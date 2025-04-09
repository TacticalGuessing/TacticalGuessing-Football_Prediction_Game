// backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define the path for avatar storage relative to this file's directory
const avatarStoragePath = path.join(__dirname, '..', 'uploads', 'avatars');
console.log(`[Upload Middleware] Expected avatar storage path: ${avatarStoragePath}`);

// --- Ensure the directory exists ---
// This check runs when the module is loaded (i.e., when the server starts)
try {
    if (!fs.existsSync(avatarStoragePath)) {
        fs.mkdirSync(avatarStoragePath, { recursive: true });
        console.log(`[Upload Middleware] Created directory: ${avatarStoragePath}`);
    } else {
        // Optional: Log if it already exists, helps confirm path resolution
        // console.log(`[Upload Middleware] Directory already exists: ${avatarStoragePath}`);
    }
} catch (err) {
    console.error(`[Upload Middleware] Error ensuring directory ${avatarStoragePath} exists:`, err);
    // Depending on severity, you might want to throw error or exit process
}
// ---------------------------------

// --- Configure Disk Storage ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Check if the directory exists *again* just before saving? Usually not needed,
        // but can be a failsafe if the dir was somehow deleted after server start.
        // if (!fs.existsSync(avatarStoragePath)) { ... handle error ... }
        cb(null, avatarStoragePath); // Tell multer to save files here
    },
    filename: function (req, file, cb) {
        // Generate a unique filename to prevent overwrites
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Add randomness
        const extension = path.extname(file.originalname); // Get file extension (e.g., '.jpg')
        const newFilename = `avatar-${req.user.userId}-${uniqueSuffix}${extension}`; // Include user ID for easier tracking
        console.log(`[Upload Middleware] Generating filename: ${newFilename}`);
        cb(null, newFilename);
    }
});
// -------------------------------

// --- File Filter (Optional but Recommended) ---
const fileFilter = (req, file, cb) => {
    // Accept common image formats only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype); // Check MIME type
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); // Check file extension

    if (mimetype && extname) {
        return cb(null, true); // Accept file
    } else {
        console.warn(`[Upload Middleware] Rejected file upload for user ${req.user?.userId}: Invalid type - ${file.originalname} (MIME: ${file.mimetype})`);
        // Pass an error to multer
        cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP images are allowed.'), false);
    }
};
// -------------------------------------------

// --- Create Multer Instance ---
const uploadAvatar = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB file size limit (adjust as needed)
    },
    fileFilter: fileFilter
 });
// -----------------------------

// Export the configured middleware for single 'avatar' field upload
module.exports = { uploadAvatar }; // Exporting as an object for potential future additions