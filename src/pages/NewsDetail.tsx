import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, Sparkles, Clock } from 'lucide-react';
import TabButton from '../components/TabButton';
import { createClient } from '@supabase/supabase-js';
import type { Category } from '../types';

interface NewsDetailProps {
  category: Category;
  newsId: string;
  personName: string;
  newsTitle: string;
  youtubeUrl?: string;
  onBack: () => void;
  onNavigateToCategory: (category: Category) => void;
}

function NewsDetail({ category, newsId, personName, newsTitle, youtubeUrl, onBack, onNavigateToCategory }: NewsDetailProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbYoutubeUrl, setDbYoutubeUrl] = useState<string | undefined>(undefined);
  const [forceStream, setForceStream] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchStreamingContent = async () => {
      setLoading(true);
      setError(null);
      setContent('');

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const client = supabaseUrl && anonKey ? createClient(supabaseUrl, anonKey) : null;
        if (!client) {
          throw new Error('Supabase not configured');
        }
        const tableName = `${category}_news`;
        const { data: row, error: selErr } = await client
          .from(tableName)
          .select('id,youtube_url,news_body')
          .eq('id', newsId)
          .limit(1)
          .maybeSingle();
        if (selErr) {
          console.warn('Failed to read news body', selErr);
        }
        if (row?.youtube_url) {
          setDbYoutubeUrl(row.youtube_url as string);
        }
        if (!forceStream && row?.news_body && String(row.news_body).trim().length > 0) {
          setContent(String(row.news_body));
          setLoading(false);
          return;
        }
        const params = new URLSearchParams({
          category,
          personName,
          newsTitle,
        });

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
        let full = '';

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
                  try {
                    const fnUrl = `${supabaseUrl}/functions/v1/update-news-body`;
                    const r = await fetch(fnUrl, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${anonKey}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ table: tableName, id: newsId, news_body: full })
                    });
                    if (!r.ok) {
                      console.warn('Failed to persist news_body via function', r.status, r.statusText);
                    }
                  } catch {}
                  setLoading(false);
                  setForceStream(false);
                  break;
                }

                if (data.error) {
                  throw new Error(data.error);
                }

                if (data.text) {
                  full += data.text;
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
  }, [category, newsId, personName, newsTitle, forceStream]);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col selection:bg-rosewood selection:text-white">
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rosewood/10 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full animate-pulse-slow delay-1000"></div>
        <div className="absolute inset-0 noise-texture opacity-[0.02]"></div>
      </div>

      <div className="fixed top-0 left-0 right-0 z-50 bg-onyx/20 backdrop-blur-3xl border-b border-white/5 safe-top">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-20 sm:h-24">
            <div className="flex items-center gap-6">
              <button
                onClick={onBack}
                className="group p-3 bg-white/5 hover:bg-rosewood backdrop-blur-md rounded-2xl border border-white/5 transition-all duration-500 shadow-xl"
                aria-label="Go back"
              >
                <ArrowLeft className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
              </button>

              <nav className="hidden md:flex items-center p-1 bg-white/5 backdrop-blur-md rounded-full border border-white/5">
                <TabButton
                  active={category === 'bollywood'}
                  onClick={() => onNavigateToCategory('bollywood')}
                  label="Bollywood"
                />
                <TabButton
                  active={category === 'tv'}
                  onClick={() => onNavigateToCategory('tv')}
                  label="TV"
                />
                <TabButton
                  active={category === 'hollywood'}
                  onClick={() => onNavigateToCategory('hollywood')}
                  label="Hollywood"
                />
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-rosewood/10 px-4 py-1.5 rounded-full border border-rosewood/20">
                <span className="text-rosewood text-[10px] font-black uppercase tracking-[0.2em]">{category}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow safe-pt-28 pb-24 px-6 lg:px-12 relative z-10">
        <div className="max-w-4xl mx-auto">
          <header className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-[1px] bg-rosewood"></div>
              <span className="text-gold text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
                <Sparkles className="w-4 h-4 fill-gold" /> Exclusive Feature
              </span>
            </div>
            
            <h1 className="text-5xl sm:text-7xl font-black mb-8 leading-[1.1] tracking-tighter text-white">
              <span className="italic font-serif text-rosewood block mb-2">{personName}</span>
              {newsTitle}
            </h1>

            <div className="flex flex-wrap items-center gap-8 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-rosewood" />
                <span>{Math.ceil(content.split(' ').length / 200)} Minute Read</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span>Live Feed</span>
              </div>
            </div>
          </header>

          {loading && content === '' ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="relative">
                <Loader2 className="w-20 h-20 text-rosewood animate-spin stroke-[3]" />
                <div className="absolute inset-0 blur-3xl bg-rosewood/40 animate-pulse"></div>
              </div>
              <p className="mt-12 text-slate-500 font-black tracking-[0.3em] uppercase text-xs">Assembling Details...</p>
            </div>
          ) : error ? (
            <div className="bg-rosewood/10 backdrop-blur-3xl border border-rosewood/20 rounded-3xl p-12 text-center shadow-2xl">
              <p className="text-rosewood font-bold text-lg">{error}</p>
            </div>
          ) : (
            <div className="space-y-16">
              {(dbYoutubeUrl || youtubeUrl) && (
                <section className="relative group">
                  <div className="absolute inset-0 bg-rosewood/20 blur-3xl rounded-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-700"></div>
                  <div className="relative bg-onyx rounded-[2rem] overflow-hidden border border-white/5 shadow-2xl aspect-video">
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={(dbYoutubeUrl || youtubeUrl || '').replace('watch?v=', 'embed/')}
                      title="News Video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </section>
              )}

              <article className="relative">
                <div className="absolute -left-8 top-0 bottom-0 w-[1px] bg-gradient-to-b from-rosewood via-white/5 to-transparent hidden lg:block"></div>
                <div className="bg-onyx/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 p-10 sm:p-16 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                    <Sparkles className="w-64 h-64 text-rosewood" />
                  </div>

                  <div className="prose prose-invert max-w-none relative z-10">
                    <div className="space-y-10">
                      {content.split('\n\n').map((paragraph, idx) => (
                        paragraph.trim() && (
                          <p key={idx} className="text-slate-200 text-xl leading-[1.8] font-medium font-inter first-letter:text-5xl first-letter:font-serif first-letter:text-rosewood first-letter:mr-3 first-letter:float-left">
                            {paragraph.trim()}
                          </p>
                        )
                      ))}
                    </div>
                    
                    {!loading && content.trim().split(/\s+/).filter(Boolean).length < 90 && (
                      <div className="mt-12 text-center">
                        <button
                          className="px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold tracking-widest uppercase text-[10px] transition-all border border-white/5"
                          onClick={() => {
                            if (loading) return;
                            setError(null);
                            setContent('');
                            setForceStream(true);
                            setLoading(true);
                          }}
                        >
                          Expand Full Coverage
                        </button>
                      </div>
                    )}

                    {loading && (
                      <div className="mt-16 flex items-center justify-center gap-4">
                        <div className="flex gap-1.5">
                          <div className="w-1.5 h-1.5 bg-rosewood rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-1.5 h-1.5 bg-rosewood rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-1.5 h-1.5 bg-rosewood rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
                          Transcribing live feed...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>

              <footer className="pt-8">
                <button
                  onClick={onBack}
                  className="group flex items-center gap-4 px-10 py-5 bg-gradient-to-br from-rosewood to-rosewood/80 hover:scale-[1.02] active:scale-95 text-white font-black uppercase tracking-[0.2em] text-xs rounded-2xl transition-all shadow-[0_20px_40px_-15px_rgba(168,81,110,0.5)]"
                >
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  Back to Feed
                </button>
              </footer>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
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

export default NewsDetail;
