import puppeteer from 'puppeteer';
import cheerio from 'cheerio';
import axios from 'axios';
import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';

export class WebsiteCloner {
  constructor(url, theme, businessType) {
    this.url = url;
    this.theme = theme;
    this.businessType = businessType;
    this.outputDir = path.join(process.cwd(), 'output', Date.now().toString());
  }

  async clone() {
    try {
      // Create output directory
      await fs.ensureDir(this.outputDir);

      // Launch browser
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      
      // Get website content
      await page.goto(this.url);
      const content = await page.content();
      
      // Parse content
      const $ = cheerio.load(content);
      
      // Extract data
      const data = {
        title: $('title').text(),
        description: $('meta[name="description"]').attr('content'),
        headings: $('h1, h2, h3').map((i, el) => $(el).text()).get(),
        images: $('img').map((i, el) => $(el).attr('src')).get(),
        text: $('p').map((i, el) => $(el).text()).get()
      };

      // Download and process images
      await this.processImages(data.images);

      // Generate variations
      const variations = await this.generateVariations(data);

      // Close browser
      await browser.close();

      return variations;
    } catch (error) {
      console.error('Cloning error:', error);
      throw error;
    }
  }

  async processImages(images) {
    const imageDir = path.join(this.outputDir, 'images');
    await fs.ensureDir(imageDir);

    for (const imageUrl of images) {
      try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageName = path.basename(imageUrl);
        await sharp(response.data)
          .resize(800, null, { withoutEnlargement: true })
          .toFile(path.join(imageDir, imageName));
      } catch (error) {
        console.error(`Error processing image ${imageUrl}:`, error);
      }
    }
  }

  async generateVariations(data) {
    // Generate different versions based on theme and business type
    // This would use templates and AI to create variations
    // Return URLs of generated sites
    return [
      `/demo/${path.basename(this.outputDir)}/variation1`,
      `/demo/${path.basename(this.outputDir)}/variation2`
    ];
  }
} 