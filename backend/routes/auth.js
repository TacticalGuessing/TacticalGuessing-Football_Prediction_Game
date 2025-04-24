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

// Register using Prisma Client - MODIFIED for Email Verification
router.post('/register', asyncHandler(async (req, res, next) => { // Use asyncHandler
    const { name, email, password } = req.body;

    // --- Input Validation ---
    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Name, email, and password are required.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
         res.status(400);
         throw new Error('Please provide a valid email address.');
    }

    // --- Password Strength Check ---
    // This is a basic example. Consider a stronger library like zxcvbn
    const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
    if (!passwordRegex.test(password)) {
        res.status(400);
        throw new Error('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one symbol.');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
    });

    if (existingUser) {
        res.status(409); // Conflict
        throw new Error('Email already registered.');
    }
    // --- End Basic Checks ---

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate Verification Token (before DB write)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    console.log(`[REGISTER] New user registration request. Email: ${email.toLowerCase()}, Name: ${name}. Generated (plaintext) token: ${verificationToken.substring(0,5)}...`);

    let newUser = null;
    try {
         // Create user using Prisma Client
        newUser = await prisma.user.create({
            data: {
                name: name,
                email: email.toLowerCase(),
                passwordHash: passwordHash, // Hash stored, not plain text

                // Set New Verification & Subscription Fields
                emailVerified: false, // Default, as user needs to verify first
                emailVerificationToken: verificationToken,
                subscriptionTier: 'FREE'   // All new accounts start with Free tier
            },
             select: { // Select fields for login or success response
                 userId: true, name: true, email: true, role: true, emailVerified: true
             }
        });
    } catch (dbError) {
         console.error(`[REGISTER] Database error during user creation:`, dbError);
         // Handle specific errors
         if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
             res.status(409);
             throw new Error("That email is already in use. Please use a different email.");
         }
         // Fallback for other database errors
         throw new Error("Could not register user due to a database issue."); // Generic error
    }

    // Check if createUser worked
    if (newUser) {
        try {
            // Construct Verification URL
            const frontendUrl = process.env.FRONTEND_URL; // Get base URL
            if (!frontendUrl) {
                console.error("[REGISTER] Server configuration error: FRONTEND_URL missing!");
                throw new Error("Server configuration error preventing password reset."); // Abort if this essential env var is missing
            }
             const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`; // Token now sent in query param
             console.log(`Generated verification link (DEV ONLY): ${verificationUrl}`);

            // Prepare Email Content (Use a dynamic HTML template for cleaner code)
            const message = `
                <h1>Welcome to Tactical Guessing!</h1>
                <p>Hello ${newUser.name},</p>
                <p>Please verify your email address by clicking the link below to activate your account:</p>
                <p><a href="${verificationUrl}" target="_blank">Verify Email Address</a></p>
                <p>If you did not create this account, please ignore this email.</p>
            `;

            // Send Email
            console.log(`Attempting to send verification email to ${newUser.email}...`);
            await sendEmail({
                to: newUser.email,
                subject: 'Tactical Guessing - Verify Your Email',
                html: message // Use the createMessageHTML template
            });
            console.log(`Verification email sent successfully to ${newUser.email}`);

        } catch (emailError) {
            console.error(`Failed to send verification email to ${newUser.email}:`, emailError);
            // OPTIONAL: If email sending fails, should we delete the partially created user, or just log the failure?
            console.warn(`Attempting to clear verification token in DB due to email failure...`);
            try {
                 // This best-effort attempt does not justify failing the main process if *this* fails.
                 await prisma.user.update({ where: { userId: newUser.userId }, data: { emailVerificationToken: null } });
                 console.log('Successfully cleared verification token after email failure. User can try again.');
            } catch (clearError) {
                console.error("Failed to clear verification token after email failure:", clearError); // Keep logging in case something goes wrong
             }
           
            res.status(500); // Indicate email sending issue
            throw new Error('There was an issue sending the verification email. Please try again later.');

        } // Finally (to send response), moved outside to handle async logic more clearly

        // --- SUCCESS Response: Email Sent, Awaiting Verification ---
        console.log(`User registered successfully: ${newUser.email} (ID: ${newUser.userId}). Awaiting email verification.`);
        res.status(201).json({
            success: true, // Inform frontend to show a success message
            message: 'Registration successful! Please check your email to verify your account.',
            // Don't send tokens or user data yet, await verification
            // token: token,
            // user: newUser
        });
        // --- End Success Response ---

    } else {
        // Should not happen if validation is tight
        res.status(500); // Indicate server error
        throw new Error('Unexpected error during user creation. Please try again.');
    }
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

    // --- >>> ADD Email Verification Check <<< ---
    if (!user.emailVerified) {
        console.log(`[Login] Failed: Email not verified for user ${user.userId} (${user.email})`);
        res.status(403); // Forbidden or 401 Unauthorized are possibilities
        // Send a specific error message the frontend can check for
        throw new Error('EMAIL_NOT_VERIFIED'); // Use a specific code/message
        // Or: throw new Error('Please verify your email address before logging in.');
    }
    // --- >>> END Email Verification Check <<< ---

    // Generate JWT (Only if password matches AND email verified)
    console.log('[Login] Password matched & email verified. Generating JWT...');
    if (!JWT_SECRET) { throw new Error("Server configuration error: JWT_SECRET missing."); }
    const tokenPayload = {
        userId: user.userId,
        role: user.role
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

    // 7. Prepare Email Content
    const message = `
        <h1>Tactical Guessing - Password Reset</h1>
        <p>Hello ${user.name},</p>
        <p>You requested a password reset. Please click the link below to set a new password:</p>
        <p><a href="${resetUrl}" target="_blank">Reset Your Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <hr>
        <p><small>Link if button doesn't work: ${resetUrl}</small></p>
    `; // Example HTML content

    const plainTextMessage = `
        Hello ${user.name},

        You requested a password reset for Tactical Guessing.
        Please use the following link to set a new password (link expires in 1 hour):
        ${resetUrl}

        If you did not request this, please ignore this email.
    `; // Example Plain Text content

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

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', asyncHandler(async (req, res) => { // Use asyncHandler
    const { token } = req.params; // Get token from URL parameter

    console.log(`[VERIFY EMAIL] Received verification request with token (first 5): ${token?.substring(0, 5)}...`);

    if (!token) {
        res.status(400);
        throw new Error('Verification token is missing.');
    }

    // 1. Find the user by the verification token using Prisma
    const user = await prisma.user.findUnique({
        where: { emailVerificationToken: token },
        // Select fields needed for checks or response (optional)
        select: { userId: true, emailVerified: true }
    });

    // 2. Check if user exists and is not already verified
    if (!user) {
        console.log(`[VERIFY EMAIL] Token not found or invalid.`);
        res.status(400); // Bad Request
        // Don't reveal *why* it failed (token not found vs expired vs already used)
        throw new Error('Verification link is invalid or has expired.');
    }

    if (user.emailVerified) {
        console.log(`[VERIFY EMAIL] Email for user ${user.userId} is already verified.`);
        // Optional: Redirect to login with a message indicating already verified
        // For API consistency, sending JSON success is fine.
        return res.status(200).json({ success: true, message: 'Email already verified. Please log in.' });
    }

    // 3. Update the user: Mark as verified and clear the token
    try {
        await prisma.user.update({
            where: { userId: user.userId },
            data: {
                emailVerified: true,
                emailVerificationToken: null, // Clear the token after successful verification
                // Optional: Change role if you used a temporary one like 'UNVERIFIED'
                // role: 'PLAYER'
            }
        });

        console.log(`[VERIFY EMAIL] Email successfully verified for user ${user.userId}`);

        // 4. Respond with success JSON (Frontend page will handle display and link)
         res.status(200).json({ success: true, message: 'Email successfully verified! You can now log in.' });

        // --- Alternative: Redirect to frontend page ---
        // const frontendUrl = process.env.FRONTEND_URL;
        // if (frontendUrl) {
        //     res.redirect(`${frontendUrl}/login?verified=true`); // Redirect to login page
        // } else {
        //     // Fallback if FRONTEND_URL is not set
        //     res.status(200).json({ success: true, message: 'Email successfully verified! Please proceed to login.' });
        // }
        // --- End Alternative ---

    } catch (dbError) {
        console.error(`[VERIFY EMAIL] Database error during verification update for user ${user.userId}:`, dbError);
        // Use next(error) if you want the global handler, or throw for asyncHandler
        throw new Error('Failed to update verification status due to a server error.');
    }
}));
// --- >>> END NEW ROUTE HANDLER <<< ---

// --- >>> ADD RESEND VERIFICATION ROUTE <<< ---
// POST /api/auth/resend-verification
router.post('/resend-verification', asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Email is required.');
    }
    const lowerCaseEmail = email.toLowerCase();
    console.log(`[RESEND VERIFY] Request received for email: ${lowerCaseEmail}`);

    // 1. Find user by email
    const user = await prisma.user.findUnique({
        where: { email: lowerCaseEmail },
        select: { userId: true, emailVerified: true, name: true } // Select needed fields
    });

    // 2. Check if user exists and needs verification
    if (!user) {
        console.log(`[RESEND VERIFY] User not found for email ${lowerCaseEmail}. Sending generic response.`);
        // Return generic success even if user not found for security
        return res.status(200).json({ message: 'If an account with that email exists and requires verification, a new email has been sent.' });
    }

    if (user.emailVerified) {
        console.log(`[RESEND VERIFY] Email for user ${user.userId} is already verified. No email sent.`);
        // Return generic success even if already verified
        return res.status(200).json({ message: 'If an account with that email exists and requires verification, a new email has been sent.' });
    }

    // 3. Generate a NEW verification token
    const newVerificationToken = crypto.randomBytes(32).toString('hex');
    console.log(`[RESEND VERIFY] Generated NEW token for user ${user.userId}: ${newVerificationToken.substring(0,5)}...`);

    try {
        // 4. Update user with the new token
        await prisma.user.update({
            where: { userId: user.userId },
            data: { emailVerificationToken: newVerificationToken }
        });
        console.log(`[RESEND VERIFY] Updated verification token for user ${user.userId}.`);

        // 5. Send the new verification email
        const frontendUrl = process.env.FRONTEND_URL;
        if (!frontendUrl) { throw new Error("Server configuration error: FRONTEND_URL missing."); }
        const verificationUrl = `${frontendUrl}/verify-email?token=${newVerificationToken}`;
        console.log(`[RESEND VERIFY] Generated new verification link (DEV ONLY): ${verificationUrl}`);

        const message = `
            <h1>Tactical Guessing - Resend Verification</h1>
            <p>Hello ${user.name},</p>
            <p>You requested another verification email. Please click the link below to activate your account:</p>
            <p><a href="${verificationUrl}" target="_blank">Verify Email Address</a></p>
            <p>If you did not request this, please ignore this email.</p>
        `;

        await sendEmail({
            to: lowerCaseEmail,
            subject: 'Tactical Guessing - Verify Your Email (Resend)',
            html: message
        });
        console.log(`[RESEND VERIFY] Successfully resent verification email to ${lowerCaseEmail}.`);

        // 6. Send generic success response
        res.status(200).json({ message: 'If an account with that email exists and requires verification, a new email has been sent.' });

    } catch (error) {
        console.error(`[RESEND VERIFY] Error processing resend request for ${lowerCaseEmail}:`, error);
        // Don't reveal specific errors, let global handler manage internal errors
        throw new Error('Failed to process request. Please try again later.');
    }
}));
// --- >>> END RESEND VERIFICATION ROUTE <<< ---

module.exports = router;