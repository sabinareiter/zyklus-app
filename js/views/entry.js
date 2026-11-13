import { state, saveEntry } from '../store.js';
import { analyze, dayInfo, PHASES } from '../analysis.js';
import { todayIso, isValidIso, addDays, fmt } from '../dates.js';
import { INTENSITY_LABELS } from '../categories.js';
import { esc, toast } from '../ui.js';

export function renderEntry(el, arg) {
  const today = todayIso();
  let iso = isValidIso(arg) ? arg : today;
  if (iso > today) iso = today;

  const entry = structuredClone(state.entries.get(iso) || { date: iso, v: {}, note: '' });
  const A = analyze(state, today);
  const info = dayInfo(A, iso);
  const cats = state.settings.categories.filter((c) => !c.hidden || c.fixed);

  const catHtml = (cat) => {
    const val = entry.v[cat.id] || {};
    let body = '';
    if (cat.type === 'number') {
      body = `<div class="num-row">
        <input type="number" inputmode="decimal" data-num="${cat.id}" min="${cat.min ?? ''}" max="${cat.max ?? ''}" step="${cat.step ?? 'any'}" value="${val.n ?? ''}" placeholder="z. B. ${cat.id === 'temp' ? '36,5' : '0'}">
        <span class="unit">${esc(cat.unit || '')}</span>
      </div>`;
    } else {
      const opts = cat.options.filter((o) => !o.hidden || (val.o || []).includes(o.id));
      body = `<div class="chips">${opts.map((o) => {
        const on = (val.o || []).includes(o.id);
        return `<button class="chip ${on ? 'on' : ''} ${cat.id === 'period' ? 'period' : ''}" data-cat="${cat.id}" data-opt="${o.id}" aria-pressed="${on}">${esc(o.label)}</button>`;
      }).join('')}</div>`;
      if (cat.intensity && (val.o || []).length) {
        const i = val.i || 0;
        body += `<div class="intensity">
          <span class="small muted">Intensität</span>
          <div class="seg">${[1, 2, 3, 4, 5].map((k) => `<button class="${i === k ? 'on' : ''}" data-int="${cat.id}" data-val="${k}" title="${INTENSITY_LABELS[k]}">${k}</button>`).join('')}</div>
          <span class="small">${i ? INTENSITY_LABELS[i] : ''}</span>
        </div>`;
      }
    }
    return `<section class="card cat" data-card="${cat.id}">
      <h3>${cat.icon} ${esc(cat.name)}</h3>
      ${body}
    </section>`;
  };

  const ph = info ? PHASES[info.phase] : null;
  el.innerHTML = `
    <header class="entry-head">
      <a class="icon-btn" href="#/tag/${addDays(iso, -1)}" aria-label="Vorheriger Tag">‹</a>
      <div class="center">
        <div class="entry-date">${iso === today ? 'Heute' : fmt(iso, 'long')}</div>
        <div class="small muted">${iso === today ? fmt(iso, 'long') : fmt(iso, 'med')}${info ? ` · Zyklustag ${info.cycleDay}` : ''}</div>
      </div>
      ${iso < today ? `<a class="icon-btn" href="#/tag/${addDays(iso, 1)}" aria-label="Nächster Tag">›</a>` : '<span class="icon-btn disabled">›</span>'}
    </header>
    ${ph ? `<div class="phase-pill small" style="--pc:${ph.color}">${ph.name}${info.predicted ? ' (Prognose)' : ''}</div>` : ''}
    <div class="cats">${cats.map(catHtml).join('')}</div>
    <section class="card">
      <h3>📝 Notizen</h3>
      <textarea data-note rows="4" placeholder="Wie geht es dir? Besonderheiten, Auslöser, Gedanken …">${esc(entry.note || '')}</textarea>
    </section>
    <div class="row gap">
      <a class="btn ghost" href="#/einstellungen/kategorien">⚙️ Kategorien anpassen</a>
      <button class="btn primary grow" data-done>Fertig</button>
    </div>`;

  const persist = () => saveEntry(entry).catch((e) => { console.error(e); toast('Speichern fehlgeschlagen'); });
  const redrawCard = (catId) => {
    const cat = cats.find((c) => c.id === catId);
    const old = el.querySelector(`[data-card="${catId}"]`);
    const tmp = document.createElement('div');
    tmp.innerHTML = catHtml(cat);
    old.replaceWith(tmp.firstElementChild);
  };

  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-opt]');
    if (chip) {
      const cat = cats.find((c) => c.id === chip.dataset.cat);
      const val = entry.v[cat.id] || (entry.v[cat.id] = { o: [] });
      val.o = val.o || [];
      const id = chip.dataset.opt;
      if (val.o.includes(id)) val.o = val.o.filter((x) => x !== id);
      else if (cat.type === 'single') val.o = [id];
      else val.o.push(id);
      if (!val.o.length) delete val.i;
      persist();
      redrawCard(cat.id);
      return;
    }
    const intB = e.target.closest('[data-int]');
    if (intB) {
      const val = entry.v[intB.dataset.int];
      const k = Number(intB.dataset.val);
      val.i = val.i === k ? undefined : k;
      persist();
      redrawCard(intB.dataset.int);
      return;
    }
    if (e.target.closest('[data-done]')) {
      persist();
      location.hash = iso === today ? '#/heute' : '#/kalender/' + iso.slice(0, 7);
    }
  });

  let noteTimer;
  el.addEventListener('input', (e) => {
    if (e.target.matches('[data-note]')) {
      entry.note = e.target.value;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(persist, 400);
    }
    if (e.target.matches('[data-num]')) {
      const raw = e.target.value.replace(',', '.');
      const id = e.target.dataset.num;
      if (raw === '') delete entry.v[id];
      else if (!Number.isNaN(Number(raw))) entry.v[id] = { n: Number(raw) };
      clearTimeout(noteTimer);
      noteTimer = setTimeout(persist, 400);
    }
  });
  // beim Verlassen sicher speichern
  el._cleanup = () => { clearTimeout(noteTimer); persist(); };
}
