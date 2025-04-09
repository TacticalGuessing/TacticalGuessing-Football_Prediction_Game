/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Or whatever your existing config is
  images: {
    remotePatterns: [
      {
        protocol: 'http', // Use 'http' for local dev
        hostname: 'localhost', // The hostname serving the images
        port: '5000', // The port serving the images (if not 80/443)
        pathname: '/uploads/avatars/**', // Pattern for allowed image paths
      },
      // Add other patterns here if you use Cloudinary, S3, etc. in production
      // Example for Cloudinary:
      // {
      //   protocol: 'https',
      //   hostname: 'res.cloudinary.com',
      //   port: '',
      //   pathname: '/your_cloud_name/image/upload/**',
      // },
    ],
  },
  // ... any other configurations you have
};

module.exports = nextConfig;
