import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Newsletter from '../components/Newsletter';
import { fetchNews } from '../services/newsService';
import type { NewsItem } from '../types';

interface NewsletterPageProps {
  onBack: () => void;
}

export default function NewsletterPage({ onBack }: NewsletterPageProps) {
  const [bollywoodNews, setBollywoodNews] = useState<NewsItem[]>([]);
  const [tvNews, setTvNews] = useState<NewsItem[]>([]);
  const [hollywoodNews, setHollywoodNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAllNews = async () => {
      try {
        const [bollywood, tv, hollywood] = await Promise.all([
          fetchNews('bollywood'),
          fetchNews('tv'),
          fetchNews('hollywood'),
        ]);
        setBollywoodNews(bollywood);
        setTvNews(tv);
        setHollywoodNews(hollywood);
      } catch (err) {
        setError('Failed to load newsletter data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadAllNews();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-rose-500 animate-spin" />
          <div className="absolute inset-0 blur-xl bg-rose-500/30 animate-pulse"></div>
        </div>
        <p className="mt-6 text-slate-400 font-medium">Loading newsletter...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center">
        <button
          onClick={onBack}
          className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <div className="bg-red-500/10 backdrop-blur-lg border border-red-500/20 rounded-2xl p-8 text-center max-w-md">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="fixed top-8 left-8 z-50 flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors bg-slate-950/50 hover:bg-slate-950/70 rounded-lg backdrop-blur-sm border border-white/10"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Back</span>
      </button>
      <Newsletter
        bollywoodNews={bollywoodNews}
        tvNews={tvNews}
        hollywoodNews={hollywoodNews}
      />
    </div>
  );
}
