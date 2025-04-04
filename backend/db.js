// backend/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => console.log('Connected to the PostgreSQL database'));
pool.on('error', (err) => console.error('Unexpected database error', err));

module.exports = {
  // Function to execute simple queries (used elsewhere)
  query: (text, params) => pool.query(text, params),

  // Export the pool object itself for transaction management
  pool: pool  // <<< MAKE SURE THIS LINE EXISTS AND IS CORRECT
};