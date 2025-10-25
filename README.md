# StorySpark (StoryMaker AI)

**StorySpark** is an AI-powered children's book creation platform that guides you through a complete multi-step story generation process, from concept to illustrated pages. Create personalized, printable children's books with custom characters, settings, and AI-generated illustrations.

![StorySpark Logo](docs/1-login.png)

## What is StorySpark?

StorySpark transforms your story ideas into fully illustrated children's books through an intelligent, guided workflow. The application uses AI to help you develop compelling narratives, generate vivid imagery descriptions, and produce professional illustrations—all while keeping you in creative control at every step.

Whether you're a parent creating a bedtime story for your child, an educator developing educational content, or a creative writer exploring new ideas, StorySpark makes the process intuitive and accessible.

---

## Features

### 🎯 Multi-Step Story Generation Process

StorySpark guides you through a comprehensive story creation workflow designed to produce high-quality, coherent children's books:

1. **Story Details & Concept** - Define the basic premise, title, and story parameters
   ![Story Details](docs/3-story-details.png)

2. **Setting Expansion** - AI helps you develop rich, detailed story settings
   ![Expand Setting](docs/4-expand-setting.png)

3. **Character Definition** - Create and refine character profiles with detailed descriptions
   ![Define Characters](docs/5-define-characters.png)

4. **Story Review & Core Imagery** - Review the complete narrative and generate core visual concepts before page-by-page imagery
   ![Review Story](docs/6-review-story.png)

5. **Image Generation** - Transform your story into illustrated pages with AI-generated artwork
   ![Generate Images](docs/7-generate-images.png)

### 📚 Story Library & Management

- Browse all your created stories in an organized library view
- Track story generation progress
- Quick access to edit, continue, or read any story
- Delete stories you no longer need

![Library View](docs/2-library.png)

### 🎨 Advanced Image Generation

#### BYOK (Bring Your Own Key)

StorySpark supports **Bring Your Own Key** functionality, allowing you to use your own API keys for:
- **OpenAI** (DALL-E 3) - High-quality, prompt-faithful image generation
- **Replicate** - Access to numerous open-source image models

This means you control your costs and aren't dependent on third-party credits or subscriptions.

![Profile Settings](docs/14-profile.png)

#### Flexible Image Model Selection

Choose from multiple image generation providers and models:
- **OpenAI DALL-E 3** - Premium quality with excellent prompt adherence
- **Replicate Models** - Choose from dozens of open-source models including:
  - FLUX models (Dev, Schnell, Pro)
  - Stable Diffusion variants
  - Specialized art styles
  - Custom fine-tuned models

![Replicate Configuration](docs/15-profile-replicate.png)

#### Replicate Model Configuration

Advanced users can add and configure custom Replicate models:
- Add any Replicate model by owner/name
- **AI-Powered Schema Analysis** - Automatically analyze model parameters
- Configure model-specific settings (style presets, aspect ratios, etc.)
- Save model templates for reuse

![Add Model](docs/16-add-model.png)
![Analyze Model](docs/17-analyze-model.png)
![Model Configuration](docs/18-model-configuration.png)

### 🔄 Image Regeneration

Don't like a generated image? Regenerate it with a single click:

- **Core Image Regeneration** - Regenerate the thematic core imagery that guides all page illustrations
  ![Regenerate Core Image](docs/8-regenerate-core-image.png)

- **Individual Page Regeneration** - Regenerate specific page images without affecting the rest of your story
  ![Regenerate Page Image](docs/9-regenerate-page-image.png)

### 📖 Read Mode & Story Viewing

Experience your completed story in a beautiful, distraction-free reading interface:
- Full-screen immersive reading mode
- Page-by-page navigation
- View illustrations alongside text
- Perfect for sharing with children

![Read Mode](docs/11-read-mode.png)
![View Image](docs/12-view-image.png)

### 🖨️ Export to Printable PDF

Transform your digital story into a physical book:
- Export to high-quality PDF format
- Professional layout with text and images
- Ready for printing or digital distribution
- Perfect for creating personalized gifts

