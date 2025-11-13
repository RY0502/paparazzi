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
        relative px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 overflow-hidden
        ${
          active
            ? 'text-white bg-white/10 backdrop-blur-lg border border-white/20'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 backdrop-blur-sm border border-transparent'
        }
      `}
    >
      {active && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500/80 to-pink-500/80 rounded-xl -inset-1"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl blur-lg opacity-50 -inset-2"></div>
        </>
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

export default TabButton;