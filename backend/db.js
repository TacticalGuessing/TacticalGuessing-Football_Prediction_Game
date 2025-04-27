// backend/db.js
const { Pool } = require('pg');
// dotenv should be configured in the main entry point (server.js) before this file is required.

// --- Determine if the connection is likely to a cloud database requiring SSL ---
// Checks if the DATABASE_URL environment variable exists and contains common cloud provider hostnames.
const isCloudDb = process.env.DATABASE_URL && (
    process.env.DATABASE_URL.includes('.render.com') ||
    process.env.DATABASE_URL.includes('.supabase.co') ||
    process.env.DATABASE_URL.includes('.neon.tech') ||
    process.env.DATABASE_URL.includes('sslmode=require') // Also check if sslmode is explicitly required
    // Add other cloud provider indicators if necessary
);
// --- End Cloud DB Check ---

// --- Configuration prioritizes DATABASE_URL ---
const poolConfig = {
    // Use connection string from environment variable if available
    connectionString: process.env.DATABASE_URL,

    // --- Modified SSL Configuration ---
    // Enable SSL with rejectUnauthorized: false ONLY if isCloudDb is true.
    // Otherwise, leave SSL undefined (effectively disabled) for local connections.
    ssl: isCloudDb
         ? { rejectUnauthorized: false }
         : undefined,
    // --- End Modified SSL Configuration ---

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
    ? process.env.DATABASE_URL.replace(/:([^:@\/]+)@/, ':<password>@') // Mask password
    : `${poolConfig.host || 'localhost'}:${poolConfig.port || 5432}/${poolConfig.database || 'default_db'}`; // Fallback for logging
//console.log(`[db.js] Attempting to connect pool to: ${logTarget}`);
// Log the SSL configuration being used AFTER determining if it's cloud/local
//console.log(`[db.js] SSL Configuration determined:`, poolConfig.ssl);

// Create the pool instance with the configured options
const pool = new Pool(poolConfig);

// Event listener for successful client connection within the pool
pool.on('connect', (client) => {
    const params = client.connectionParameters;
    //console.log(`[db.js] Pool client connected to ${params.host}:${params.port}/${params.database}. SSL Active: ${client.ssl ? 'Yes' : 'No'}`); // Log SSL status
    // client.on('error', err => console.error('[db.js] Error on connected client:', err));
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
        return pool.query(text, params)
            .catch(err => {
                // Log errors during query execution
                console.error('[db.js] ERROR executing query:', { text }, err); // Avoid logging params in production if sensitive
                throw err; // Re-throw the error so the calling route handler can catch it
            });
    },
    // Export the pool itself if needed for transactions or direct pool management
    pool: pool
};