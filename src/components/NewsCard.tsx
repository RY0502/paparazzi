import { ExternalLink, User } from 'lucide-react';
import { useState } from 'react';
import type { NewsItem } from '../types';

interface NewsCardProps {
  item: NewsItem;
  onClick: (personName: string, newsTitle: string) => void;
}

function NewsCard({ item, onClick }: NewsCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  return (
    <article
      onClick={() => onClick(item.person_name, item.news_text)}
      className="group relative bg-white/5 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 hover:border-rose-500/30 hover:bg-white/10 transition-all duration-300 cursor-pointer hover:shadow-2xl hover:shadow-rose-500/20 hover:-translate-y-1"
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-64 h-64 sm:h-48 overflow-hidden bg-slate-900/50">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin"></div>
            </div>
          )}

          {imageError || !item.image_url ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <User className="w-20 h-20 text-slate-600" />
            </div>
          ) : (
            <img
              src={item.image_url}
              alt={item.person_name}
              onError={handleImageError}
              onLoad={handleImageLoad}
              className="absolute inset-0 h-full w-full object-cover [object-position:50%_15%] bg-neutral-100 aspect-[4/3]"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60"></div>

          <div className="absolute bottom-3 left-3 right-3">
            <div className="inline-block px-3 py-1 bg-rose-500/80 backdrop-blur-md rounded-full border border-white/20">
              <p className="text-white text-sm font-semibold">{item.person_name}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <p className="text-slate-200 text-lg leading-relaxed mb-4">
              {item.news_text}
            </p>
          </div>

          <div className="flex items-center justify-between mt-4">
            <time className="text-slate-500 text-sm">
              {new Date(item.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </time>

            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 group-hover:bg-rose-500/90 group-hover:border-white/30 group-hover:backdrop-blur-xl transition-all duration-300">
              <span className="text-white text-sm font-semibold">Read Full Story</span>
              <ExternalLink className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
    </article>
  );
}

export default NewsCard;