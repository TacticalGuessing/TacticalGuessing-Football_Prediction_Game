import type { Metadata } from "next";
// Import directly from the specific Geist font package paths
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import "./globals.css";
import AppProviders from "@/providers/AppProviders";

// NO function calls needed here - the imports provide objects with properties

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
        <AppProviders>
           {/* Ensure your globals.css or tailwind config uses these variables */}
           {/* e.g., font-family: var(--font-geist-sans); */}
           <main className="antialiased">
              {children}
           </main>
        </AppProviders>
      </body>
    </html>
  );
}