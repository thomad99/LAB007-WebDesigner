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
    
    const prompt = 'You are a world-class web designer and developer tasked with creating an exceptional, modern website redesign.\n\n' +
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
      'DESIGN REQUIREMENTS:\n' +
      '1. Create a stunning, premium-quality design that looks like it was built by top-tier agencies\n' +
      '2. Use a sophisticated ' + theme + ' color scheme with carefully chosen complementary colors\n' +
      '3. Preserve ALL original content and structure while dramatically improving presentation\n' +
      '4. Implement advanced typography with proper font hierarchy, line heights, and spacing\n' +
      '5. Add premium UI elements: glassmorphism effects, subtle shadows, gradients, and micro-interactions\n' +
      '6. Ensure the design perfectly fits a ' + businessType + ' business with appropriate visual language\n' +
      '7. Include comprehensive meta tags, structured data, and SEO optimization\n' +
      '8. Create a fully responsive design that works flawlessly on all devices\n' +
      '9. Use cutting-edge CSS: Grid, Flexbox, CSS variables, custom properties, and modern selectors\n' +
      '10. Add sophisticated animations: smooth transitions, hover effects, scroll-triggered animations\n' +
      '11. Implement modern design patterns: card layouts, hero sections, feature grids, and testimonials\n' +
      '12. Use CSS custom properties for consistent theming and easy customization\n' +
      '13. Add accessibility features: proper ARIA labels, focus states, and keyboard navigation\n' +
      '14. Optimize for performance with efficient CSS and minimal JavaScript\n' +
      '15. Include modern web features: smooth scrolling, lazy loading, and progressive enhancement\n\n' +
      'TECHNICAL REQUIREMENTS:\n' +
      '- Use semantic HTML5 elements for better SEO and accessibility\n' +
      '- Implement CSS Grid and Flexbox for modern layouts\n' +
      '- Use CSS custom properties for consistent theming\n' +
      '- Add smooth transitions and animations (0.3s ease-in-out)\n' +
      '- Ensure mobile-first responsive design\n' +
      '- Use modern CSS features like backdrop-filter, box-shadow, and gradients\n' +
      '- Include proper meta viewport and charset tags\n' +
      '- Optimize for Core Web Vitals and performance\n\n' +
      'Generate complete, production-ready HTML/CSS code that represents the highest quality of modern web design. The result should look like it was created by a premium design agency.';

    console.log('AI Prompt built successfully');
    console.log('Calling OpenAI API...');
    console.log(`Prompt length: ${prompt.length} characters`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a world-class web designer and developer with expertise in creating premium, award-winning websites. Your designs should rival those created by top-tier design agencies like Pentagram, IDEO, or Frog Design. Generate complete, modern HTML/CSS code that preserves original content while creating an exceptional, premium-quality design that exceeds modern web standards. Use semantic HTML5, cutting-edge CSS, and ensure the code is production-ready with perfect accessibility and performance."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 7000,
      temperature: 0.7
    });

    console.log('OpenAI API call completed successfully');
    console.log(`Response tokens used: ${completion.usage?.total_tokens || 'Unknown'}`);
    console.log(`Generated content length: ${completion.choices[0].message.content.length} characters`);

    // 3. Store generated designs
    console.log('Step 3: Storing generated design...');
    let newDesign = completion.choices[0].message.content;
    
    // Clean up the AI response to extract only the HTML/CSS code
    newDesign = cleanAIResponse(newDesign);
    
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

