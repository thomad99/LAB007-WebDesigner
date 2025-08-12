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
    console.log('🚀 Starting website redesign process...');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
    const { website, email, theme, businessType } = req.body;
    const jobId = uuidv4();
    
    console.log(`🆔 Generated job ID: ${jobId}`);
    console.log(`🌐 Website: ${website}`);
    console.log(`📧 Email: ${email || 'Not provided'}`);
    console.log(`🎨 Theme: ${theme}`);
    console.log(`🏢 Business Type: ${businessType}`);

    // Store job in database
    console.log('💾 Storing job in database...');
    await pool.query(
      'INSERT INTO jobs (id, website, email, theme, business_type, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, email, theme, businessType, 'scraping']
    );
    console.log('✅ Job stored in database successfully');

    // Start the process asynchronously
    console.log('🔄 Starting async website processing...');
    processWebsite(jobId, website, email, theme, businessType);

    console.log('📤 Sending response to client...');
    res.json({ 
      message: 'Job started', 
      jobId
    });
    console.log('✅ Response sent successfully');
    
  } catch (error) {
    console.error('❌ Error in /api/clone-website:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processWebsite(jobId, website, email, theme, businessType) {
  try {
    console.log(`\n🔄 Starting website processing for job ${jobId}`);
    console.log(`🌐 Processing website: ${website}`);
    
    // 1. Scrape website content with enhanced extraction
    console.log('🔍 Step 1: Starting website scraping...');
    console.log('📡 Making HTTP request to website...');
    
    const { data } = await axios.get(website);
    console.log('✅ Website response received successfully');
    console.log(`📊 Response size: ${(data.length / 1024).toFixed(2)} KB`);
    
    console.log('🔍 Loading HTML with Cheerio...');
    const $ = cheerio.load(data);
    console.log('✅ HTML loaded and parsed successfully');
    
    console.log('📝 Extracting website content...');
    
    // Enhanced content extraction
    const content = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      logo: findLogo($),
      navigation: extractNavigation($),
      headings: $('h1, h2, h3, h4').map((i, el) => ({
        level: el.name,
        text: $(el).text().trim(),
        classes: $(el).attr('class') || ''
      })).get(),
      paragraphs: $('p').map((i, el) => $(el).text().trim()).get().filter(text => text.length > 20),
      images: $('img').map((i, el) => ({
        src: $(el).attr('src'),
        alt: $(el).attr('alt') || '',
        classes: $(el).attr('class') || ''
      })).get(),
      links: $('a').map((i, el) => ({
        text: $(el).text().trim(),
        href: $(el).attr('href'),
        classes: $(el).attr('class') || ''
      })).get().filter(link => link.text && link.href),
      buttons: $('button, .btn, input[type="submit"]').map((i, el) => $(el).text().trim()).get(),
      contactInfo: extractContactInfo($),
      socialLinks: extractSocialLinks($)
    };

    console.log('📊 Content extraction completed:');
    console.log(`   - Title: ${content.title}`);
    console.log(`   - Description: ${content.description}`);
    console.log(`   - Logo found: ${content.logo ? 'Yes' : 'No'}`);
    console.log(`   - Navigation items: ${content.navigation.length}`);
    console.log(`   - Headings: ${content.headings.length}`);
    console.log(`   - Paragraphs: ${content.paragraphs.length}`);
    console.log(`   - Images: ${content.images.length}`);
    console.log(`   - Links: ${content.links.length}`);
    console.log(`   - Contact info: ${content.contactInfo.length}`);
    console.log(`   - Social links: ${content.socialLinks.length}`);

    // Update status to analyzing
    console.log('🔄 Updating job status to "analyzing"...');
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['analyzing', jobId]
    );
    console.log('✅ Status updated to "analyzing"');

    // 2. Use OpenAI to generate improved designs with better context
    console.log('🤖 Step 2: Starting AI design generation...');
    console.log('📝 Building AI prompt...');
    
    const prompt = `You are a professional web designer tasked with redesigning a website. 

ORIGINAL WEBSITE CONTENT:
- Title: ${content.title}
- Description: ${content.description}
- Business Type: ${businessType}
- Theme: ${theme}

CONTENT TO PRESERVE AND IMPROVE:
- Main headings: ${content.headings.map(h => `${h.level}: ${h.text}`).join(', ')}
- Key paragraphs: ${content.paragraphs.slice(0, 5).join(' | ')}
- Navigation items: ${content.navigation.join(', ')}
- Contact information: ${content.contactInfo.join(', ')}
- Social links: ${content.socialLinks.join(', ')}

REQUIREMENTS:
1. Create a modern, mobile-first responsive design
2. Use a ${theme} color scheme and aesthetic
3. Preserve ALL original content and structure
4. Improve typography, spacing, and visual hierarchy
5. Add modern UI elements (cards, gradients, shadows)
6. Ensure the design fits a ${businessType} business
7. Include proper meta tags and SEO optimization
8. Make it fully responsive for all devices
9. Use modern CSS (Grid, Flexbox, CSS variables)
10. Add subtle animations and hover effects

Generate complete, production-ready HTML/CSS code that can be immediately used.`;

    console.log('📝 AI Prompt built successfully');
    console.log('🤖 Calling OpenAI API...');
    console.log(`📊 Prompt length: ${prompt.length} characters`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert web designer. Generate complete, modern HTML/CSS code that preserves original content while dramatically improving the design and user experience. Use semantic HTML, modern CSS, and ensure the code is production-ready."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 6000,
      temperature: 0.7
    });

    console.log('✅ OpenAI API call completed successfully');
    console.log(`📊 Response tokens used: ${completion.usage?.total_tokens || 'Unknown'}`);
    console.log(`📝 Generated content length: ${completion.choices[0].message.content.length} characters`);

    // 3. Store generated designs
    console.log('💾 Step 3: Storing generated design...');
    const newDesign = completion.choices[0].message.content;
    const demoUrl = `/demo/${jobId}`;

    console.log('💾 Updating database with generated design...');
    await pool.query(
      'UPDATE jobs SET status = $1, demo_urls = $2, generated_html = $3 WHERE id = $4',
      ['completed', JSON.stringify([demoUrl]), newDesign, jobId]
    );
    console.log('✅ Design stored in database successfully');
    console.log(`🔗 Demo URL: ${demoUrl}`);

    // 4. Send email if provided
    if (email) {
      console.log('📧 Step 4: Sending email notification...');
      console.log(`📧 Sending email to: ${email}`);
      
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
        subject: 'Your Website Redesign is Ready! 🎨',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">🎉 Your Website Redesign is Complete!</h1>
            <p>We've successfully redesigned your website with a modern, ${theme} aesthetic that's perfect for your ${businessType} business.</p>
            <p><strong>What's new:</strong></p>
            <ul>
              <li>✨ Modern, responsive design</li>
              <li>📱 Mobile-first approach</li>
              <li>🎨 ${theme} color scheme</li>
              <li>🚀 Improved user experience</li>
              <li>📝 All your original content preserved</li>
            </ul>
            <div style="text-align: center; margin: 2rem 0;">
              <a href="${demoUrl}" style="background: #007bff; color: white; padding: 1rem 2rem; text-decoration: none; border-radius: 5px; display: inline-block;">View Your New Design</a>
            </div>
            <p><em>Your redesigned website is ready to use!</em></p>
          </div>
        `
      });
      console.log('✅ Email sent successfully');
    } else {
      console.log('📧 No email provided, skipping email notification');
    }

    console.log(`🎉 Website processing completed successfully for job ${jobId}!`);

  } catch (error) {
    console.error(`❌ Error processing website for job ${jobId}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data
    });
    
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      [`error: ${error.message}`, jobId]
    );
    console.log(`✅ Error status updated in database for job ${jobId}`);
  }
}

