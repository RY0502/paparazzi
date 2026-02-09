import { createClient } from '@supabase/supabase-js';
import type { NewsItem, Category } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabase;
}

function resetSupabaseClient() {
  if (supabase) {
    supabase = null;
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      resetSupabaseClient();
    }
  });
}

const CACHE_DURATION_MS = 60 * 60 * 1000;

const inMemoryCache: Record<Category, { data: NewsItem[]; timestamp: number } | null> = {
  bollywood: null,
  tv: null,
  hollywood: null,
};

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function fetchNews(category: Category): Promise<NewsItem[]> {
  const now = Date.now();
  const cached = inMemoryCache[category];

  if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
    return cached.data;
  }

  const client = getSupabaseClient();
  if (!client) {
    console.log('Supabase not configured, using mock data');
    const mockData = getMockNews(category);
    inMemoryCache[category] = {
      data: mockData,
      timestamp: now,
    };
    return mockData;
  }

  try {
    const tableName = `${category}_news`;
    const maxAttempts = 2;
    const baseDelayMs = 500;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data, error } = await client
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(15);
        if (error) {
          if (attempt < maxAttempts) {
            const wait = Math.max(0, baseDelayMs * Math.pow(2, attempt - 1) + (Math.random() * baseDelayMs * 0.6 - baseDelayMs * 0.3));
            await delay(wait);
            continue;
          }
          const mockData = getMockNews(category);
          return mockData;
        }
        const newsItems = data || [];
        if (newsItems.length === 0) {
          if (attempt < maxAttempts) {
            const wait = Math.max(0, baseDelayMs * Math.pow(2, attempt - 1) + (Math.random() * baseDelayMs * 0.6 - baseDelayMs * 0.3));
            await delay(wait);
            continue;
          }
          const mockData = getMockNews(category);
          return mockData;
        }
        inMemoryCache[category] = {
          data: newsItems,
          timestamp: now,
        };
        return newsItems;
      } catch (e) {
        if (attempt < maxAttempts) {
          const wait = Math.max(0, baseDelayMs * Math.pow(2, attempt - 1) + (Math.random() * baseDelayMs * 0.6 - baseDelayMs * 0.3));
          await delay(wait);
          continue;
        }
        const mockData = getMockNews(category);
        return mockData;
      }
    }
    const mockData = getMockNews(category);
    return mockData;
  } catch (err) {
    console.error(`Failed to fetch ${category} news:`, err);
    const mockData = getMockNews(category);
    return mockData;
  }
}

function getMockNews(category: Category): NewsItem[] {
  const mockData: Record<Category, NewsItem[]> = {
    bollywood: [
      {
        id: '1',
        news_text: 'Shah Rukh Khan announces new project with acclaimed director, set to begin filming next month',
        person_name: 'Shah Rukh Khan',
        image_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Shah Rukh Khan new project announcement',
      },
      {
        id: '2',
        news_text: 'Deepika Padukone wins Best Actress award at international film festival',
        person_name: 'Deepika Padukone',
        image_url: 'https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Deepika Padukone Best Actress award',
      },
      {
        id: '3',
        news_text: 'Ranveer Singh collaborates with global brand for exclusive fashion line',
        person_name: 'Ranveer Singh',
        image_url: 'https://images.pexels.com/photos/1516680/pexels-photo-1516680.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Ranveer Singh fashion collaboration',
      },
    ],
    tv: [
      {
        id: '4',
        news_text: 'Popular TV actress signs for new daily soap drama premiering next season',
        person_name: 'Hina Khan',
        image_url: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Hina Khan new daily soap',
      },
      {
        id: '5',
        news_text: 'Reality show host reveals behind-the-scenes secrets in candid interview',
        person_name: 'Karan Johar',
        image_url: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Karan Johar reality show interview',
      },
      {
        id: '6',
        news_text: 'Lead actor from hit series discusses upcoming season finale surprises',
        person_name: 'Rupali Ganguly',
        image_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Rupali Ganguly TV series finale',
      },
    ],
    hollywood: [
      {
        id: '7',
        news_text: 'Oscar winner announces retirement from acting to focus on directing',
        person_name: 'Leonardo DiCaprio',
        image_url: 'https://images.pexels.com/photos/1438081/pexels-photo-1438081.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Leonardo DiCaprio retirement directing',
      },
      {
        id: '8',
        news_text: 'A-list actress launches production company focused on diverse storytelling',
        person_name: 'Emma Stone',
        image_url: 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Emma Stone production company',
      },
      {
        id: '9',
        news_text: 'Pop superstar drops surprise album with star-studded collaborations',
        person_name: 'Taylor Swift',
        image_url: 'https://images.pexels.com/photos/1587009/pexels-photo-1587009.jpeg?auto=compress&cs=tinysrgb&w=800',
        created_at: new Date().toISOString(),
        search_query: 'Taylor Swift surprise album release',
      },
    ],
  };

  return mockData[category] || [];
}
