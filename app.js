require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/user_management', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// User Model
// In app.js, update the userSchema:
const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false // Don't return password in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [1, 'Age must be at least 1'],
      max: [120, 'Age must be less than or equal to 120']
    }
  }, {
    timestamps: true
  });
  
  // Hash password before saving
  userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
  });
  
  // Method to compare password
  userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
  };
  
  // Method to generate JWT token
  userSchema.methods.generateAuthToken = function() {
    return jwt.sign(
      { id: this._id, role: this.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
  };

const User = mongoose.model('User', userSchema);

// Validation middleware
const validateUserData = (userData) => {
  const errors = [];
  
  if (!userData.name) {
    errors.push({
      type: 'field',
      msg: 'Name is required',
      path: 'name',
      location: 'body'
    });
  }
  
  if (!userData.email) {
    errors.push({
      type: 'field',
      msg: 'Email is required',
      path: 'email',
      location: 'body'
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.push({
      type: 'field',
      msg: 'Please enter a valid email',
      path: 'email',
      location: 'body'
    });
  }
  
  if (userData.age === undefined || userData.age === null) {
    errors.push({
      type: 'field',
      msg: 'Age is required',
      path: 'age',
      location: 'body'
    });
  } else if (typeof userData.age !== 'number' || userData.age < 1 || userData.age > 120) {
    errors.push({
      type: 'field',
      msg: 'Age must be between 1 and 120',
      path: 'age',
      location: 'body'
    });
  }
  
  return errors;
};

// Routes

// Create one or multiple users
app.post('/api/users', async (req, res) => {
  try {
    if (Array.isArray(req.body)) {
      // Bulk create users
      const results = [];
      const errors = [];
      
      for (let i = 0; i < req.body.length; i++) {
        const userData = req.body[i];
        const validationErrors = validateUserData(userData);
        
        if (validationErrors.length > 0) {
          errors.push({
            index: i,
            errors: validationErrors
          });
          continue;
        }
        
        try {
          const user = new User(userData);
          await user.save();
          results.push(user);
        } catch (error) {
          if (error.code === 11000) { // Duplicate key error
            errors.push({
              index: i,
              errors: [{
                type: 'field',
                value: userData.email,
                msg: 'Email already exists',
                path: 'email',
                location: 'body'
              }]
            });
          } else {
            errors.push({
              index: i,
              errors: [{
                type: 'error',
                msg: error.message
              }]
            });
          }
        }
      }
      
      if (errors.length > 0) {
        return res.status(207).json({
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
      
      try {
        const user = new User(req.body);
        await user.save();
        return res.status(201).json(user);
      } catch (error) {
        if (error.code === 11000) {
          return res.status(400).json({
            errors: [{
              type: 'field',
              value: req.body.email,
              msg: 'Email already exists',
              path: 'email',
              location: 'body'
            }]
          });
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error creating user(s):', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid user ID format' 
      });
    }
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a user
app.put('/api/users/:id', async (req, res) => {
  try {
    const updates = {};
    const { name, email, age } = req.body;
    
    // Build update object with only provided fields
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (age !== undefined) updates.age = age;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid user ID format' 
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        errors: [{
          type: 'field',
          value: req.body.email,
          msg: 'Email already in use by another user',
          path: 'email',
          location: 'body'
        }]
      });
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        type: 'field',
        msg: err.message,
        path: err.path,
        location: 'body'
      }));
      return res.status(400).json({ errors });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ 
        error: 'Invalid user ID format' 
      });
    }
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

// Connect to MongoDB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});