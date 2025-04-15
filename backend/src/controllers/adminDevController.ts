// backend/src/controllers/adminDevController.ts
import { Request, Response } from 'express';
// --- TEMPORARY Placeholder for Prisma Import ---
// We will fix this path once we know where your client is initialized
import prisma from '../db.js'; // <-- This path is likely INCORRECT - we will fix it
// --- End Placeholder ---

export const handleResetGameData = async (req: Request, res: Response) => {
    console.log('Received request to reset game data...');

    // --- CRITICAL: Environment Check ---
    if (process.env.NODE_ENV !== 'development') {
        console.warn('Attempted to reset data outside development environment!');
        // Use return to stop execution
        return res.status(403).json({ message: 'Forbidden: This action is only allowed in development.' });
    }
    // --- END Environment Check ---

    try {
        console.log('Executing data reset transaction...');
        // Use Prisma transaction
        await prisma.$transaction([
            prisma.prediction.deleteMany({}),
            prisma.fixture.deleteMany({}),
            prisma.round.deleteMany({}),
            // Optional: Reset user points (excluding ADMINs)
            // prisma.user.updateMany({
            //     where: { role: { not: 'ADMIN' } },
            //     data: { points: 0 /*, other fields to reset */ }
            // })
        ]);

        console.log('Game data reset completed successfully.');
        // Use return here as well
        return res.status(200).json({ message: 'All Rounds, Fixtures, and Predictions have been deleted.' });

    } catch (error) {
        console.error('Error during game data reset:', error);
         // Use return here
        return res.status(500).json({ message: 'Internal server error during data reset.' });
    }
};