import { useState, useEffect } from 'react';
import { Loader2, Sparkles, Star } from 'lucide-react';
import NewsCard from './components/NewsCard';
import TabButton from './components/TabButton';
import NewsDetail from './pages/NewsDetail';
import { fetchNews } from './services/newsService';
import type { NewsItem, Category } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<Category>('bollywood');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<{
    personName: string;
    newsTitle: string;
  } | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    if (!selectedNews) {
      window.scrollTo(0, scrollPosition);
    }
  }, [selectedNews, scrollPosition]);

  useEffect(() => {
    loadNews(activeTab);
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

  const handleNewsClick = (personName: string, newsTitle: string) => {
    setScrollPosition(window.scrollY);
    setSelectedNews({ personName, newsTitle });
  };

  const handleBackFromDetail = () => {
    setSelectedNews(null);
  };

  if (selectedNews) {
    return (
      <NewsDetail
        category={activeTab}
        personName={selectedNews.personName}
        newsTitle={selectedNews.newsTitle}
        onBack={handleBackFromDetail}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-950/30 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 sm:h-20 gap-2 sm:gap-6">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl blur-xl opacity-60 group-hover:opacity-100 transition-opacity animate-glow"></div>
                <div className="relative bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-xl">
                  <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
                  Paparazzi
                </h1>
                <p className="text-slate-400 text-xs hidden sm:block">Entertainment News</p>
              </div>
            </div>

            <nav className="flex gap-0 overflow-hidden rounded-xl">
              <TabButton
                active={activeTab === 'bollywood'}
                onClick={() => setActiveTab('bollywood')}
                label={
                  <>
                    <span className="sm:hidden">B'wood</span>
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
                    <span className="sm:hidden">H'wood</span>
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-md rounded-full mb-4 border border-white/10">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                Latest Updates
              </span>
            </div>
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
            <div className="bg-red-500/10 backdrop-blur-lg border border-red-500/20 rounded-2xl p-8 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 text-center">
              <p className="text-slate-400">No news available at the moment.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {news.map((item) => (
                <NewsCard
                  key={item.id}
                  item={item}
                  onClick={handleNewsClick}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/30 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold">Paparazzi</p>
                <p className="text-slate-400 text-sm">Entertainment News</p>
              </div>
            </div>
            <p className="text-slate-500 text-sm">
              © 2025 RYaxn. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;