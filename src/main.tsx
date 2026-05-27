import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './lib/queryClient';
import App from './App';
import './index.css';

const STALE_CHUNK_RELOAD_KEY = 'argus-stale-chunk-reload-at';

function reloadOnceForStaleChunk() {
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
  if (now - lastReload < 30000) return;
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnceForStaleChunk();
});

window.addEventListener('unhandledrejection', (event) => {
  const message = String(event.reason?.message || event.reason || '');
  if (message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed')) {
    event.preventDefault();
    reloadOnceForStaleChunk();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#44403C',
              border: '1px solid #E7E5E4',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#059669', secondary: '#FFFFFF' } },
            error: { iconTheme: { primary: '#DC2626', secondary: '#FFFFFF' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
