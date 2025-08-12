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
app.use(express.static('public')); // Serve static files from public directory

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
    console.log('Starting website redesign process...');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { website, email, theme, businessType } = req.body;
    const jobId = uuidv4();
    
    console.log('Generated job ID:', jobId);
    console.log('Website:', website);
    console.log('Email:', email || 'Not provided');
    console.log('Theme:', theme);
    console.log('Business Type:', businessType);

    // Store job in database
    console.log('Storing job in database...');
    await pool.query(
      'INSERT INTO jobs (id, website, email, theme, business_type, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, email, theme, businessType, 'scraping']
    );
    console.log('Job stored in database successfully');

    // Start the process asynchronously
    console.log('Starting async website processing...');
    processWebsite(jobId, website, email, theme, businessType);

    console.log('Sending response to client...');
    res.json({ 
      message: 'Job started', 
      jobId
    });
    console.log('Response sent successfully');
    
  } catch (error) {
    console.error('Error in /api/clone-website:', error);
    res.status(500).json({ error: error.message });
  }
});

async function processWebsite(jobId, website, email, theme, businessType) {
  try {
    console.log(`\nStarting website processing for job ${jobId}`);
    console.log(`Processing website: ${website}`);
    
    // 1. Scrape website content with enhanced extraction
    console.log('Step 1: Starting website scraping...');
    console.log('Making HTTP request to website...');
    
    const { data } = await axios.get(website);
    console.log('Website response received successfully');
    console.log(`Response size: ${(data.length / 1024).toFixed(2)} KB`);
    
    console.log('Loading HTML with Cheerio...');
    const $ = cheerio.load(data);
    console.log('HTML loaded and parsed successfully');
    
    console.log('Extracting website content...');
    
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

    console.log('Content extraction completed:');
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
    console.log('Updating job status to "analyzing"...');
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['analyzing', jobId]
    );
    console.log('Status updated to "analyzing"');

    // 2. Use OpenAI to generate improved designs with better context
    console.log('Step 2: Starting AI design generation...');
    console.log('Building AI prompt...');
    
    const prompt = 'You are a professional web designer tasked with redesigning a website.\n\n' +
      'ORIGINAL WEBSITE CONTENT:\n' +
      '- Title: ' + content.title + '\n' +
      '- Description: ' + content.description + '\n' +
      '- Business Type: ' + businessType + '\n' +
      '- Theme: ' + theme + '\n\n' +
      'CONTENT TO PRESERVE AND IMPROVE:\n' +
      '- Main headings: ' + content.headings.map(function(h) { return h.level + ': ' + h.text; }).join(', ') + '\n' +
      '- Key paragraphs: ' + content.paragraphs.slice(0, 5).join(' | ') + '\n' +
      '- Navigation items: ' + content.navigation.join(', ') + '\n' +
      '- Contact information: ' + content.contactInfo.join(', ') + '\n' +
      '- Social links: ' + content.socialLinks.join(', ') + '\n\n' +
      'REQUIREMENTS:\n' +
      '1. Create a modern, mobile-first responsive design\n' +
      '2. Use a ' + theme + ' color scheme and aesthetic\n' +
      '3. Preserve ALL original content and structure\n' +
      '4. Improve typography, spacing, and visual hierarchy\n' +
      '5. Add modern UI elements (cards, gradients, shadows)\n' +
      '6. Ensure the design fits a ' + businessType + ' business\n' +
      '7. Include proper meta tags and SEO optimization\n' +
      '8. Make it fully responsive for all devices\n' +
      '9. Use modern CSS (Grid, Flexbox, CSS variables)\n' +
      '10. Add subtle animations and hover effects\n\n' +
      'Generate complete, production-ready HTML/CSS code that can be immediately used.';

    console.log('AI Prompt built successfully');
    console.log('Calling OpenAI API...');
    console.log(`Prompt length: ${prompt.length} characters`);

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

    console.log('OpenAI API call completed successfully');
    console.log(`Response tokens used: ${completion.usage?.total_tokens || 'Unknown'}`);
    console.log(`Generated content length: ${completion.choices[0].message.content.length} characters`);

    // 3. Store generated designs
    console.log('Step 3: Storing generated design...');
    const newDesign = completion.choices[0].message.content;
    const demoUrl = `/demo/${jobId}`;

    console.log('Updating database with generated design...');
    await pool.query(
      'UPDATE jobs SET status = $1, demo_urls = $2, generated_html = $3 WHERE id = $4',
      ['completed', JSON.stringify([demoUrl]), newDesign, jobId]
    );
    console.log('Design stored in database successfully');
    console.log(`Demo URL: ${demoUrl}`);

    // 4. Send email if provided
    if (email) {
      console.log('Step 4: Sending email notification...');
      console.log(`Sending email to: ${email}`);
      
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
        subject: 'Your Website Redesign is Ready!',
        html: '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">' +
          '<h1 style="color: #333;">Your Website Redesign is Complete!</h1>' +
          '<p>We have successfully redesigned your website with a modern, ' + theme + ' aesthetic that is perfect for your ' + businessType + ' business.</p>' +
          '<p><strong>What is new:</strong></p>' +
          '<ul>' +
          '<li>Modern, responsive design</li>' +
          '<li>Mobile-first approach</li>' +
          '<li>' + theme + ' color scheme</li>' +
          '<li>Improved user experience</li>' +
          '<li>All your original content preserved</li>' +
          '</ul>' +
          '<div style="text-align: center; margin: 2rem 0;">' +
          '<a href="' + demoUrl + '" style="background: #007bff; color: white; padding: 1rem 2rem; text-decoration: none; border-radius: 5px; display: inline-block;">View Your New Design</a>' +
          '</div>' +
          '<p><em>Your redesigned website is ready to use!</em></p>' +
          '</div>'
      });
      console.log('Email sent successfully');
    } else {
      console.log('No email provided, skipping email notification');
    }

    console.log(`Website processing completed successfully for job ${jobId}!`);

  } catch (error) {
    console.error(`Error processing website for job ${jobId}:`, error);
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
    console.log(`Error status updated in database for job ${jobId}`);
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
      socialLinks.push(text + ': ' + href);
    }
  });
  return socialLinks;
}

