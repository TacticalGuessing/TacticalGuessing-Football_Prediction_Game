// backend/routes/users.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { protect } = require('../middleware/authMiddleware'); // Only need 'protect'
const { uploadAvatar } = require('../middleware/uploadMiddleware'); // <<< ADD THIS
const fs = require('fs'); // <<< ADD THIS
const path = require('path'); // <<< ADD THIS
const multer = require('multer');

const prisma = new PrismaClient();
const router = express.Router();

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
router.post(
    '/profile/avatar',
    (req, res, next) => { // Add intermediate handler for logging/debugging multer errors if needed
        uploadAvatar.single('avatar')(req, res, (err) => {
            if (err instanceof multer.MulterError) {
                // A Multer error occurred when uploading (e.g., file size limit)
                console.error(`[Multer Error] User ${req.user?.userId}:`, err.message);
                return res.status(400).json({ message: `Upload Error: ${err.message}` });
            } else if (err) {
                // An unknown error occurred (e.g., our custom fileFilter error)
                console.error(`[File Filter Error] User ${req.user?.userId}:`, err.message);
                 // Handle the specific file type error message from our filter
                 if (err.message.startsWith('Invalid file type')) {
                    return res.status(400).json({ message: err.message });
                 }
                return res.status(500).json({ message: 'An unexpected error occurred during file upload.' });
            }
            // If no errors, proceed to the main route handler
            console.log(`[Upload Middleware] File processed successfully for user ${req.user?.userId}`);
            next();
        });
    },
    async (req, res, next) => {
        const userId = req.user.userId;

        // 1. Check if a file was uploaded
        if (!req.file) {
            console.warn(`[Avatar Upload] User ${userId}: No file uploaded.`);
            return res.status(400).json({ message: 'No file uploaded. Please select an image.' });
        }

        console.log(`[Avatar Upload] User ${userId}: Received file - ${req.file.filename}`);

        // 2. Construct the URL path for the new avatar
        // We store the relative path, assuming the frontend knows the base URL
        const newAvatarPath = `/uploads/avatars/${req.file.filename}`;
        console.log(`[Avatar Upload] User ${userId}: New avatar path - ${newAvatarPath}`);


        try {
            // --- Optional: Delete Old Avatar ---
            const user = await prisma.user.findUnique({
                where: { userId: userId },
                select: { avatarUrl: true } // Only fetch the old URL
            });

            if (user?.avatarUrl) {
                // Check if the old URL points to a local upload
                if (user.avatarUrl.startsWith('/uploads/avatars/')) {
                    const oldFilename = path.basename(user.avatarUrl); // Get filename from path
                    const oldFilePath = path.join(__dirname, '..', 'uploads', 'avatars', oldFilename);
                    console.log(`[Avatar Upload] User ${userId}: Attempting to delete old avatar: ${oldFilePath}`);

                    // Check if file exists before attempting delete
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlink(oldFilePath, (err) => {
                            if (err) {
                                // Log error but don't stop the update process
                                console.error(`[Avatar Upload] User ${userId}: Failed to delete old avatar ${oldFilePath}:`, err);
                            } else {
                                console.log(`[Avatar Upload] User ${userId}: Successfully deleted old avatar: ${oldFilePath}`);
                            }
                        });
                    } else {
                         console.warn(`[Avatar Upload] User ${userId}: Old avatar file not found, skipping deletion: ${oldFilePath}`);
                    }
                } else {
                     console.log(`[Avatar Upload] User ${userId}: Old avatar URL is not a local upload, skipping deletion: ${user.avatarUrl}`);
                }
            }
            // ---------------------------------

            // 3. Update user record in the database
            const updatedUser = await prisma.user.update({
                where: { userId: userId },
                data: {
                    avatarUrl: newAvatarPath // Store the relative path
                },
                select: { // Return updated user info (adjust as needed by frontend)
                    userId: true,
                    name: true,
                    email: true,
                    role: true,
                    teamName: true,
                    avatarUrl: true // Include the new avatar URL
                }
            });

            console.log(`[Avatar Upload] User ${userId}: Successfully updated avatar URL in DB.`);
            // 4. Return success response with updated user data
            res.status(200).json(updatedUser);

        } catch (error) {
            console.error(`[Avatar Upload] User ${userId}: Error updating avatar in DB:`, error);
            // Cleanup: If DB update fails, attempt to delete the newly uploaded file
            const uploadedFilePath = path.join(__dirname, '..', 'uploads', 'avatars', req.file.filename);
            if (fs.existsSync(uploadedFilePath)) {
                fs.unlink(uploadedFilePath, (delErr) => {
                    if(delErr) console.error(`[Avatar Upload Cleanup] User ${userId}: Failed to delete orphaned file ${uploadedFilePath}:`, delErr);
                    else console.log(`[Avatar Upload Cleanup] User ${userId}: Deleted orphaned file ${uploadedFilePath} after DB error.`);
                });
            }

             if (error.code === 'P2025') { // Record not found (unlikely due to 'protect', but good practice)
                return res.status(404).json({ message: 'User not found.' });
            }
            next(error); // Pass to global error handler
        }
    }
);


module.exports = router;