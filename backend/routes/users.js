// backend/routes/users.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { protect } = require('../middleware/authMiddleware'); // Only need 'protect'
const { uploadAvatar } = require('../middleware/uploadMiddleware'); // <<< ADD THIS
const asyncHandler = require('express-async-handler');

const prisma = new PrismaClient();
const router = express.Router();

// --- Add Cloudinary Configuration ---
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    // secure: true // Optional: defaults to true, ensures https URLs
});
// ------------------------------------

// Function to upload buffer stream to Cloudinary
const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: 'fp_avatars' }, // Optional: organize uploads in Cloudinary
            (error, result) => {
                if (error) {
                    console.error("Cloudinary Upload Error:", error);
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        // Pipe the buffer into the upload stream
        uploadStream.end(buffer);
    });
};

// Apply 'protect' middleware to all routes in this file
router.use(protect);

// --- User Profile Routes ---

/**
 * @route   POST /api/users/profile/team-name
 * @desc    Set or update the logged-in user's team name
 * @access  Private (Protected)
 */
router.post('/profile/team-name', async (req, res, next) => {
    const userId = req.user.userId;
    const { teamName } = req.body; // Expecting { teamName: "New Team Name" }

    console.log(`[${new Date().toISOString()}] User ${userId} attempting to set team name to: "${teamName}"`);

    // Validation
    if (typeof teamName !== 'string') {
         return res.status(400).json({ message: 'Team name must be a string.' });
    }
    const trimmedTeamName = teamName.trim();
    if (trimmedTeamName.length === 0) {
         // Allow setting empty string to REMOVE team name? Yes.
         // Or require non-empty? Let's allow empty for now.
         // Adjust validation if non-empty is required:
         // if (trimmedTeamName.length === 0 || trimmedTeamName.length > 50) { // Example length limit
         //    return res.status(400).json({ message: 'Team name must be between 1 and 50 characters.' });
         // }
         console.log(`[${new Date().toISOString()}] User ${userId} setting team name to empty.`);
    } else if (trimmedTeamName.length > 50) { // Example max length
         return res.status(400).json({ message: 'Team name cannot exceed 50 characters.' });
    }
    // Optional: Add profanity filter or other validation here

    try {
        const updatedUser = await prisma.user.update({
            where: { userId: userId }, // Use model field name
            data: {
                teamName: trimmedTeamName === '' ? null : trimmedTeamName // Store null if empty, otherwise trimmed name
            },
            select: { // Return only relevant fields
                userId: true,
                name: true,
                teamName: true,
                email: true,
                role: true,
                avatarUrl: true
            }
        });

        console.log(`[${new Date().toISOString()}] User ${userId} successfully updated team name.`);
        res.status(200).json(updatedUser); // Return updated user info (camelCase)

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error setting team name for User ${userId}:`, error);
         // Handle potential errors like user not found (though 'protect' should prevent)
        if (error.code === 'P2025') { // Record not found
            return res.status(404).json({ message: 'User not found.' });
        }
        next(error);
    }
});


/**
 * @route   POST /api/users/profile/avatar
 * @desc    Upload or update the logged-in user's avatar image
 * @access  Private (Protected)
 */
// --- NEW VERSION (Using Cloudinary) ---
router.post(
    '/profile/avatar',
    protect, // Ensure user is logged in
    uploadAvatar.single('avatar'), // Use Multer middleware (now using memoryStorage)
    asyncHandler(async (req, res) => {
        if (!req.file) {
            res.status(400);
            throw new Error('Please upload an image file.');
        }
        if (!req.file.buffer) {
             res.status(500);
             throw new Error('File buffer is missing after upload.');
        }

        const userId = req.user.userId;

        try {
            console.log(`[Avatar Upload] User ${userId}: Uploading image to Cloudinary...`);
            // --- Cloudinary Upload ---
            const cloudinaryResult = await uploadToCloudinary(req.file.buffer);

            if (!cloudinaryResult || !cloudinaryResult.secure_url) {
                 res.status(500);
                 throw new Error('Cloudinary upload failed, no secure URL returned.');
            }

            const newAvatarUrl = cloudinaryResult.secure_url; // Get the HTTPS URL
            console.log(`[Avatar Upload] User ${userId}: Cloudinary upload successful. URL: ${newAvatarUrl}`);
            // --- End Cloudinary Upload ---

            // --- Remove Old File Deletion Logic ---
            // No longer needed as we don't store local paths or files.
            // Cloudinary can be configured to overwrite files with the same public_id
            // or manage versions, but simple replacement is fine for now.
            // ------------------------------------

            // --- Update Database ---
            const updatedUser = await prisma.user.update({
                where: { userId: userId },
                data: { avatarUrl: newAvatarUrl }, // Store the FULL Cloudinary URL
                select: { // Select fields needed by frontend Auth context / profile page
                    userId: true,
                    email: true,
                    teamName: true,
                    avatarUrl: true, // Get the updated URL back
                    // Include roles or other fields if needed by the frontend context
                },
            });
            console.log(`[Avatar Upload] User ${userId}: Database updated successfully.`);
            // --- End Update Database ---

            // --- Send Response ---
            // Map DB field to API field (snake_case to camelCase for frontend)
            res.status(200).json({
                 userId: updatedUser.userId,
                 email: updatedUser.email,
                 teamName: updatedUser.teamName,
                 avatarUrl: updatedUser.avatarUrl // API uses camelCase
            });
            // --- End Send Response ---

        } catch (error) {
            console.error(`[Avatar Upload] Error during avatar upload for user ${userId}:`, error);
            // Don't throw the raw error, send a generic message
            // Ensure express-async-handler or your global error handler catches this
             res.status(500);
             throw new Error('Failed to upload avatar. Please try again.');
             // Or if not using asyncHandler:
             // res.status(500).json({ message: 'Failed to upload avatar. Please try again.' });
        }
    })
);


module.exports = router;