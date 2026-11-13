import { state, saveSettings, exportData, replaceAll, clearAll, getCategory } from '../store.js';
import { newId } from '../categories.js';
import { esc, toast, confirmDialog, shareOrDownload } from '../ui.js';
import { todayIso } from '../dates.js';
import { INTENSITY_LABELS } from '../categories.js';

export const APP_VERSION = '1.0.0';

export function renderSettings(el, arg, rerender) {
  const S = state.settings;
  const cats = S.categories;

  el.innerHTML = `
    <header class="page-head"><h1>Einstellungen</h1></header>

    <section class="card" id="kategorien">
      <h2>Tracking-Kategorien</h2>
      <p class="muted small">Reihenfolge mit ↑ ↓ ändern, mit 👁 ein- oder ausblenden. Über ✎ kannst du einzelne Optionen ausblenden oder eigene hinzufügen.</p>
      <ul class="cat-list">
        ${cats.map((c, i) => `
          <li class="${c.hidden && !c.fixed ? 'is-hidden' : ''}">
            <span class="cat-name">${c.icon} ${esc(c.name)}${c.builtin ? '' : ' <span class="tag">eigene</span>'}</span>
            <span class="cat-actions">
              <button class="icon-btn sm" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">↑</button>
              <button class="icon-btn sm" data-move="${i}" data-dir="1" ${i === cats.length - 1 ? 'disabled' : ''} aria-label="nach unten">↓</button>
              ${c.fixed ? '<span class="icon-btn sm disabled" title="Blutung kann nicht ausgeblendet werden">🔒</span>'
                : `<button class="icon-btn sm" data-toggle="${c.id}" aria-label="${c.hidden ? 'einblenden' : 'ausblenden'}">${c.hidden ? '🙈' : '👁'}</button>`}
              <a class="icon-btn sm" href="#/kategorie/${c.id}" aria-label="bearbeiten">✎</a>
            </span>
          </li>`).join('')}
      </ul>
      <a class="btn block" href="#/kategorie/neu">＋ Eigene Kategorie anlegen</a>
    </section>

    <section class="card">
      <h2>Zyklus-Grundwerte</h2>
      <p class="muted small">Werden genutzt, solange noch nicht genug eigene Daten vorhanden sind.</p>
      <label class="field">Übliche Zykluslänge (Tage)
        <input type="number" inputmode="numeric" min="18" max="50" data-cycle="defaultCycle" value="${S.cycle.defaultCycle}"></label>
      <label class="field">Übliche Periodenlänge (Tage)
        <input type="number" inputmode="numeric" min="1" max="12" data-cycle="defaultPeriod" value="${S.cycle.defaultPeriod}"></label>
      <label class="field">Lutealphase (Tage)
        <input type="number" inputmode="numeric" min="9" max="18" data-cycle="luteal" value="${S.cycle.luteal}">
        <span class="small muted">Tage zwischen Eisprung und nächster Periode. Meist 12–16, Standard 14. Wird für die Schätzung von Eisprung und fruchtbaren Tagen verwendet.</span></label>
    </section>

    <section class="card">
      <h2>Darstellung</h2>
      <div class="seg wide">
        ${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button data-theme="${k}" class="${S.theme === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2>💾 Daten &amp; Backup</h2>
      <p class="small">Deine Daten (${state.entries.size} Tage) liegen <strong>nur auf diesem Gerät</strong>. Wenn du Browserdaten löschst oder das Handy wechselst, sind sie ohne Backup weg.</p>
      <p class="small muted">Letztes Backup: ${S.lastBackup ? new Date(S.lastBackup).toLocaleString('de-DE') : 'noch keins'}</p>
      <button class="btn primary block" data-act="export">Backup exportieren (.json)</button>
      <button class="btn block" data-act="import">Backup importieren</button>
      <input type="file" accept="application/json,.json" data-file hidden>
      <button class="btn ghost block" data-act="csv">Als Tabelle exportieren (.csv)</button>
      <button class="btn danger-ghost block" data-act="wipe">Alle Daten löschen</button>
      ${state.storage !== 'indexeddb' ? '<p class="hint warn-hint">Hinweis: Dein Browser erlaubt keine Datenbank (privater Modus?). Daten werden nur eingeschränkt gespeichert.</p>' : ''}
    </section>

    <section class="card">
      <h2>Über diese App</h2>
      <p class="small">Zyklus · Version ${APP_VERSION}</p>
      <p class="small">🔒 Keine Konten, kein Tracking, keine Werbung. Alle Daten werden ausschließlich lokal in deinem Browser gespeichert und nirgendwohin übertragen.</p>
      <p class="small">📱 Installieren: Öffne die Seite im Browser und wähle <strong>„Zum Home-Bildschirm“</strong> (iPhone: Teilen-Symbol in Safari; Android: Menü ⋮ in Chrome). Auf dem iPhone ist das wichtig, damit Safari die Daten nicht nach längerer Nichtnutzung löscht.</p>
      <p class="small">⚠️ Prognosen und fruchtbare Tage sind Schätzungen auf Basis deiner bisherigen Daten. Die App ist kein Medizinprodukt und nicht zur Verhütung geeignet.</p>
    </section>`;

  if (arg === 'kategorien') requestAnimationFrame(() => el.querySelector('#kategorien')?.scrollIntoView());

  const save = async () => { await saveSettings(); };

  el.addEventListener('click', async (e) => {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const i = Number(mv.dataset.move), j = i + Number(mv.dataset.dir);
      [cats[i], cats[j]] = [cats[j], cats[i]];
      await save(); rerender(); return;
    }
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const c = getCategory(tg.dataset.toggle);
      c.hidden = !c.hidden;
      await save(); rerender(); return;
    }
    const th = e.target.closest('[data-theme]');
    if (th) {
      S.theme = th.dataset.theme;
      applyTheme();
      await save(); rerender(); return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'export') {
      const ok = await shareOrDownload(`zyklus-backup-${todayIso()}.json`, JSON.stringify(exportData(), null, 1), 'application/json');
      if (ok) {
        S.lastBackup = new Date().toISOString();
        await save(); toast('Backup erstellt'); rerender();
      }
    }
    if (act === 'csv') {
      await shareOrDownload(`zyklus-${todayIso()}.csv`, toCsv(), 'text/csv');
    }
    if (act === 'import') el.querySelector('[data-file]').click();
    if (act === 'wipe') {
      const ok = await confirmDialog({
        title: 'Wirklich alles löschen?',
        text: `Alle ${state.entries.size} Einträge und deine Einstellungen werden unwiderruflich gelöscht. Erstelle vorher am besten ein Backup.`,
        ok: 'Endgültig löschen', danger: true,
      });
      if (ok) { await clearAll(); applyTheme(); toast('Alle Daten gelöscht'); location.hash = '#/heute'; }
    }
  });

  el.addEventListener('change', async (e) => {
    if (e.target.matches('[data-cycle]')) {
      const k = e.target.dataset.cycle;
      const v = Math.round(Number(e.target.value));
      const lim = { defaultCycle: [18, 50], defaultPeriod: [1, 12], luteal: [9, 18] }[k];
      if (!v || v < lim[0] || v > lim[1]) { toast(`Bitte einen Wert zwischen ${lim[0]} und ${lim[1]} eingeben`); e.target.value = S.cycle[k]; return; }
      S.cycle[k] = v;
      await save(); toast('Gespeichert');
    }
    if (e.target.matches('[data-file]')) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'zyklus-app' || !Array.isArray(data.entries)) throw new Error('format');
        const ok = await confirmDialog({
          title: 'Backup importieren?',
          text: `Das Backup enthält ${data.entries.length} Tage (exportiert am ${new Date(data.exported).toLocaleDateString('de-DE')}). Deine aktuellen Daten (${state.entries.size} Tage) werden dabei <strong>ersetzt</strong>.`,
          ok: 'Importieren',
        });
        if (ok) { await replaceAll(data); applyTheme(); toast('Backup importiert'); rerender(); }
      } catch (err) {
        console.error(err);
        toast('Die Datei ist kein gültiges Backup dieser App.');
      }
      e.target.value = '';
    }
  });
}