// Helper function to find logo
function findLogo($) {
  // Look for common logo selectors
  const logoSelectors = [
    '.logo img', '.brand img', '.header-logo img', 
    'header img', '.navbar-brand img', '.site-logo img'
  ];
  
  for (const selector of logoSelectors) {
    const logo = $(selector).first();
    if (logo.length) {
      return {
        src: logo.attr('src'),
        alt: logo.attr('alt') || 'Logo'
      };
    }
  }
  
  // Fallback to first image in header
  const headerImg = $('header img, .header img, .navbar img').first();
  if (headerImg.length) {
    return {
      src: headerImg.attr('src'),
      alt: headerImg.attr('alt') || 'Logo'
    };
  }
  
  return null;
}

// Helper function to extract navigation
function extractNavigation($) {
  const navItems = [];
  $('nav a, .navbar a, .navigation a, .menu a').each((i, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 50) {
      navItems.push(text);
    }
  });
  return navItems.slice(0, 8); // Limit to 8 items
}

// Helper function to extract contact information
function extractContactInfo($) {
  const contactInfo = [];
  const text = $('body').text();
  
  // Look for common contact patterns
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const phoneRegex = /(\+\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g;
  const addressRegex = /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)/gi;
  
  const emails = text.match(emailRegex);
  const phones = text.match(phoneRegex);
  const addresses = text.match(addressRegex);
  
  if (emails) contactInfo.push(...emails.slice(0, 2));
  if (phones) contactInfo.push(...phones.slice(0, 2));
  if (addresses) contactInfo.push(...addresses.slice(0, 1));
  
  return contactInfo;
}

// Helper function to extract social links
function extractSocialLinks($) {
  const socialLinks = [];
  $('a[href*="facebook"], a[href*="twitter"], a[href*="instagram"], a[href*="linkedin"], a[href*="youtube"]').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && text) {
      socialLinks.push(`${text}: ${href}`);
    }
  });
  return socialLinks;
}

