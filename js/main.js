import { loadState } from './store.js';
import { renderToday } from './views/today.js';
import { renderCalendar } from './views/calendar.js';
import { renderEntry } from './views/entry.js';
import { renderInsights } from './views/insights.js';
import { renderSettings, renderCategoryEditor, applyTheme } from './views/settings.js';

const ROUTES = {
  heute: { view: renderToday, tab: 'heute' },
  kalender: { view: renderCalendar, tab: 'kalender' },
  tag: { view: renderEntry, tab: null },
  analyse: { view: renderInsights, tab: 'analyse' },
  einstellungen: { view: renderSettings, tab: 'einstellungen' },
  kategorie: { view: renderCategoryEditor, tab: 'einstellungen' },
};

const app = document.getElementById('app');
let currentEl = null;
let lastRoute = '';

function render() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [name, arg] = raw.split('/');
  const route = ROUTES[name] || ROUTES.heute;
  if (currentEl && currentEl._cleanup) currentEl._cleanup();
  if (raw !== lastRoute) document.getElementById('modal-root').replaceChildren();

  const el = document.createElement('div');
  el.className = 'view view-' + (name || 'heute');
  const sameRoute = raw === lastRoute;
  const scrollY = window.scrollY;
  const rerender = () => render();
  route.view(el, arg, rerender);
  app.replaceChildren(el);
  currentEl = el;
  if (sameRoute) window.scrollTo(0, scrollY);
  else window.scrollTo(0, 0);
  lastRoute = raw;

  document.querySelectorAll('#tabbar a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === route.tab);
  });
  document.body.classList.toggle('no-tabbar', name === 'tag' || name === 'kategorie');
}

async function start() {
  await loadState();
  applyTheme();
  window.addEventListener('hashchange', render);
  render();

  // Tageswechsel: beim Zurückkehren in die App neu zeichnen
  let day = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && new Date().toDateString() !== day) {
      day = new Date().toDateString();
      render();
    }
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }
}

start().catch((e) => {
  console.error(e);
  app.innerHTML = `<div class="card"><h2>Fehler beim Starten</h2><p>${String(e)}</p></div>`;
});