// Helper function to clean AI response and extract only HTML/CSS code
function cleanAIResponse(content) {
  // Remove common AI explanatory text patterns
  let cleaned = content;
  
  // Remove markdown code blocks and explanatory text
  cleaned = cleaned.replace(/```html\s*/gi, '');
  cleaned = cleaned.replace(/```css\s*/gi, '');
  cleaned = cleaned.replace(/```\s*$/gm, '');
  
  // Remove common AI explanatory phrases
  const explanatoryPatterns = [
    /Creating a full, production-ready HTML\/CSS code would be too extensive for this platform\. However, I can provide you a basic structure and styling that you can continue to build upon\./gi,
    /Here's a complete HTML\/CSS implementation:/gi,
    /Here's the HTML and CSS code:/gi,
    /Here's a modern, responsive design:/gi,
    /I'll create a professional website design for you:/gi,
    /Here's a complete website redesign:/gi,
    /This design includes:/gi,
    /Features of this design:/gi,
    /The design incorporates:/gi,
    /This modern design features:/gi,
    /Here's what I've created:/gi,
    /I've designed a website that:/gi,
    /This professional design includes:/gi,
    /The website design features:/gi,
    /Here's a professional redesign:/gi,
    /I've created a modern design with:/gi,
    /This responsive design includes:/gi,
    /The design showcases:/gi,
    /Here's a complete redesign featuring:/gi,
    /I've built a website that:/gi
  ];
  
  explanatoryPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Remove any remaining explanatory text before HTML tags
  const htmlStartIndex = cleaned.search(/<[^!]/);
  if (htmlStartIndex > 0) {
    cleaned = cleaned.substring(htmlStartIndex);
  }
  
  // Remove any text after the last HTML tag
  const htmlEndIndex = cleaned.lastIndexOf('>');
  if (htmlEndIndex > 0 && htmlEndIndex < cleaned.length - 1) {
    cleaned = cleaned.substring(0, htmlEndIndex + 1);
  }
  
  // Clean up extra whitespace and newlines
  cleaned = cleaned.trim();
  
  // Ensure the content starts with <!DOCTYPE html> or <html>
  if (!cleaned.startsWith('<!DOCTYPE html') && !cleaned.startsWith('<html')) {
    // If it doesn't start properly, try to find the HTML start
    const htmlMatch = cleaned.match(/(<!DOCTYPE html[^>]*>.*)/is);
    if (htmlMatch) {
      cleaned = htmlMatch[1];
    }
  }
  
  console.log('AI response cleaned successfully');
  console.log(`Original length: ${content.length}, Cleaned length: ${cleaned.length}`);
  
  return cleaned;
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
    
    // Enhance the generated HTML with LAB007 logo header instead of text
    const enhancedHtml = generatedHtml.replace(
      '<head>',
      '<head>' +
        '<meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<meta name="description" content="AI-redesigned version of ' + originalWebsite + '">' +
        '<title>Redesigned: ' + originalWebsite + '</title>' +
        '<style>' +
        'body {' +
          'background: linear-gradient(135deg, #2d1b69 0%, #1a103f 25%, #3d1f7a 50%, #2d1b69 75%, #1a103f 100%);' +
          'background-size: 400% 400%;' +
          'animation: gradientShift 8s ease infinite;' +
          'position: relative;' +
        '}' +
        'body::before {' +
          'content: "";' +
          'position: fixed;' +
          'top: 0;' +
          'left: 0;' +
          'width: 100%;' +
          'height: 100%;' +
          'background-image: ' +
            'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),' +
            'radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),' +
            'radial-gradient(circle at 40% 40%, rgba(120, 119, 255, 0.2) 0%, transparent 50%);' +
          'pointer-events: none;' +
          'z-index: -1;' +
        '}' +
        'body::after {' +
          'content: "";' +
          'position: fixed;' +
          'top: 0;' +
          'left: 0;' +
          'width: 100%;' +
          'height: 100%;' +
          'background-image: url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'1\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");' +
          'pointer-events: none;' +
          'z-index: -1;' +
        '}' +
        '@keyframes gradientShift {' +
          '0% { background-position: 0% 50%; }' +
          '50% { background-position: 100% 50%; }' +
          '100% { background-position: 0% 50%; }' +
        '}' +
        '.demo-header {' +
          'background: rgba(45, 27, 105, 0.9);' +
          'backdrop-filter: blur(10px);' +
          'border-bottom: 2px solid #667eea;' +
          'padding: 1.5rem;' +
          'text-align: center;' +
          'font-family: Arial, sans-serif;' +
          'box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);' +
        '}' +
        '.demo-header .logo {' +
          'max-width: 200px;' +
          'height: auto;' +
          'border-radius: 10px;' +
          'margin: 0 auto;' +
          'display: block;' +
          'filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));' +
        '}' +
        '.demo-header .subtitle {' +
          'color: #ffffff;' +
          'font-size: 0.9rem;' +
          'margin-top: 0.5rem;' +
          'opacity: 0.9;' +
          'text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);' +
        '}' +
        '</style>'
    ).replace(
      '<body>',
      '<body>' +
        '<div class="demo-header">' +
          '<img src="/lab007-trans.PNG" alt="LAB007 Logo" class="logo">' +
          '<div class="subtitle">AI-Powered Website Redesign</div>' +
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
          
          if (absoluteUrl.startsWith(website) && !absoluteUrl.includes('#') && !absoluteUrl.includes('javascript:')) {
            // Check if this is a main navigation link (not too deep)
            const urlPath = new URL(absoluteUrl).pathname;
            const pathDepth = urlPath.split('/').filter(segment => segment.length > 0).length;
            
            // Only include main pages: index (depth 0) and direct navigation (depth 1)
            // For sub-menus, only take the first item from each level
            let shouldInclude = false;
            
            if (pathDepth <= 1) {
              // Main pages and direct navigation
              shouldInclude = true;
            } else if (pathDepth === 2) {
              // Sub-menu items - only include if it's the first of its type
              const parentPath = urlPath.split('/').slice(0, -1).join('/');
              const existingSubMenu = Array.from(internalLinks).some(existingUrl => {
                const existingPath = new URL(existingUrl).pathname;
                return existingPath.startsWith(parentPath) && existingPath !== parentPath;
              });
              shouldInclude = !existingSubMenu;
            }
            
            if (shouldInclude) {
              internalLinks.add(absoluteUrl);
              
              if (isInNav || linkClasses.includes('nav') || linkClasses.includes('menu') || 
                  parentElement.hasClass('nav') || parentElement.hasClass('menu') ||
                  linkText.length > 0 && linkText.length < 50) {
                navigationLinks.add(absoluteUrl);
                console.log('Navigation link found:', linkText, '->', absoluteUrl);
              }
            }
          } else if (href.startsWith('http') && !href.startsWith(website)) {
            externalLinks.add(absoluteUrl);
          }
        } catch (error) {
          console.log('Skipping invalid link:', href, 'Error:', error.message);
        }
      }
    });
    
    console.log('Internal links found:', internalLinks.size);
    console.log('Navigation links found:', navigationLinks.size);
    console.log('External links found:', externalLinks.size);
    
    // 3. Analyze main pages only (limit to 10 to avoid too many requests)
    const pagesToAnalyze = Array.from(internalLinks).slice(0, 10);
    console.log('Pages to analyze:', pagesToAnalyze.length);
    
    const pageAnalysis = [];
    for (const pageUrl of pagesToAnalyze) {
      try {
        console.log('Analyzing page:', pageUrl);
        const pageResponse = await axios.get(pageUrl);
        const page$ = cheerio.load(pageResponse.data);
        
        const pageData = {
          url: pageUrl,
          title: page$('title').text().trim(),
          metaDescription: page$('meta[name="description"]').attr('content') || '',
          metaKeywords: page$('meta[name="keywords"]').attr('content') || '',
          wordCount: page$('body').text().trim().split(/\s+/).length,
          imageCount: page$('img').length,
          h1Count: page$('h1').length,
          h2Count: page$('h2').length,
          h3Count: page$('h3').length,
          content: page$('body').text().trim().substring(0, 500),
          links: page$('a[href]').length
        };
        
        pageAnalysis.push(pageData);
        console.log('Page analysis completed:', pageData.title);
        
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log('Error analyzing page:', pageUrl, 'Error:', error.message);
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
      
      // Page structure - focused on main pages only
      totalPages: internalLinks.size,
      navigationPages: navigationLinks.size,
      mainPages: pagesToAnalyze.length,
      analyzedPages: pageAnalysis.length,
      averageWordsPerPage: pageAnalysis.length > 0 ? Math.round(pageAnalysis.reduce(function(sum, page) { return sum + page.wordCount; }, 0) / pageAnalysis.length) : 0,
      
      // Content analysis
      totalImages: pageAnalysis.reduce(function(sum, page) { return sum + page.imageCount; }, 0),
      totalHeadings: {
        h1: pageAnalysis.reduce(function(sum, page) { return sum + page.h1Count; }, 0),
        h2: pageAnalysis.reduce(function(sum, page) { return sum + page.h2Count; }, 0),
        h3: pageAnalysis.reduce(function(sum, page) { return sum + page.h3Count; }, 0)
      },
      
      // Page depth analysis
      pageDepth: {
        indexLevel: 1, // Always 1 for index
        directNavigation: Array.from(internalLinks).filter(url => {
          const path = new URL(url).pathname;
          return path.split('/').filter(segment => segment.length > 0).length === 1;
        }).length,
        subMenuLevel: Array.from(internalLinks).filter(url => {
          const path = new URL(url).pathname;
          return path.split('/').filter(segment => segment.length > 0).length === 2;
        }).length
      },
      
      // Link health
      linkHealth: {
        internalLinks: internalLinks.size,
        navigationLinks: navigationLinks.size,
        externalLinks: externalLinks.size,
        mainPageLinks: pagesToAnalyze.length,
        subPageLinks: internalLinks.size - pagesToAnalyze.length
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
      
      // Business insights
      businessInsights: {
        estimatedBusinessType: mainPageAnalysis.estimatedBusinessType,
        suggestedThemes: mainPageAnalysis.suggestedThemes,
        hasContactInfo: mainPageAnalysis.contactInfo.length > 0,
        hasSocialLinks: mainPageAnalysis.socialLinks.length > 0,
        logoFound: !!mainPageAnalysis.logo
      },
      
      // Page content for redesign focus
      pageContent: pageAnalysis.map(function(page) {
        return {
          url: page.url,
          title: page.title,
          wordCount: page.wordCount,
          content: page.content,
          isMainPage: page.url === website || new URL(page.url).pathname.split('/').filter(segment => segment.length > 0).length <= 1
        };
      })
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

// Temporary database setup endpoint (remove after use)
app.post('/api/setup-database', async (req, res) => {
  try {
    console.log('Setting up database tables...');
    
    const setupSQL = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        website TEXT NOT NULL,
        email TEXT,
        theme VARCHAR(50) NOT NULL,
        business_type VARCHAR(50) NOT NULL,
        status TEXT NOT NULL,
        job_type VARCHAR(50) DEFAULT 'clone',
        demo_urls JSONB,
        mockup_url TEXT,
        generated_html TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(setupSQL);
    console.log('Database tables created successfully');
    
    res.json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Database setup error:', error);
    res.status(500).json({ error: 'Failed to setup database: ' + error.message });
  }
});

// GET endpoint for easy browser access
app.get('/api/setup-database', async (req, res) => {
  try {
    console.log('Setting up database tables via GET request...');
    
    const setupSQL = `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        website TEXT NOT NULL,
        email TEXT,
        theme VARCHAR(50) NOT NULL,
        business_type VARCHAR(50) NOT NULL,
        status TEXT NOT NULL,
        job_type VARCHAR(50) DEFAULT 'clone',
        demo_urls JSONB,
        mockup_url TEXT,
        generated_html TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await pool.query(setupSQL);
    console.log('Database tables created successfully');
    
    res.send(`
      <html>
        <head><title>Database Setup</title></head>
        <body style="font-family: Arial, sans-serif; padding: 2rem; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #28a745;">✅ Database Setup Complete!</h1>
            <p><strong>Message:</strong> Database initialized successfully</p>
            <p><strong>Tables Created:</strong> jobs</p>
            <p><strong>Next Step:</strong> You can now use the generate website functionality!</p>
            <a href="/" style="display: inline-block; background: #667eea; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 5px; margin-top: 1rem;">← Back to Website</a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Database setup error:', error);
    res.status(500).send(`
      <html>
        <head><title>Database Setup Error</title></head>
        <body style="font-family: Arial, sans-serif; padding: 2rem; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #dc3545;">❌ Database Setup Failed</h1>
            <p><strong>Error:</strong> ${error.message}</p>
            <p>Please check your database connection settings in Render.</p>
            <a href="/" style="display: inline-block; background: #6c757d; color: white; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 5px; margin-top: 1rem;">← Back to Website</a>
          </div>
        </body>
      </html>
    `);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});