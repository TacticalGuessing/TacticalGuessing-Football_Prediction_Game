// frontend/src/app/(authenticated)/admin/layout.tsx
'use client'; // Keep 'use client' if needed for other layout logic, but not for modal state

import React from 'react'; // No longer need useState
import AdminSidebar from '@/components/Admin/AdminSidebar'; // Path is likely correct now
// No longer need CreateRoundModal import here
// No longer need useRouter here unless used for other layout purposes

// Potentially import your main Header if it should also be present on admin pages
// import Header from '@/components/layout/Header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- State for Create Round Modal is REMOVED ---
  // const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // --- Functions to control the modal are REMOVED ---
  // const openCreateModal = () => setIsCreateModalOpen(true);
  // const closeCreateModal = () => setIsCreateModalOpen(false);

  // --- Callback after creation is REMOVED ---
  // const handleRoundCreated = () => { /* ... */ };


  return (
    // Ensure container allows sidebar and main content
    // Assuming your global layout or header handles top padding (e.g., pt-16)
    <div className="flex min-h-screen"> {/* Removed bg-gray-900 if set globally */}

      {/* Render sidebar WITHOUT the prop */}
      <AdminSidebar />

      {/* Main content area */}
      {/* Adjust ml-64 based on actual sidebar width */}
      {/* Added overflow-y-auto for scrolling content */}
      <main className="flex-1 sm:ml-64 overflow-y-auto">
        {/* Render the page content passed as children */}
        {children}
      </main>

      {/* Render the modal conditionally - REMOVED */}
      {/* The modal is now rendered within admin/page.tsx */}
      {/* <CreateRoundModal ... /> */}

    </div>
  );
}