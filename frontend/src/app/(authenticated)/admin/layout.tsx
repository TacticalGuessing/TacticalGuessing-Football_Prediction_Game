// frontend/src/app/admin/layout.tsx
'use client';

import React, { useState } from 'react';
import AdminSidebar from '@/components/Admin/AdminSidebar'; // Adjust path if needed
import CreateRoundModal from '@/components/Admin/CreateRoundModal';
import { useRouter } from 'next/navigation';
// Potentially import your main Header if it should also be present on admin pages
// import Header from '@/components/layout/Header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  // State for Create Round Modal visibility
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Functions to control the modal
  const openCreateModal = () => setIsCreateModalOpen(true);
  const closeCreateModal = () => setIsCreateModalOpen(false);

  // Callback after creation (simplified - just close for now)
  // Ideally this would trigger a refresh of the rounds list on the page
  const handleRoundCreated = () => {
      console.log("Round created! Need to refresh list.");
      router.refresh();
      // For now, just close modal. Refresh needs more state management/router events.
      // Example: router.refresh(); // If using Next.js App Router refresh
  };


  return (
    <div className="flex min-h-screen bg-gray-900"> {/* Added dark bg */}

      {/* Pass the function to open the modal down to the sidebar */}
      <AdminSidebar onOpenCreateRoundModal={openCreateModal} />

      {/* Main content area */}
      <main className="flex-1 p-4 sm:ml-64 pt-2">
        {children}
      </main>

      {/* Render the modal conditionally */}
      <CreateRoundModal
          isOpen={isCreateModalOpen}
          onClose={closeCreateModal}
          onRoundCreated={() => {
              handleRoundCreated(); // Call the refresh handler
              closeCreateModal(); // Ensure it closes
          }}
      />
    </div>
  );
}