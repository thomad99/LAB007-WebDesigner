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
import fetch from 'node-fetch';

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
    
    const { website, theme, pageCount } = req.body;
    const jobId = uuidv4();
    
    // Set default values for removed fields
    const email = null;
    const businessType = 'general';
    const maxPages = pageCount ? parseInt(pageCount) : 1; // Use provided page count or default to 1
    
    console.log('Generated job ID:', jobId);
    console.log('Website:', website);
    console.log('Email:', email || 'Not provided');
    console.log('Theme:', theme);
    console.log('Business Type:', businessType);
    console.log('Max Pages to Process:', maxPages);

    // Store job in database
    console.log('Storing job in database...');
    await pool.query(
      'INSERT INTO jobs (id, website, email, theme, business_type, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [jobId, website, email, theme, businessType, 'scraping']
    );
    console.log('Job stored in database successfully');

    // Start the process asynchronously
    console.log('Starting async website processing...');
    processWebsite(jobId, website, email, theme, businessType, maxPages);

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

async function processWebsite(jobId, website, email, theme, businessType, maxPages = 1) {
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
    
    // Enhanced content extraction - identify all pages
    const pages = identifyPages($, website);
    console.log(`Found ${pages.length} pages to redesign`);
    
    // Limit pages based on user selection
    const pagesToProcess = pages.slice(0, maxPages);
    console.log(`Processing ${pagesToProcess.length} pages (limited to ${maxPages} as requested)`);
    
    // Store page information in database
    await pool.query(
      'UPDATE jobs SET total_pages = $1 WHERE id = $2',
      [pagesToProcess.length, jobId]
    );
    
            // Process each page individually
        const redesignedPages = [];
        const chatgptPrompts = [];
        
        for (let i = 0; i < pagesToProcess.length; i++) {
          const page = pagesToProcess[i];
          console.log(`Processing page ${i + 1} of ${pagesToProcess.length}: ${page.title}`);
          
          // Update progress in database for frontend
          await pool.query(
            'UPDATE jobs SET current_page = $1, status = $2 WHERE id = $3',
            [i + 1, 'processing_page', jobId]
          );
          
          // Generate AI prompt for this specific page
          const pagePrompt = buildPagePrompt(page, businessType, theme);
          
          // Store the prompt for frontend display
          chatgptPrompts.push({
            title: page.title,
            prompt: pagePrompt
          });
          
          // Send to ChatGPT
          console.log(`Sending page ${i + 1} of ${pagesToProcess.length} to ChatGPT...`);
          const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
              {
                role: "system",
                content: "You are an expert web designer and front-end developer with extensive experience in creating modern, responsive websites. Your expertise includes semantic HTML5, modern CSS (Grid, Flexbox, CSS Variables), accessibility best practices, and SEO optimization. Generate complete, production-ready HTML/CSS code that can be immediately used. No explanations, no markdown formatting, no commentary - only pure HTML output."
              },
              {
                role: "user",
                content: pagePrompt
              }
            ],
            max_tokens: 7000,
            temperature: 0.2
          });
          
          console.log(`ChatGPT returned HTML for page ${i + 1}`);
          
          // Clean and store the generated HTML
          let generatedHtml = completion.choices[0].message.content;
          generatedHtml = cleanAIResponse(generatedHtml);
          
          // Add LAB007 branding (favicon and logo)
          generatedHtml = addLAB007Branding(generatedHtml, page.title, page.url);
          
          // Store this page's HTML
          const pageId = uuidv4(); // Generate proper UUID for each page
          await pool.query(
            'INSERT INTO page_designs (id, job_id, page_number, title, url, generated_html, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
            [pageId, jobId, i + 1, page.title, page.url, generatedHtml]
          );
          
          redesignedPages.push({
            pageNumber: i + 1,
            title: page.title,
            url: page.url,
            demoUrl: `/demo/${pageId}`
          });
          
          console.log(`Page ${i + 1} stored on web server`);
        }
    
    // Generate mockup image for the home page (first page)
    console.log('Generating mockup image for home page...');
    
    // Update status to show mockup generation
    await pool.query(
      'UPDATE jobs SET status = $1 WHERE id = $2',
      ['generating_mockup', jobId]
    );
    
    // Update the jobs table with chatgpt_prompts if the column exists
    try {
      await pool.query(
        'UPDATE jobs SET chatgpt_prompts = $1 WHERE id = $2',
        [JSON.stringify(chatgptPrompts), jobId]
      );
    } catch (error) {
      console.log('chatgpt_prompts column not found, skipping update');
    }
    
    // Also try to update other missing columns if they don't exist
    try {
      await pool.query(
        'UPDATE jobs SET mockup_url = $1 WHERE id = $2',
        [mockupUrl, jobId]
      );
    } catch (error) {
      console.log('mockup_url column not found, skipping update');
    }
    
    const homePage = pages[0];
    const imagePrompt = `Create a professional website mockup image for a ${businessType} business with ${theme} design theme. 
    
    Website details:
    - Title: ${homePage.title}
    - Description: ${homePage.description || 'Professional business website'}
    - Theme: ${theme}
    - Business Type: ${businessType}
    
    The mockup should show:
    - Modern, professional layout
    - ${theme} color scheme and styling
    - Responsive design elements
    - Professional typography
    - Clean, modern aesthetics
    
    Generate a high-quality, realistic website mockup that showcases the redesigned website's appearance.`;
    
    try {
      const imageCompletion = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });
      
      const mockupImageUrl = imageCompletion.data[0].url;
      console.log('Mockup image generated successfully:', mockupImageUrl);
      
      // Store the mockup image URL in the jobs table
      await pool.query(
        'UPDATE jobs SET mockup_url = $1 WHERE id = $2',
        [mockupImageUrl, jobId]
      );
    } catch (imageError) {
      console.error('Error generating mockup image:', imageError);
      // Continue without image if there's an error
    }
    
          // Update status to completed
      await pool.query(
        'UPDATE jobs SET status = $1 WHERE id = $2',
        ['completed', jobId]
      );
      
      // Store the prompts in the database
      await pool.query(
        'UPDATE jobs SET demo_urls = $1, chatgpt_prompts = $2 WHERE id = $3',
        [JSON.stringify(redesignedPages.map(p => p.demoUrl)), JSON.stringify(chatgptPrompts), jobId]
      );
      
      // Store the main content for reference
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

    // Update status to completed
    console.log('Updating job status to "completed"...');
    await pool.query(
      'UPDATE jobs SET status = $1, demo_urls = $2 WHERE id = $3',
      ['completed', JSON.stringify(redesignedPages.map(p => p.demoUrl)), jobId]
    );
    console.log('Status updated to "completed"');
    
    console.log('All pages redesigned and stored successfully');
    console.log(`Total pages processed: ${redesignedPages.length}`);

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

