// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss';
import formsPlugin from '@tailwindcss/forms';

const config: Config = {
  content: [ /* ... */ ],
  darkMode: 'class',
  theme: {
    extend: {
      // --- CSS Variable Definition ---
      // Define the variable for use like bg-[--color-forest]
      colors: {
         // Define the variable itself linked to the color value
         'forest-var': 'var(--color-forest)', // Name for using with variable
         // Keep the named color utility definition too
         'forest': {
             DEFAULT: '#228B22',
             '600': '#228B22',
         },
         'accent': {
             DEFAULT: '#EAB308', // Tailwind's yellow-500
                      '500': '#EAB308',   // Define specific shade
              // Add other shades like 400, 600 if needed for hover/focus later
                      '600': '#CA8A04', // yellow-600 for hover?
},
         'success': { /* ... */ },
         'danger': { /* ... */ },
         'warning': {
             DEFAULT: '#EAB308', // Use new accent (yellow-500)
                      '500': '#EAB308',
 }
      },
      fontFamily: { /* ... */ },
    },
  },
  plugins: [ formsPlugin ],
   // Add corePlugins section to ensure variables are processed? (Check v4 docs)
   // corePlugins: {
   //   preflight: true, // Ensure preflight runs
   // },
};
// Define the actual CSS variable value OUTSIDE the config object usually?
// No, Tailwind should handle injecting this based on theme config in v4.
// Let's rely on the theme.extend.colors definition.

export default config;