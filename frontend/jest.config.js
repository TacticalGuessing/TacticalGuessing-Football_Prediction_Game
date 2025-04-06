// frontend/jest.config.js
import nextJest from 'next/jest.js' // Use .js extension for ES Module import

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  // Add more setup options before each test is run
  // if you created `jest.setup.js` add it here:
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Use jsdom environment for simulating browser environment
  testEnvironment: 'jest-environment-jsdom',

  // Handle module aliases (edit based on your `tsconfig.json` paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Add other aliases here if you use them
  },

  // Optional: Prevent reporting individual test results
  // verbose: false,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
// Export an async function directly
export default createJestConfig(customJestConfig)