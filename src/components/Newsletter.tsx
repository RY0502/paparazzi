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
      await generateNewsletterPDF(bollywoodNews, tvNews, hollywoodNews);
    } catch (error) {
      console.error('Failed to generate newsletter:', error);
    }
  };

  const bollywood = bollywoodNews.slice(0, 4);
  const tv = tvNews.slice(0, 3);
  const hollywood = hollywoodNews.slice(0, 4);

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden p-8 sm:p-12 md:p-16">
            <div className="text-center mb-12 md:mb-16">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-rose-600 bg-clip-text text-transparent mb-2">
                Paparazzi
              </h1>
              <p className="text-slate-500 text-lg sm:text-xl font-light italic">
                Where entertainment never sleeps...
              </p>
            </div>

            <div className="border-t-2 border-slate-200 pt-12 md:pt-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-12 md:mb-16">
                <NewsCategory title="Bollywood" news={bollywood} />
                <NewsCategory title="Hollywood" news={hollywood} />
              </div>

              <NewsCategory title="TV Updates" news={tv} />
            </div>

            <div className="mt-12 md:mt-16 pt-8 border-t border-slate-300 text-center">
              <p className="text-slate-600 text-sm">
                © 2025 Paparazzi Newsletter. All entertainment rights reserved.
              </p>
              <p className="text-slate-500 text-xs mt-2">
                {new Date().toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
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

function NewsCategory({ title, news }: { title: string; news: NewsItem[] }) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 relative inline-block">
        {title}
        <div className="absolute -bottom-2 left-0 w-12 h-1 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full"></div>
      </h2>
      <div className="mt-8 space-y-6">
        {news.map((item, index) => (
          <div key={item.id} className="flex gap-4 sm:gap-6">
            <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32">
              <img
                src={item.image_url}
                alt={item.person_name}
                className="w-full h-full object-cover rounded-lg shadow-md"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-start gap-2">
                <div className="bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-xs sm:text-sm rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm sm:text-base">
                    {item.person_name}
                  </p>
                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed mt-1">
                    {item.news_text}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