export function applyTheme() {
  const t = state.settings?.theme || 'auto';
  document.documentElement.dataset.theme = t;
}

function toCsv() {
  const cats = state.settings.categories;
  const head = ['Datum', ...cats.flatMap((c) => (c.intensity ? [c.name, c.name + ' Intensität'] : [c.name])), 'Notiz'];
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [...state.entries.values()].sort((a, b) => a.date.localeCompare(b.date)).map((e) => {
    const cols = [e.date];
    for (const c of cats) {
      const v = e.v[c.id];
      if (c.type === 'number') cols.push(v?.n !== undefined ? String(v.n).replace('.', ',') : '');
      else cols.push((v?.o || []).map((id) => c.options.find((o) => o.id === id)?.label || id).join(', '));
      if (c.intensity) cols.push(v?.i ? `${v.i} (${INTENSITY_LABELS[v.i]})` : '');
    }
    cols.push(e.note || '');
    return cols.map(q).join(';');
  });
  return '﻿' + [head.map(q).join(';'), ...rows].join('\r\n');
}

/* ---------------- Kategorie bearbeiten / anlegen ---------------- */

export function renderCategoryEditor(el, id) {
  const isNew = id === 'neu';
  const orig = isNew ? null : getCategory(id);
  if (!isNew && !orig) { location.hash = '#/einstellungen/kategorien'; return; }
  const draft = isNew
    ? { id: newId('c_'), name: '', icon: '⭐', type: 'multi', intensity: false, options: [], builtin: false }
    : structuredClone(orig);

  const draw = () => {
    el.innerHTML = `
      <header class="entry-head">
        <a class="icon-btn" href="#/einstellungen/kategorien" aria-label="Zurück">‹</a>
        <div class="center"><div class="entry-date">${isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}</div></div>
        <span class="icon-btn disabled"></span>
      </header>
      <section class="card">
        <div class="row gap">
          <label class="field emoji-field">Symbol<input data-f="icon" value="${esc(draft.icon)}" maxlength="4"></label>
          <label class="field grow">Name<input data-f="name" value="${esc(draft.name)}" placeholder="z. B. Sport" maxlength="30"></label>
        </div>
        ${draft.desc ? `<p class="small muted">${esc(draft.desc)}</p>` : ''}
        ${isNew ? `
        <label class="field">Art
          <select data-f="type">
            <option value="multi" ${draft.type === 'multi' ? 'selected' : ''}>Mehrfachauswahl (mehrere Optionen pro Tag)</option>
            <option value="single" ${draft.type === 'single' ? 'selected' : ''}>Einfachauswahl (eine Option pro Tag)</option>
            <option value="number" ${draft.type === 'number' ? 'selected' : ''}>Zahl (z. B. Gewicht, Stunden)</option>
          </select>
        </label>` : ''}
        ${draft.type !== 'number' && !draft.fixed && !draft.ordinal ? `
        <label class="check"><input type="checkbox" data-f="intensity" ${draft.intensity ? 'checked' : ''}> Intensität (1–5) zusätzlich erfassen</label>` : ''}
        ${draft.type === 'number' ? `
        <div class="row gap">
          <label class="field grow">Einheit<input data-f="unit" value="${esc(draft.unit || '')}" placeholder="z. B. kg" maxlength="8"></label>
          <label class="field grow">Schrittweite<input type="number" data-f="step" value="${draft.step ?? 1}" step="any" min="0"></label>
        </div>` : ''}
      </section>
      ${draft.type !== 'number' ? `
      <section class="card">
        <h3>Optionen</h3>
        <p class="small muted">Ausgeblendete Optionen erscheinen nicht mehr beim Eintragen, bisherige Daten bleiben erhalten.</p>
        <ul class="cat-list">
          ${draft.options.map((o, i) => `
            <li class="${o.hidden ? 'is-hidden' : ''}">
              <input class="opt-input" data-opt-label="${i}" value="${esc(o.label)}" maxlength="40">
              <span class="cat-actions">
                <button class="icon-btn sm" data-omove="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
                <button class="icon-btn sm" data-omove="${i}" data-dir="1" ${i === draft.options.length - 1 ? 'disabled' : ''}>↓</button>
                ${draft.fixed ? '' : `<button class="icon-btn sm" data-ohide="${i}">${o.hidden ? '🙈' : '👁'}</button>`}
                ${o.custom || !draft.builtin ? `<button class="icon-btn sm" data-odel="${i}" aria-label="löschen">🗑</button>` : ''}
              </span>
            </li>`).join('')}
        </ul>
        ${draft.fixed ? '' : `
        <div class="row gap">
          <input class="grow" data-newopt placeholder="Neue Option …" maxlength="40">
          <button class="btn" data-addopt>Hinzufügen</button>
        </div>`}
      </section>` : ''}
      <p class="error" hidden></p>
      <div class="row gap">
        ${!isNew && !draft.builtin ? '<button class="btn danger-ghost" data-delcat>Kategorie löschen</button>' : ''}
        <button class="btn primary grow" data-savecat>Speichern</button>
      </div>`;
  };
  draw();

  const err = (m) => { const p = el.querySelector('.error'); p.textContent = m; p.hidden = false; };

  el.addEventListener('input', (e) => {
    const f = e.target.dataset.f;
    if (f && f !== 'type' && f !== 'intensity') draft[f] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    if (e.target.dataset.optLabel !== undefined) draft.options[Number(e.target.dataset.optLabel)].label = e.target.value;
  });
  el.addEventListener('change', (e) => {
    const f = e.target.dataset.f;
    if (f === 'type') { draft.type = e.target.value; draw(); }
    if (f === 'intensity') draft.intensity = e.target.checked;
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.matches('[data-newopt]') && e.key === 'Enter') { e.preventDefault(); el.querySelector('[data-addopt]').click(); }
  });
  el.addEventListener('click', async (e) => {
    const t = e.target;
    if (t.closest('[data-addopt]')) {
      const inp = el.querySelector('[data-newopt]');
      const label = inp.value.trim();
      if (!label) return;
      draft.options.push({ id: newId('o_'), label, custom: true });
      draw();
      el.querySelector('[data-newopt]').focus();
      return;
    }
    const om = t.closest('[data-omove]');
    if (om) {
      const i = Number(om.dataset.omove), j = i + Number(om.dataset.dir);
      [draft.options[i], draft.options[j]] = [draft.options[j], draft.options[i]];
      draw(); return;
    }
    const oh = t.closest('[data-ohide]');
    if (oh) { const o = draft.options[Number(oh.dataset.ohide)]; o.hidden = !o.hidden; draw(); return; }
    const od = t.closest('[data-odel]');
    if (od) { draft.options.splice(Number(od.dataset.odel), 1); draw(); return; }
    if (t.closest('[data-delcat]')) {
      const ok = await confirmDialog({
        title: 'Kategorie löschen?',
        text: `„${esc(draft.name)}“ wird entfernt. Bereits eingetragene Werte bleiben im Backup erhalten, werden aber nicht mehr angezeigt.`,
        ok: 'Löschen', danger: true,
      });
      if (!ok) return;
      state.settings.categories = state.settings.categories.filter((c) => c.id !== draft.id);
      await saveSettings();
      toast('Kategorie gelöscht');
      location.hash = '#/einstellungen/kategorien';
      return;
    }
    if (t.closest('[data-savecat]')) {
      draft.name = (draft.name || '').trim();
      draft.icon = (draft.icon || '').trim() || '⭐';
      if (!draft.name) return err('Bitte einen Namen eingeben.');
      draft.options = draft.options.filter((o) => o.label.trim());
      draft.options.forEach((o) => { o.label = o.label.trim(); });
      if (draft.type !== 'number' && !draft.options.length) return err('Bitte mindestens eine Option hinzufügen.');
      if (draft.type === 'number') { draft.options = []; draft.intensity = false; }
      if (isNew) state.settings.categories.push(draft);
      else {
        const i = state.settings.categories.findIndex((c) => c.id === draft.id);
        state.settings.categories[i] = draft;
      }
      await saveSettings();
      toast('Gespeichert');
      location.hash = '#/einstellungen/kategorien';
    }
  });
}
