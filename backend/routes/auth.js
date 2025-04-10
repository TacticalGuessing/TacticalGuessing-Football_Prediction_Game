// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET;

// Register
router.post('/register', async (req, res, next) => {
  const { name, email, password } = req.body;
  if (!email || !password || !name) return res.status(400).json({ message: 'Name, email, and password required.' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });

  try {
    const userCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) return res.status(409).json({ message: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, name, email, role',
      [name, email, passwordHash]
    );
    res.status(201).json({ message: 'User registered successfully!', user: newUser.rows[0] });
  } catch (err) { next(err); }
});

// Login
router.post('/login', async (req, res, next) => {

    console.log('--- Login Request ---'); // Added log
    console.log('Request Headers:', req.headers); // Log headers (check content-type)
    console.log('Request Body (raw):', req.body); // <<< ADD THIS LOG
    console.log('---------------------');

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

  try {
    console.log(`[Login] Attempting to query DB for email: ${email}`); // <<< ADD LOG BEFORE
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    console.log('[Login] DB query completed. Rows found:', result.rows.length); // <<< ADD LOG AFTER + row coun
    const user = result.rows[0];
    if (!user) {
      console.log(`[Login] Failed: User not found for email: ${email}`); // Log failure reason
      return res.status(401).json({ message: 'Invalid credentials.' });
  }

  console.log('[Login] User found. Comparing password...'); // Log next step  
  const isMatch = await bcrypt.compare(password, user.password_hash);
  console.log('[Login] Password comparison result:', isMatch); // Log comparison result
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials.' });

    console.log('[Login] Password matched. Generating JWT...'); // Log next step
    const payload = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamName: user.team_name, // Include teamName if needed in token
      avatarUrl: user.avatar_url // <<< ADD avatar_url FROM DB
  };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
    console.log('[Login] JWT generated successfully.'); // Log success


    res.status(200).json({
      message: 'Login successful!', token,
      user: { // Ensure this object sent to frontend matches the User interface
        userId: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamName: user.team_name, // Include teamName
        avatarUrl: user.avatar_url // <<< ADD avatar_url FROM DB
    },
    });
  } catch (err) {
    // Log the specific error encountered during the try block
    console.error(`[Login] ERROR during login process for email ${email}:`, err); // <<< ENHANCED ERROR LOG
    next(err); // Pass error to global error handler
}
});

module.exports = router;