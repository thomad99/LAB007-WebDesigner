import { AIWebsiteDesigner } from './src/services/aiWebsiteDesigner.js';
import dotenv from 'dotenv';

dotenv.config();

async function testImageGeneration() {
  try {
    console.log('Testing AI Image Generation...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return;
    }
    
    const aiDesigner = new AIWebsiteDesigner(process.env.OPENAI_API_KEY);
    
    // Test content-based image generation
    const designRequest = {
      logoName: 'Flower Shop Logo',
      currentSiteUrl: 'https://flowershop.com',
      businessType: 'flower-shop',
      themes: 'clean-white, dark-botanical, colorful',
      pages: 'homepage, about, services, contact',
      city: 'Portland',
      region: 'Oregon'
    };
    
    console.log('Generating website designs with images...');
    console.log('Design request:', designRequest);
    
    const result = await aiDesigner.generateWebsiteDesigns(designRequest);
    
    console.log('\n✅ AI Website Designs with Images Generated Successfully!');
    console.log(`Output directory: ${result.outputDirectory}`);
    console.log(`Concepts generated: ${result.concepts.length}`);
    
    result.concepts.forEach((concept, index) => {
      console.log(`\nConcept ${index + 1}: ${concept.conceptName}`);
      console.log(`  - Directory: ${concept.directory}`);
      console.log(`  - HTML file: ${concept.htmlFile}`);
      console.log(`  - Preview file: ${concept.previewFile}`);
      
      if (concept.generated_images && concept.generated_images.length > 0) {
        console.log(`  - Generated images: ${concept.generated_images.length}`);
        concept.generated_images.forEach((image, imgIndex) => {
          console.log(`    Image ${imgIndex + 1}: ${image.type} (${image.size})`);
          console.log(`    URL: ${image.url}`);
        });
      } else {
        console.log(`  - No images generated for this concept`);
      }
    });
    
    console.log(`\n🎉 All done! Check the output directory: ${result.outputDirectory}`);
    console.log('Each concept should now have an "images" folder with generated images!');
    
  } catch (error) {
    console.error('❌ Error testing AI Image Generation:', error);
  }
}

testImageGeneration();
