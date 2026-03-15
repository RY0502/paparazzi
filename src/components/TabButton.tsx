import type { ReactNode } from 'react';

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
}

function TabButton({ active, onClick, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-widest transition-all duration-500 active:scale-95
        ${
          active
            ? 'text-white border border-white/10 shadow-[0_0_20px_rgba(168,81,110,0.2)]'
            : 'text-slate-500 hover:text-slate-200 border border-transparent'
        }
      `}
    >
      {active && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-rosewood to-rosewood/60 rounded-full"></div>
          <div className="absolute inset-0 bg-rosewood rounded-full blur-md opacity-40"></div>
        </>
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

export default TabButton;