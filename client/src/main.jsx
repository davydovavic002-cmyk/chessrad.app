import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

/** Old PWA cached /api/* in puzzle-api → ERR_CACHE_READ_FAILURE. One-time cleanup. */
const SW_API_CACHE_FIX = 'chessrad_sw_api_cache_fix_v1';
async function migrateBrokenPwaApiCache() {
  if (typeof window === 'undefined' || localStorage.getItem(SW_API_CACHE_FIX)) return;
  localStorage.setItem(SW_API_CACHE_FIX, '1');

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k === 'puzzle-api').map((k) => caches.delete(k)));
  }

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    if (navigator.serviceWorker.controller) {
      window.location.reload();
    }
  }
}
void migrateBrokenPwaApiCache();

import './styles/theme.css';
import './styles/ui-polish.css';
import './styles/components.css';
import './styles/features-game.css';
import './styles/mobile.css';
import './styles/desktop.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