![Finished Story](docs/10-story-finished.png)
![Exported PDF](docs/13-exported-pdf.png)

---

## 🤖 AI-Generated Code Acknowledgment

**This entire application was created using AI assistance.**

All code in this repository was generated through AI-powered development on [Replit](https://replit.com), with human guidance and direction. This project demonstrates the power of AI-assisted software development and serves as an example of what can be built when human creativity meets AI capabilities.

The human's role was purely:
- Conceptual direction
- Feature requests
- Design preferences
- Quality assurance
- Refinement guidance
- Major bug fixes
- Refactor, code, and database design suggestions

The AI handled:
- All code implementation
- Architecture decisions
- Minor fixes
- Feature development
- Database schema design
- UI/UX implementation

Built with: **Replit** + **Claude AI**

---

## 📸 Screenshots

All screenshots are available in the `docs/` folder:

- `1-login.png` - Login screen with Google authentication
- `2-library.png` - Story library overview
- `3-story-details.png` - Story creation and details
- `4-expand-setting.png` - Setting expansion step
- `5-define-characters.png` - Character definition interface
- `6-review-story.png` - Story review and core imagery
- `7-generate-images.png` - Image generation process
- `8-regenerate-core-image.png` - Core image regeneration
- `9-regenerate-page-image.png` - Individual page regeneration
- `10-story-finished.png` - Completed story view
- `11-read-mode.png` - Immersive read mode
- `12-view-image.png` - Full-size image viewer
- `13-exported-pdf.png` - PDF export preview
- `14-profile.png` - Profile and OpenAI settings
- `15-profile-replicate.png` - Replicate configuration
- `16-add-model.png` - Adding custom Replicate models
- `17-analyze-model.png` - AI model schema analysis
- `18-model-configuration.png` - Model parameter configuration

---

## 🚀 How to Run StorySpark Yourself

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**
- **PostgreSQL** database (or use a managed service like Neon)

### Required Accounts & API Keys

You'll need to set up accounts and obtain API keys from the following services:

#### 1. **PostgreSQL Database**
- **Option A:** Install PostgreSQL locally - [Download](https://www.postgresql.org/download/)
- **Option B:** Use a managed service:
  - [Neon](https://neon.tech/) - Serverless PostgreSQL (Recommended)
  - [Supabase](https://supabase.com/)
  - [Railway](https://railway.app/)
  - [Heroku Postgres](https://www.heroku.com/postgres)

#### 2. **Google OAuth Credentials**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure OAuth consent screen if prompted
6. Application type: **Web application**
7. Add authorized JavaScript origins:
   - `http://localhost:5000` (development)
   - Your production domain (e.g., `https://yourdomain.com`)
8. Add authorized redirect URIs:
   - `http://localhost:5000/api/callback` (development)
   - `https://yourdomain.com/api/callback` (production)
9. Save and note your **Client ID** and **Client Secret**

#### 3. **Image Generation API Keys** (User's Choice)

Users will provide their own API keys, but you may want to set up free mode:

**OpenAI** (for DALL-E 3):
- Sign up at [OpenAI Platform](https://platform.openai.com/)
- Navigate to [API Keys](https://platform.openai.com/api-keys)
- Create a new API key (starts with `sk-proj-...`)
- Add billing information and set usage limits to prevent overages

**Replicate** (for open-source models):
- Sign up at [Replicate](https://replicate.com/)
- Navigate to [Account Settings > API Tokens](https://replicate.com/account/api-tokens)
- Create a new API token (starts with `r8_...`)
- Add billing information or use free tier

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/StorySpark.git
cd StorySpark
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```bash
# Required: Database connection string
DATABASE_URL=postgresql://username:password@host:port/database

# Required: Google OAuth credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/callback

# Required: Generate a random 32+ character string
JWT_SECRET=your-random-jwt-secret-min-32-chars

# Required: Generate a random 32-character string
ENCRYPTION_KEY=your-32-character-encryption-key

# Required for frontend: Same as GOOGLE_CLIENT_ID
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Optional: For "free mode" users (uses your API keys)
OPENAI_API_KEY=sk-proj-your-openai-api-key
REPLICATE_API_KEY=r8_your-replicate-api-key

# Optional: Server configuration
PORT=5000
NODE_ENV=development
```

**Generate secure secrets:**

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY (exactly 32 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('base64').slice(0, 32))"
```

#### 4. Set Up Database

Run database migrations to create all necessary tables:

```bash
npm run db:push
```

#### 5. Run the Application

**Development mode** (with hot reload):

```bash
npm run dev
```

**Production mode:**

```bash
# Build the application
npm run build

# Start the production server
npm start
```

#### 6. Access the Application

Open your browser and navigate to:

```
http://localhost:5000
```

---

## 📝 Environment Variables Reference

See `.env.example` for a comprehensive list of all environment variables with detailed explanations.

**Quick reference:**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | ✅ Yes | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ Yes | Google OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | ⚠️ Optional | OAuth redirect URI (defaults to standard) |
| `JWT_SECRET` | ✅ Yes | Secret for JWT token signing (32+ chars) |
| `ENCRYPTION_KEY` | ✅ Yes | Key for encrypting user API keys (exactly 32 chars) |
| `VITE_GOOGLE_CLIENT_ID` | ✅ Yes | Google Client ID for frontend (same as above) |
| `OPENAI_API_KEY` | ❌ Optional | Your OpenAI API key for free mode |
| `REPLICATE_API_KEY` | ❌ Optional | Your Replicate API key for free mode |
| `PORT` | ❌ Optional | Server port (default: 5000) |
| `NODE_ENV` | ❌ Optional | Environment (development/production) |

---

## 🛠️ Technology Stack

- **Frontend:** React, TypeScript, TailwindCSS, Radix UI
- **Backend:** Express.js, Node.js
- **Database:** PostgreSQL (via Neon serverless)
- **ORM:** Drizzle ORM
- **Authentication:** Google OAuth 2.0, JWT
- **AI Services:** OpenAI GPT-4, DALL-E 3, Replicate models
- **PDF Generation:** jsPDF
- **Build Tools:** Vite, esbuild

---

## 🗂️ Project Structure

```
StorySpark/
├── client/               # React frontend application
│   └── src/
│       ├── components/   # Reusable UI components
│       ├── pages/        # Application pages
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utility functions
├── server/               # Express backend application
│   ├── routes.ts         # API routes
│   ├── auth.ts           # Authentication logic
│   ├── storage.ts        # Database operations
│   ├── services/         # Business logic services
│   └── utils/            # Utility functions
├── shared/               # Shared code between client/server
│   └── schema.ts         # Database schema (Drizzle)
├── docs/                 # Documentation and screenshots
├── .env.example          # Environment variables template
└── README.md             # This file
```

---

## 📄 License

MIT License - Feel free to use this project for personal or commercial purposes.

---

## 🤝 Contributing

Since this project is AI-generated, contributions follow a unique model:
- Fork the repository
- Make your changes
- Submit a pull request with clear descriptions
- All code should maintain the existing architecture and patterns

---

## 🐛 Known Issues & Limitations

- PDF export may have formatting issues with very long text
- Some Replicate models may have rate limits or specific requirements
- Large image generations may take time depending on the model chosen
- Free mode API costs are borne by the server operator

---

## 💡 Future Ideas

- Multi-language support for story generation
- Voice narration for read mode
- Collaborative story editing
- Story templates and presets
- Mobile app versions
- Integration with print-on-demand services

---

## 📞 Support

For issues, questions, or feature requests:
1. Check the existing issues in the repository
2. Create a new issue with detailed information
3. Include screenshots or error messages when applicable

---

## 🙏 Acknowledgments

- **Replit** - For providing the AI-powered development environment
- **Claude AI (Anthropic)** - For generating all the code in this project
- **OpenAI** - For GPT-4 and DALL-E 3 APIs
- **Replicate** - For access to open-source image models
- **Google** - For OAuth authentication services

---

**Built with AI, Powered by Imagination** ✨
