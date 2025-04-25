// backend/scripts/resetDevDataAndCreateUsers.js

const { PrismaClient, Prisma } = require('@prisma/client'); // Import Prisma for error types if needed
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const SALT_ROUNDS = 10; // Standard salt rounds for bcrypt

async function main() {
    console.log('🚀 Starting data reset and test user creation...');
    console.warn('⚠️ WARNING: This will delete all gameplay data (Rounds, Fixtures, Predictions, Leagues, Memberships, Friendships, News) and unverified users.');

    // --- DELETION PHASE (in transaction) ---
    console.log('\n🔄 Starting deletion phase (within transaction)...');
    try {
        await prisma.$transaction(async (tx) => {
            console.log('   Deleting Predictions...');
            await tx.prediction.deleteMany({});
            console.log('   Deleting League Memberships...');
            await tx.leagueMembership.deleteMany({});
            console.log('   Deleting Friendships...');
            await tx.friendship.deleteMany({});
            console.log('   Deleting News Items...');
            await tx.newsItem.deleteMany({});
            console.log('   Deleting Fixtures...');
            await tx.fixture.deleteMany({});
            console.log('   Deleting Rounds...');
            await tx.round.deleteMany({});
            console.log('   Deleting Leagues...');
            await tx.league.deleteMany({});
            console.log('   ✅ Gameplay data deleted.');

            console.log('   Deleting unverified users...');
            const deleteResult = await tx.user.deleteMany({
                where: { emailVerified: false },
            });
            console.log(`   ✅ Deleted ${deleteResult.count} unverified users.`);

        }, {
            maxWait: 10000, // Optional: adjust timeouts if needed
            timeout: 20000,
        });
        console.log('✅ Deletion transaction successful.');

    } catch (error) {
        console.error('❌ Error during deletion transaction:', error);
        console.error('❌ Halting script execution due to deletion error.');
        throw error; // Stop execution if deletion fails
    }

    // --- USER CREATION PHASE ---
    console.log('\n➕ Starting user creation phase...');
    try {
        console.log('   Ensuring test users exist...');
        const testPassword = 'password123'; // Use a standard, memorable test password
        const hashedPassword = await bcrypt.hash(testPassword, SALT_ROUNDS);

        // Use upsert: Creates if not found, updates if found (based on unique email)
        // Ensures verified test accounts have the correct state even if they already existed.
        const user1 = await prisma.user.upsert({
            where: { email: 'testuser1@example.com' },
            update: { // What to update if user exists
                name: 'Test User One',
                teamName: 'Testers FC',
                role: 'PLAYER',
                
                emailVerified: true // Ensure verified
            },
            create: { // What to create if user doesn't exist
                email: 'testuser1@example.com',
                name: 'Test User One',
                passwordHash: hashedPassword,
                role: 'PLAYER',
                emailVerified: true,
                
                teamName: 'Testers FC'
            },
        });

        const user2 = await prisma.user.upsert({
             where: { email: 'testuser2@example.com' },
             update: {
                 name: 'Test User Two',
                 teamName: 'Mockingbirds',
                 role: 'PLAYER',
                 
                 emailVerified: true
            },
             create: {
                email: 'testuser2@example.com',
                name: 'Test User Two',
                passwordHash: hashedPassword,
                role: 'PLAYER',
                emailVerified: true,
                
                teamName: 'Mockingbirds'
            },
        });

        const adminUser = await prisma.user.upsert({
            where: { email: 'admin@example.com' },
            update: {
                name: 'Admin User',
                teamName: 'Admins United',
                role: 'ADMIN',
                
                emailVerified: true
            },
             create: {
                email: 'admin@example.com',
                name: 'Admin User',
                passwordHash: hashedPassword,
                role: 'ADMIN',
                emailVerified: true,
                
                teamName: 'Admins United'
            },
        });
        console.log(`   ✅ Test users ensured/created:`);
        console.log(`      - ${user1.email} (ID: ${user1.userId}, Role: ${user1.role})`);
        console.log(`      - ${user2.email} (ID: ${user2.userId}, Role: ${user2.role})`);
        console.log(`      - ${adminUser.email} (ID: ${adminUser.userId}, Role: ${adminUser.role})`);
        console.log(`   🔑 Password for all test users: ${testPassword}`);

        console.log('✅ User creation phase successful.');

    } catch (error) {
        console.error('❌ Error during user creation phase:', error);
    }

    console.log('\n✅ Script finished.');
}

main()
    .catch((e) => {
        console.error("❌ Unhandled error in main execution:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('🔌 Prisma client disconnected.');
    });