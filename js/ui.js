// Gemeinsame UI-Helfer: Escaping, Toasts, Dialoge, Downloads.

import { state, saveEntries } from './store.js';
import { todayIso, toNum, toIso, fmt } from './dates.js';
import { INTENSITY_LABELS } from './categories.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/** Öffnet ein Bottom-Sheet. Gibt { el, close } zurück. */
export function sheet(html, { onClose } = {}) {
  const root = document.getElementById('modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'backdrop';
  wrap.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 200);
    onClose && onClose();
  };
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap || e.target.closest('[data-close]')) close();
  });
  return { el: wrap.querySelector('.sheet'), close };
}

export function confirmDialog({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet(`
      <h2>${esc(title)}</h2>
      <p>${text}</p>
      <div class="row gap end">
        <button class="btn ghost" data-act="no">${esc(cancel)}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${esc(ok)}</button>
      </div>`, { onClose: () => { if (!done) resolve(false); } });
    s.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      done = true;
      resolve(b.dataset.act === 'yes');
      s.close();
    });
  });
}

/** Kurzfassung eines Eintrags als Chips. */
export function entryChips(entry, { limit = 99 } = {}) {
  if (!entry) return '';
  const chips = [];
  for (const cat of state.settings.categories) {
    const val = entry.v[cat.id];
    if (!val) continue;
    if (cat.type === 'number' && val.n !== undefined) {
      chips.push(`<span class="chip sm">${cat.icon} ${String(val.n).replace('.', ',')} ${esc(cat.unit || '')}</span>`);
      continue;
    }
    for (const oid of val.o || []) {
      const o = cat.options.find((x) => x.id === oid);
      if (!o) continue;
      const cls = cat.id === 'period' ? 'chip sm period' : 'chip sm';
      chips.push(`<span class="${cls}">${cat.icon} ${esc(o.label)}</span>`);
    }
    if (val.i) chips.push(`<span class="chip sm">${cat.icon} Intensität: ${INTENSITY_LABELS[val.i]}</span>`);
  }
  let html = chips.slice(0, limit).join('');
  if (chips.length > limit) html += `<span class="chip sm muted">+${chips.length - limit}</span>`;
  if (entry.note) html += `<p class="note-preview">📝 ${esc(entry.note)}</p>`;
  return html;
}

/** Dialog zum Nachtragen einer ganzen Periode. */
export function periodDialog(onDone, preset = {}) {
  const today = todayIso();
  const start = preset.start || today;
  const len = state.settings.cycle.defaultPeriod;
  const endDefault = toIso(Math.min(toNum(start) + len - 1, toNum(today)));
  const s = sheet(`
    <h2>🩸 Periode eintragen</h2>
    <p class="muted">Trage Beginn und Ende einer (auch vergangenen) Periode ein. Bereits erfasste Tage behalten ihre Blutungsstärke.</p>
    <label class="field">Erster Tag<input type="date" name="start" value="${start}" max="${today}"></label>
    <label class="field">Letzter Tag<input type="date" name="end" value="${endDefault}" max="${today}"></label>
    <label class="field">Blutungsstärke
      <select name="flow">
        <option value="light">leicht</option>
        <option value="medium" selected>mittel</option>
        <option value="heavy">stark</option>
      </select>
    </label>
    <p class="error" hidden></p>
    <div class="row gap end">
      <button class="btn ghost" data-close>Abbrechen</button>
      <button class="btn primary" data-save>Speichern</button>
    </div>`);
  const $ = (n) => s.el.querySelector(`[name=${n}]`);
  $('start').addEventListener('change', () => {
    if (!$('start').value) return;
    const e = Math.min(toNum($('start').value) + len - 1, toNum(today));
    $('end').value = toIso(e);
  });
  s.el.querySelector('[data-save]').addEventListener('click', async () => {
    const err = s.el.querySelector('.error');
    const a = $('start').value, b = $('end').value;
    if (!a || !b) { err.textContent = 'Bitte beide Daten angeben.'; err.hidden = false; return; }
    const an = toNum(a), bn = toNum(b);
    if (bn < an) { err.textContent = 'Der letzte Tag liegt vor dem ersten Tag.'; err.hidden = false; return; }
    if (bn > toNum(today)) { err.textContent = 'Zukünftige Tage können nicht eingetragen werden.'; err.hidden = false; return; }
    if (bn - an > 14) { err.textContent = 'Eine Periode kann höchstens 15 Tage lang sein.'; err.hidden = false; return; }
    const list = [];
    for (let n = an; n <= bn; n++) {
      const iso = toIso(n);
      const e = structuredClone(state.entries.get(iso) || { date: iso, v: {}, note: '' });
      if (!e.v.period || !e.v.period.o || !e.v.period.o.length) e.v.period = { o: [$('flow').value] };
      list.push(e);
    }
    await saveEntries(list);
    s.close();
    toast(`Periode eingetragen: ${fmt(a)} – ${fmt(b)}`);
    onDone && onDone();
  });
}

export async function shareOrDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await navigator.share({ files: [file], title: filename });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export function pct(x) {
  return `${Math.round(x * 100)} %`;
}
