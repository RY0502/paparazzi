import { useState, useEffect } from 'react';
import { Loader2, Sparkles, Star, FileText, Bell } from 'lucide-react';
import NewsCard from './components/NewsCard';
import TabButton from './components/TabButton';
import NewsDetail from './pages/NewsDetail';
import NewsletterPage from './pages/NewsletterPage';
import { fetchNews } from './services/newsService';
import type { NewsItem, Category } from './types';
import { enableNotifications, isNotificationsEnabled } from './services/pushService';

function App() {
  const [activeTab, setActiveTab] = useState<Category>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('activeCategory');
      if (stored === 'bollywood' || stored === 'tv' || stored === 'hollywood') {
        return stored as Category;
      }
    }
    return 'bollywood';
  });
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<{
    id: string;
    personName: string;
    newsTitle: string;
    youtubeUrl?: string;
  } | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [viewingNewsletter, setViewingNewsletter] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifMsg, setNotifMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNews) {
      window.scrollTo(0, scrollPosition);
    }
  }, [selectedNews, scrollPosition]);

  useEffect(() => {
    loadNews(activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeCategory', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    (async () => {
      try {
        const enabled = await isNotificationsEnabled();
        setNotifsEnabled(enabled);
      } catch {
        setNotifsEnabled(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }, []);

  // Remove auto-prompt and persistent banner behavior; show iOS hint only on button click

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

  const handleNewsClick = (id: string, personName: string, newsTitle: string, youtubeUrl?: string) => {
    setScrollPosition(window.scrollY);
    setSelectedNews({ id, personName, newsTitle, youtubeUrl });
  };

  const handleBackFromDetail = () => {
    setSelectedNews(null);
  };

  const handleNavigateToCategory = (category: Category) => {
    setScrollPosition(0);
    setActiveTab(category);
    setSelectedNews(null);
  };

  if (viewingNewsletter) {
    return (
      <NewsletterPage onBack={() => setViewingNewsletter(false)} />
    );
  }

  if (selectedNews) {
    return (
      <NewsDetail
        category={activeTab}
        newsId={selectedNews.id}
        personName={selectedNews.personName}
        newsTitle={selectedNews.newsTitle}
        youtubeUrl={selectedNews.youtubeUrl}
        onBack={handleBackFromDetail}
        onNavigateToCategory={handleNavigateToCategory}
      />
    );
  }

  const ptClass = 'safe-pt-28';
  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-rose selection:text-white">
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose/10 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full animate-pulse-slow delay-1000"></div>
        <div className="absolute inset-0 noise-texture opacity-[0.02]"></div>
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 bg-onyx/20 backdrop-blur-3xl border-b border-white/5 safe-top">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20 sm:h-24">
            <div
              className="flex items-center gap-4 group cursor-pointer"
              onClick={() => {
                setSelectedNews(null);
                setViewingNewsletter(false);
                setActiveTab('bollywood');
                setScrollPosition(0);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-rose rounded-xl blur-2xl opacity-40 group-hover:opacity-70 transition-opacity"></div>
                <div className="relative bg-gradient-to-br from-rose to-rose/80 p-2.5 rounded-2xl border border-white/10 shadow-2xl">
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-3xl font-black tracking-tighter text-white font-inter">
                  PAPARAZZI
                </h1>
                <div className="flex items-center gap-2">
                  <span className="h-[1px] w-4 bg-rose"></span>
                  <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-slate-500">
                    Premium Feed
                  </p>
                </div>
              </div>
            </div>

            <nav className="flex items-center p-1 bg-white/5 backdrop-blur-md rounded-full border border-white/5 shadow-inner">
              <TabButton
                active={activeTab === 'bollywood'}
                onClick={() => handleNavigateToCategory('bollywood')}
                label="Bollywood"
              />
              <TabButton
                active={activeTab === 'tv'}
                onClick={() => handleNavigateToCategory('tv')}
                label="TV"
              />
              <TabButton
                active={activeTab === 'hollywood'}
                onClick={() => handleNavigateToCategory('hollywood')}
                label="Hollywood"
              />
            </nav>
          </div>
        </div>
      </div>

      <main className={`${ptClass} pb-24 px-6 lg:px-12 relative z-10`}>
        <div className="max-w-5xl mx-auto">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-onyx/40 backdrop-blur-xl rounded-full mb-8 border border-white/5 shadow-2xl">
              <Star className="w-4 h-4 text-gold fill-gold" />
              <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                Verified Updates
              </span>
            </div>
            <h2 className="text-6xl sm:text-8xl font-black text-white mb-6 tracking-tighter uppercase font-inter italic">
              {activeTab} <span className="text-rose">News</span>
            </h2>
            <p className="text-slate-500 text-lg font-medium max-w-xl mx-auto leading-relaxed">
              Curated entertainment exclusives from the heart of {activeTab}.
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-rose animate-spin stroke-[3]" />
                <div className="absolute inset-0 blur-2xl bg-rose/40 animate-pulse"></div>
              </div>
              <p className="mt-10 text-slate-500 font-bold tracking-widest uppercase text-xs">Syncing Exclusives...</p>
            </div>
          ) : error ? (
            <div className="bg-rose/10 backdrop-blur-3xl border border-rose/20 rounded-3xl p-12 text-center shadow-2xl">
              <p className="text-rose font-bold text-lg">{error}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-3xl border border-white/5 rounded-3xl p-12 text-center">
              <p className="text-slate-500 font-medium">The feed is quiet... for now.</p>
            </div>
          ) : (
            <div className="grid gap-10">
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

      <footer className="border-t border-white/5 bg-onyx/20 backdrop-blur-3xl relative z-10">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 items-start">
            <div className="md:col-span-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-rose p-3 rounded-2xl shadow-2xl">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-black tracking-tighter text-white">PAPARAZZI</h3>
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm">
                The ultimate destination for premium entertainment exclusives. From Bollywood to Hollywood, we bring you the stories that matter with a cinematic touch.
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Actions</h4>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setViewingNewsletter(true)}
                  className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all font-bold text-xs uppercase tracking-widest"
                >
                  <FileText className="w-4 h-4 text-rose" />
                  Newsletter
                </button>
                <button
                  onClick={async () => {
                    if (notifsEnabled || notifBusy) return;
                    setNotifBusy(true);
                    const res = await enableNotifications();
                    setNotifBusy(false);
                    setNotifsEnabled(!!res.success);
                    setNotifMsg(res.message || (res.success ? 'Notifications enabled' : 'Unable to enable notifications'));
                  }}
                  className={`flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    notifsEnabled
                      ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                      : 'bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20'
                  }`}
                  disabled={notifsEnabled || notifBusy}
                >
                  {notifBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                  {notifsEnabled ? 'Notifications Active' : 'Enable Alerts'}
                </button>
              </div>
            </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Legal</h4>
                <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">
                  © RYaxn 2026 Paparazzi.<br/>Where Entertainment Never Sleeps.
                </p>
                {notifMsg && (
                  <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                    {notifMsg}
                  </p>
                )}
              </div>
          </div>
          
          <div className="mt-16 pt-8 border-t border-white/5 flex justify-center items-center">
            <div className="flex gap-6">
              {['Twitter', 'Instagram', 'YouTube'].map(social => (
                <span key={social} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-rose cursor-pointer transition-colors">
                  {social}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