// Add this new endpoint for image mockup
app.post('/api/create-mockup', async (req, res) => {
  try {
    console.log('🖼️ Starting mockup generation process...');
    console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
    
    const { website, theme, businessType } = req.body;
    const jobId = uuidv4();
    
    console.log(`🆔 Generated mockup job ID: ${jobId}`);
    console.log(`🌐 Website: ${website}`);
    console.log(`🎨 Theme: ${theme}`);
    console.log(`🏢 Business Type: ${businessType}`);

    // Store job in database
    console.log('💾 Storing mockup job in database...');
    await pool.query(
      'INSERT INTO jobs (id, website, theme, business_type, status, job_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, theme, businessType, 'generating', 'mockup']
    );
    console.log('✅ Mockup job stored in database successfully');

    // Start the mockup process asynchronously
    console.log('🔄 Starting async mockup generation...');
    createMockup(jobId, website, theme, businessType);

    console.log('📤 Sending mockup response to client...');
    res.json({ 
      message: 'Mockup generation started', 
      jobId 
    });
    console.log('✅ Mockup response sent successfully');
    
  } catch (error) {
    console.error('❌ Error in /api/create-mockup:', error);
    res.status(500).json({ error: error.message });
  }
});

async function createMockup(jobId, website, theme, businessType) {
  try {
    console.log(`\n🖼️ Starting mockup generation for job ${jobId}`);
    console.log(`🌐 Processing website: ${website}`);
    
    // Update initial status
    console.log('🔄 Updating job status to "scraping"...');
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['scraping', jobId]
    );
    console.log('✅ Status updated to "scraping"');

    // 1. Scrape website content with enhanced extraction (same as main function)
    console.log('🔍 Step 1: Starting website scraping for mockup...');
    console.log('📡 Making HTTP request to website...');
    
    const { data } = await axios.get(website);
    console.log('✅ Website response received successfully');
    console.log(`📊 Response size: ${(data.length / 1024).toFixed(2)} KB`);
    
    console.log('🔍 Loading HTML with Cheerio...');
    const $ = cheerio.load(data);
    console.log('✅ HTML loaded and parsed successfully');
    
    console.log('📝 Extracting content for mockup...');
    
    const content = {
      title: $('title').text().trim() || 'Website',
      description: $('meta[name="description"]').attr('content') || '',
      logo: findLogo($),
      navigation: extractNavigation($),
      headings: $('h1, h2, h3').map((i, el) => $(el).text().trim()).get().slice(0, 5),
      paragraphs: $('p').map((i, el) => $(el).text().trim()).get().filter(text => text.length > 20).slice(0, 3),
      contactInfo: extractContactInfo($),
      socialLinks: extractSocialLinks($)
    };
    
    console.log('📊 Mockup content extraction completed:');
    console.log(`   - Title: ${content.title}`);
    console.log(`   - Description: ${content.description}`);
    console.log(`   - Logo found: ${content.logo ? 'Yes' : 'No'}`);
    console.log(`   - Navigation items: ${content.navigation.length}`);
    console.log(`   - Headings: ${content.headings.length}`);
    console.log(`   - Paragraphs: ${content.paragraphs.length}`);
    console.log(`   - Contact info: ${content.contactInfo.length}`);
    console.log(`   - Social links: ${content.socialLinks.length}`);
    
    // Update status to generating
    console.log('🔄 Updating job status to "generating"...');
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['generating', jobId]
    );
    console.log('✅ Status updated to "generating"');
    
    // 2. Generate image using DALL-E with enhanced prompt
    console.log('🎨 Step 2: Starting DALL-E image generation...');
    console.log('📝 Building DALL-E prompt...');
    
    const prompt = `Create a professional, modern website mockup for a ${businessType} business with a ${theme} theme.

BUSINESS CONTEXT:
- Business Type: ${businessType}
- Theme: ${theme}
- Website Title: ${content.title}
- Description: ${content.description}

CONTENT TO INCLUDE:
- Main headings: ${content.headings.join(', ')}
- Key content: ${content.paragraphs.join(' | ')}
- Navigation menu: ${content.navigation.join(', ')}
- Contact info: ${content.contactInfo.join(', ')}
- Social links: ${content.socialLinks.join(', ')}

DESIGN REQUIREMENTS:
- Modern, professional ${theme} aesthetic
- Clean, responsive layout
- Professional typography and spacing
- ${theme} color scheme throughout
- Mobile-friendly design elements
- Professional business appearance
- Include realistic content placement
- Show navigation, hero section, content areas
- Make it look like a real, professional website screenshot

Style: Professional website mockup, clean design, modern UI, business-appropriate, realistic content placement`;

    console.log('📝 DALL-E prompt built successfully');
    console.log(`📊 Prompt length: ${prompt.length} characters`);
    console.log('🎨 Calling DALL-E API...');
    
    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });
    
    console.log('✅ DALL-E API call completed successfully');
    console.log('📊 DALL-E response received:', JSON.stringify(image, null, 2));
    
    if (!image.data || !image.data[0] || !image.data[0].url) {
      throw new Error('Failed to generate image - no URL returned');
    }

    const imageUrl = image.data[0].url;
    console.log('🔗 Generated image URL:', imageUrl);

    // 3. Store the result
    console.log('💾 Step 3: Storing mockup result...');
    console.log('💾 Updating database with mockup URL...');
    
    await pool.query(
      'UPDATE jobs SET status = $1, mockup_url = $2 WHERE id = $3',
      ['completed', imageUrl, jobId]
    );
    console.log('✅ Mockup result stored in database successfully');
    console.log(`🎉 Mockup generation completed successfully for job ${jobId}!`);

  } catch (error) {
    console.error(`❌ Error generating mockup for job ${jobId}:`, error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      response: error.response?.data
    });
    
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      [`error: ${error.message}`, jobId]
    );
    console.log(`✅ Error status updated in database for job ${jobId}`);
  }
}

