// frontend/src/app/layout.tsx
import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans'; // Correct import for Geist Sans
// import { GeistMono } from 'geist/font/mono'; // Keep commented if you decide not to use it globally
import AppProviders from "@/providers/AppProviders"; // Your context providers wrapper
import { Toaster } from 'react-hot-toast'; // Keep Toaster import
import "./globals.css";

export const metadata: Metadata = {
  title: "Tactical Guessing - Football Prediction Game", // Slightly more descriptive title
  description: "Predict football scores and compete with friends!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply Geist Sans font variable class to the <html> tag.
    // Remove Geist Mono if not used globally.
    <html lang="en" className={GeistSans.variable}>

      {/* Apply base dark theme background and default text color to the <body> tag */}
      {/* 'antialiased' improves font rendering */}
      <body className="bg-gray-900 text-gray-200 antialiased">

        {/* Render the Toaster component for notifications */}
        <Toaster
           position="top-center"
           reverseOrder={false}
           // You might customize toastOptions later based on your theme
        />

        {/* Wrap children with AppProviders (which includes AuthProvider) */}
        <AppProviders>
           {/*
             The main content structure (like adding Header/Footer or centering content)
             should typically happen in more specific layout files (e.g., /app/(authenticated)/layout.tsx)
             or directly within page components if no nested layout exists.
             The <main> tag here is okay, but often redundant if child layouts/pages also use <main>.
             We ensure the base styles are on <body>.
           */}
           {children}
        </AppProviders>

      </body>
    </html>
  );
}