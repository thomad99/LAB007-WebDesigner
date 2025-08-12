import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Database connected successfully');
  }
});

export const initDatabase = async () => {
  try {
    // Read the SQL file
    const sqlFile = await fs.readFile('./src/database/init.sql', 'utf8');
    
    // Execute the SQL commands
    await pool.query(sqlFile);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

export default pool; 