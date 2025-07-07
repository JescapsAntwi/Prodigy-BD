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

// Auth middleware
const protect = async (req, res, next) => {
    try {
      let token;
      
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }
      
      if (!token) {
        return res.status(401).json({ 
          success: false,
          message: 'Not authorized to access this route' 
        });
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      req.user = await User.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized, token failed' 
      });
    }
  };
  
  // Role-based authorization middleware
  const authorize = (...roles) => {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
          success: false,
          message: `User role ${req.user.role} is not authorized to access this route` 
        });
      }
      next();
    };
  };

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

// Protect all user routes
// app.use('/api/users', protect);

// / Example of protected route with role-based access
// app.get('/api/users', authorize('admin'), async (req, res) => {
//   // Your existing get all users code
// });

// Other routes...


// Routes

// Create one or multiple users
// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, age } = req.body;
  
      // Check if user exists
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({
          success: false,
          message: 'User already exists'
        });
      }
  
      // Create user
      user = await User.create({
        name,
        email,
        password,
        age,
        role: email === 'admin@example.com' ? 'admin' : 'user' // For demo, first user is admin
      });
  
      // Create token
      const token = user.generateAuthToken();
  
      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ 
        success: false,
        message: 'Server error' 
      });
    }
  });
  
  // @desc    Login user
  // @route   POST /api/auth/login
  // @access  Public
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
  
      // Check if user exists
      const user = await User.findOne({ email }).select('+password');
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
  
      // Check password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
  
      // Create token
      const token = user.generateAuthToken();
  
      res.status(200).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ 
        success: false,
        message: 'Server error' 
      });
    }
  });

// Get all users
// Example of a protected route
app.get('/api/users/me', protect, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ 
        success: false,
        message: 'Server error' 
      });
    }
  });
  
  // Example of admin-only route
  app.get('/api/admin/users', protect, authorize('admin'), async (req, res) => {
    try {
      const users = await User.find().select('-password');
      res.status(200).json({
        success: true,
        count: users.length,
        data: users
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ 
        success: false,
        message: 'Server error' 
      });
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