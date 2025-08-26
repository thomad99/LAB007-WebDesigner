# AI Website Designer Service

This service uses OpenAI's GPT-4 to generate 3 distinct website redesign concepts based on your specifications. Each concept includes a complete, responsive HTML file with inline CSS, design summaries, image requests, and accessibility features.

## Features

- **3 Distinct Design Concepts**: Each with unique visual direction and design tokens
- **AI-Generated Images**: Content-aware image generation for hero, products, and backgrounds
- **Complete HTML Output**: Single-file HTML with inline CSS (no external dependencies)
- **Design Diversity**: Clean White Luxury, Dark Botanical, and Color Pop themes
- **Accessibility Focused**: WCAG 2.2 AA compliance, keyboard navigation, focus states
- **SEO Optimized**: Meta tags, Open Graph, Twitter cards, schema.org markup
- **Performance Optimized**: LCP under 2.5s target, optimized CSS, minimal assets
- **Responsive Design**: Mobile-first approach with fluid typography and spacing

## Quick Start

### 1. Environment Setup

Make sure you have your OpenAI API key in your `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 2. API Usage

#### Endpoint: `POST /api/ai-design`

**Request Body:**
```json
{
  "logoName": "Your Business Logo",
  "currentSiteUrl": "https://yourwebsite.com",
  "businessType": "flower-shop",
  "themes": "clean-white, dark-botanical, colorful",
  "pages": "homepage, about, services, contact",
  "city": "Portland",
  "region": "Oregon"
}
```

**Response:**
```json
{
  "message": "AI website design generation started",
  "jobId": "uuid-here"
}
```

#### Endpoint: `POST /api/generate-content-images`

Generate images based on website content analysis:

**Request Body:**
```json
{
  "website": "https://yourwebsite.com",
  "businessType": "flower-shop",
  "theme": "modern",
  "contentAnalysis": {
    "title": "Your Business",
    "description": "Business description",
    "headings": ["Main Heading", "Service 1", "Service 2"],
    "mainContent": ["Content paragraph 1", "Content paragraph 2"]
  }
}
```

**Response:**
```json
{
  "message": "Content-based image generation started",
  "jobId": "uuid-here"
}
```

### 3. Check Status

#### Endpoint: `GET /api/status/:jobId`

Returns the current status and results of your design generation job.

## Design Concepts

### Concept A: Clean White Luxury
- **Style**: Airy, editorial, soft shadows, subtle glassmorphism
- **Colors**: Whites, light grays, subtle accents
- **Mood**: Professional, sophisticated, minimal

### Concept B: Dark Botanical
- **Style**: Deep charcoal/ink, copper accents, saturated florals, low-glare
- **Colors**: Dark backgrounds, rich accent colors, organic tones
- **Mood**: Elegant, nature-inspired, premium

### Concept C: Color Pop
- **Style**: Bright accents, asymmetric cards, playful tags, rounded geometry
- **Colors**: Vibrant primary colors, high contrast, energetic palette
- **Mood**: Fun, modern, engaging

## Output Structure

Each generated design creates a directory structure:

```
output/ai-designs/[timestamp]/
├── index.html                    # Main index showing all concepts
├── concept-1/
│   ├── index.html               # Complete website HTML
│   ├── preview.html             # Preview page with iframe
│   ├── design-summary.json      # Design concept details
│   ├── image-requests.json      # AI image generation prompts
│   ├── generated-images.json    # Generated image URLs and metadata
│   ├── seo-meta.json           # SEO and meta information
│   ├── accessibility-notes.json # Accessibility features
│   └── images/                  # Generated images directory
│       └── index.html           # Images gallery page
├── concept-2/
│   └── [same structure]
└── concept-3/
    └── [same structure]
