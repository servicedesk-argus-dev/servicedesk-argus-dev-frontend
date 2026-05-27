const key = 'argus-stale-chunk-reload-at';

try {
  const now = Date.now();
  const lastReload = Number(sessionStorage.getItem(key) || 0);
  if (now - lastReload > 30000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
} catch {
  window.location.reload();
}

export {};