// Update the status endpoint to handle both types with detailed status
app.get('/api/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`📊 Status check requested for job: ${jobId}`);
    
    const result = await pool.query(
      'SELECT status, demo_urls, mockup_url, job_type, website FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ Job ${jobId} not found`);
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = result.rows[0];
    console.log(`📊 Job ${jobId} status: ${job.status}, type: ${job.job_type}`);
    
    // Provide more detailed status information
    let detailedStatus = job.status;
    let statusDescription = '';
    
    switch (job.status) {
      case 'scraping':
        statusDescription = 'Analyzing your website content and structure...';
        break;
      case 'analyzing':
        statusDescription = 'AI is processing your content and generating design ideas...';
        break;
      case 'generating':
        if (job.job_type === 'mockup') {
          statusDescription = 'Creating your website mockup with AI...';
        } else {
          statusDescription = 'Generating your redesigned website...';
        }
        break;
      case 'completed':
        if (job.job_type === 'mockup') {
          statusDescription = 'Your website mockup is ready!';
        } else {
          statusDescription = 'Your redesigned website is ready!';
        }
        break;
      default:
        if (job.status.startsWith('error:')) {
          statusDescription = 'An error occurred during processing. Please try again.';
        } else {
          statusDescription = 'Processing your request...';
        }
    }
    
    res.json({
      status: job.status,
      statusDescription: statusDescription,
      jobType: job.job_type,
      demoUrls: job.demo_urls,
      mockupUrl: job.mockup_url,
      website: job.website
    });
    
    console.log(`✅ Status response sent for job ${jobId}`);
    
  } catch (error) {
    console.error(`❌ Error checking status for job ${req.params.jobId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update the root route with new UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>LAB007 AI Website Redesigner</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          
          .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 2rem;
          }
          
          .header {
            text-align: center;
            margin-bottom: 3rem;
            color: white;
          }
          
          .header h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          
          .header p {
            font-size: 1.2rem;
            opacity: 0.9;
          }
          
          .main-content {
            background: white;
            border-radius: 20px;
            padding: 3rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          
          .option-buttons {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            justify-content: center;
          }
          
          .option-button {
            flex: 1;
            max-width: 200px;
            padding: 1.5rem;
            font-size: 1.1rem;
            border: 2px solid #667eea;
            background: white;
            color: #667eea;
            cursor: pointer;
            border-radius: 15px;
            transition: all 0.3s ease;
            font-weight: 600;
          }
          
          .option-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
          }
          
          .option-button.active {
            background: #667eea;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
          }
          
          .form-section {
            margin-bottom: 2rem;
          }
          
          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
          }
          
          .form-group {
            display: flex;
            flex-direction: column;
          }
          
          .form-group.full-width {
            grid-column: 1 / -1;
          }
          
          label {
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #555;
          }
          
          input, select {
            padding: 1rem;
            font-size: 1rem;
            border: 2px solid #e1e5e9;
            border-radius: 10px;
            transition: border-color 0.3s ease;
            font-family: inherit;
          }
          
          input:focus, select:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .analyze-btn {
            background: #28a745;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background-color 0.3s ease;
            margin-top: 0.5rem;
          }
          
          .analyze-btn:hover {
            background: #218838;
          }
          
          .analyze-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
          }
          
          .submit-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 1.5rem 3rem;
            border-radius: 15px;
            cursor: pointer;
            font-size: 1.2rem;
            font-weight: 600;
            transition: all 0.3s ease;
            width: 100%;
            margin-top: 1rem;
          }
          
          .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 30px rgba(102, 126, 234, 0.4);
          }
          
          .submit-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
          }
          
          #status-box {
            margin-top: 2rem;
            padding: 1.5rem;
            border: 2px solid #e1e5e9;
            border-radius: 15px;
            display: none;
            background: #f8f9fa;
          }
          
          .status-active {
            display: block !important;
          }
          
          .status-loading {
            text-align: center;
            color: #667eea;
          }
          
          .status-error {
            border-color: #dc3545;
            background: #f8d7da;
            color: #721c24;
          }
          
          .status-success {
            border-color: #28a745;
            background: #d4edda;
            color: #155724;
          }
          
          .progress-container {
            text-align: center;
          }
          
          .progress-bar {
            width: 100%;
            height: 20px;
            background-color: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 1rem 0;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.5s ease;
            border-radius: 10px;
          }
          
          .step-details {
            margin-top: 1rem;
            text-align: left;
          }
          
          .step-info {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            border-left: 4px solid #667eea;
            margin: 0.5rem 0;
          }
          
          .step-info.success {
            border-left-color: #28a745;
            background: #f8fff9;
          }
          
          .step-info.error {
            border-left-color: #dc3545;
            background: #fff8f8;
          }
          
          .step-info p {
            margin: 0.25rem 0;
            font-size: 0.9rem;
          }
          
          .demo-item {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            margin: 0.5rem 0;
            justify-content: center;
          }
          
          .demo-btn {
            background: #667eea;
            color: white;
            padding: 0.75rem 1.5rem;
            text-decoration: none;
            border-radius: 8px;
            transition: background-color 0.3s ease;
            font-weight: 600;
          }
          
          .demo-btn:hover {
            background: #5a6fd8;
          }
          
          .copy-btn {
            background: #6c757d;
            color: white;
            border: none;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            cursor: pointer;
            transition: background-color 0.3s ease;
            font-size: 0.9rem;
          }
          
          .copy-btn:hover {
            background: #5a6268;
          }
          
          .download-btn {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 0.75rem 1.5rem;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 1rem;
            transition: background-color 0.3s ease;
            font-weight: 600;
          }
          
          .download-btn:hover {
            background: #218838;
          }
          
          .mockup-result {
            margin-top: 2rem;
            text-align: center;
          }
          
          .mockup-result img {
            max-width: 100%;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-top: 1rem;
          }
          
          .demo-links {
            margin-top: 1rem;
          }
          
          .demo-links a {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 0.75rem 1.5rem;
            text-decoration: none;
            border-radius: 8px;
            margin: 0.5rem;
            transition: background-color 0.3s ease;
          }
          
          .demo-links a:hover {
            background: #5a6fd8;
          }
          
          .analysis-results {
            background: #e8f4fd;
            border: 1px solid #bee5eb;
            border-radius: 10px;
            padding: 1.5rem;
            margin: 1rem 0;
            display: none;
          }
          
          .analysis-results h3 {
            color: #0c5460;
            margin-bottom: 1rem;
          }
          
          .analysis-item {
            margin-bottom: 0.5rem;
            padding: 0.5rem;
            background: white;
            border-radius: 5px;
          }
          
          .suggestions {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-top: 0.5rem;
          }
          
          .suggestion-tag {
            background: #667eea;
            color: white;
            padding: 0.25rem 0.75rem;
            border-radius: 15px;
            font-size: 0.8rem;
            cursor: pointer;
            transition: background-color 0.3s ease;
          }
          
          .suggestion-tag:hover {
            background: #5a6fd8;
          }
          
          @media (max-width: 768px) {
            .container {
              padding: 1rem;
            }
            
            .main-content {
              padding: 2rem 1.5rem;
            }
            
            .form-row {
              grid-template-columns: 1fr;
            }
            
            .option-buttons {
              flex-direction: column;
              align-items: center;
            }
            
            .option-button {
              max-width: 100%;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎨 AI Website Redesigner</h1>
            <p>Transform your existing website with AI-powered modern design</p>
          </div>
          
          <div class="main-content">
            <div class="option-buttons">
              <button type="button" class="option-button active" data-option="clone">🚀 Full Site Redesign</button>
              <button type="button" class="option-button" data-option="mockup">🖼️ Quick Mockup</button>
            </div>

            <form id="redesign-form">
              <div class="form-section">
                <div class="form-group full-width">
                  <label for="website">Your Current Website URL:</label>
                  <input type="url" id="website" name="website" required placeholder="https://example.com">
                  <button type="button" id="analyze-btn" class="analyze-btn">🔍 Analyze Website</button>
                </div>
                
                <div id="analysis-results" class="analysis-results">
                  <h3>📊 Website Analysis Results</h3>
                  <div id="analysis-content"></div>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="email">Your Email (Optional):</label>
                  <input type="email" id="email" name="email" placeholder="your@email.com">
                </div>
                
                <div class="form-group">
                  <label for="theme">Preferred Style:</label>
                  <select id="theme" name="theme" required>
                    <option value="">Select a style</option>
                    <option value="clean-white">✨ Clean White</option>
                    <option value="dark-black">🌙 Dark Black</option>
                    <option value="colorful">🎨 Colorful</option>
                  </select>
                </div>
              </div>
              
              <div class="form-group full-width">
                <label for="businessType">Business Type:</label>
                <select id="businessType" name="businessType" required>
                  <option value="">Select business type</option>
                  <option value="flower-shop">🌸 Flower Shop</option>
                  <option value="retail-store">🛍️ Retail Store</option>
                  <option value="product-info">📦 Product Information</option>
                  <option value="healthcare">🏥 Healthcare</option>
                  <option value="tech">💻 Tech</option>
                  <option value="pet-care">🐾 Pet Care</option>
                  <option value="local-business">🏢 Local Business</option>
                  <option value="blog">📝 Blog</option>
                </select>
              </div>
              
              <button type="submit" id="submit-btn" class="submit-btn">
                🚀 Generate Redesigned Website
              </button>
            </form>
            
            <div id="status-box"></div>
          </div>
        </div>
        
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('redesign-form');
            const statusBox = document.getElementById('status-box');
            const optionButtons = document.querySelectorAll('.option-button');
            const analyzeBtn = document.getElementById('analyze-btn');
            const analysisResults = document.getElementById('analysis-results');
            const analysisContent = document.getElementById('analysis-content');
            const submitBtn = document.getElementById('submit-btn');
            
            let selectedOption = 'clone';
            let isAnalyzing = false;

            // Option button handling
            optionButtons.forEach(button => {
              button.addEventListener('click', () => {
                optionButtons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                selectedOption = button.dataset.option;
                
                // Update button text based on option
                if (selectedOption === 'clone') {
                  submitBtn.innerHTML = '🚀 Generate Redesigned Website';
                } else {
                  submitBtn.innerHTML = '🖼️ Generate Website Mockup';
                }
              });
            });

            // Website analysis
            analyzeBtn.addEventListener('click', async function() {
              const website = document.getElementById('website').value;
              if (!website) {
                alert('Please enter a website URL first');
                return;
              }
              
              if (isAnalyzing) return;
              
              isAnalyzing = true;
              analyzeBtn.disabled = true;
              analyzeBtn.innerHTML = '🔍 Analyzing...';
              
              try {
                const response = await fetch('/api/analyze-website', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ website: normalizeUrl(website) })
                });
                
                const data = await response.json();
                
                if (data.error) {
                  throw new Error(data.error);
                }
                
                // Display analysis results
                analysisContent.innerHTML = \`
                  <div class="analysis-item">
                    <strong>Title:</strong> \${data.title || 'Not found'}
                  </div>
                  <div class="analysis-item">
                    <strong>Description:</strong> \${data.description || 'Not found'}
                  </div>
                  <div class="analysis-item">
                    <strong>Estimated Business Type:</strong> \${data.estimatedBusinessType}
                  </div>
                  <div class="analysis-item">
                    <strong>Suggested Themes:</strong>
                    <div class="suggestions">
                      \${data.suggestedThemes.map(theme => 
                        \`<span class="suggestion-tag" onclick="selectTheme('\${theme}')">\${theme}</span>\`
                      ).join('')}
                    </div>
                  </div>
                  \${data.logo ? \`
                    <div class="analysis-item">
                      <strong>Logo Found:</strong> ✅
                    </div>
                  \` : ''}
                \`;
                
                analysisResults.style.display = 'block';
                
                // Auto-fill business type if not already selected
                if (!document.getElementById('businessType').value) {
                  document.getElementById('businessType').value = data.estimatedBusinessType;
                }
                
              } catch (error) {
                alert('Error analyzing website: ' + error.message);
              } finally {
                isAnalyzing = false;
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '🔍 Analyze Website';
              }
            });

            // Theme selection from suggestions
            window.selectTheme = function(theme) {
              document.getElementById('theme').value = theme;
            };

            // Form submission
            form.addEventListener('submit', async function(e) {
              e.preventDefault();
              
              if (isAnalyzing) {
                alert('Please wait for website analysis to complete');
                return;
              }
              
              statusBox.className = 'status-active status-loading';
                              statusBox.innerHTML = '<div class="progress-container">' +
                  '<h3>🚀 Starting the redesign process...</h3>' +
                  '<div class="progress-bar">' +
                  '<div class="progress-fill" id="progress-fill"></div>' +
                  '</div>' +
                  '<p id="current-step">Initializing...</p>' +
                  '<div class="step-details" id="step-details"></div>' +
                  '</div>';
              
              const formData = {
                website: normalizeUrl(form.website.value),
                email: form.email.value,
                theme: form.theme.value,
                businessType: form.businessType.value
              };

              try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '⏳ Processing...';
                
                const endpoint = selectedOption === 'clone' ? '/api/clone-website' : '/api/create-mockup';
                console.log('📡 Making request to:', endpoint);
                
                const response = await fetch(endpoint, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(formData)
                });
                
                const data = await response.json();
                if (data.error) {
                  throw new Error(data.error);
                }
                
                console.log('✅ Initial response received:', data);
                updateProgress(10, 'Job started successfully');
                
                pollStatus(data.jobId);
              } catch (error) {
                console.error('❌ Error in form submission:', error);
                statusBox.className = 'status-active status-error';
                statusBox.innerHTML = `
                  <h3>❌ Error Starting Process</h3>
                  <p><strong>Error:</strong> ${error.message}</p>
                  <p>Please check your input and try again.</p>
                `;
                submitBtn.disabled = false;
                submitBtn.innerHTML = selectedOption === 'clone' ? '🚀 Generate Redesigned Website' : '🖼️ Generate Website Mockup';
              }
            });

            async function pollStatus(jobId) {
              try {
                console.log(`📊 Polling status for job: ${jobId}`);
                const response = await fetch('/api/status/' + jobId);
                const data = await response.json();
                
                if (data.error) {
                  console.error('❌ Status check error:', data.error);
                  statusBox.className = 'status-active status-error';
                  statusBox.innerHTML = `
                    <h3>❌ Error Checking Status</h3>
                    <p><strong>Error:</strong> ${data.error}</p>
                  `;
                  return;
                }

                console.log(`📊 Status update for job ${jobId}:`, data);
                
                // Update progress based on status
                let progress = 0;
                let currentStep = '';
                let stepDetails = '';
                
                switch (data.status) {
                  case 'scraping':
                    progress = 25;
                    currentStep = '🔍 Scraping Website Content';
                    stepDetails = `
                      <div class="step-info">
                        <p><strong>What's happening:</strong> Analyzing your website structure and extracting content</p>
                        <p><strong>Current task:</strong> Reading HTML, finding logos, navigation, and content</p>
                        <p><strong>Website:</strong> ${data.website}</p>
                      </div>
                    `;
                    break;
                    
                  case 'analyzing':
                    progress = 50;
                    currentStep = '🤖 AI Content Analysis';
                    stepDetails = `
                      <div class="step-info">
                        <p><strong>What's happening:</strong> AI is processing your content and planning the redesign</p>
                        <p><strong>Current task:</strong> Understanding your business type and content structure</p>
                        <p><strong>Business:</strong> ${document.getElementById('businessType').value}</p>
                      </div>
                    `;
                    break;
                    
                  case 'generating':
                    if (data.jobType === 'mockup') {
                      progress = 75;
                      currentStep = '🎨 Creating Website Mockup';
                      stepDetails = `
                        <div class="step-info">
                          <p><strong>What's happening:</strong> AI is generating a visual mockup of your redesigned website</p>
                          <p><strong>Current task:</strong> Using DALL-E to create a professional mockup</p>
                          <p><strong>Theme:</strong> ${document.getElementById('theme').value}</p>
                        </div>
                      `;
                    } else {
                      progress = 75;
                      currentStep = '🎨 Generating Redesigned Website';
                      stepDetails = `
                        <div class="step-info">
                          <p><strong>What's happening:</strong> AI is creating your complete redesigned website</p>
                          <p><strong>Current task:</strong> Building HTML/CSS with modern design principles</p>
                          <p><strong>Theme:</strong> ${document.getElementById('theme').value}</p>
                        </div>
                      `;
                    }
                    break;
                    
                  case 'completed':
                    progress = 100;
                    currentStep = '✅ Process Completed!';
                    stepDetails = `
                      <div class="step-info success">
                        <p><strong>🎉 Your ${data.jobType === 'mockup' ? 'mockup' : 'redesigned website'} is ready!</strong></p>
                      </div>
                    `;
                    break;
                    
                  default:
                    if (data.status.startsWith('error:')) {
                      progress = 0;
                      currentStep = '❌ Error Occurred';
                      stepDetails = `
                        <div class="step-info error">
                          <p><strong>Error:</strong> ${data.status.replace('error: ', '')}</p>
                          <p>Please try again or contact support if the problem persists.</p>
                        </div>
                      `;
                    } else {
                      progress = 10;
                      currentStep = '⏳ Processing...';
                      stepDetails = `
                        <div class="step-info">
                          <p><strong>Status:</strong> ${data.status}</p>
                          <p>Please wait while we process your request...</p>
                        </div>
                      `;
                    }
                }
                
                // Update the UI
                updateProgress(progress, currentStep);
                document.getElementById('step-details').innerHTML = stepDetails;
                
                // Show current status
                const statusText = data.status || 'Processing...';
                let statusIcon = '⏳';
                if (statusText.includes('error')) statusIcon = '❌';
                else if (statusText === 'completed') statusIcon = '✅';
                else if (statusText === 'scraping') statusIcon = '🔍';
                else if (statusText === 'analyzing') statusIcon = '🤖';
                else if (statusText === 'generating') statusIcon = '🎨';
                
                // Continue polling if not completed or errored
                if (data.status && !data.status.startsWith('error') && data.status !== 'completed') {
                  setTimeout(() => pollStatus(jobId), 2000);
                } else if (data.status === 'completed') {
                  statusBox.className = 'status-active status-success';
                  
                                      if (data.mockupUrl) {
                      statusBox.innerHTML += '<div class="mockup-result"><h3>🎨 Your Website Mockup:</h3>' +
                        '<img src="' + data.mockupUrl + '" alt="Website Mockup">' +
                        '<div class="download-section">' +
                        '<a href="' + data.mockupUrl + '" download="website-mockup.png" class="download-btn">📥 Download Mockup</a>' +
                        '</div></div>';
                    } else if (data.demoUrls) {
                      statusBox.innerHTML += '<div class="demo-links"><h3>🚀 Your Redesigned Website:</h3>' + 
                        data.demoUrls.map(function(url) {
                          return '<div class="demo-item">' +
                            '<a href="' + url + '" target="_blank" class="demo-btn">🌐 View Redesigned Site</a>' +
                            '<button onclick="copyToClipboard(\'' + url + '\')" class="copy-btn">📋 Copy Link</button>' +
                            '</div>';
                        }).join('') +
                        '</div>';
                    }
                  
                  submitBtn.disabled = false;
                  submitBtn.innerHTML = selectedOption === 'clone' ? '🚀 Generate Redesigned Website' : '🖼️ Generate Website Mockup';
                }
              } catch (error) {
                console.error('❌ Error polling status:', error);
                statusBox.className = 'status-active status-error';
                statusBox.innerHTML = `
                  <h3>❌ Error Checking Status</h3>
                  <p><strong>Error:</strong> ${error.message}</p>
                  <p>Please refresh the page and try again.</p>
                `;
                submitBtn.disabled = false;
                submitBtn.innerHTML = selectedOption === 'clone' ? '🚀 Generate Redesigned Website' : '🖼️ Generate Website Mockup';
              }
            }
            
            function updateProgress(percentage, step) {
              const progressFill = document.getElementById('progress-fill');
              const currentStepElement = document.getElementById('current-step');
              
              if (progressFill) {
                progressFill.style.width = percentage + '%';
              }
              
              if (currentStepElement) {
                currentStepElement.textContent = step;
              }
              
              console.log(`📊 Progress: ${percentage}% - ${step}`);
            }
            
            function copyToClipboard(text) {
              navigator.clipboard.writeText(text).then(() => {
                alert('Link copied to clipboard!');
              }).catch(err => {
                console.error('Failed to copy: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Link copied to clipboard!');
              });
            }
          });

          function normalizeUrl(url) {
            if (!url) return url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              return 'https://' + url;
            }
            return url;
          }
        </script>
      </body>
    </html>
  `);
});

