// frontend/src/components/Profile/ProfileSidebar.tsx
'use client'; // Required for usePathname

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaUser, FaCog, FaHistory, FaChartBar } from 'react-icons/fa';
import { clsx } from 'clsx';
import React from 'react';

// Define link structure
interface ProfileNavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

// Define profile navigation links
const profileLinks: ProfileNavLink[] = [
    { href: '/profile', label: 'View Profile', icon: <FaUser /> },
    { href: '/profile/settings', label: 'Settings', icon: <FaCog /> },
    { href: '/profile/predictions', label: 'My Predictions', icon: < FaHistory />}, // Placeholder link, disabled
    { href: '/profile/settings/statistics', label: 'Statistics', icon: < FaChartBar /> }, 
  ];

export default function ProfileSidebar() {
  const pathname = usePathname();

  return (
    // Sidebar container - Similar style to AdminSidebar but maybe slightly different bg/border if desired
    // Using fixed width (e.g., w-56 or w-64)
    <aside className="fixed left-0 top-0 z-40 h-screen w-60 bg-gray-800 dark:bg-gray-800 border-r border-gray-700 dark:border-gray-700 pt-16 transition-transform -translate-x-full sm:translate-x-0">
      {/* Adjust pt-16 based on Header height */}
      {/* Adjust w-60 if you want a different width than admin */}
      <div className="h-full px-3 py-4 overflow-y-auto">
        <nav aria-label="Profile Navigation">
          <ul className="space-y-2 font-medium">
            {profileLinks.map((link) => {
              // Use exact match for '/profile', startsWith for '/profile/settings' etc.
              const isActive = link.href === '/profile'
                                 ? pathname === link.href
                                 : pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={clsx(
                      'flex items-center p-2 rounded-lg group transition-colors',
                      'text-gray-300 dark:text-gray-300',
                      'hover:bg-gray-700 dark:hover:bg-gray-700 hover:text-white dark:hover:text-white',
                      { // Active state styling
                        'bg-gray-700 dark:bg-gray-700 font-semibold text-white dark:text-white': isActive,
                      }
                    )}
                  >
                    <span className={clsx(
                        'text-xl text-gray-400 dark:text-gray-400 group-hover:text-gray-300 transition duration-75',
                        { 'text-gray-200 dark:text-gray-200': isActive } // Icon color active state
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