// Add this new endpoint for image mockup
app.post('/api/create-mockup', async (req, res) => {
  try {
    console.log('Starting mockup generation process...');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const { website, theme, businessType } = req.body;
    const jobId = uuidv4();
    
    console.log('Generated mockup job ID:', jobId);
    console.log('Website:', website);
    console.log('Theme:', theme);
    console.log('Business Type:', businessType);

    // Store job in database
    console.log('Storing mockup job in database...');
    await pool.query(
      'INSERT INTO jobs (id, website, theme, business_type, status, job_type) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, theme, businessType, 'generating', 'mockup']
    );
    console.log('Mockup job stored in database successfully');

    // Start the mockup process asynchronously
    console.log('Starting async mockup generation...');
    createMockup(jobId, website, theme, businessType);

    console.log('Sending mockup response to client...');
    res.json({ 
      message: 'Mockup generation started', 
      jobId 
    });
    console.log('Mockup response sent successfully');
    
  } catch (error) {
    console.error('Error in /api/create-mockup:', error);
    res.status(500).json({ error: error.message });
  }
});

async function createMockup(jobId, website, theme, businessType) {
  try {
    console.log(`\nStarting mockup generation for job ${jobId}`);
    console.log(`Processing website: ${website}`);
    
    // Update initial status
    console.log('Updating job status to "scraping"...');
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['scraping', jobId]
    );
    console.log('Status updated to "scraping"');

    // 1. Scrape website content with enhanced extraction (same as main function)
    console.log('Step 1: Starting website scraping for mockup...');
    console.log('Making HTTP request to website...');
    
    const { data } = await axios.get(website);
    console.log('Website response received successfully');
    console.log(`Response size: ${(data.length / 1024).toFixed(2)} KB`);
    
    console.log('Loading HTML with Cheerio...');
    const $ = cheerio.load(data);
    console.log('HTML loaded and parsed successfully');
    
    console.log('Extracting content for mockup...');
    
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
    
    console.log('Mockup content extraction completed:');
    console.log(`   - Title: ${content.title}`);
    console.log(`   - Description: ${content.description}`);
    console.log(`   - Logo found: ${content.logo ? 'Yes' : 'No'}`);
    console.log(`   - Navigation items: ${content.navigation.length}`);
    console.log(`   - Headings: ${content.headings.length}`);
    console.log(`   - Paragraphs: ${content.paragraphs.length}`);
    console.log(`   - Contact info: ${content.contactInfo.length}`);
    console.log(`   - Social links: ${content.socialLinks.length}`);
    
    // Update status to generating
    console.log('Updating job status to "generating"...');
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['generating', jobId]
    );
    console.log('Status updated to "generating"');
    
    // 2. Generate image using DALL-E with enhanced prompt
    console.log('Step 2: Starting DALL-E image generation...');
    console.log('Building DALL-E prompt...');
    
    const prompt = 'Create a professional, modern website mockup for a ' + businessType + ' business with a ' + theme + ' theme.\n\n' +
      'BUSINESS CONTEXT:\n' +
      '- Business Type: ' + businessType + '\n' +
      '- Theme: ' + theme + '\n' +
      '- Website Title: ' + content.title + '\n' +
      '- Description: ' + content.description + '\n\n' +
      'CONTENT TO INCLUDE:\n' +
      '- Main headings: ' + content.headings.join(', ') + '\n' +
      '- Key content: ' + content.paragraphs.join(' | ') + '\n' +
      '- Navigation menu: ' + content.navigation.join(', ') + '\n' +
      '- Contact info: ' + content.contactInfo.join(', ') + '\n' +
      '- Social links: ' + content.socialLinks.join(', ') + '\n\n' +
      'DESIGN REQUIREMENTS:\n' +
      '- Modern, professional ' + theme + ' aesthetic\n' +
      '- Clean, responsive layout\n' +
      '- Professional typography and spacing\n' +
      '- ' + theme + ' color scheme throughout\n' +
      '- Mobile-friendly design elements\n' +
      '- Professional business appearance\n' +
      '- Include realistic content placement\n' +
      '- Show navigation, hero section, content areas\n' +
      '- Make it look like a real, professional website screenshot\n\n' +
      'Style: Professional website mockup, clean design, modern UI, business-appropriate, realistic content placement';

    console.log('DALL-E prompt built successfully');
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log('Calling DALL-E API...');

    const image = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });
    
    console.log('DALL-E API call completed successfully');
    console.log('DALL-E response received:', JSON.stringify(image, null, 2));
    
    if (!image.data || !image.data[0] || !image.data[0].url) {
      throw new Error('Failed to generate image - no URL returned');
    }

    const imageUrl = image.data[0].url;
    console.log('Generated image URL:', imageUrl);

    // 3. Store the result
    console.log('Storing mockup result...');
    console.log('Updating database with mockup URL...');
    
    await pool.query(
      'UPDATE jobs SET status = $1, mockup_url = $2 WHERE id = $3',
      ['completed', imageUrl, jobId]
    );
    console.log('Mockup result stored in database successfully');
    console.log(`Mockup generation completed successfully for job ${jobId}!`);

  } catch (error) {
    console.error(`Error generating mockup for job ${jobId}:`, error);
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
    console.log(`Error status updated in database for job ${jobId}`);
  }
}