// Add this function near the top with other functions
function normalizeUrl(url) {
  if (!url) return url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

// Add this after your other endpoints
app.get('/demo/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await pool.query(
      'SELECT generated_html, website FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].generated_html) {
      return res.status(404).send('Demo not found');
    }
    
    const generatedHtml = result.rows[0].generated_html;
    const originalWebsite = result.rows[0].website;
    
    // Enhance the generated HTML with better meta tags and original website reference
    const enhancedHtml = generatedHtml.replace(
      '<head>',
      `<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="AI-redesigned version of ${originalWebsite}">
        <title>Redesigned: ${originalWebsite}</title>
        <style>
          .demo-header {
            background: #f8f9fa;
            border-bottom: 2px solid #007bff;
            padding: 1rem;
            text-align: center;
            font-family: Arial, sans-serif;
          }
          .demo-header h1 {
            margin: 0;
            color: #007bff;
            font-size: 1.5rem;
          }
          .demo-header p {
            margin: 0.5rem 0 0 0;
            color: #666;
            font-size: 0.9rem;
          }
          .demo-header a {
            color: #007bff;
            text-decoration: none;
          }
          .demo-header a:hover {
            text-decoration: underline;
          }
        </style>`
    ).replace(
      '<body>',
      `<body>
        <div class="demo-header">
          <h1>🎨 AI-Redesigned Website</h1>
          <p>This is an AI-generated redesign of <a href="${originalWebsite}" target="_blank">${originalWebsite}</a></p>
          <p>All original content has been preserved and enhanced with modern design</p>
        </div>`
    );
    
    // Serve the enhanced HTML
    res.send(enhancedHtml);
  } catch (error) {
    res.status(500).send('Error loading demo: ' + error.message);
  }
});

