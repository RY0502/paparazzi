# Paparazzi - Entertainment News App Setup Instructions

## Overview
Paparazzi is a modern, visually stunning entertainment news application that delivers the latest updates from Bollywood, TV, and Hollywood industries. The app features AI-powered news generation using Google's Gemini API and automated hourly updates.

## Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Supabase account with database access
- Google Gemini API key
- Pexels API key (optional, for better image quality)

## Database Setup

### Step 1: Create Database Tables
Run the following SQL in your Supabase SQL Editor to create the required tables:

```sql
-- Create bollywood_news table
CREATE TABLE IF NOT EXISTS bollywood_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_text text NOT NULL,
  person_name text NOT NULL,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  search_query text NOT NULL
);

-- Create tv_news table
CREATE TABLE IF NOT EXISTS tv_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_text text NOT NULL,
  person_name text NOT NULL,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  search_query text NOT NULL
);

-- Create hollywood_news table
CREATE TABLE IF NOT EXISTS hollywood_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_text text NOT NULL,
  person_name text NOT NULL,
  image_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  search_query text NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS bollywood_news_created_at_idx ON bollywood_news(created_at DESC);
CREATE INDEX IF NOT EXISTS tv_news_created_at_idx ON tv_news(created_at DESC);
CREATE INDEX IF NOT EXISTS hollywood_news_created_at_idx ON hollywood_news(created_at DESC);

-- Enable RLS
ALTER TABLE bollywood_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE tv_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE hollywood_news ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Anyone can read bollywood news"
  ON bollywood_news FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can read tv news"
  ON tv_news FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can read hollywood news"
  ON hollywood_news FOR SELECT
  TO anon
  USING (true);

-- Function to maintain max 25 news items
CREATE OR REPLACE FUNCTION maintain_news_limit()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM bollywood_news
  WHERE id IN (
    SELECT id FROM bollywood_news
    ORDER BY created_at DESC
    OFFSET 25
  );

  DELETE FROM tv_news
  WHERE id IN (
    SELECT id FROM tv_news
    ORDER BY created_at DESC
    OFFSET 25
  );

  DELETE FROM hollywood_news
  WHERE id IN (
    SELECT id FROM hollywood_news
    ORDER BY created_at DESC
    OFFSET 25
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to maintain limits
CREATE OR REPLACE TRIGGER maintain_bollywood_limit
AFTER INSERT ON bollywood_news
FOR EACH STATEMENT
EXECUTE FUNCTION maintain_news_limit();

CREATE OR REPLACE TRIGGER maintain_tv_limit
AFTER INSERT ON tv_news
FOR EACH STATEMENT
EXECUTE FUNCTION maintain_news_limit();

CREATE OR REPLACE TRIGGER maintain_hollywood_limit
AFTER INSERT ON hollywood_news
FOR EACH STATEMENT
EXECUTE FUNCTION maintain_news_limit();
```

### Step 2: Deploy Edge Functions

The project includes two Edge Functions:

1. **fetch-news**: Fetches news on-demand using Gemini AI
2. **news-scheduler**: Automated hourly updates for all categories

To deploy these functions, use the Supabase CLI or dashboard to deploy the functions located in:
- `supabase/functions/fetch-news/`
- `supabase/functions/news-scheduler/`

### Step 3: Configure Environment Variables

#### For Edge Functions (in Supabase Dashboard):
Add these secrets to your Supabase project:
- `GEMINI_API_KEY`: Your Google Gemini API key
- `PEXELS_API_KEY`: Your Pexels API key (optional)

#### For Frontend (.env file):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 4: Get API Keys

1. **Gemini API Key**:
   - Visit https://makersuite.google.com/app/apikey
   - Create a new API key
   - Add to Supabase Edge Function secrets

2. **Pexels API Key** (Optional):
   - Visit https://www.pexels.com/api/
   - Sign up and get a free API key
   - Add to Supabase Edge Function secrets

### Step 5: Setup Cron Job for Automated Updates

In your Supabase Dashboard, set up a cron job to run the `news-scheduler` function every hour:

Using Supabase Cron (via SQL):
```sql
SELECT cron.schedule(
  'news-scheduler-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
      url:='https://your-project.supabase.co/functions/v1/news-scheduler',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) AS request_id;
  $$
);
```

Or use external services like:
- GitHub Actions
- Vercel Cron Jobs
- Cloud Scheduler

### Step 6: Initial Data Population

After deploying the Edge Functions, trigger the scheduler manually to populate initial data:

```bash
curl -X POST \
  https://your-project.supabase.co/functions/v1/news-scheduler \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Configure your `.env` file with Supabase credentials

4. Start the development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Features

- **Modern UI**: Beautiful dark theme with gradient accents and smooth animations
- **Three Categories**: Bollywood, TV, and Hollywood news
- **AI-Powered**: Uses Google Gemini 2.0 Flash for intelligent news generation
- **Automated Updates**: Hourly cron job fetches fresh news
- **Image Integration**: Fetches celebrity images from Pexels
- **Caching**: 1-hour cache for optimal performance
- **Responsive Design**: Works beautifully on mobile and desktop
- **Direct Search**: Click any news item to search on Google

## Architecture

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Google Gemini 2.0 Flash
- **Images**: Pexels API
- **Caching**: In-memory + Supabase storage

## Performance Features

- In-memory caching with 1-hour expiration
- Optimized database queries with indexes
- Lazy loading images with fallbacks
- Automatic cleanup of old news (maintains max 25 items per category)
- CDN-optimized image delivery

## Troubleshooting

### No News Showing
- Ensure database tables are created
- Check if Edge Functions are deployed
- Verify API keys are configured
- Trigger the scheduler manually for initial data

### Images Not Loading
- Check Pexels API key configuration
- Fallback default image will be used if API fails
- Verify CORS settings in Edge Functions

### Cron Job Not Running
- Verify cron job is properly configured
- Check Supabase logs for errors
- Ensure service role key has proper permissions

## License
MIT