// Update the status endpoint to handle both types with detailed status
app.get('/api/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`Status check requested for job: ${jobId}`);
    
    const result = await pool.query(
      'SELECT status, demo_urls, mockup_url, job_type, website FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (result.rows.length === 0) {
      console.log(`Job ${jobId} not found`);
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const job = result.rows[0];
    console.log(`Job ${jobId} status: ${job.status}, type: ${job.job_type}`);
    
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
    
    console.log(`Status response sent for job ${jobId}`);
    
  } catch (error) {
    console.error(`Error checking status for job ${req.params.jobId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Update the root route with new UI
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
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
      '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<meta name="description" content="AI-redesigned version of ' + originalWebsite + '">' +
        '<title>Redesigned: ' + originalWebsite + '</title>' +
        '<style>' +
        '.demo-header {' +
          'background: #f8f9fa;' +
          'border-bottom: 2px solid #007bff;' +
          'padding: 1rem;' +
          'text-align: center;' +
          'font-family: Arial, sans-serif;' +
        '}' +
        '.demo-header h1 {' +
          'margin: 0;' +
          'color: #007bff;' +
          'font-size: 1.5rem;' +
        '}' +
        '.demo-header p {' +
          'margin: 0.5rem 0 0 0;' +
          'color: #666;' +
          'font-size: 0.9rem;' +
        '}' +
        '.demo-header a {' +
          'color: #007bff;' +
          'text-decoration: none;' +
        '}' +
        '.demo-header a:hover {' +
          'text-decoration: underline;' +
        '}' +
        '</style>'
    ).replace(
      '<body>',
      '<body>' +
        '<div class="demo-header">' +
          '<h1>AI-Redesigned Website</h1>' +
          '<p>This is an AI-generated redesign of <a href="' + originalWebsite + '" target="_blank">' + originalWebsite + '</a></p>' +
          '<p>All original content has been preserved and enhanced with modern design</p>' +
          '</div>'
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

    console.log('Starting comprehensive website analysis for:', website);
    
    // 1. Analyze the main page first
    const mainPageData = await axios.get(website);
    const $ = cheerio.load(mainPageData.data);
    
    // 2. Extract all internal links to discover pages
    const internalLinks = new Set();
    const externalLinks = new Set();
    const navigationLinks = new Set();
    const allLinks = $('a[href]');
    
    console.log('Total links found on main page:', allLinks.length);
    
    allLinks.each(function(i, el) {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, website).href;
          const linkText = $(el).text().trim();
          const linkClasses = $(el).attr('class') || '';
          const parentElement = $(el).parent();
          const isInNav = $(el).closest('nav, .nav, .navbar, .navigation, .menu, .header, header').length > 0;
          
          if (absoluteUrl.startsWith(website)) {
            // Filter out cart, shop, checkout, admin pages
            if (!absoluteUrl.includes('/cart') && 
                !absoluteUrl.includes('/shop') && 
                !absoluteUrl.includes('/checkout') && 
                !absoluteUrl.includes('/admin') &&
                !absoluteUrl.includes('/login') &&
                !absoluteUrl.includes('/register') &&
                !absoluteUrl.includes('/account') &&
                !absoluteUrl.includes('/user') &&
                !absoluteUrl.includes('/search') &&
                !absoluteUrl.includes('/tag') &&
                !absoluteUrl.includes('/category') &&
                !absoluteUrl.includes('/page/') &&
                !absoluteUrl.includes('/comment') &&
                !absoluteUrl.includes('/reply')) {
              
              internalLinks.add(absoluteUrl);
              
              // Track navigation links specifically
              if (isInNav || 
                  linkClasses.includes('nav') || 
                  linkClasses.includes('menu') || 
                  linkClasses.includes('link') ||
                  parentElement.is('nav') ||
                  parentElement.hasClass('nav') ||
                  parentElement.hasClass('menu') ||
                  parentElement.hasClass('navigation')) {
                navigationLinks.add(absoluteUrl);
                console.log('Navigation link found:', linkText, '->', absoluteUrl);
              }
            }
          } else if (href.startsWith('http')) {
            externalLinks.add(absoluteUrl);
          }
        } catch (error) {
          console.log('Invalid URL:', href);
        }
      }
    });
    
    console.log('Navigation links found:', navigationLinks.size);
    console.log('Total internal pages found:', internalLinks.size);
    console.log('External links found:', externalLinks.size);
    
    // 3. Crawl internal pages to get comprehensive data
    const pageAnalysis = [];
    const allMetaData = new Map();
    const allKeywords = new Map();
    const deadLinks = [];
    const pageContent = [];
    
    console.log('Found ' + internalLinks.size + ' internal pages to analyze');
    
    // Limit to first 15 pages for performance
    const pagesToAnalyze = Array.from(internalLinks).slice(0, 15);
    
    for (const pageUrl of pagesToAnalyze) {
      try {
        console.log('Analyzing page: ' + pageUrl);
        const pageResponse = await axios.get(pageUrl, { timeout: 10000 });
        const page$ = cheerio.load(pageResponse.data);
        
        // Extract page-specific data
        const pageData = {
          url: pageUrl,
          title: page$('title').text().trim(),
          metaDescription: page$('meta[name="description"]').attr('content') || '',
          metaKeywords: page$('meta[name="keywords"]').attr('content') || '',
          h1Count: page$('h1').length,
          h2Count: page$('h2').length,
          h3Count: page$('h3').length,
          imageCount: page$('img').length,
          wordCount: page$('body').text().trim().split(/\s+/).length,
          loadTime: pageResponse.headers['x-response-time'] || 'unknown'
        };
        
        pageAnalysis.push(pageData);
        
        // Store page content for display
        const pageText = page$('body').text().trim();
        if (pageText.length > 100) {
          pageContent.push({
            url: pageUrl,
            title: pageData.title,
            content: pageText.substring(0, 500) + '...',
            wordCount: pageData.wordCount
          });
        }
        
        // Collect meta data
        page$('meta').each(function(i, el) {
          const name = page$(el).attr('name') || page$(el).attr('property');
          const content = page$(el).attr('content');
          if (name && content) {
            if (!allMetaData.has(name)) {
              allMetaData.set(name, new Set());
            }
            allMetaData.get(name).add(content);
          }
        });
        
        // Extract keywords from content
        const pageTextLower = pageText.toLowerCase();
        const words = pageTextLower.match(/\b[a-z]{3,}\b/g) || [];
        words.forEach(function(word) {
          if (word.length > 3) {
            allKeywords.set(word, (allKeywords.get(word) || 0) + 1);
          }
        });
        
      } catch (error) {
        console.log('Failed to analyze page ' + pageUrl + ':', error.message);
        deadLinks.push(pageUrl);
      }
    }
    
    // 4. Check external links for dead links
    console.log('Checking ' + externalLinks.size + ' external links for health...');
    const externalLinkChecks = Array.from(externalLinks).slice(0, 20); // Limit external checks
    
    for (const externalUrl of externalLinkChecks) {
      try {
        await axios.head(externalUrl, { timeout: 5000 });
      } catch (error) {
        if (error.response && error.response.status >= 400) {
          deadLinks.push(externalUrl);
        }
      }
    }
    
    // 5. Analyze main page content
    const mainPageAnalysis = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content') || '',
      logo: findLogo($),
      navigation: extractNavigation($),
      headings: $('h1, h2, h3').map(function(i, el) { return $(el).text().trim(); }).get().slice(0, 5),
      contactInfo: extractContactInfo($),
      socialLinks: extractSocialLinks($),
      estimatedBusinessType: estimateBusinessType($),
      suggestedThemes: suggestThemes($)
    };
    
    // 6. Compile comprehensive analysis
    const analysis = {
      // Basic info
      ...mainPageAnalysis,
      
      // Page structure
      totalPages: internalLinks.size,
      navigationPages: navigationLinks.size,
      analyzedPages: pageAnalysis.length,
      averageWordsPerPage: pageAnalysis.length > 0 ? Math.round(pageAnalysis.reduce(function(sum, page) { return sum + page.wordCount; }, 0) / pageAnalysis.length) : 0,
      
      // Content analysis
      totalImages: pageAnalysis.reduce(function(sum, page) { return sum + page.imageCount; }, 0),
      totalHeadings: {
        h1: pageAnalysis.reduce(function(sum, page) { return sum + page.h1Count; }, 0),
        h2: pageAnalysis.reduce(function(sum, page) { return sum + page.h2Count; }, 0),
        h3: pageAnalysis.reduce(function(sum, page) { return sum + page.h3Count; }, 0)
      },
      
      // Meta data summary
      metaDataSummary: Object.fromEntries(
        Array.from(allMetaData.entries()).map(function(entry) {
          return [
            entry[0], 
            Array.from(entry[1]).slice(0, 5) // Show first 5 unique values
          ];
        })
      ),
      
      // Top keywords (most frequent)
      topKeywords: Array.from(allKeywords.entries())
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 20)
        .map(function(entry) { return { word: entry[0], count: entry[1] }; }),
      
      // Link health
      linkHealth: {
        internalLinks: internalLinks.size,
        navigationLinks: navigationLinks.size,
        externalLinks: externalLinks.size,
        deadLinks: deadLinks.length,
        deadLinkPercentage: Math.round((deadLinks.length / (internalLinks.size + externalLinks.size)) * 100)
      },
      
      // SEO insights
      seoInsights: {
        hasTitle: !!mainPageAnalysis.title,
        hasDescription: !!mainPageAnalysis.description,
        titleLength: mainPageAnalysis.title ? mainPageAnalysis.title.length : 0,
        descriptionLength: mainPageAnalysis.description ? mainPageAnalysis.description.length : 0,
        titleOptimal: mainPageAnalysis.title && mainPageAnalysis.title.length >= 30 && mainPageAnalysis.title.length <= 60,
        descriptionOptimal: mainPageAnalysis.description && mainPageAnalysis.description.length >= 120 && mainPageAnalysis.description.length <= 160
      },
      
      // Page performance indicators
      performance: {
        averageLoadTime: 'analyzed', // Would need actual timing data
        imageOptimization: pageAnalysis.reduce(function(sum, page) { return sum + page.imageCount; }, 0) > 0 ? 'images present' : 'no images',
        contentDensity: pageAnalysis.length > 0 ? 'good' : 'limited'
      },
      
      // Business insights
      businessInsights: {
        estimatedBusinessType: mainPageAnalysis.estimatedBusinessType,
        suggestedThemes: mainPageAnalysis.suggestedThemes,
        hasContactInfo: mainPageAnalysis.contactInfo.length > 0,
        hasSocialLinks: mainPageAnalysis.socialLinks.length > 0,
        logoFound: !!mainPageAnalysis.logo
      },
      
      // Page content for display
      pageContent: pageContent,
      
      // Raw page analysis data
      pageAnalysis: pageAnalysis,
      
      // Navigation analysis
      navigation: {
        totalLinks: navigationLinks.size,
        links: Array.from(navigationLinks)
      }
    };

    console.log('Comprehensive analysis completed successfully');
    res.json(analysis);
    
  } catch (error) {
    console.error('Error in comprehensive website analysis:', error);
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
  console.log('Server running on port', PORT);
});