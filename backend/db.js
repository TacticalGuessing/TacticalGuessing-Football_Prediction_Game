// backend/db.js
const { Pool } = require('pg');
// dotenv should be configured in the main entry point (server.js) before this file is required.
// require('dotenv').config(); // Usually not needed here if done in server.js

// --- Configuration prioritizes DATABASE_URL ---
const poolConfig = {
    // Use connection string from environment variable if available
    connectionString: process.env.DATABASE_URL,

    // --- Explicit SSL Configuration ---
    // Assume SSL is REQUIRED if DATABASE_URL is set (typical for cloud DBs like Render)
    // Use rejectUnauthorized: false for default certs common in cloud providers' free tiers.
    ssl: process.env.DATABASE_URL
         ? { rejectUnauthorized: false } // Enable SSL for cloud connections
         : undefined,                   // Disable SSL if DATABASE_URL is missing (assume local non-SSL)
    // --- End SSL Configuration ---

    // Fallback to individual variables ONLY if connectionString is NOT provided
    // (Less likely to be used when DATABASE_URL is correctly set in the environment)
    user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
    host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
    database: process.env.DATABASE_URL ? undefined : process.env.DB_DATABASE,
    password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
    port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432', 10),

    // Optional: Add pool configuration settings if needed
    // max: 20,
    // idleTimeoutMillis: 30000,
    // connectionTimeoutMillis: 2000,
};

// Log the effective connection target (mask password for security)
const logTarget = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@\/]+)@/, ':<password>@')
    : `${poolConfig.host || 'localhost'}:${poolConfig.port || 5432}/${poolConfig.database || 'default_db'}`; // Add fallbacks for logging
console.log(`[db.js] Attempting to connect pool to: ${logTarget}`);
// Log the SSL configuration being used
console.log(`[db.js] SSL Configuration:`, poolConfig.ssl);

// Create the pool instance
const pool = new Pool(poolConfig);

// Event listener for successful client connection within the pool
pool.on('connect', (client) => {
    const params = client.connectionParameters;
    console.log(`[db.js] Pool client connected to ${params.host}:${params.port}/${params.database}`);
    // client.on('error', err => console.error('[db.js] Error on connected client:', err)); // Optional: Log errors on specific clients
});

// Event listener for errors occurring on idle clients in the pool
pool.on('error', (err, client) => {
    console.error('[db.js] Unexpected error on idle client in pool:', err);
    // Consider more robust monitoring/alerting in production
});

// Export the query function and potentially the pool itself
module.exports = {
    /**
     * Executes a SQL query using a client from the pool.
     * @param {string} text - The SQL query text (e.g., "SELECT * FROM users WHERE id = $1").
     * @param {Array<any>} [params] - Optional array of parameters for placeholder substitution.
     * @returns {Promise<QueryResult<any>>} A promise that resolves with the query result.
     */
    query: (text, params) => {
        // Removed verbose query logging for production, uncomment if needed for debugging
        // const start = Date.now();
        // console.log('[db.js] Executing query:', { text, params: params?.length });
        return pool.query(text, params)
            // .then(res => {
            //     const duration = Date.now() - start;
            //     console.log('[db.js] Query executed:', { text, duration: `${duration}ms`, rows: res.rowCount });
            //     return res;
            // })
            .catch(err => {
                // Log errors during query execution
                console.error('[db.js] ERROR executing query:', { text }, err); // Log text but maybe not params in prod
                throw err; // Re-throw the error so the calling route handler can catch it
            });
    },
    // Export the pool itself if needed for transactions or direct pool management
    pool: pool
};