import express from 'express';
import { Pool } from 'pg';
import { Configuration, OpenAIApi } from 'openai';
import nodemailer from 'nodemailer';
import path from 'path';

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

const PORT = process.env.PORT || 3000;

// Health check endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/build', 'index.html'));
  });
}

app.post('/api/clone-website', async (req, res) => {
  const { website, email, theme, businessType } = req.body;
  const jobId = generateJobId();

  try {
    // Store job in database
    await pool.query(
      'INSERT INTO jobs (id, website, email, theme, business_type, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, email, theme, businessType, 'pending']
    );

    // Start processing in background
    processWebsite(jobId, website, email, theme, businessType);

    res.json({ jobId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status/:jobId', async (req, res) => {
  const { jobId } = req.params;
  
  try {
    const result = await pool.query('SELECT status, demo_urls FROM jobs WHERE id = $1', [jobId]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function processWebsite(jobId, website, email, theme, businessType) {
  try {
    // Update status: Scraping
    await updateJobStatus(jobId, 'Capturing current website');
    const websiteData = await scrapeWebsite(website);

    // Update status: Analyzing
    await updateJobStatus(jobId, 'Gathering information on the new site design');
    
    // Generate variations using GPT-4
    const variations = await generateVariations(websiteData, theme, businessType);

    // Create demo sites
    const demoUrls = await createDemoSites(variations);

    // Send email if provided
    if (email) {
      await sendNotificationEmail(email, demoUrls);
    }

    // Update final status with demo URLs
    await updateJobStatus(jobId, 'completed', demoUrls);
  } catch (error) {
    await updateJobStatus(jobId, 'error: ' + error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 