// backend/middleware/authenticateToken.js
const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    // Get token from Authorization header: "Bearer TOKEN_STRING"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Get the token part

    if (token == null) {
        // No token provided
        return res.status(401).json({ message: 'Authentication token required.' });
    }

    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET, (err, userPayload) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            // Token might be expired or invalid
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }

        // Token is valid, attach the decoded payload (which should include userId, email, name, role) to the request object
        req.user = userPayload; // Make user info available to subsequent handlers
        console.log('Authenticated user:', req.user.email, 'UserId:', req.user.userId); // Log authenticated user
        next(); // Proceed to the next middleware or route handler
    });
};

module.exports = authenticateToken;