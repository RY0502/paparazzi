import { useState, useEffect } from 'react';
import { Loader2, ExternalLink, Sparkles } from 'lucide-react';
import NewsCard from './components/NewsCard';
import TabButton from './components/TabButton';
import { fetchNews } from './services/newsService';
import type { NewsItem, Category } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<Category>('bollywood');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNews( activeTab);
  }, [activeTab]);

  const loadNews = async (category: Category) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchNews(category);
      setNews(data);
    } catch (err) {
      setError('Failed to load news. Please try again later.');
      console.error('Error loading news:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewsClick = (searchQuery: string) => {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 sm:h-20 gap-2 sm:gap-6">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-rose-500 group-hover:text-rose-400 transition-colors" />
                <div className="absolute inset-0 blur-xl bg-rose-500/30 group-hover:bg-rose-400/40 transition-all"></div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
                Paparazzi
              </h1>
            </div>

            <nav className="flex gap-0">
              <TabButton
                active={activeTab === 'bollywood'}
                onClick={() => setActiveTab('bollywood')}
                label={
    <>
      <span className="sm:hidden">B’wood</span>
      <span className="hidden sm:inline">Bollywood</span>
    </>
  }
              />
              <TabButton
                active={activeTab === 'tv'}
                onClick={() => setActiveTab('tv')}
                label="TV"
              />
              <TabButton
                active={activeTab === 'hollywood'}
                onClick={() => setActiveTab('hollywood')}
                label={
    <>
      <span className="sm:hidden">H’wood</span>
      <span className="hidden sm:inline">Hollywood</span>
    </>
  }
              />
            </nav>
          </div>
        </div>
      </div>

      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-2 capitalize">
              {activeTab} News
            </h2>
            <p className="text-slate-400">
              Latest entertainment updates from the {activeTab} industry
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
                <div className="absolute inset-0 blur-xl bg-rose-500/30 animate-pulse"></div>
              </div>
              <p className="mt-6 text-slate-400 font-medium">Loading latest news...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center">
              <p className="text-slate-400">No news available at the moment.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {news.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onClick={() => handleNewsClick(item.search_query)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-slate-500 text-sm">
            © 2025 RYaxn. Entertainment news at your fingertips.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
