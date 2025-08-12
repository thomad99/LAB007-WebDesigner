import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Mock API endpoints for testing
app.post('/api/analyze-website', async (req, res) => {
  try {
    const { website } = req.body;
    console.log('Mock analyze request for:', website);
    
    // Return mock analysis data
    res.json({
      title: 'Test Website',
      description: 'This is a test website for development purposes',
      estimatedBusinessType: 'tech',
      suggestedThemes: ['clean-white', 'dark-black', 'colorful'],
      logo: null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clone-website', async (req, res) => {
  try {
    const { website, email, theme, businessType } = req.body;
    console.log('Mock clone request:', { website, email, theme, businessType });
    
    // Return mock job ID
    res.json({ 
      message: 'Mock job started', 
      jobId: 'test-job-' + Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-mockup', async (req, res) => {
  try {
    const { website, theme, businessType } = req.body;
    console.log('Mock mockup request:', { website, theme, businessType });
    
    // Return mock job ID
    res.json({ 
      message: 'Mock mockup generation started', 
      jobId: 'test-mockup-' + Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log('Mock status check for job:', jobId);
    
    // Return mock status that progresses
    const timestamp = Date.now();
    const progress = (timestamp % 4000) / 40; // Progress from 0-100 over 4 seconds
    
    let status, statusDescription, jobType;
    
    if (progress < 25) {
      status = 'scraping';
      statusDescription = 'Analyzing your website content and structure...';
      jobType = jobId.includes('mockup') ? 'mockup' : 'clone';
    } else if (progress < 50) {
      status = 'analyzing';
      statusDescription = 'AI is processing your content and generating design ideas...';
      jobType = jobId.includes('mockup') ? 'mockup' : 'clone';
    } else if (progress < 75) {
      status = 'generating';
      if (jobId.includes('mockup')) {
        statusDescription = 'Creating your website mockup with AI...';
      } else {
        statusDescription = 'Generating your redesigned website...';
      }
      jobType = jobId.includes('mockup') ? 'mockup' : 'clone';
    } else {
      status = 'completed';
      if (jobId.includes('mockup')) {
        statusDescription = 'Your website mockup is ready!';
      } else {
        statusDescription = 'Your redesigned website is ready!';
      }
      jobType = jobId.includes('mockup') ? 'mockup' : 'clone';
    }
    
    res.json({
      status: status,
      statusDescription: statusDescription,
      jobType: jobType,
      demoUrls: jobType === 'clone' ? ['/demo/test'] : null,
      mockupUrl: jobType === 'mockup' ? 'https://via.placeholder.com/1024x1024/667eea/ffffff?text=Website+Mockup' : null,
      website: 'https://example.com'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mock demo endpoint
app.get('/demo/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mock Redesigned Website</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          .header { background: #667eea; color: white; padding: 2rem; text-align: center; border-radius: 10px; }
          .content { margin: 2rem 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Mock Redesigned Website</h1>
          <p>This is a test page to verify the frontend is working</p>
        </div>
        <div class="content">
          <h2>Frontend Test Successful!</h2>
          <p>If you can see this page, the frontend is working correctly.</p>
          <p>All buttons, forms, and API calls should now be functional.</p>
        </div>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Test server running on port', PORT);
  console.log('Open http://localhost:' + PORT + ' in your browser');
  console.log('This is a test server with mock API endpoints');
});
