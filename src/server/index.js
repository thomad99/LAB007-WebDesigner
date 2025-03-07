import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;
import OpenAI from 'openai';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

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
    const jobId = uuidv4();

    // Store job in database
    await pool.query(
      'INSERT INTO jobs (id, website, email, theme, business_type, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, email, theme, businessType, 'scraping']
    );

    // Start the process asynchronously
    processWebsite(jobId, website, email, theme, businessType);

    res.json({ 
      message: 'Job started', 
      jobId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function processWebsite(jobId, website, email, theme, businessType) {
  try {
    // 1. Scrape website content
    const { data } = await axios.get(website);
    const $ = cheerio.load(data);
    
    // Extract content
    const content = {
      title: $('title').text(),
      description: $('meta[name="description"]').attr('content'),
      headings: $('h1, h2, h3').map((i, el) => $(el).text()).get(),
      paragraphs: $('p').map((i, el) => $(el).text()).get(),
      images: $('img').map((i, el) => $(el).attr('src')).get()
    };

    // Update status
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['analyzing', jobId]
    );

    // 2. Use OpenAI to generate new designs
    const prompt = `Given this website content for a ${businessType} with a ${theme} theme:
    Title: ${content.title}
    Description: ${content.description}
    Main headings: ${content.headings.join(', ')}
    
    Generate modern, mobile-friendly HTML/CSS code for a redesigned version. Include:
    1. Responsive navigation
    2. Modern layout
    3. ${theme} color scheme
    4. Mobile-first design
    5. Improved user experience`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional web designer. Generate complete, modern HTML/CSS code."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 4000
    });

    // 3. Store generated designs
    const newDesign = completion.choices[0].message.content;
    const demoUrl = `https://web-designer.onrender.com/demo/${jobId}`;

    // Store the generated design in the database
    await pool.query(
      'UPDATE jobs SET status = $1, demo_urls = $2 WHERE id = $3',
      ['completed', JSON.stringify([demoUrl]), jobId]
    );

    // 4. Send email if provided
    if (email) {
      // Setup nodemailer (using your EMAIL_USER and EMAIL_PASSWORD from environment)
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your Website Redesign is Ready',
        html: `
          <h1>Your Website Redesign is Complete!</h1>
          <p>View your new design here: <a href="${demoUrl}">${demoUrl}</a></p>
        `
      });
    }

  } catch (error) {
    console.error('Error processing website:', error);
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      [`error: ${error.message}`, jobId]
    );
  }
}

// Update the status endpoint to return more information
app.get('/api/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(
      'SELECT status, demo_urls FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = result.rows[0];
    res.json({
      status: job.status,
      demoUrls: job.demo_urls
    });
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
            margin-bottom: 2rem;
          }
          label {
            font-weight: bold;
          }
          input, select {
            padding: 0.5rem;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          button {
            padding: 1rem;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1.1rem;
          }
          button:hover {
            background-color: #0056b3;
          }
          #status-box {
            margin-top: 2rem;
            padding: 1rem;
            border: 2px solid #ddd;
            border-radius: 4px;
            display: none;
          }
          .status-active {
            display: block !important;
          }
        </style>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const form = document.querySelector('form');
            const statusBox = document.getElementById('status-box');

            form.addEventListener('submit', async function(e) {
              e.preventDefault();
              statusBox.classList.add('status-active');
              statusBox.innerHTML = '<p>Starting process...</p>';

              const formData = {
                website: form.website.value,
                email: form.email.value,
                theme: form.theme.value,
                businessType: form.businessType.value
              };

              try {
                const response = await fetch('/api/clone-website', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(formData)
                });
                const data = await response.json();
                
                // Start polling for status updates
                const jobId = data.jobId;
                pollStatus(jobId);
              } catch (error) {
                statusBox.innerHTML = '<p>Error: ' + error.message + '</p>';
              }
            });

            async function pollStatus(jobId) {
              try {
                const response = await fetch('/api/status/' + jobId);
                const data = await response.json();
                statusBox.innerHTML = '<p>Status: ' + data.status + '</p>';
                
                if (data.status !== 'completed' && data.status !== 'error') {
                  setTimeout(() => pollStatus(jobId), 2000);
                }
                if (data.demoUrls) {
                  statusBox.innerHTML += '<p>Demo URLs:</p><ul>' + 
                    data.demoUrls.map(url => '<li><a href="' + url + '">' + url + '</a></li>').join('') +
                    '</ul>';
                }
              } catch (error) {
                statusBox.innerHTML = '<p>Error checking status: ' + error.message + '</p>';
              }
            }
          });
        </script>
      </head>
      <body>
        <h1>LAB007 AI Website Cloner</h1>
        <form>
          <label for="website">Your Current Website:</label>
          <input type="url" id="website" name="website" required placeholder="https://example.com">
          
          <label for="email">Your Email (Optional):</label>
          <input type="email" id="email" name="email" placeholder="your@email.com">
          
          <label for="theme">Preferred Style:</label>
          <select id="theme" name="theme" required>
            <option value="">Select a style</option>
            <option value="clean-white">Clean White</option>
            <option value="dark-black">Dark Black</option>
            <option value="colorful">Colorful</option>
          </select>
          
          <label for="businessType">Business Type:</label>
          <select id="businessType" name="businessType" required>
            <option value="">Select business type</option>
            <option value="flower-shop">Flower Shop</option>
            <option value="retail-store">Retail Store</option>
            <option value="product-info">Product Information</option>
            <option value="healthcare">Healthcare</option>
            <option value="tech">Tech</option>
            <option value="pet-care">Pet Care</option>
            <option value="local-business">Local Business</option>
            <option value="blog">Blog</option>
          </select>
          
          <button type="submit">Generate Website Designs</button>
        </form>
        
        <div id="status-box"></div>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
