// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
// import { GeistMono } from 'geist/font/mono';
import AppProviders from "@/providers/AppProviders";
import { Toaster } from 'react-hot-toast';
import "./globals.css";

// --- Updated Metadata ---
export const metadata: Metadata = {
  // Define a template and default title
  title: {
    template: '%s | Tactical Guessing', // Allows pages to set their part, e.g., "Login | Tactical Guessing"
    default: 'Tactical Guessing - Football Prediction Game', // Fallback title
  },
  // More descriptive text with relevant keywords
  description: 'Join Tactical Guessing, the engaging football prediction game. Create private leagues, challenge friends, predict match outcomes, and climb the leaderboards!',
  // Add basic Open Graph meta tags for better social sharing previews
  openGraph: {
    title: 'Tactical Guessing - Football Prediction Game',
    description: 'Engaging football prediction game with private leagues and scoring.',
    // url: 'https://tacticalguessing.com', // TODO: Replace with your actual production URL
    siteName: 'Tactical Guessing',
    // images: [ // TODO: Add a default preview image for sharing
    //   {
    //     url: 'https://tacticalguessing.com/og-default.png', // Example URL
    //     width: 1200,
    //     height: 630,
    //   },
    // ],
    type: 'website',
  },
   // Optional: Add basic Twitter card data (often uses Open Graph tags as fallback)
   // twitter: {
   //   card: 'summary_large_image',
   //   title: 'Tactical Guessing - Football Prediction Game', // Can often omit if same as og:title
   //   description: 'Engaging football prediction game...', // Can often omit if same as og:description
   //   images: ['https://tacticalguessing.com/og-default.png'], // Example URL
   // },
   // Note: Favicons placed in the /app directory (favicon.ico, apple-touch-icon.png etc.) are often picked up automatically.
   // You can also define them here if needed:
   // icons: {
   //   icon: '/favicon.ico',
   //   apple: '/apple-touch-icon.png',
   // }
};
// --- End Updated Metadata ---

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body className="bg-gray-900 text-gray-200 antialiased">
        <Toaster
           position="top-center"
           reverseOrder={false}
        />
        <AppProviders>
           {children}
        </AppProviders>
      </body>
    </html>
  );
}