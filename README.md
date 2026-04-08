# AI Fitness Dance Diet Coach 🏋️‍♀️💃🥗

A comprehensive, production-ready AI-powered fitness coaching platform that combines workout training, dance instruction, and personalized nutrition planning with real-time form analysis and intelligent chat support.

## 🌟 Features

### Core Features
- **🎥 Real-time Form Analysis**: MediaPipe-powered pose detection with instant feedback on exercise form
- **💪 Comprehensive Exercise Library**:
  - Strength Training (Squats, Lunges, Push-ups, Planks)
  - Cardio (Jumping Jacks)
  - HIIT (Burpees, Mountain Climbers)
  - Yoga & Flexibility (Downward Dog, Child's Pose)
- **💃 Dance Coaching**:
  - Zumba
  - Hip-Hop Dance
  - Ballet Fitness
  - Real-time posture and symmetry tracking
- **🤖 AI Coach Chat**:
  - ChatGPT-powered personal coach
  - Context-aware of your profile (age, weight, height, goals, medical conditions)
  - Personalized fitness, nutrition, and dance advice
- **📊 Progress Tracking**:
  - GitHub-style activity heatmap
  - Weekly workout calendar
  - Weight and measurements tracking
  - Achievement system with 10+ milestones
- **🍽️ Nutrition Planning**:
  - Personalized meal plans
  - Macro tracking
  - Dietary preference support (vegetarian, vegan, keto, etc.)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- OpenAI API key (for AI coach chat feature)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YourUsername/ai-fitness-dance-diet-coach.git
   cd ai-fitness-dance-diet-coach
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env.local` and add your OpenAI API key:
   ```env
   DATABASE_URL=file:local.db
   BETTER_AUTH_SECRET=your-secret-key
   BETTER_AUTH_URL=http://localhost:3000
   OPENAI_API_KEY=sk-your-openai-api-key-here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Initialize the database**
   ```bash
   npm run db:push    # Create database tables
   npm run db:seed    # Seed with initial data
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3000](http://localhost:3000)**

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (chat, exercises, workouts, profile)
│   ├── coach/              # Coaching pages (chat, dance, workout)
│   ├── dashboard/          # User dashboard
│   ├── workouts/           # Workout library
│   └── page.tsx            # Landing page
├── components/             # React components
│   ├── ui/                 # shadcn/ui components
│   ├── AICoachChat.tsx     # Chat interface
│   └── FormAnalyzer.tsx    # Pose detection
├── db/                     # Database (schema, client, seed)
└── lib/                    # Utilities and auth config
```

## 🎯 Key Pages

- **`/`** - Landing page with features overview
- **`/workouts`** - Browse exercise library by category
- **`/coach/chat`** - Chat with AI fitness coach
- **`/coach/workout`** - Real-time workout coaching with form analysis
- **`/coach/dance`** - Dance coaching with posture tracking
- **`/dashboard`** - Progress tracking and analytics

## 🗄️ Database

The app uses SQLite (via Drizzle ORM) with tables for:
- Users & authentication
- Exercise & dance libraries (pre-seeded)
- Workout sessions & tracking
- Nutrition plans & food logs
- Chat messages & sessions
- Progress tracking & achievements

## 🛠️ Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:push      # Update database schema
npm run db:seed      # Seed initial data
npm run db:studio    # Open database GUI
```

## 🎨 Tech Stack

- **Next.js 15** + **React 19** + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui**
- **Drizzle ORM** + **SQLite/Turso**
- **better-auth** for authentication
- **OpenAI API** for AI chat
- **MediaPipe** for pose detection

## 🚀 Deployment

For production, use Turso for the database:

```bash
# Create Turso database
turso db create ai-fitness-coach

# Get credentials
turso db show ai-fitness-coach --url
turso db tokens create ai-fitness-coach

# Update .env with Turso credentials
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-token

# Deploy to Vercel
vercel
```

## 📄 License

MIT License

---

Built with ❤️ using Next.js, React, and AI
