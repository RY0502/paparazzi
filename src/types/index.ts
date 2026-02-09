export type Category = 'bollywood' | 'tv' | 'hollywood';

export interface NewsItem {
  id: string;
  news_text: string;
  person_name: string;
  image_url: string;
  created_at: string;
  search_query: string;
  youtube_url?: string;
  news_body?: string;
}

export interface CachedNews {
  id: string;
  category: Category;
  cached_data: NewsItem[];
  cached_at: string;
  expires_at: string;
}

export interface NewsDetailParams {
  category: Category;
  personName: string;
  newsTitle: string;
}
