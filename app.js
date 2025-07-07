// Import required modules
require('dotenv').config();
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('./config/database');
const cors = require('cors');
const user = require('./models/user')

// Initialize express app
const app = express();

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(cors()); // Enable CORS for all routes

// In-memory storage for users (using a JavaScript object as a hashmap)
const users = {};

// Validation middleware for creating/updating a user
const validateUser = [
    body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
    body('email').isEmail().withMessage('Please enter a valid email'),
    body('age').isInt({ min: 1, max: 120 }).withMessage('Age must be between 1 and 120'),
    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        next();
    }
];

// Helper function to validate UUID
const isValidUUID = (id) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
};

// Routes

// Validation middleware for user data
const validateUserData = (userData, isBulk = false) => {
    const errors = [];
    
    if (!userData.name) {
        errors.push({
            type: 'field',
            msg: 'Name is required',
            path: isBulk ? `[].name` : 'name',
            location: 'body'
        });
    }
    
    if (!userData.email) {
        errors.push({
            type: 'field',
            msg: 'Email is required',
            path: isBulk ? `[].email` : 'email',
            location: 'body'
        });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        errors.push({
            type: 'field',
            msg: 'Please enter a valid email',
            path: isBulk ? `[].email` : 'email',
            location: 'body'
        });
    }
    
    if (userData.age === undefined || userData.age === null) {
        errors.push({
            type: 'field',
            msg: 'Age is required',
            path: isBulk ? `[].age` : 'age',
            location: 'body'
        });
    } else if (typeof userData.age !== 'number' || userData.age < 1 || userData.age > 120) {
        errors.push({
            type: 'field',
            msg: 'Age must be between 1 and 120',
            path: isBulk ? `[].age` : 'age',
            location: 'body'
        });
    }
    
    return errors;
};

// Create one or multiple users
app.post('/api/users', (req, res) => {
    try {
        // Check if request body is an array (bulk create) or object (single create)
        if (Array.isArray(req.body)) {
            // Bulk create users
            const results = [];
            const errors = [];
            
            req.body.forEach((userData, index) => {
                // Validate user data
                const validationErrors = validateUserData(userData, true);
                
                if (validationErrors.length > 0) {
                    // Format errors to include index for bulk operations
                    errors.push(...validationErrors.map(err => ({
                        ...err,
                        path: err.path.replace('[]', `[${index}]`)
                    })));
                    return;
                }
                
                const { name, email, age } = userData;
                
                // Check if email already exists
                const existingUser = Object.values(users).find(user => user.email === email);
                if (existingUser) {
                    errors.push({
                        type: 'field',
                        value: email,
                        msg: 'Email already exists',
                        path: `[${index}].email`,
                        location: 'body'
                    });
                    return;
                }
                
                // Create and save new user
                const id = uuidv4();
                const newUser = { id, name, email, age };
                users[id] = newUser;
                results.push(newUser);
            });
            
            if (errors.length > 0) {
                // If there were any errors in bulk create
                return res.status(400).json({
                    message: 'Some users were not created',
                    created: results,
                    errors: errors
                });
            }
            
            return res.status(201).json({
                message: 'All users created successfully',
                users: results
            });
            
        } else {
            // Single user creation
            const validationErrors = validateUserData(req.body);
            
            if (validationErrors.length > 0) {
                return res.status(400).json({ errors: validationErrors });
            }
            
            const { name, email, age } = req.body;
            
            // Check if email already exists
            const existingUser = Object.values(users).find(user => user.email === email);
            if (existingUser) {
                return res.status(400).json({
                    errors: [{
                        type: 'field',
                        value: email,
                        msg: 'Email already exists',
                        path: 'email',
                        location: 'body'
                    }]
                });
            }
            
            // Create new user with generated UUID
            const id = uuidv4();
            const newUser = { id, name, email, age };
            users[id] = newUser;
            
            // Return the created user with 201 status code
            return res.status(201).json(newUser);
        }
    } catch (error) {
        console.error('Error creating user(s):', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all users
app.get('/api/users', (req, res) => {
    try {
        // Convert users object to array and return
        res.json(Object.values(users));
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a single user by ID
app.get('/api/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate UUID format
        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        const user = users[id];
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update a user
app.put('/api/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, age } = req.body;
        
        // Validate UUID format
        if (!isValidUUID(id)) {
            return res.status(400).json({ 
                errors: [{
                    type: 'param',
                    msg: 'Invalid user ID format',
                    path: 'id',
                    location: 'params'
                }]
            });
        }
        
        // Check if user exists
        const user = users[id];
        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }
        
        // Validate input data
        const validationErrors = validateUserData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({ errors: validationErrors });
        }
        
        // Check if email is being changed to an existing email (excluding current user)
        if (email && email !== user.email) {
            const emailInUse = Object.values(users).some(
                u => u.email === email && u.id !== id
            );
            
            if (emailInUse) {
                return res.status(400).json({
                    errors: [{
                        type: 'field',
                        value: email,
                        msg: 'Email already in use by another user',
                        path: 'email',
                        location: 'body'
                    }]
                });
            }
        }
        
        // Update user with new data (only provided fields)
        const updatedUser = {
            ...user,
            name: name || user.name,
            email: email || user.email,
            age: age !== undefined ? age : user.age
        };
        
        users[id] = updatedUser;
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a user
app.delete('/api/users/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate UUID format
        if (!isValidUUID(id)) {
            return res.status(400).json({ error: 'Invalid user ID format' });
        }
        
        // Check if user exists
        if (!users[id]) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Delete user
        delete users[id];
        
        res.status(204).send(); // No content response for successful deletion
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
