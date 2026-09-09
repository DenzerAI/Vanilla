import { installIconMotion } from './icon-motion';
import './icon-motion.css';
import './tailwind.css';
import './app.jsx';

// Installable shell; the service worker never caches private data.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const disposeIconMotion = installIconMotion();
if (import.meta.hot) import.meta.hot.dispose(disposeIconMotion);
