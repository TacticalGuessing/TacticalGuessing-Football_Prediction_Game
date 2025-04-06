// backend/jest.config.js
module.exports = {
    testEnvironment: 'node', // Use Node environment for backend tests
    clearMocks: true,        // Automatically clear mock calls between tests
    // You might add testMatch patterns if your tests aren't found automatically
    // testMatch: ['**/__tests__/**/*.test.js?(x)', '**/__tests__/**/*.spec.js?(x)'],
  };