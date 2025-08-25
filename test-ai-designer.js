import { AIWebsiteDesigner } from './src/services/aiWebsiteDesigner.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAIDesigner() {
  try {
    console.log('Testing AI Website Designer...');
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY not found in environment variables');
      return;
    }
    
    const aiDesigner = new AIWebsiteDesigner(process.env.OPENAI_API_KEY);
    
    const designRequest = {
      logoName: 'My Business Logo',
      currentSiteUrl: 'https://example.com',
      businessType: 'flower-shop',
      themes: 'clean-white, dark-botanical, colorful',
      pages: 'homepage, about, services, contact',
      city: 'Portland',
      region: 'Oregon'
    };
    
    console.log('Generating website designs...');
    console.log('Design request:', designRequest);
    
    const result = await aiDesigner.generateWebsiteDesigns(designRequest);
    
    console.log('\n✅ AI Website Designs Generated Successfully!');
    console.log(`Output directory: ${result.outputDirectory}`);
    console.log(`Concepts generated: ${result.concepts.length}`);
    
    result.concepts.forEach((concept, index) => {
      console.log(`\nConcept ${index + 1}: ${concept.conceptName}`);
      console.log(`  - Directory: ${concept.directory}`);
      console.log(`  - HTML file: ${concept.htmlFile}`);
      console.log(`  - Preview file: ${concept.previewFile}`);
      console.log(`  - Design summary: ${JSON.stringify(concept.designSummary, null, 2)}`);
    });
    
    console.log(`\n🎉 All done! Check the output directory: ${result.outputDirectory}`);
    
  } catch (error) {
    console.error('❌ Error testing AI Website Designer:', error);
  }
}

testAIDesigner();
