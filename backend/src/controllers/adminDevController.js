// backend/src/controllers/adminDevController.js
// Note: Changed from .ts to .js and using require/module.exports

const prisma = require('../db.ts').default; // <-- FIX THIS PATH to your actual Prisma client file (e.g., ../db.js)

console.log('Prisma instance in adminDevController:', prisma);

const handleResetGameData = async (req, res) => { // Removed Request, Response types
    console.log('Received request to reset game data...');

    // CRITICAL: Environment Check
    if (process.env.NODE_ENV !== 'development') {
        console.warn('Attempted to reset data outside development environment!');
        return res.status(403).json({ message: 'Forbidden: This action is only allowed in development.' });
    }

    try {
        console.log('Executing data reset transaction...');
        await prisma.$transaction([
            prisma.prediction.deleteMany({}),
            prisma.fixture.deleteMany({}),
            prisma.round.deleteMany({}),
        ]);

        console.log('Game data reset completed successfully.');
        return res.status(200).json({ message: 'All Rounds, Fixtures, and Predictions have been deleted.' });

    } catch (error) {
        console.error('Error during game data reset:', error);
        return res.status(500).json({ message: 'Internal server error during data reset.' });
    }
};

// Export the function
module.exports = {
    handleResetGameData,
};