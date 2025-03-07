import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());  // Add CORS support

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// API endpoint for website cloning
app.post('/api/clone-website', async (req, res) => {
  try {
    const { website, email, theme, businessType } = req.body;
    res.json({ 
      message: 'Request received', 
      website, 
      email, 
      theme, 
      businessType 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status check endpoint
app.get('/api/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    res.json({ status: 'pending', jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 