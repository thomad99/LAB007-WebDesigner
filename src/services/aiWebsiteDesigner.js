import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';

export class AIWebsiteDesigner {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey
    });
  }

  async generateWebsiteDesigns(designRequest) {
    try {
      const prompt = this.buildPrompt(designRequest);
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8000
      });

      const response = completion.choices[0].message.content;
      
      // Try to parse the JSON response
      try {
        const designs = JSON.parse(response);
        return this.processDesigns(designs, designRequest);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        // Fallback: try to extract JSON from the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const designs = JSON.parse(jsonMatch[0]);
            return this.processDesigns(designs, designRequest);
          } catch (fallbackError) {
            console.error('Fallback JSON parsing failed:', fallbackError);
            throw new Error('Invalid response format from OpenAI');
          }
        } else {
          throw new Error('No JSON found in OpenAI response');
        }
      }
    } catch (error) {
      console.error('AI Website Design generation error:', error);
      throw error;
    }
  }

  buildPrompt(designRequest) {
    return `You are a world-class brand + web designer and front-end engineer.
Your job: produce 3 distinct, modern redesign concepts for the given site content,
each with a unique visual direction, design tokens, and a fully responsive single-file HTML
(HTML + a single <style> block). Think step-by-step, but output only the final deliverables.

OBJECTIVES
- Keep the business goals (conversion, clarity, trust).
- Preserve the site's information architecture and essential content, but paraphrase copy.
- Produce premium visuals with auto-generated images (hero, product/collection, lifestyle).
- Ensure performance, accessibility (WCAG 2.2 AA), SEO, and mobile-first best practices.

INPUTS
- Brand/Logo: ${designRequest.logoName || 'N/A'}
- Current Site URL: ${designRequest.currentSiteUrl || 'N/A'}
- Business Type: ${designRequest.businessType || 'business'}
- Preferred Themes: ${designRequest.themes || 'clean-white, dark-botanical, colorful'}
- Pages to remix: ${designRequest.pages || 'homepage'}
- Geo context: ${designRequest.city || 'N/A'}, ${designRequest.region || 'N/A'}

CONSTRAINTS
- One HTML file per concept. No external CSS/JS frameworks. Use semantic HTML5.
- Use a single <style> tag with CSS variables (design tokens) and fluid typography (clamp()).
- Use system fonts OR 1 webfont via <link> if you must; include robust fallbacks.
- No copied text; paraphrase to maintain meaning. Keep contact info and legal intact.
- Include alt text, focus states, sufficient color contrast, reduced-motion support.
- Performance budget: aim for LCP under 2.5s; avoid heavy effects/images by default.

DELIVERABLES (for EACH of 3 concepts)
1) DESIGN SUMMARY (short)
   - Concept Name
   - Brand Direction (tone, vibe in 2–3 bullets)
   - Layout Pattern (hero type, nav style, section order)
   - Component Set (cards, badges, CTAs, forms, FAQ, testimonials)
   - Color Palette (5–7 HEX with use cases)
   - Type Pairing (Headings / Body with fallbacks)
   - Design Tokens (JSON + CSS :root variables)
2) IMAGE_REQUESTS (JSON)
   - 3–5 prompts tailored to this brand (hero, product grid, lifestyle, background texture)
   - Include size/aspect (hero 1920×1080, product 1200×1200), style, lighting, negative cues
3) SEO + META
   - <title>, meta description, Open Graph + Twitter meta, favicon placeholder, schema.org JSON-LD
4) ACCESSIBILITY + UX
   - Landmark regions, skip link, keyboard nav, :focus-visible, prefers-reduced-motion, ARIA where needed
5) SINGLE-FILE HTML
   - Clean, commented structure; tokens in :root; fluid spacing; responsive grid
   - Microinteractions with pure CSS (hover, focus, subtle transitions)
   - Placeholder <img> tags with data-src and descriptive alt; include widths/heights
   - Optional decorative SVGs (noise/organic shapes) inlined, not oversized

STYLE DIRECTIONS (force diversity)
- Concept A: "Clean White Luxury" — airy, editorial, soft shadows, subtle glassmorphism
- Concept B: "Dark Botanical" — deep charcoal/ink, copper accents, saturated florals, low-glare
- Concept C: "Color Pop" — bright accents, asymmetric cards, playful tags, rounded geometry

OUTPUT FORMAT
Return a top-level JSON object with:
{
  "concepts": [
    {
      "design_summary": {...},
      "image_requests": [...],
      "seo_meta": {...},
      "accessibility_notes": [...],
      "html": "<!doctype html>...complete single-file page..."
    },
    {...},
    {...}
  ]
}

IMPORTANT: Return ONLY valid JSON. Do not include any explanatory text before or after the JSON.`;
  }

  async processDesigns(designs, designRequest) {
    try {
      // Create output directory
      const outputDir = path.join(process.cwd(), 'output', 'ai-designs', Date.now().toString());
      await fs.ensureDir(outputDir);

      const processedDesigns = [];

      for (let i = 0; i < designs.concepts.length; i++) {
        const concept = designs.concepts[i];
        const conceptDir = path.join(outputDir, `concept-${i + 1}`);
        await fs.ensureDir(conceptDir);

        // Save HTML file
        const htmlPath = path.join(conceptDir, 'index.html');
        await fs.writeFile(htmlPath, concept.html, 'utf8');

        // Save design summary
        const summaryPath = path.join(conceptDir, 'design-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(concept.design_summary, null, 2), 'utf8');

        // Save image requests
        const imagesPath = path.join(conceptDir, 'image-requests.json');
        await fs.writeFile(imagesPath, JSON.stringify(concept.image_requests, null, 2), 'utf8');

        // Save SEO meta
        const seoPath = path.join(conceptDir, 'seo-meta.json');
        await fs.writeFile(seoPath, JSON.stringify(concept.seo_meta, null, 2), 'utf8');

        // Save accessibility notes
        const accessibilityPath = path.join(conceptDir, 'accessibility-notes.json');
        await fs.writeFile(accessibilityPath, JSON.stringify(concept.accessibility_notes, null, 2), 'utf8');

        // Create a preview file
        const previewPath = path.join(conceptDir, 'preview.html');
        const previewHtml = this.createPreviewPage(concept, i + 1);
        await fs.writeFile(previewPath, previewHtml, 'utf8');

        processedDesigns.push({
          conceptNumber: i + 1,
          conceptName: concept.design_summary?.Concept_Name || `Concept ${i + 1}`,
          directory: conceptDir,
          htmlFile: htmlPath,
          previewFile: previewPath,
          designSummary: concept.design_summary,
          imageRequests: concept.image_requests,
          seoMeta: concept.seo_meta,
          accessibilityNotes: concept.accessibility_notes
        });
      }

      // Create index file
      const indexPath = path.join(outputDir, 'index.html');
      const indexHtml = this.createIndexPage(processedDesigns, designRequest);
      await fs.writeFile(indexPath, indexHtml, 'utf8');

      return {
        outputDirectory: outputDir,
        concepts: processedDesigns,
        indexFile: indexPath
      };
    } catch (error) {
      console.error('Error processing designs:', error);
      throw error;
    }
  }

  createPreviewPage(concept, conceptNumber) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${concept.design_summary?.Concept_Name || `Concept ${conceptNumber}`} - Preview</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .concept-name { font-size: 2rem; margin: 0; color: #333; }
        .brand-direction { color: #666; margin: 10px 0; }
        .color-palette { display: flex; gap: 10px; margin: 20px 0; }
        .color-swatch { width: 40px; height: 40px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        .preview-frame { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .preview-frame iframe { width: 100%; height: 600px; border: none; }
        .back-link { display: inline-block; margin: 20px 0; color: #007bff; text-decoration: none; }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <a href="../index.html" class="back-link">← Back to All Concepts</a>
        
        <div class="header">
            <h1 class="concept-name">${concept.design_summary?.Concept_Name || `Concept ${conceptNumber}`}</h1>
            <p class="brand-direction">${concept.design_summary?.Brand_Direction || 'Brand direction description'}</p>
            
            <div class="color-palette">
                ${concept.design_summary?.Color_Palette ? 
                  concept.design_summary.Color_Palette.split(',').map(color => 
                    `<div class="color-swatch" style="background-color: ${color.trim()}" title="${color.trim()}"></div>`
                  ).join('') : ''
                }
            </div>
        </div>

        <div class="preview-frame">
            <iframe src="index.html" title="Website Preview"></iframe>
        </div>
    </div>
</body>
</html>`;
  }

  createIndexPage(concepts, designRequest) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Website Design Concepts</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { color: #333; margin-bottom: 10px; }
        .request-info { background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .concepts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; }
        .concept-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); transition: transform 0.2s; }
        .concept-card:hover { transform: translateY(-2px); }
        .concept-name { font-size: 1.5rem; margin: 0 0 10px 0; color: #333; }
        .concept-description { color: #666; margin-bottom: 15px; }
        .concept-links { display: flex; gap: 10px; }
        .btn { padding: 8px 16px; border-radius: 4px; text-decoration: none; color: white; font-size: 14px; }
        .btn-primary { background: #007bff; }
        .btn-secondary { background: #6c757d; }
        .btn:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AI Website Design Concepts</h1>
            <p>Generated website redesign concepts based on your requirements</p>
        </div>

        <div class="request-info">
            <h3>Design Request Details:</h3>
            <p><strong>Business Type:</strong> ${designRequest.businessType || 'N/A'}</p>
            <p><strong>Themes:</strong> ${designRequest.themes || 'N/A'}</p>
            <p><strong>Pages:</strong> ${designRequest.pages || 'N/A'}</p>
            <p><strong>Location:</strong> ${designRequest.city || 'N/A'}, ${designRequest.region || 'N/A'}</p>
        </div>

        <div class="concepts-grid">
            ${concepts.map(concept => `
                <div class="concept-card">
                    <h3 class="concept-name">${concept.conceptName}</h3>
                    <p class="concept-description">${concept.designSummary?.Brand_Direction || 'Brand direction description'}</p>
                    <div class="concept-links">
                        <a href="${concept.conceptName.toLowerCase().replace(/\s+/g, '-')}/preview.html" class="btn btn-primary">Preview</a>
                        <a href="${concept.conceptName.toLowerCase().replace(/\s+/g, '-')}/index.html" class="btn btn-secondary">View HTML</a>
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }
}
