// tailwind.config.ts
const config = {
  // ... other config
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'sans-serif'], // Use the variable
        mono: ['var(--font-geist-mono)', 'monospace'], // Use the variable
      },
    },
  },
  plugins: [],
};
export default config;