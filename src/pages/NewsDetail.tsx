import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Sparkles, Clock } from 'lucide-react';
import TabButton from '../components/TabButton';
import type { Category } from '../types';

interface NewsDetailProps {
  category: Category;
  personName: string;
  newsTitle: string;
  onBack: () => void;
}

function NewsDetail({ category, personName, newsTitle, onBack }: NewsDetailProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchStreamingContent = async () => {
      setLoading(true);
      setError(null);
      setContent('');

      try {
        const params = new URLSearchParams({
          category,
          personName,
          newsTitle,
        });

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const url = `${supabaseUrl}/functions/v1/stream-news-content?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${anonKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6);
                const data = JSON.parse(jsonStr);

                if (data.done) {
                  setLoading(false);
                  break;
                }

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.text) {
                  setContent((prev) => prev + data.text);
                }
              } catch {
              }
            }
          }

          buffer = lines[lines.length - 1];
        }

        setLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load content'
        );
        setLoading(false);
      }
    };

    fetchStreamingContent();
  }, [category, personName, newsTitle]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 sm:h-20 gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors group"
              aria-label="Go back"
            >
              <ArrowLeft className="w-6 h-6 text-rose-500 group-hover:text-rose-400 transition-colors" />
            </button>

            <nav className="flex gap-2">
              <TabButton
                active={category === 'bollywood'}
                onClick={() => {}}
                label={
                  <>
                    <span className="sm:hidden">B'wood</span>
                    <span className="hidden sm:inline">Bollywood</span>
                  </>
                }
              />
              <TabButton
                active={category === 'tv'}
                onClick={() => {}}
                label="TV"
              />
              <TabButton
                active={category === 'hollywood'}
                onClick={() => {}}
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

      <main className="flex-grow pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 backdrop-blur-sm rounded-full mb-4 border border-slate-700/50">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                {category}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
                {personName}
              </span>
              <span className="text-slate-400 mx-3">—</span>
              <span className="text-white">{newsTitle}</span>
            </h1>
            <div className="flex items-center gap-4 text-slate-400 mb-6">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {Math.ceil(content.split(' ').length / 200)} min read
                </span>
              </div>
            </div>
            <div className="h-1 w-32 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"></div>
          </div>

          {loading && content === '' ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-rose-500 animate-spin" />
                <div className="absolute inset-0 blur-xl bg-rose-500/30 animate-pulse"></div>
              </div>
              <p className="mt-8 text-slate-400 font-medium text-lg">
                Fetching details...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
              <p className="text-red-400 font-medium">{error}</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div
                ref={contentRef}
                className="prose prose-invert max-w-none"
              >
                <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 sm:p-12 leading-relaxed">
                  <div className="space-y-6">
                    {content.split('\n\n').map((paragraph, idx) => (
                      paragraph.trim() && (
                        <p key={idx} className="text-slate-200 text-lg leading-8">
                          {paragraph.trim()}
                        </p>
                      )
                    ))}
                  </div>
                  {loading && (
                    <div className="mt-8 flex items-center gap-3">
                      <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
                      <span className="text-slate-400 text-sm">
                        Fetching more details...
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={onBack}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all hover:shadow-lg hover:shadow-rose-500/20 active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to News
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
       <footer className="border-t border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
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

export default NewsDetail;