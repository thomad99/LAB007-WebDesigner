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

// Root route - Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>LAB007 AI Website Cloner</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          h1 {
            text-align: center;
            color: #333;
          }
          form {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          label {
            font-weight: bold;
          }
          input, select {
            padding: 0.5rem;
            font-size: 1rem;
            border: 1px solid #ccc;
          }
        </style>
      </head>
      <body>
        <h1>LAB007 AI Website Cloner</h1>
        <form>
          <label for="website">Website URL:</label>
          <input type="text" id="website" name="website" required>
          <label for="email">Email:</label>
          <input type="email" id="email" name="email" required>
          <label for="theme">Theme:</label>
          <select id="theme" name="theme" required>
            <option value="">Select a theme</option>
            <option value="modern">Modern</option>
            <option value="classic">Classic</option>
            <option value="minimalist">Minimalist</option>
          </select>
          <label for="businessType">Business Type:</label>
          <select id="businessType" name="businessType" required>
            <option value="">Select a business type</option>
            <option value="ecommerce">E-commerce</option>
            <option value="blog">Blog</option>
            <option value="portfolio">Portfolio</option>
          </select>
          <button type="submit">Clone Website</button>
        </form>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
