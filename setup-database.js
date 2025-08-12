import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

async function setupDatabase() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected to database successfully!');
    
    // Read the SQL schema file
    const schemaPath = path.join(process.cwd(), 'src', 'database', 'init.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Creating database schema...');
    await client.query(schemaSQL);
    console.log('Database schema created successfully!');
    
    // Verify the table was created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'jobs'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Jobs table verified successfully!');
    } else {
      console.log('❌ Jobs table not found after creation');
    }
    
    client.release();
    console.log('Database setup completed!');
    
  } catch (error) {
    console.error('Database setup failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
  } finally {
    await pool.end();
  }
}

setupDatabase();
