import { initDatabase } from '../database/db.js';

async function setupDatabase() {
  try {
    await initDatabase();
    console.log('Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase(); 