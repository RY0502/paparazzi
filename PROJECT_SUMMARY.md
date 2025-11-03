# Paparazzi - Entertainment News App

## Project Complete! ✓

A stunning, modern entertainment news application that delivers the latest updates from Bollywood, TV, and Hollywood industries.

## What's Been Built

### Frontend (Complete ✓)
- **Modern React App** with TypeScript and Vite
- **Beautiful Dark Theme** with rose/pink gradient accents (no purple!)
- **Three Category Tabs**: Bollywood, TV, Hollywood
- **Responsive Design** that works beautifully on mobile and desktop
- **Smooth Animations** with hover effects and transitions
- **Loading States** with animated spinners
- **News Cards** with images, person names, and descriptions
- **1-Hour Caching** for optimal performance
- **Click-to-Search** - Opens Google search in new tab

### Backend (Complete ✓)
- **Database Schema** - SQL ready to deploy (see SETUP_INSTRUCTIONS.md)
- **Two Edge Functions**:
  1. `fetch-news` - On-demand news fetching
  2. `news-scheduler` - Hourly automated updates
- **Gemini AI Integration** - Uses Google Gemini 2.0 Flash for news generation
- **Pexels API Integration** - Fetches celebrity images
- **Automatic Cleanup** - Maintains max 25 news items per category
- **Mock Data** - App works immediately with sample data

## Files Created

### Frontend
- `src/App.tsx` - Main application component
- `src/components/NewsCard.tsx` - Beautiful news card with image
- `src/components/TabButton.tsx` - Gradient tab button
- `src/types/index.ts` - TypeScript interfaces
- `src/services/newsService.ts` - API service with caching

### Backend
- `supabase/functions/fetch-news/index.ts` - News fetching function
- `supabase/functions/news-scheduler/index.ts` - Automated scheduler

### Documentation
- `SETUP_INSTRUCTIONS.md` - Complete setup guide
- `.env` - Environment variables (needs GEMINI_API_KEY)

## Next Steps to Deploy

1. **Set Up Database** (in Supabase SQL Editor)
   - Run the SQL from `SETUP_INSTRUCTIONS.md`
   - Creates 3 tables: bollywood_news, tv_news, hollywood_news
   - Sets up RLS policies and triggers

2. **Get API Keys**
   - Gemini API: https://makersuite.google.com/app/apikey
   - Pexels API: https://www.pexels.com/api/ (optional)

3. **Deploy Edge Functions**
   - Use Supabase dashboard to deploy functions
   - Add GEMINI_API_KEY and PEXELS_API_KEY to secrets

4. **Set Up Cron Job**
   - Configure hourly execution of news-scheduler
   - Use Supabase Cron or external service

5. **Initial Data Load**
   - Trigger news-scheduler manually to populate data
   - App will then show real AI-generated news

## Features Implemented

✓ Three category tabs (Bollywood, TV, Hollywood)
✓ AI-powered news generation with Gemini 2.0 Flash
✓ Celebrity image fetching from Pexels
✓ 1-hour caching for performance
✓ Displays latest 15 news per category
✓ Stores max 25 news per category (auto-cleanup)
✓ Click to open Google search
✓ Beautiful modern UI with smooth animations
✓ Fully responsive design
✓ Loading states and error handling
✓ Mock data for immediate testing

## Current Status

The app is **fully functional** with mock data and will connect to real data once you:
1. Run the database SQL setup
2. Deploy the Edge Functions with API keys
3. Set up the hourly cron job

The build is successful and ready for deployment!

## Design Highlights

- **Color Scheme**: Dark slate background with rose/pink accents
- **No Purple!**: Used rose, pink, and slate colors for a premium feel
- **Glassmorphism**: Backdrop blur effects on header and cards
- **Smooth Transitions**: Hover effects on cards and buttons
- **Modern Typography**: Clean, readable text with proper spacing
- **Loading Experience**: Beautiful animated loaders while fetching

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Supabase (database + edge functions)
- Google Gemini 2.0 Flash (AI news generation)
- Pexels API (celebrity images)
- Lucide React (icons)

The app is production-ready and builds successfully!
