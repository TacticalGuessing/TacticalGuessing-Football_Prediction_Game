// frontend/src/app/layout.tsx
import type { Metadata } from "next";
// Import directly from the specific Geist font package paths
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import AppProviders from "@/providers/AppProviders"; // Assuming this wraps AuthProvider or similar
import { Toaster } from 'react-hot-toast'; // <<< Make sure this import is present

// Font variables are applied directly in the HTML tag className

export const metadata: Metadata = {
  title: "Football Prediction Game",
  description: "Predict football scores and compete!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply the CSS variable classes directly from the imported font objects
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        {/* === ADD TOASTER HERE === */}
        <Toaster
           position="top-center" // You can adjust position: 'top-right', 'bottom-center', etc.
           reverseOrder={false}  // Keep default order
           // You can add more customization options if needed later:
           // toastOptions={{
           //   duration: 5000, // Default duration
           //   style: { // Default styles
           //      background: '#363636',
           //      color: '#fff',
           //   },
           // }}
        />
        {/* ======================= */}

        {/* Assuming AppProviders includes your AuthProvider and potentially other context providers */}
        <AppProviders>
           {/* Ensure your globals.css or tailwind config uses these variables */}
           {/* e.g., font-family: var(--font-geist-sans); */}
           {/* Using <main> here is fine, or you could have another div */}
           <main className="antialiased">
              {children}
           </main>
        </AppProviders>
      </body>
    </html>
  );
}