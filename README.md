# Math Problem Generator - Developer Assessment Starter Kit

## Overview

This is a starter kit for building an AI-powered math problem generator application. The goal is to create a standalone prototype that uses AI to generate math word problems suitable for Primary 5 students, saves the problems and user submissions to a database, and provides personalized feedback.

## Tech Stack

- **Frontend Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **AI Integration**: Google Generative AI (Gemini)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/haari006/nextjs-gemini-maths-genai.git
cd math-problem-generator
```

### 2. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings → API to find your:
   - Project URL (starts with `https://`)
   - Anon/Public Key

### 3. Set Up Database Tables

1. In your Supabase dashboard, go to SQL Editor
2. Copy and paste the contents of `database.sql`
3. Click "Run" to create the tables and policies

### 4. Get Google API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key for Gemini

### 5. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
2. Edit `.env.local` and add your actual keys:
   ```
NEXT_PUBLIC_SUPABASE_URL=https://oawritcponbrgvtwmrjf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hd3JpdGNwb25icmd2dHdtcmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2Mjg4ODcsImV4cCI6MjA3NTIwNDg4N30.CvOvq8zkgQSJHBt51CDzeGyoyCKVHc8JSBIRnd0VEys
   GOOGLE_API_KEY=your_actual_google_api_key
   ```

### 6. Install Dependencies

```bash
npm install
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Assessment Submission

1. **GitHub Repository URL**: Make sure it's public
2. **Live Demo URL**: [Your Vercel deployment](https://nextjs-gemini-maths-genai.vercel.app/)
3. **Supabase Credentials**: Add these to your README for testing:
   ```
   SUPABASE_URL: [https://oawritcponbrgvtwmrjf.supabase.co]
   SUPABASE_ANON_KEY: [eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hd3JpdGNwb25icmd2dHdtcmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2Mjg4ODcsImV4cCI6MjA3NTIwNDg4N30.CvOvq8zkgQSJHBt51CDzeGyoyCKVHc8JSBIRnd0VEys]
   ```