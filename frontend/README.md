# FINAI – AI Loan Advisor & Routing

## About FINAI

FINAI is an AI-powered chat interface that helps users find the right loan products based on their needs. The system provides personalized recommendations through an intelligent conversation flow.

## Project Structure

- **Frontend**: React + TypeScript + Vite + shadcn/ui
- **Backend**: Express + TypeScript + Gemini AI
- **Data Source**: Google Sheets

## Getting Started

### Requirements

- Node.js (v18+) & npm installed

### Setup

```sh
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd finai

# Step 3: Install dependencies
npm install

# Step 4: Set up environment variables
# Copy .env.example to .env and fill in your configuration
cp .env.example .env

# Step 5: Start development server
npm run dev
```

## Development

### Running the app locally

```sh
npm run dev
```

The frontend runs on `http://localhost:8080` by default.

### Building for production

```sh
npm run build
```

### Running tests

```sh
npm test
npm run test:watch
```

## Architecture

### Chat Flow

1. **User Input** → Frontend sends message to backend
2. **AI Analysis** → Gemini AI extracts: purpose, urgency, amount needed
3. **Offer Selection** → Backend selects top 3 offers based on user needs
4. **Response** → Frontend displays AI reply + offer cards with apply buttons

### Key Features

- 🌐 **Bilingual**: Auto-detects English or Spanish from first message
- 🔒 **PII Protection**: Masks sensitive info before processing
- 🎯 **Smart Routing**: Matches users with the best loan products
- 📊 **Session Management**: Tracks conversation context with localStorage
- 🔗 **Tracking**: Forwards ad click IDs (gclid, fbclid, ttclid) for attribution

## Tech Stack

- **UI Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Component Library**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **State Management**: React hooks + Framer Motion
- **HTTP Client**: Fetch API
- **Testing**: Vitest + Playwright

### Key Dependencies

- `react`: UI framework
- `framer-motion`: Animations
- `zod`: Runtime validation
- `lucide-react`: Icons
- `sonner`: Toast notifications
- `@hookform/resolvers` + `react-hook-form`: Form handling

# Step 3: Install dependencies
npm install

# Step 4: Start the development server
npm run dev
```

## Deployment

### Build for Production

```sh
npm run build
```

This creates an optimized build in the `dist/` folder.

### Hosting

Deploy the contents of the `dist/` folder to any static hosting service:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Your own server (nginx, Apache, etc.)

### Environment Variables

When deploying, ensure the following environment variables are set:

```
VITE_API_URL=https://your-backend-api.com
```

This tells the frontend where to reach the backend API. By default, it uses `/api` as a relative path (same origin).

## Contributing

Feel free to submit issues and pull requests. Please follow the existing code style and add tests for new features.

## License

MIT
