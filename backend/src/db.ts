// backend/src/db.ts
import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client once
const prisma = new PrismaClient({
     // Optional: Add logging configuration if desired
     // log: ['query', 'info', 'warn', 'error'],
});

// Export the single instance
export default prisma;