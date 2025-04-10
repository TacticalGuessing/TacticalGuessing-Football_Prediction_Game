// backend/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path'); // Still needed for fileFilter extension check

// --- Removed local storage path and directory creation ---
// const avatarStoragePath = path.join(__dirname, '..', 'uploads', 'avatars');
// console.log(`[Upload Middleware] Expected avatar storage path: ${avatarStoragePath}`);
// try { ... fs operations ... } catch (err) { ... }
// -------------------------------------------------------

// --- Configure Memory Storage ---
// Instead of saving to disk, keep the file data in memory as a buffer.
// This buffer will be available at req.file.buffer in the route handler.
const storage = multer.memoryStorage();
console.log(`[Upload Middleware] Configured to use memoryStorage.`);
// -------------------------------

// --- File Filter (Unchanged - Still Recommended) ---
const fileFilter = (req, file, cb) => {
    // Accept common image formats only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = allowedTypes.test(file.mimetype); // Check MIME type
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase()); // Check file extension

    if (mimetype && extname) {
        return cb(null, true); // Accept file
    } else {
        // Log the rejection reason
        console.warn(`[Upload Middleware] Rejected file upload for user ${req.user?.userId}: Invalid type - ${file.originalname} (MIME: ${file.mimetype})`);
        // Provide a user-friendly error message via the callback
        cb(new Error('Invalid file type. Only JPG, PNG, GIF, WEBP images are allowed.'), false);
    }
};
// -------------------------------------------

// --- Create Multer Instance ---
const uploadAvatar = multer({
    storage: storage, // Use memoryStorage instead of diskStorage
    limits: {
        fileSize: 1024 * 1024 * 5 // 5MB file size limit (adjust as needed)
    },
    fileFilter: fileFilter
 });
// -----------------------------

// Export the configured middleware for single 'avatar' field upload
module.exports = { uploadAvatar }; // Exporting as an object for potential future additions