# Overview

StoryMaker AI is a full-stack web application that generates personalized children's stories using OpenAI's GPT-4o and DALL-E 3 models. The application features an enhanced multi-step workflow:

1. **Story Creation**: Users input basic story details (setting, characters, plot, age group)
2. **Setting Expansion**: AI expands the setting with rich, vivid descriptions for user editing
3. **Character Extraction**: AI extracts individual characters and creates detailed descriptions
4. **Story Generation**: AI generates the complete story text using enriched context
5. **Image Generation**: High-quality HD images for each story page and character portraits
6. **Story Library**: Clickable library entries for viewing and managing existing stories

The system includes demo mode functionality for seamless operation during API quota limitations, making character images available for enhanced page illustration consistency.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool and development server
- **Styling**: TailwindCSS with shadcn/ui component library for consistent UI components
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Component Structure**: Modular design with reusable UI components in `/components/ui/` and feature-specific components

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API structure with centralized route registration
- **Development Setup**: Custom Vite integration for hot module replacement in development
- **Error Handling**: Centralized error middleware with consistent JSON responses
- **Request Logging**: Custom middleware for API request logging and performance monitoring

## Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema synchronization
- **Connection**: Neon Database serverless PostgreSQL for cloud hosting
- **Fallback Storage**: In-memory storage implementation for development and testing
- **Data Models**: Strongly typed schemas with Zod validation for stories and user entities

## Authentication and Authorization
- **Current State**: No authentication system implemented
- **Session Management**: Connect-pg-simple configured for PostgreSQL session storage (ready for future implementation)
- **User Schema**: Basic user model defined but not actively used

## External Service Integrations
- **AI Text Generation**: OpenAI GPT-4o for story text generation, setting expansion, and character extraction
- **AI Image Generation**: OpenAI DALL-E 3 with HD quality for character portraits and story page illustrations
- **Smart Workflow**: Multi-step approval process with setting expansion, character definition, and story refinement
- **Demo Mode**: Automatic fallback system with sample content during API quota limitations
- **Font Loading**: Google Fonts integration for typography
- **Development Tools**: Replit integration for development environment and error handling

## Key Design Patterns
- **Monorepo Structure**: Shared schema and types between client and server in `/shared/` directory
- **Type Safety**: End-to-end TypeScript with shared Zod schemas for validation
- **Component Composition**: Radix UI primitives with custom styling through class-variance-authority
- **Enhanced Multi-Step Workflow**: Six-step creation process (details → setting expansion → character definition → story review → image generation → completion)
- **Character-Driven Generation**: Individual character portraits and enhanced page illustrations using character context
- **Interactive Story Library**: Clickable entries for viewing, editing, and managing story collection
- **Responsive Design**: Mobile-first approach with TailwindCSS responsive utilities
- **Code Splitting**: Vite-based bundling with automatic code splitting and hot reloading

# External Dependencies

## Database and ORM
- **PostgreSQL**: Primary database using Neon serverless hosting
- **Drizzle ORM**: Type-safe database queries and schema management
- **Drizzle Kit**: Database migrations and schema synchronization

## AI and External APIs
- **OpenAI API**: GPT-4o for text generation and DALL-E for image generation
- **API Key Management**: Environment variable configuration for secure API access

## UI and Design System
- **Radix UI**: Accessible, unstyled UI primitives for complex components
- **TailwindCSS**: Utility-first CSS framework with custom design tokens
- **shadcn/ui**: Pre-built component library built on Radix UI and TailwindCSS
- **Lucide React**: Icon library for consistent iconography
- **Google Fonts**: Web fonts for typography (Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter)

## Development and Build Tools
- **Vite**: Fast build tool and development server with HMR
- **TypeScript**: Type safety across the entire application
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with TailwindCSS and Autoprefixer

## State Management and Data Fetching
- **TanStack Query**: Server state management, caching, and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition

## Utilities and Helpers
- **date-fns**: Date manipulation and formatting
- **clsx**: Conditional CSS class construction
- **class-variance-authority**: Component variant styling
- **nanoid**: Unique ID generation
- **cmdk**: Command menu implementation