```

## Design Deliverables

### 1. Design Summary
- Concept Name
- Brand Direction (tone, vibe)
- Layout Pattern (hero type, nav style, section order)
- Component Set (cards, badges, CTAs, forms, FAQ, testimonials)
- Color Palette (5-7 HEX colors with use cases)
- Type Pairing (Headings/Body with fallbacks)
- Design Tokens (JSON + CSS :root variables)

### 2. Image Requests & Generated Images
- 3-5 AI image generation prompts
- Tailored to brand and concept
- Include size/aspect ratios, style, lighting
- Negative cues for better results
- **AI-Generated Images**: Automatically generated based on content
  - Hero images (1792×1024)
  - Product/service images (1024×1024)
  - Background textures (1024×1024)
  - Content-aware prompts based on business type and theme

### 3. SEO + Meta
- Title, meta description
- Open Graph + Twitter meta
- Favicon placeholder
- Schema.org JSON-LD markup

### 4. Accessibility + UX
- Landmark regions
- Skip links
- Keyboard navigation
- Focus-visible states
- Reduced motion support
- ARIA labels where needed

### 5. Single-File HTML
- Semantic HTML5 structure
- Inline CSS with design tokens
- Fluid typography (clamp())
- Responsive grid system
- Microinteractions
- Placeholder images with alt text

## Testing

Run the test scripts to see the service in action:

```bash
# Test basic AI website design
node test-ai-designer.js

# Test image generation functionality
node test-image-generation.js
```

## Integration Examples

### Frontend Integration

```javascript
// Generate website designs with images
const response = await fetch('/api/ai-design', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    logoName: 'My Business',
    currentSiteUrl: 'https://mybusiness.com',
    businessType: 'restaurant',
    themes: 'clean-white, dark-botanical, colorful',
    pages: 'homepage, menu, about, contact',
    city: 'Seattle',
    region: 'Washington'
  })
});

const { jobId } = await response.json();

// Check status
const statusResponse = await fetch(`/api/status/${jobId}`);
const status = await statusResponse.json();

if (status.status === 'completed') {
  console.log('Designs with images ready!', status);
}

// Generate content-based images only
const imageResponse = await fetch('/api/generate-content-images', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    website: 'https://mybusiness.com',
    businessType: 'restaurant',
    theme: 'modern',
    contentAnalysis: {
      title: 'My Restaurant',
      description: 'Fine dining experience',
      headings: ['Welcome', 'Our Menu', 'About Us'],
      mainContent: ['Delicious food', 'Great service', 'Cozy atmosphere']
    }
  })
});

const { jobId: imageJobId } = await imageResponse.json();
```

### Direct Service Usage

```javascript
import { AIWebsiteDesigner } from './src/services/aiWebsiteDesigner.js';

const aiDesigner = new AIWebsiteDesigner(process.env.OPENAI_API_KEY);

const result = await aiDesigner.generateWebsiteDesigns({
  logoName: 'Test Logo',
  businessType: 'tech-startup',
  themes: 'clean-white, dark-black, colorful'
});

console.log(`Generated ${result.concepts.length} concepts`);
```

## Technical Details

### Dependencies
- OpenAI GPT-4 API
- Node.js fs-extra for file operations
- Path module for cross-platform compatibility

### Performance Considerations
- LCP target: under 2.5 seconds
- No external CSS/JS frameworks
- Optimized CSS with CSS variables
- Minimal image assets
- System fonts preferred

### Accessibility Features
- WCAG 2.2 AA compliance
- Semantic HTML structure
- Keyboard navigation support
- Focus management
- Screen reader compatibility
- Color contrast compliance
- Reduced motion support

## Error Handling

The service includes robust error handling:
- JSON parsing fallbacks
- Graceful API error handling
- File system error management
- Database transaction safety

## Future Enhancements

- Custom theme generation
- Brand-specific design systems
- Interactive design previews
- Design iteration capabilities
- Export to various formats
- Integration with design tools

## Support

For issues or questions:
1. Check the server logs for detailed error information
2. Verify your OpenAI API key is valid
3. Ensure sufficient API credits for GPT-4 usage
4. Check file system permissions for output directories

## License

This service is part of the LAB007 Web Designer project.
