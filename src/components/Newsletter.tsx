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

      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
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
    <div className="bg-white" style={{ width: '900px' }}>
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 p-12 text-white">
        <div className="text-center mb-4">
          <div className="text-sm font-bold tracking-widest mb-3">ENTERTAINMENT NEWS DAILY</div>
          <h1 className="text-8xl font-black" style={{ letterSpacing: '-2px', lineHeight: '1' }}>
            PAPARAZZI
          </h1>
          <div className="text-sm font-bold tracking-wider mt-4">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>
        <div className="border-t border-white/30 mt-4 pt-4 text-center">
          <p className="text-base font-semibold italic">Where Entertainment Never Sleeps</p>
        </div>
      </div>

      <div className="p-10">
        <NewsletterSection title="BOLLYWOOD BUZZ" news={bollywood} bgColor="bg-red-50" accentColor="border-red-600" />
        <div className="my-8 border-t-4 border-gray-300"></div>
        <NewsletterSection title="HOLLYWOOD HOTLINE" news={hollywood} bgColor="bg-amber-50" accentColor="border-amber-600" />
        <div className="my-8 border-t-4 border-gray-300"></div>
        <NewsletterSection title="TV UPDATES" news={tv} bgColor="bg-blue-50" accentColor="border-blue-600" />

        <div className="mt-12 pt-8 border-t-4 border-gray-800 text-center">
          <p className="text-xs font-bold text-gray-800">© 2025 PAPARAZZI ENTERTAINMENT NEWS</p>
        </div>
      </div>
    </div>
  );
}

function NewsletterSection({ title, news, accentColor }: { title: string; news: NewsItem[]; bgColor?: string; accentColor: string }) {
  return (
    <div>
      <h2 className={`text-4xl font-black text-gray-900 mb-8 pb-4 border-b-4 ${accentColor}`}>
        {title}
      </h2>
      <div className="space-y-6">
        {news.map((item) => (
          <div key={item.id} className="border-b-2 border-gray-200 pb-6">
            <div className="grid grid-cols-5 gap-4">
              <div className="col-span-1">
                <img
                  src={item.image_url}
                  alt={item.person_name}
                  className="w-full h-40 object-cover border-3 border-gray-800 shadow-lg"
                />
              </div>
              <div className="col-span-4">
                <p className="text-lg font-black text-gray-900 uppercase tracking-wide mb-2">
                  {item.person_name}
                </p>
                <p className="text-base leading-relaxed text-gray-800 font-serif">
                  {item.news_text}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div className="text-right pt-4">
          <p className="text-lg font-black text-gray-600 italic">and more....</p>
        </div>
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
