// frontend/src/app/(authenticated)/profile/layout.tsx
'use client'; // Needed if layout itself needs hooks, maybe not strictly necessary here but safe

import React from 'react';
import ProfileSidebar from '@/components/Profile/ProfileSidebar'; // Import the new sidebar

// Potentially import Header if it's not in the root layout
// import Header from '@/components/layout/Header';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarWidth = 'sm:ml-60'; // Match the w-60 in ProfileSidebar
  const paddingTop = 'pt-16'; // Match the pt-16 in ProfileSidebar (adjust based on Header height)

  return (
    <div className="flex min-h-screen bg-gray-900"> {/* Ensure consistent bg */}
      {/* Optional: Render Header here if not in RootLayout */}
      {/* <Header /> */}

      <ProfileSidebar />

      {/* Main content area for profile pages */}
      {/* Apply margin-left matching sidebar width and padding-top matching header height */}
      <main className={`flex-1 p-4 ${sidebarWidth} ${paddingTop}`}>
        {children} {/* This will be profile/page.tsx or profile/settings/page.tsx */}
      </main>
    </div>
  );
}