// New endpoint to extract and analyze logos from websites
app.post('/api/analyze-website', async (req, res) => {
  try {
    const { website } = req.body;
    
    if (!website) {
      return res.status(400).json({ error: 'Website URL is required' });
    }

    const { data } = await axios.get(website);
    const $ = cheerio.load(data);
    
    const analysis = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      logo: findLogo($),
      navigation: extractNavigation($),
      headings: $('h1, h2, h3').map((i, el) => $(el).text().trim()).get().slice(0, 5),
      contactInfo: extractContactInfo($),
      socialLinks: extractSocialLinks($),
      estimatedBusinessType: estimateBusinessType($),
      suggestedThemes: suggestThemes($)
    };

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to estimate business type based on content
function estimateBusinessType($) {
  const text = $('body').text().toLowerCase();
  
  if (text.includes('flower') || text.includes('floral') || text.includes('bouquet')) return 'flower-shop';
  if (text.includes('health') || text.includes('medical') || text.includes('doctor')) return 'healthcare';
  if (text.includes('tech') || text.includes('software') || text.includes('app')) return 'tech';
  if (text.includes('pet') || text.includes('dog') || text.includes('cat')) return 'pet-care';
  if (text.includes('blog') || text.includes('article') || text.includes('post')) return 'blog';
  if (text.includes('retail') || text.includes('shop') || text.includes('store')) return 'retail-store';
  
  return 'local-business';
}

// Helper function to suggest themes based on content
function suggestThemes($) {
  const text = $('body').text().toLowerCase();
  const themes = [];
  
  if (text.includes('modern') || text.includes('tech') || text.includes('innovation')) {
    themes.push('clean-white', 'dark-black');
  }
  if (text.includes('creative') || text.includes('art') || text.includes('design')) {
    themes.push('colorful', 'clean-white');
  }
  if (text.includes('professional') || text.includes('business') || text.includes('corporate')) {
    themes.push('clean-white', 'dark-black');
  }
  if (text.includes('warm') || text.includes('friendly') || text.includes('welcoming')) {
    themes.push('colorful', 'clean-white');
  }
  
  // Always include default themes
  if (!themes.includes('clean-white')) themes.push('clean-white');
  if (!themes.includes('dark-black')) themes.push('dark-black');
  if (!themes.includes('colorful')) themes.push('colorful');
  
  return themes.slice(0, 3);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 