// Function to add LAB007 branding to generated HTML
function addLAB007Branding(html, pageTitle, pageUrl) {
  // Find the <head> tag and add favicon
  if (html.includes('<head>')) {
    const faviconLink = '<link rel="icon" type="image/png" href="/SpinnerLogo.png">';
    html = html.replace('<head>', `<head>\n    ${faviconLink}`);
  }
  
  // Check if there's already a LAB007 header to avoid duplicates
  if (html.includes('LAB007') && html.includes('AI-Powered Website Redesign')) {
    console.log('LAB007 header already exists, skipping duplicate');
    return html;
  }
  
  // Find the <body> tag and add LAB007 logo at the top
  if (html.includes('<body>')) {
    const logoHeader = `
    <!-- LAB007 AI Redesigned Website -->
    <header style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1rem; text-align: center; border-bottom: 3px solid #667eea;">
      <img src="/lab007-trans.PNG" alt="LAB007 Logo" style="max-width: 200px; height: auto; margin-bottom: 0.5rem;">
      <div style="font-size: 0.9rem; opacity: 0.8;">AI-Powered Website Redesign</div>
      <div style="font-size: 0.8rem; opacity: 0.6; margin-top: 0.25rem;">Original: ${pageUrl}</div>
    </header>`;
    
    html = html.replace('<body>', `<body>\n    ${logoHeader}`);
  }
  
  return html;
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

// Helper function to identify all pages on the website
function identifyPages($, baseUrl) {
  const pages = [];
  const baseUrlObj = new URL(baseUrl);
  
  // Add the main page
  pages.push({
    title: $('title').text().trim() || 'Home Page',
    url: baseUrl,
    content: {
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
      navigation: extractNavigation($),
      contactInfo: extractContactInfo($),
      socialLinks: extractSocialLinks($)
    }
  });
  
  // Find internal links that could be other pages
  $('a[href^="/"], a[href^="' + baseUrlObj.origin + '"]').each((i, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    
    if (text && text.length > 3 && text.length < 50 && href) {
      let fullUrl = href;
      if (href.startsWith('/')) {
        fullUrl = baseUrlObj.origin + href;
      }
      
      // Avoid duplicates and common non-page links
      if (!pages.find(p => p.url === fullUrl) && 
          !href.includes('#') && 
          !href.includes('.pdf') && 
          !href.includes('.jpg') && 
          !href.includes('.png')) {
        
        pages.push({
          title: text,
          url: fullUrl,
          content: {
            headings: [text], // We'll get full content when processing
            paragraphs: [],
            images: [],
            navigation: [],
            contactInfo: [],
            socialLinks: []
          }
        });
      }
    }
  });
  
  // Limit to reasonable number of pages (max 10)
  return pages.slice(0, 10);
}

// Helper function to build page-specific prompts
function buildPagePrompt(page, businessType, theme) {
  return `You are an expert web designer and front-end developer. I will give you a website page to redesign.

PAGE DETAILS:
- Title: ${page.title}
- URL: ${page.url}
- Business Type: ${businessType}
- Design Theme: ${theme}

SOURCE CONTENT TO PRESERVE:
• Headings: ${page.content.headings.map(h => h.text).join(' | ')}
• Main Content: ${page.content.paragraphs.slice(0, 3).join(' | ')}
• Navigation Items: ${page.content.navigation.join(' | ')}
• Contact Information: ${page.content.contactInfo.join(' | ')}
• Social Links: ${page.content.socialLinks.join(' | ')}

REDESIGN REQUIREMENTS:
Create a **single-page HTML** redesign with a **${theme} theme** and modern styling using only HTML + CSS (no external frameworks).

The HTML must:
- Contain all the same sections and structure as the source page
- Paraphrase the text content so it's not identical but maintains the same meaning
- Use semantic HTML5 tags (header, nav, main, section, article, footer, etc.)
- Be fully responsive and mobile-friendly
- Have all CSS inline in a <style> block within the HTML
- Avoid external dependencies or CDN links
- Include smooth animations and hover effects
- Use modern CSS features (Grid, Flexbox, CSS Variables, etc.)
- Have proper accessibility features (alt text, ARIA labels, etc.)
- Be SEO-optimized with proper meta tags and structure

DESIGN APPROACH:
- Apply the ${theme} theme consistently throughout
- Use modern design principles (glassmorphism, shadows, gradients)
- Ensure excellent typography hierarchy and readability
- Create engaging visual elements that enhance the ${businessType} business type
- Make the design look professional and premium-quality

OUTPUT: Generate complete, production-ready HTML/CSS code only. No explanations, no markdown formatting, no commentary. Output pure HTML that can be immediately used.`;
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

// Add new endpoint for Remix v2 (streaming approach)
app.post('/api/remix-v2', async (req, res) => {
  try {
    console.log('Starting Remix v2 process...');
    const { sourceUrl, siteText, theme = "dark", styleNotes = "" } = req.body;
    
    console.log('Remix v2 request:', { sourceUrl, theme, styleNotes, textLength: siteText?.length || 0 });
    
    // Build the system + user prompt for v2
    const userPrompt = `You are a senior front-end designer.
Create a single-page HTML document with inline CSS (no frameworks).
Theme: ${theme.toUpperCase()}. Style notes: ${styleNotes}

Requirements:
- Keep the same information architecture & menu labels from the provided text.
- Paraphrase copy; preserve meaning, don't copy verbatim.
- Strong contrast, accessible focus states, responsive layout.
- Polished hero, nav, sections, and a simple contact form (no external posts).
- No external fonts/scripts/images. Use only HTML + <style>.
- Output ONLY the final HTML.

Source URL (context only): ${sourceUrl || "N/A"}
Raw text & menu:
${siteText}`;

    // Using the Chat Completions API with streaming
    const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",              // Using gpt-4o for better compatibility
        temperature: 0.2,
        stream: true,                // enable streaming
        messages: [
          {
            role: "system",
            content: "You are an expert web designer and front-end developer. Output only valid HTML."
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    if (!apiRes.ok) {
      throw new Error(`OpenAI API error: ${apiRes.status} ${apiRes.statusText}`);
    }

    // Stream chunks back to the browser
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Handle the streaming response properly
    console.log('Response status:', apiRes.status);
    console.log('Response headers:', apiRes.headers);
    
    if (apiRes.body) {
      console.log('Streaming response detected');
      apiRes.body.on("data", (chunk) => {
        console.log('Received chunk:', chunk.toString().substring(0, 100));
        res.write(chunk);
      });
      
      apiRes.body.on("end", () => {
        console.log('Stream ended');
        res.end();
      });
      
      apiRes.body.on("error", (err) => {
        console.error('Streaming error:', err);
        try { res.end(); } catch {}
      });
    } else {
      console.log('Non-streaming response, using fallback');
      // Fallback for non-streaming responses
      const data = await apiRes.text();
      console.log('Fallback data received:', data.substring(0, 200));
      res.write(data);
      res.end();
    }
    
  } catch (error) {
    console.error('Error in Remix v2:', error);
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
    
    // Get job status - handle missing columns gracefully
    let result;
    try {
      result = await pool.query(
        'SELECT status, demo_urls, mockup_url, job_type, website, chatgpt_prompts FROM jobs WHERE id = $1',
        [jobId]
      );
    } catch (error) {
      if (error.code === '42703') { // Column doesn't exist
        console.log('Some columns missing, using fallback query');
        result = await pool.query(
          'SELECT status, website FROM jobs WHERE id = $1',
          [jobId]
        );
        // Add missing columns with default values
        result.rows[0] = {
          ...result.rows[0],
          demo_urls: null,
          mockup_url: null,
          job_type: 'website',
          chatgpt_prompts: []
        };
      } else {
        throw error;
      }
    }
    
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
      website: job.website,
      chatgptPrompts: job.chatgpt_prompts
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

// Database setup endpoint to add missing columns
app.post('/api/setup-database', async (req, res) => {
  try {
    console.log('Setting up database schema...');
    
    // Add missing columns if they don't exist
    const alterQueries = [
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1',
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 1',
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS chatgpt_prompts JSONB DEFAULT \'[]\'',
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mockup_url TEXT',
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS demo_urls TEXT[]',
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT \'website\''
    ];
    
    for (const query of alterQueries) {
      try {
        await pool.query(query);
        console.log('Executed:', query);
      } catch (error) {
        console.log('Column already exists or error:', error.message);
      }
    }
    
    // Create page_designs table if it doesn't exist
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS page_designs (
          id UUID PRIMARY KEY,
          job_id UUID REFERENCES jobs(id),
          page_number INTEGER,
          title TEXT,
          url TEXT,
          generated_html TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('page_designs table created/verified');
    } catch (error) {
      console.log('Error with page_designs table:', error.message);
    }
    
    res.json({ message: 'Database setup completed successfully' });
  } catch (error) {
    console.error('Database setup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add this after your other endpoints
app.get('/demo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First try to find it as a page design
    let result = await pool.query(
      'SELECT pd.generated_html, j.website FROM page_designs pd JOIN jobs j ON pd.job_id = j.id WHERE pd.id = $1',
      [id]
    );
    
    let generatedHtml, originalWebsite;
    
    if (result.rows.length > 0) {
      // Found as page design
      generatedHtml = result.rows[0].generated_html;
      originalWebsite = result.rows[0].website;
    } else {
      // Try to find as job (fallback for old format)
      result = await pool.query(
        'SELECT generated_html, website FROM jobs WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0 || !result.rows[0].generated_html) {
        return res.status(404).send('Demo not found');
      }
      
      generatedHtml = result.rows[0].generated_html;
      originalWebsite = result.rows[0].website;
    }
    
    // Enhance the generated HTML with LAB007 logo header instead of text
    const enhancedHtml = generatedHtml.replace(
      '<head>',
      '<head>' +
        '<link rel="icon" type="image/png" href="/SpinnerLogo.png">' +
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
        chatgpt_prompts JSONB,
        total_pages INTEGER DEFAULT 1,
        current_page INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS page_designs (
        id TEXT PRIMARY KEY,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        page_number INTEGER DEFAULT 1,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        generated_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add missing columns if they don't exist
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 1;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS chatgpt_prompts JSONB;
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
        chatgpt_prompts JSONB,
        total_pages INTEGER DEFAULT 1,
        current_page INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS page_designs (
        id TEXT PRIMARY KEY,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        page_number INTEGER DEFAULT 1,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        generated_html TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add missing columns if they don't exist
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_pages INTEGER DEFAULT 1;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_page INTEGER DEFAULT 1;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS chatgpt_prompts JSONB;
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
            <p><strong>Tables Created:</strong> jobs, page_designs</p>
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