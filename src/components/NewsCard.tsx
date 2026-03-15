import { ExternalLink, User, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { NewsItem } from '../types';

interface NewsCardProps {
  item: NewsItem;
  onClick: (id: string, personName: string, newsTitle: string, youtubeUrl?: string) => void;
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
      onClick={() => onClick(item.id, item.person_name, item.news_text, item.youtube_url)}
      className="group relative bg-onyx/40 backdrop-blur-2xl rounded-3xl overflow-hidden border border-white/5 hover:border-rosewood/30 hover:bg-onyx/60 transition-all duration-500 cursor-pointer hover:shadow-[0_0_40px_-10px_rgba(168,81,110,0.3)] hover:-translate-y-2"
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative w-full sm:w-72 h-72 sm:h-56 overflow-hidden bg-onyx">
          {imageLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-rosewood/20 border-t-rosewood rounded-full animate-spin"></div>
            </div>
          )}

          {imageError || !item.image_url ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-onyx to-slate-900">
              <User className="w-16 h-16 text-slate-800" />
            </div>
          ) : (
            <img
              src={item.image_url}
              alt={item.person_name}
              onError={handleImageError}
              onLoad={handleImageLoad}
              className="absolute inset-0 h-full w-full object-cover [object-position:50%_15%] transition-transform duration-700 group-hover:scale-110"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-onyx via-transparent to-transparent opacity-80"></div>

          <div className="absolute bottom-4 left-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rosewood/90 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
              <div className="w-1.5 h-1.5 bg-gold rounded-full animate-pulse"></div>
              <p className="text-white text-xs font-bold tracking-wide uppercase">{item.person_name}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Sparkles className="w-24 h-24 text-gold" />
          </div>

          <div className="relative z-10">
            <p className="text-slate-100 text-xl font-medium leading-relaxed mb-6 font-playfair group-hover:text-white transition-colors">
              {item.news_text}
            </p>
          </div>

          <div className="flex items-center justify-between mt-auto relative z-10">
            <time className="text-slate-500 text-xs font-semibold tracking-widest uppercase">
              {new Date(item.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
              })}
            </time>

            <div className="flex items-center gap-3 px-6 py-2.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 group-hover:bg-rosewood group-hover:border-rosewood group-hover:shadow-[0_0_20px_rgba(168,81,110,0.4)] transition-all duration-500">
              <span className="text-white text-sm font-bold tracking-tight">View Story</span>
              <ExternalLink className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rosewood to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
    </article>
  );
}

export default NewsCard;
