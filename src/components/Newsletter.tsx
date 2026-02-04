import { Download, Sparkles } from 'lucide-react';
import { generateNewsletterPDF } from '../utils/newsletterGenerator';
import type { NewsItem } from '../types';

interface NewsletterProps {
  bollywoodNews: NewsItem[];
  tvNews: NewsItem[];
  hollywoodNews: NewsItem[];
}

export default function Newsletter({
  bollywoodNews,
  tvNews,
  hollywoodNews,
}: NewsletterProps) {
  const handleDownload = async () => {
    try {
      await generateNewsletterPDF();
    } catch (error) {
      console.error('Failed to generate newsletter:', error);
    }
  };

  const bollywood = bollywoodNews.slice(0, 3);
  const tv = tvNews.slice(0, 3);
  const hollywood = hollywoodNews.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-950/30 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-rose-500 to-pink-500 p-2 rounded-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
                Paparazzi
              </div>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:shadow-lg hover:shadow-rose-500/50 transition-all duration-300 font-semibold text-sm sm:text-base"
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Download Newsletter</span>
              <span className="sm:hidden">Download</span>
            </button>
          </div>
        </div>
      </div>

      <div id="newsletter-content" className="hidden">
        <NewsletterContent bollywood={bollywood} tv={tv} hollywood={hollywood} />
      </div>

      <main className="pt-40 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-5xl sm:text-6xl font-black bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-clip-text text-transparent mb-4">
              Paparazzi Newsletter
            </h1>
            <p className="text-xl text-slate-400">
              Your daily dose of entertainment gossip
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <PreviewSection title="BOLLYWOOD BUZZ" news={bollywood} icon="🎬" color="from-rose-500 to-pink-500" />
            <PreviewSection title="HOLLYWOOD HOTLINE" news={hollywood} icon="🌟" color="from-amber-500 to-orange-500" />
            <PreviewSection title="TV UPDATES" news={tv} icon="📺" color="from-blue-500 to-cyan-500" />
          </div>

          <div className="text-center mt-16">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl hover:shadow-2xl hover:shadow-rose-500/50 transition-all duration-300 font-bold text-lg"
            >
              <Download className="w-6 h-6" />
              Download Newsletter as Image
            </button>
            <p className="text-slate-500 text-sm mt-6">
              Get your newsletter in high-quality PNG format
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-slate-950/30 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">About</h3>
              <p className="text-slate-400 text-sm">Your premium source for entertainment news and celebrity updates.</p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Categories</h3>
              <ul className="text-slate-400 text-sm space-y-2">
                <li>Bollywood</li>
                <li>Hollywood</li>
                <li>TV Updates</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Newsletter</h3>
              <p className="text-slate-400 text-sm">Download today and stay updated with the latest entertainment buzz.</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-slate-500 text-sm">
              © 2025 Paparazzi. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NewsletterContent({ bollywood, tv, hollywood }: { bollywood: NewsItem[]; tv: NewsItem[]; hollywood: NewsItem[] }) {
  return (
    <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 w-full max-w-6xl mx-auto" style={{ paddingBottom: '100px' }}>
      <div className="pt-12 px-6 md:px-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 break-words">
            Paparazzi Newsletter
          </h1>
          <p className="text-lg md:text-xl text-slate-400">
            Your daily dose of entertainment gossip
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-12">
          <div className="col-span-1 md:col-span-2 lg:col-span-1 mx-auto w-full md:w-auto">
            <PrintPreviewSection title="BOLLYWOOD BUZZ" news={bollywood} icon="🎬" color="from-rose-500 to-pink-500" />
          </div>
           <PrintPreviewSection title="HOLLYWOOD HOTLINE" news={hollywood} icon="🌟" color="from-amber-500 to-orange-500"/>
           <PrintPreviewSection title="TV UPDATES" news={tv} icon="📺" color="from-blue-500 to-cyan-500" />
        </div>

        <div className="text-center mt-12 pt-12 pb-12 border-t border-white/10">
          <p className="text-slate-400 text-base break-words">
            © 2025 Paparazzi. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

function PrintPreviewSection({ title, news, icon, color }: { title: string; news: NewsItem[]; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-8 shadow-xl`}>
      <div className="mb-6">
        <div className="text-4xl mb-3">{icon}</div>
        <h2 className="text-2xl font-black text-white mb-2">{title}</h2>
        <div className="h-1 w-12 bg-white/40 rounded-full"></div>
      </div>
      <div className="space-y-4">
        {news.map((item) => (
          <div key={item.id} className="bg-white/10 backdrop-blur rounded-lg overflow-hidden border border-white/20">
            <div className="flex gap-3 h-32">
              <div className="w-32 h-32 flex-shrink-0 overflow-hidden rounded">
                <img
                  src={item.image_url}
                  alt={item.person_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col justify-start py-2 pr-2 flex-1 min-w-0">
                <p className="text-sm font-bold text-white/90 mb-1">{item.person_name}</p>
                <p className="text-sm text-white/80 leading-relaxed">{item.news_text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-sm font-bold text-white/70 italic">and more....</p>
      </div>
    </div>
  );
}

function PreviewSection({ title, news, icon, color }: { title: string; news: NewsItem[]; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-shadow`}>
      <div className="mb-6">
        <div className="text-4xl mb-3">{icon}</div>
        <h2 className="text-2xl font-black text-white mb-2">{title}</h2>
        <div className="h-1 w-12 bg-white/40 rounded-full"></div>
      </div>
      <div className="space-y-4">
        {news.map((item) => (
          <div key={item.id} className="bg-white/10 backdrop-blur rounded-lg overflow-hidden border border-white/20">
            <div className="flex gap-3 h-24">
              <img
                src={item.image_url}
                alt={item.person_name}
                className="w-24 h-24 object-cover flex-shrink-0"
              />
              <div className="flex flex-col justify-between py-2 pr-2 flex-1 min-w-0">
                <div>
                  <p className="text-xs font-bold text-white/90 mb-1">{item.person_name}</p>
                  <p className="text-xs text-white/80 line-clamp-2">{item.news_text}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-white/20">
        <p className="text-sm font-bold text-white/70 italic">and more....</p>
      </div>
    </div>
  );
}
