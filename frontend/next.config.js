// frontend/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Or whatever your existing config is

  images: {
    remotePatterns: [
      // You might keep this if you still serve default avatars locally during dev
      // but it's not needed for Cloudinary avatars. Consider removing if unused.
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5000',
        pathname: '/uploads/avatars/**',
      },

      // --- Add/Uncomment this pattern for Cloudinary ---
      {
        protocol: 'https',                 // Cloudinary uses HTTPS
        hostname: 'res.cloudinary.com',    // Cloudinary's image delivery hostname
        // Optional port (usually not needed)
        // Optional pathname (more specific, replace YOUR_CLOUD_NAME if used)
        // pathname: '/ds2gm0hmz/image/upload/**', // Example with your cloud name
      },
      // -------------------------------------------------

      // Add other patterns here if needed in the future (e.g., S3)

    ],
    // domains: [], // Keep using remotePatterns
  },
  // ... any other configurations you have
};

module.exports = nextConfig;