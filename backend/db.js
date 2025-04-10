// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

const poolConfig = {
  // Use connection string from environment variable if available
  connectionString: process.env.DATABASE_URL,
  // Add SSL configuration if DATABASE_URL requires it (Render often does)
  // This might be needed if DATABASE_URL has ?sslmode=require
  // but pg usually handles this automatically if it's in the connection string.
  // For explicit control (especially if connectionString is missing):
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
       ? { rejectUnauthorized: false } // Common for Render/Heroku free tiers
       : undefined, // Use default SSL if not required by URL or URL is missing

  // Fallback to individual variables ONLY if connectionString is NOT provided
  // These are less likely to be used if DATABASE_URL is set correctly in Render env
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST,
  database: process.env.DATABASE_URL ? undefined : process.env.DB_DATABASE,
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD,
  port: process.env.DATABASE_URL ? undefined : parseInt(process.env.DB_PORT || '5432', 10), // Ensure port is a number

  // Optional: Add pool configuration settings if needed
  // max: 20, // example: max number of clients in the pool
  // idleTimeoutMillis: 30000, // example: how long a client is allowed to remain idle before being closed
};

// Log the effective connection target (mask password)
const logTarget = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@\/]+)@/, ':<password>@') // Mask password in URL
    : `${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`;
console.log(`[db.js] Attempting to connect pool to: ${logTarget}`);

const pool = new Pool(poolConfig);

pool.on('connect', (client) => {
  // Use client.connectionParameters to get actual connection details
  const params = client.connectionParameters;
  console.log(`[db.js] Pool client connected to ${params.host}:${params.port}/${params.database}`);
  // You might log client.processID here for debugging specific connections
});
pool.on('error', (err, client) => {
  console.error('[db.js] Unexpected error on idle client in pool', err);
  // You might want more robust error handling/logging here
});

module.exports = {
  // Function to execute queries using the pool
  query: (text, params) => {
      // Optional: Add logging for query execution
      // const start = Date.now();
      // console.log('[db.js] Executing query:', { text, params: params?.length });
      return pool.query(text, params)
          // .then(res => {
          //     const duration = Date.now() - start;
          //     console.log('[db.js] Query executed:', { text, duration: `${duration}ms`, rows: res.rowCount });
          //     return res;
          // })
          .catch(err => {
              console.error('[db.js] ERROR executing query:', { text, params }, err);
              throw err; // Re-throw error after logging
          });
  },
  // Export the pool itself if needed elsewhere (e.g., transactions)
  pool: pool
};