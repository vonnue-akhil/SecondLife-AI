import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

createApp(App).mount('#app');

// Dev-only: `?fixtures` (or `?fixtures=battery|tablet`) renders canned turns so the UI can be
// reviewed without the API. `import.meta.env.DEV` is statically false in production builds,
// so this branch and the fixtures chunk are dropped from the bundle.
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  if (params.has('fixtures')) {
    void import('./dev/fixtures').then((m) => m.loadFixtures(params.get('fixtures') || 'cracked'));
  }
}
