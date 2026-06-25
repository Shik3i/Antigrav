import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/black-ops-one'
import '@fontsource/inter/400.css'
import '@fontsource/inter/700.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/700.css'
import './index.css'

import App from './App.jsx'
import { setStoredValue, getStoredValue } from './utils/clientStorage';

// Global listener for CSS/JS preload failures (common after new deployments)
window.addEventListener('error', (e) => {
  // 1. Catch script/link resource errors (they don't have a message, but have a target)
  const isResourceError = e.target && (e.target.tagName === 'LINK' || e.target.tagName === 'SCRIPT');
  
  // 2. Catch explicit Vite preload errors
  const isPreloadError = e.message?.includes('Unable to preload CSS') || 
                         e.message?.includes('Failed to fetch dynamically imported module');
  
  if (isResourceError || isPreloadError) {
    const lastReload = parseInt(getStoredValue('last_preload_retry', '0'), 10);
    const now = Date.now();
    
    // Throttle reloads to avoid infinite loops if the server is actually down
    if (now - lastReload > 10000) {
      setStoredValue('last_preload_retry', now.toString());
      console.warn('[Auto-Recovery] Resource load failed. Refreshing to sync version...');
      window.location.reload(true);
    }
  }
}, true); // Capture phase is REQUIRED to catch resource loading errors

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
