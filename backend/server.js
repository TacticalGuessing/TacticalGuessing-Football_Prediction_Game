// backend/server.js
require('dotenv').config(); // Ensure this is at the very top
const express = require('express');
const cors = require('cors');
const path = require('path'); // <<< CORRECT way to import the path module
// NOTE: You don't seem to be using the 'db' import directly in server.js,
// but routers use it, so it's fine.
// const db = require('./db');

// Import Routers
const authRoutes = require('./routes/auth');
const roundRoutes = require('./routes/rounds');
const predictionRoutes = require('./routes/predictions');
const standingsRoutes = require('./routes/standings');
// const fixtureRoutes = require('./routes/fixtures'); // You imported fixturesRoutes twice with different names
const fixturesRoutes = require('./routes/fixtures'); // Use one consistent name
const adminRoutes = require('./routes/admin');
const usersRoutes = require('./routes/users');

const app = express();
// Read port from environment AFTER dotenv has loaded
const PORT = process.env.PORT || 5001; // Render provides PORT, 5001 is local fallback

// --- Middleware ---

// ** Replace basic cors() with specific configuration **
const allowedOrigins = [
    'http://localhost:3000', // Your local frontend
    // <<< Add your planned Vercel URL below >>>
    // Example: Using 'tactical-guessing' in the URL
    'https://tactical-guessing.vercel.app'
    // Add any other origins if needed (e.g., specific preview URLs)
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin OR origins in the list
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS Error: Origin ${origin} not allowed.`);
            callback(new Error(`Origin ${origin} not allowed by CORS`)); // Provide specific error
        }
    },
    credentials: true // Allow cookies/auth headers if needed by frontend
}));

// Parse JSON request bodies AFTER CORS
app.use(express.json());

// --- Static File Serving (Keep as is, harmless for now) ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log(`[Server] Serving static files from ${path.join(__dirname, 'uploads')} at /uploads`);
// ---------------------------

// --- API Routes ---
app.get('/api/health', (req, res) => res.status(200).json({ status: 'API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/fixtures', fixturesRoutes); // Use consistent variable name
app.use('/api/standings', standingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);

// --- Remove Optional DB Test Route (usually not needed) ---
// app.get('/api/db-test', async (req, res, next) => { ... });

// --- Central Error Handling Middleware (Keep as is) ---
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack || err);
    const statusCode = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' ? 'Something went wrong!' : (err.message || 'Internal Server Error');

    res.status(statusCode).json({
        message: message,
        ...(process.env.NODE_ENV !== 'production' && { errorType: err.name, errorCode: err.code })
     });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});