// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const crypto = require('crypto');
const sendEmail = require('../src/utils/sendEmail'); // <-- ADD (Adjust path if utils is not in src)
const asyncHandler = require('express-async-handler'); // <-- ADD

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

// Forgot Password
router.post('/forgot-password', asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
      res.status(400);
      // Use next(new Error(...)) for consistency if you have error middleware
      return next(new Error('Please provide an email address'));
  }

  console.log(`Forgot password request received for email: ${email}`);

  // 1. Find user by email using db.query
  const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = userResult.rows[0];

  // Always send generic success response
  if (!user) {
      console.log(`User not found for email ${email}, sending generic response.`);
      return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  }

  // 2. Generate Reset Token
  const resetToken = crypto.randomBytes(32).toString('hex');
  console.log(`[FORGOT PWD] Generated PLAIN TEXT token: ${resetToken}`); //<--- Remove after debugging

  // 3. Hash token before saving
  const hashedToken = await bcrypt.hash(resetToken, SALT_ROUNDS); // Use your existing SALT_ROUNDS

  // 4. Set token expiry (1 hour)
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  // 5. Update user in DB with hashed token and expiry using db.query
  try {
      await db.query(
          'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE user_id = $3',
          [hashedToken, resetExpires, user.user_id] // Make sure column names match your DB
      );
      console.log(`Reset token generated and saved for user ${user.user_id}`);
  } catch (dbError) {
      console.error(`Database error updating reset token for user ${user.user_id}:`, dbError);
      return next(new Error('Failed to generate reset token. Please try again.')); // Use next()
  }

  // 6. Create Reset URL
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
       console.error("FRONTEND_URL environment variable is not set!");
       return next(new Error('Server configuration error preventing password reset.')); // Use next()
  }
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`; // Send PLAIN token
  console.log(`Generated Reset URL (DEV ONLY): ${resetUrl}`);

  // 7. Prepare Email Content
   const message = `
      <h1>Password Reset Request</h1>
      <p>You are receiving this email because you (or someone else) requested the reset of a password for your Tactical Guessing account associated with this email address.</p>
      <p>Please click on the following link, or paste it into your browser to complete the process:</p>
      <a href="${resetUrl}" clicktracking=off>${resetUrl}</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
  `;
  const plainTextMessage = `You requested a password reset. Please go to this link (expires in 1 hour): ${resetUrl} \nIf you did not request this, ignore this email.`;


  // 8. Send Email
  try {
      await sendEmail({
          to: user.email,
          subject: 'Tactical Guessing - Password Reset Request',
          text: plainTextMessage,
          html: message
      });
      console.log(`Password reset email sent successfully to ${user.email}`);
  } catch (emailError) {
      console.error(`Failed to send password reset email to ${user.email}:`, emailError);
      // Attempt to clear token fields in DB so user can try again later
       try {
           await db.query(
               'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE user_id = $1',
               [user.user_id]
           );
       } catch (clearError) {
            console.error("Failed to clear reset token after email failure:", clearError);
       }
      return next(new Error('There was an issue sending the password reset email. Please try again later.')); // Use next()
  }

  // 9. Send Generic Success Response to Client
  res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
})); // End of asyncHandler and route definition


// Reset Password
router.post('/reset-password/:token', asyncHandler(async (req, res, next) => {
  const plainTextToken = req.params.token;
  console.log(`[RESET PWD] Received PLAIN TEXT token from URL: ${plainTextToken}`); // <-- Remove after debugging
  const { password } = req.body; // The new password

  if (!password || password.length < 6) { // Add password validation
       res.status(400);
       return next(new Error('Password is required and must be at least 6 characters long.'));
  }

  console.log(`Reset password attempt received for token (first 5 chars): ${plainTextToken.substring(0, 5)}...`);

  // 1. Hash the plain text token from the URL so we can find it in the DB
  // IMPORTANT: You CANNOT directly query the DB with the plain text token.
  // You also CANNOT simply hash it and query, because bcrypt generates a different
  // hash each time due to the salt.
  // ----> THE CORRECT APPROACH <----
  // Find users whose reset token expiry is still valid, THEN compare the hashed token.
  // This avoids needing to hash the incoming token for the initial query.

  // 2. Find potential users with an UNEXPIRED token field
  // We cannot directly query by the hashed token efficiently.
  // Find all users with a non-null, non-expired token.
  const potentialUsers = await db.query(
      'SELECT user_id, password_reset_token, password_reset_expires FROM users WHERE password_reset_expires > NOW() AND password_reset_token IS NOT NULL'
  );

  console.log(`Found ${potentialUsers.rows.length} users with potentially valid tokens.`);

  let user = null;
  // 3. Iterate through potential users and compare the hashed token
  for (const potentialUser of potentialUsers.rows) {
      if (potentialUser.password_reset_token) {
        console.log(`[RESET PWD] Comparing URL token with DB hash for user ${potentialUser.user_id}: ${potentialUser.password_reset_token}`); // <-- Remove after debugging
           const isTokenMatch = await bcrypt.compare(plainTextToken, potentialUser.password_reset_token);
           if (isTokenMatch) {
               user = potentialUser; // Found the matching user
               console.log(`Token matched for user ID: ${user.user_id}`);
               break; // Stop searching
           }
      }
  }


  // 4. Check if user found and token is valid/not expired
  // The DB query already checked expiry, and the loop checked the token match.
  if (!user) {
      console.log(`No user found with a valid, non-expired token matching the provided one.`);
      res.status(400); // Bad Request
      return next(new Error('Password reset token is invalid or has expired.'));
  }

  // 5. Hash the new password
  const newPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // 6. Update user's password and clear reset token fields
  try {
      await db.query(
          'UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE user_id = $2',
          [newPasswordHash, user.user_id]
      );
      console.log(`Password successfully reset for user ${user.user_id}`);
  } catch (dbError) {
       console.error(`Database error resetting password for user ${user.user_id}:`, dbError);
       return next(new Error('Failed to update password. Please try again.'));
  }

  // 7. Send success response
  // Optionally: Send an email confirming password change
  res.status(200).json({ message: 'Password has been reset successfully.' });
})); // End of asyncHandler and route definition


module.exports = router;