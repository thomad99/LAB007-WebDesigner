# 🎨 AI Website Redesigner

Transform your existing website with AI-powered modern design! This tool analyzes your current website, preserves all your content, and creates a beautiful, modern redesign that's perfect for your business.

## ✨ Features

- **Smart Content Extraction**: Automatically extracts text, images, navigation, and structure from existing websites
- **Logo Detection**: Finds and preserves your company logo automatically
- **AI-Powered Redesign**: Uses GPT-4 to generate modern, responsive HTML/CSS designs
- **Business-Specific Styling**: Tailored designs for different business types (flower shops, healthcare, tech, etc.)
- **Theme Options**: Choose from clean white, dark black, or colorful themes
- **Quick Mockups**: Generate visual mockups using DALL-E 3
- **Full Website Cloning**: Complete redesigned websites ready to use
- **Mobile-First Design**: All designs are fully responsive
- **Email Notifications**: Get notified when your redesign is ready

## 🚀 How It Works

1. **Enter Your Website**: Provide the URL of your existing website
2. **AI Analysis**: The tool automatically analyzes your content and suggests business type and themes
3. **Choose Your Style**: Select your preferred theme and confirm business type
4. **AI Generation**: GPT-4 creates a modern redesign while preserving all your content
5. **Preview & Download**: View your redesigned website or download the generated code

## 🛠️ Setup

### Prerequisites

- Node.js 16+ 
- PostgreSQL database
- OpenAI API key
- Gmail account (for email notifications)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Web-Designer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=webdesigner
   DB_PORT=5432

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here

   # Email Configuration (for Gmail)
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_app_password_here

   # Server Configuration
   PORT=3000
   ```

4. **Set up the database**
   ```bash
   # Create the database
   createdb webdesigner
   
   # Run the initialization script
   node src/scripts/setup-db.js
   ```

5. **Start the server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## 🎯 Usage

### Full Website Redesign
1. Select "Full Site Redesign" option
2. Enter your website URL
3. Click "Analyze Website" to get AI-powered suggestions
4. Choose your preferred theme and business type
5. Submit to generate a complete redesigned website
6. View your new design at the provided demo URL

### Quick Mockup
1. Select "Quick Mockup" option
2. Enter your website URL
3. Choose theme and business type
4. Generate a visual mockup using DALL-E 3
5. Download or view the generated image

## 🔧 Technical Details

### Architecture
- **Backend**: Node.js with Express
- **Database**: PostgreSQL for job tracking and storage
- **AI Services**: OpenAI GPT-4 for content generation, DALL-E 3 for mockups
- **Web Scraping**: Cheerio for HTML parsing and content extraction
- **Email**: Nodemailer for notifications

### Content Extraction
The tool intelligently extracts:
- Page titles and descriptions
- Navigation menus
- Headings and content structure
- Images and logos
- Contact information
- Social media links
- Business-specific content

### AI Generation
- **GPT-4**: Generates complete HTML/CSS code with modern design principles
- **DALL-E 3**: Creates professional website mockups
- **Content Preservation**: All original text and structure is maintained
- **Modern Design**: Uses CSS Grid, Flexbox, and modern UI patterns

## 🎨 Design Features

### Responsive Design
- Mobile-first approach
- CSS Grid and Flexbox layouts
- Responsive typography
- Touch-friendly navigation

### Modern UI Elements
- Card-based layouts
- Subtle shadows and gradients
- Smooth animations and transitions
- Professional color schemes

### Business-Specific Styling
- **Healthcare**: Clean, trustworthy, professional
- **Tech**: Modern, innovative, sleek
- **Retail**: Engaging, colorful, conversion-focused
- **Local Business**: Warm, welcoming, community-focused

## 📱 Supported Business Types

- 🌸 Flower Shop
- 🛍️ Retail Store
- 📦 Product Information
- 🏥 Healthcare
- 💻 Tech
- 🐾 Pet Care
- 🏢 Local Business
- 📝 Blog

## 🔒 Security & Privacy

- No content is stored permanently
- All processing is done securely
- Email addresses are only used for notifications
- Generated designs are temporary and can be deleted

## 🚀 Deployment

### Render (Recommended)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Other Platforms
- Heroku
- DigitalOcean App Platform
- AWS Elastic Beanstalk
- Google Cloud Run

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:
1. Check the console logs for error messages
2. Verify your environment variables are set correctly
3. Ensure your database is running and accessible
4. Check that your OpenAI API key is valid

## 🔮 Future Enhancements

- [ ] Multiple design variations
- [ ] Custom color palette selection
- [ ] Export to various platforms (WordPress, Shopify, etc.)
- [ ] A/B testing for different designs
- [ ] Integration with design tools (Figma, Sketch)
- [ ] Advanced SEO optimization
- [ ] Performance optimization suggestions

---

**Built with ❤️ using AI to make web design accessible to everyone!**
