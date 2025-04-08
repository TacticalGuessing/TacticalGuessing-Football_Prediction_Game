// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db'); // Make sure path is correct

// Import Routers
const authRoutes = require('./routes/auth');
const roundRoutes = require('./routes/rounds');
const predictionRoutes = require('./routes/predictions');
const fixturesRoutes = require('./routes/fixtures'); // <--- Add this line: Import fixtures router
const standingsRoutes = require('./routes/standings');
const fixtureRoutes = require('./routes/fixtures'); // Adjust path if needed
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors()); // Allow frontend requests
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.get('/api/health', (req, res) => res.status(200).json({ status: 'API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/fixtures', fixturesRoutes); // <--- Add this line: Mount fixtures router
app.use('/api/standings', standingsRoutes);
app.use('/api/fixtures', fixtureRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);

// Basic Database Connection Test Route (Optional - can remove if DB connects on start)
app.get('/api/db-test', async (req, res, next) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.status(200).json({ message: 'Database connection successful', time: result.rows[0].now });
    } catch (err) {
        console.error('Database connection test failed:', err);
        next(err); // Pass error to error handling middleware
    }
});


// Central Error Handling Middleware (Place after all routes)
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack || err); // Log the full error stack
    // Avoid sending detailed stack trace to client in production
    const statusCode = err.status || err.statusCode || 500; // Use specific status if available
    const message = process.env.NODE_ENV === 'production' ? 'Something went wrong!' : (err.message || 'Internal Server Error');

    res.status(statusCode).json({
        message: message,
        // Optionally add error code or type in development
        ...(process.env.NODE_ENV !== 'production' && { errorType: err.name, errorCode: err.code })
     });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
    // Optional: Verify DB connection on startup using the pool's event listener (already in db.js)
    // or by making a simple query here. The pool.on('connect') in db.js is usually sufficient.
});