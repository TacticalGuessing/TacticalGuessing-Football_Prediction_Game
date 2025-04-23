// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../src/db.ts').default; // Import Prisma Client
const crypto = require('crypto');
const sendEmail = require('../src/utils/sendEmail'); // Adjust path if needed
const asyncHandler = require('express-async-handler'); // Keep for consistency

const router = express.Router();
const SALT_ROUNDS = 10; // Keep your salt rounds
const JWT_SECRET = process.env.JWT_SECRET;

// Register using Prisma Client
router.post('/register', asyncHandler(async (req, res, next) => { // Use asyncHandler
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Name, email, and password are required.');
    }
    if (password.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters.');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });

    if (existingUser) {
        res.status(409); // Conflict
        throw new Error('Email already registered.');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user using Prisma Client
    const newUser = await prisma.user.create({
        data: {
            name: name,
            email: email.toLowerCase(), // Store lowercase
            passwordHash: passwordHash,
            // role defaults to PLAYER, other fields default to null/handled by DB/Prisma
        },
        select: { // Select fields for response/token
            userId: true,
            name: true,
            email: true,
            role: true,
            teamName: true,
            avatarUrl: true,
        }
    });

    // Generate JWT Token
    if (!JWT_SECRET) { throw new Error("Server configuration error: JWT_SECRET missing."); }
    const tokenPayload = { userId: newUser.userId, role: newUser.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });

    console.log(`User registered successfully: ${newUser.email} (ID: ${newUser.userId})`);
    res.status(201).json({
        message: 'User registered successfully!',
        token: token,
        user: newUser
    });
}));

// Login using Prisma Client
router.post('/login', asyncHandler(async (req, res, next) => { // Use asyncHandler
    console.log('--- Login Request ---');
    console.log('Request Body:', req.body);
    console.log('---------------------');

    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400);
        throw new Error('Email and password required.');
    }

    // Find user by email
    console.log(`[Login] Attempting Prisma findUnique for email: ${email.toLowerCase()}`);
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });
    console.log('[Login] Prisma query completed. User found:', !!user);

    if (!user) {
        console.log(`[Login] Failed: User not found for email: ${email.toLowerCase()}`);
        res.status(401); // Unauthorized
        throw new Error('Invalid credentials.');
    }

    // Compare password
    console.log('[Login] User found. Comparing password...');
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    console.log('[Login] Password comparison result:', isMatch);

    if (!isMatch) {
        console.log(`[Login] Failed: Password mismatch for email: ${email.toLowerCase()}`);
        res.status(401); // Unauthorized
        throw new Error('Invalid credentials.');
    }

    // Generate JWT
    console.log('[Login] Password matched. Generating JWT...');
    if (!JWT_SECRET) { throw new Error("Server configuration error: JWT_SECRET missing."); }
    const tokenPayload = {
        userId: user.userId,
        role: user.role
        // Add other non-sensitive fields if needed in token, but keep it minimal
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
    console.log('[Login] JWT generated successfully.');

    // Send response
    res.status(200).json({
        message: 'Login successful!',
        token: token,
        user: { // Send necessary user info (excluding hash)
            userId: user.userId,
            name: user.name,
            email: user.email, // Return consistent case
            role: user.role,
            teamName: user.teamName,
            avatarUrl: user.avatarUrl,
        },
    });
}));

// Forgot Password using Prisma Client
router.post('/forgot-password', asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email address');
    }
    console.log(`Forgot password request received for email: ${email}`);

    // 1. Find user by email using Prisma
    const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });

    // Always send generic success response even if user not found
    if (!user) {
        console.log(`User not found for email ${email}, sending generic response.`);
        return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // 2. Generate Plain Text Reset Token
    const resetToken = crypto.randomBytes(32).toString('hex');
    console.log(`[FORGOT PWD] Generated PLAIN TEXT token: ${resetToken}`);

    // 3. Hash token before saving
    const hashedToken = await bcrypt.hash(resetToken, SALT_ROUNDS);

    // 4. Set token expiry (1 hour)
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // 5. Update user in DB with hashed token and expiry using Prisma
    await prisma.user.update({
        where: { userId: user.userId },
        data: {
            passwordResetToken: hashedToken,
            passwordResetExpires: resetExpires,
        }
    });
    console.log(`Reset token generated and saved for user ${user.userId}`);

    // 6. Create Reset URL (using plain text token)
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) { throw new Error('Server configuration error preventing password reset.'); }
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`; // Send PLAIN token
    console.log(`Generated Reset URL (DEV ONLY): ${resetUrl}`);

    // 7. Prepare Email Content (Keep your existing content)
    const message = `...`; // Your HTML email content using resetUrl
    const plainTextMessage = `...`; // Your Plain Text email content using resetUrl

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
        // Attempt to clear token fields in DB so user can try again later (best effort)
        try {
            await prisma.user.update({
                where: { userId: user.userId },
                data: { passwordResetToken: null, passwordResetExpires: null }
            });
        } catch (clearError) {
            console.error("Failed to clear reset token after email failure:", clearError);
        }
        // Throw error to be caught by asyncHandler -> central error handler
        throw new Error('There was an issue sending the password reset email. Please try again later.');
    }

    // 9. Send Generic Success Response to Client
    res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
}));

// Reset Password using Prisma Client
router.post('/reset-password/:token', asyncHandler(async (req, res, next) => {
    const plainTextToken = req.params.token;
    const { password } = req.body;

    if (!password || password.length < 6) {
        res.status(400);
        throw new Error('Password is required and must be at least 6 characters long.');
    }
    console.log(`Reset password attempt received for token (first 5 chars): ${plainTextToken.substring(0, 5)}...`);

    // 1. Find users with a potentially valid token (non-null, not expired)
    const potentialUsers = await prisma.user.findMany({
        where: {
            passwordResetToken: { not: null },
            passwordResetExpires: { gt: new Date() } // Check if expiry is greater than now
        },
        select: { // Select only needed fields
            userId: true,
            passwordResetToken: true
        }
    });
    console.log(`Found ${potentialUsers.length} users with potentially valid tokens.`);

    // 2. Iterate and compare the plain text token with the stored hash
    let user = null;
    for (const potentialUser of potentialUsers) {
        if (potentialUser.passwordResetToken) {
             // Compare plain token from URL with hashed token from DB
            const isTokenMatch = await bcrypt.compare(plainTextToken, potentialUser.passwordResetToken);
            if (isTokenMatch) {
                user = { userId: potentialUser.userId }; // Store only the ID, we found our match
                console.log(`Token matched for user ID: ${user.userId}`);
                break; // Exit loop
            }
        }
    }

    // 3. Check if a matching user was found
    if (!user) {
        console.log(`No user found with a valid, non-expired token matching the provided one.`);
        res.status(400); // Bad Request
        throw new Error('Password reset token is invalid or has expired.');
    }

    // 4. Hash the new password
    const newPasswordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 5. Update user's password and clear reset token fields using Prisma
    await prisma.user.update({
        where: { userId: user.userId },
        data: {
            passwordHash: newPasswordHash,
            passwordResetToken: null, // Clear token
            passwordResetExpires: null // Clear expiry
        }
    });
    console.log(`Password successfully reset for user ${user.userId}`);

    // 6. Send success response
    res.status(200).json({ message: 'Password has been reset successfully.' });
}));

module.exports = router;