export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.info('[SW] Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.warn('[SW] Registration failed:', error);
        });
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch(console.error);
  }
}
