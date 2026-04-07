import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    reg.update();

    let refreshing = false;
    navigator.serviceWorker.oncontrollerchange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
