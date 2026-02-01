import { Download } from 'lucide-react';
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
  const tv = tvNews.slice(0, 2);
  const hollywood = hollywoodNews.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="fixed top-0 left-0 right-0 z-10 bg-slate-950/30 backdrop-blur-2xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 bg-clip-text text-transparent">
              Paparazzi
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

      <div id="newsletter-content" className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow-2xl overflow-hidden" style={{ width: '850px', margin: '0 auto' }}>
            <div className="border-8 border-black p-8">
              <div className="border-b-4 border-black pb-4 mb-6">
                <div className="text-center mb-2">
                  <div className="text-xs font-bold tracking-widest text-black mb-2">ENTERTAINMENT NEWS DAILY</div>
                  <h1 className="text-7xl font-black text-black" style={{ letterSpacing: '-2px', lineHeight: '1' }}>
                    PAPARAZZI
                  </h1>
                  <div className="text-xs font-bold tracking-wider text-black mt-2">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="border-t-2 border-black mt-3 pt-3 text-center">
                  <p className="text-sm font-bold italic text-black">Where Entertainment Never Sleeps</p>
                </div>
              </div>

              <div className="space-y-8">
                <NewspaperSection title="BOLLYWOOD BUZZ" news={bollywood} />
                <div className="border-y-2 border-black py-2"></div>
                <NewspaperSection title="HOLLYWOOD HOTLINE" news={hollywood} />
                <div className="border-y-2 border-black py-2"></div>
                <NewspaperSection title="TV UPDATES" news={tv} />
              </div>

              <div className="border-t-4 border-black mt-8 pt-6 text-center">
                <p className="text-xs font-bold text-black">© 2025 PAPARAZZI ENTERTAINMENT NEWS</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-slate-950/30 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-lg hover:shadow-lg hover:shadow-rose-500/50 transition-all duration-300 font-semibold"
            >
              <Download className="w-5 h-5" />
              Download Newsletter
            </button>
            <p className="text-slate-500 text-sm mt-6">
              © 2025 Paparazzi. Entertainment News.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NewspaperSection({ title, news }: { title: string; news: NewsItem[] }) {
  return (
    <div>
      <h2 className="text-3xl font-black text-black mb-6 tracking-tight border-b-2 border-black pb-3">
        {title}
      </h2>
      <div className="space-y-6">
        {news.map((item) => (
          <div key={item.id} className="border-b border-gray-300 pb-6 relative">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <img
                  src={item.image_url}
                  alt={item.person_name}
                  className="w-full h-32 object-cover border-2 border-black"
                />
              </div>
              <div className="col-span-3">
                <p className="text-sm font-black text-black uppercase tracking-wider mb-2">
                  {item.person_name}
                </p>
                <p className="text-sm leading-relaxed text-black font-serif">
                  {item.news_text}
                </p>
              </div>
            </div>
            <div className="absolute bottom-2 right-0 text-xs font-bold italic text-gray-600">
              ...and more....
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
