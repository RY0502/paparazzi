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
        relative px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300
        ${
          active
            ? 'text-white'
            : 'text-slate-400 hover:text-slate-200'
        }
      `}
    >
      {active && (
        <>
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-pink-500 rounded-xl blur-lg opacity-50"></div>
        </>
      )}
      <span className="relative z-10">{label}</span>
    </button>
  );
}

export default TabButton;