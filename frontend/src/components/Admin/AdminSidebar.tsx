// frontend/src/components/Admin/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaTools, FaUsers, FaListOl, FaSearch, FaNewspaper, FaPalette } from 'react-icons/fa'; // Ensure FaPlus is imported
import React from 'react';
import { clsx } from 'clsx';

import { IoFileTrayStackedOutline } from 'react-icons/io5';

// NavLink interface for the navigation items
interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// Define the navigation links
const adminLinks: NavLink[] = [
  { href: '/admin', label: 'Manage Rounds', icon: <FaListOl /> },
  { href: '/admin/users', label: 'Manage Users', icon: <FaUsers /> },
  { href: '/admin/news', label: 'Post News', icon: <FaNewspaper />},
  { href: '/admin/prediction-status', label: 'Prediction Status', icon: < IoFileTrayStackedOutline /> },
  { href: '/admin/audit', label: 'Prediction Audit', icon: <FaSearch /> },
  { href: '/admin/dev', label: 'Dev Tools', icon: <FaTools /> },
  { href: '/admin/ui-sandbox', label: 'UI Sandbox', icon: < FaPalette /> },
];

// Make the component accept the props
export default function AdminSidebar(/* Removed props: { onOpenCreateRoundModal } */) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-800 dark:bg-gray-800 border-r border-gray-700 dark:border-gray-700 pt-16 transition-transform -translate-x-full sm:translate-x-0">
      {/* Adjust pt-16 based on Header height */}
      {/* Use flex-col to position button above nav */}
      <div className="h-full px-3 py-4 overflow-y-auto flex flex-col">

        

        

        {/* Navigation Links - Use flex-grow so nav takes remaining space */}
        <nav aria-label="Admin Navigation" className="flex-grow">
          <ul className="space-y-2 font-medium">
            {adminLinks.map((link) => {
              const isActive = link.href === '/admin' // Handle base admin route potentially differently if needed
                ? pathname === link.href
                : pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={clsx(
                      'flex items-center p-2  group transition-colors',
                      'text-gray-300 dark:text-gray-300',
                      'hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-white dark:hover:text-white',
                      { 'bg-gray-700 dark:bg-gray-700 font-semibold text-white dark:text-white': isActive }
                    )}
                  >
                    <span
                      className={clsx(
                        'text-xl text-gray-400 dark:text-gray-400 group-hover:text-gray-300 dark:group-hover:text-gray-300 transition duration-75',
                        { 'text-gray-200 dark:text-gray-200': isActive }
                      )}
                    >
                      {link.icon}
                    </span>
                    <span className="ml-3">{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}