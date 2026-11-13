import { state } from '../store.js';
import {
  analyze, phasePatterns, cycleDaySeries, PHASES, PHASE_ORDER, MIN_CYCLE, MAX_CYCLE,
  MAX_CYCLES_USED, round1, tempsIn, detectTempShift,
} from '../analysis.js';
import { todayIso, fmt, plural } from '../dates.js';
import { barChart, lineChart } from '../charts.js';
import { esc, pct } from '../ui.js';

const n1 = (x) => String(round1(x)).replace('.', ',');
const explain = (html) => `<details class="explain"><summary>Wie wird das berechnet?</summary><div>${html}</div></details>`;
const card = (title, body, cls = '') => `<section class="card ${cls}"><h2>${title}</h2>${body}</section>`;

// Auswahl im Symptom-Verlauf merken
let selKey = null;
let selMode = 'start';
let selTempCycle = null;

export function renderInsights(el, _arg, rerender) {
  const today = todayIso();
  const A = analyze(state, today);
  const S = A.stats;
  const cfg = state.settings.cycle;
  const parts = [];

  parts.push(`<header class="page-head"><h1>Analyse</h1><p class="muted">Basierend auf ${plural(state.entries.size, 'erfasstem Tag', 'erfassten Tagen')} und ${plural(A.periods.length, 'Periode', 'Perioden')}.</p></header>`);

  if (!A.periods.length) {
    parts.push(card('Noch keine Daten', `<p>Trag deine erste Periode ein – danach erscheinen hier Prognosen. Ab zwei Perioden berechnet die App deine echte Zykluslänge, ab etwa drei Zyklen werden Muster erkennbar.</p><a class="btn primary" href="#/kalender">Zum Kalender</a>`));
    el.innerHTML = parts.join('');
    return;
  }

  /* ---------- 1. Überblick ---------- */
  {
    const lensList = S.used.map((c) => `${fmt(c.startN, 'shortY')}: <strong>${c.length}</strong>`).join(' · ');
    const excl = S.excluded.length
      ? `<p>Nicht berücksichtigt (unter ${MIN_CYCLE} oder über ${MAX_CYCLE} Tage, meist durch vergessene Einträge): ${S.excluded.map((c) => `${fmt(c.startN, 'shortY')} (${c.length} Tage)`).join(', ')}.</p>`
      : '';
    parts.push(card('🔄 Dein Zyklus im Überblick', `
      <div class="stats">
        <div class="stat"><div class="v">${S.n ? n1(S.avg) : '–'}</div><div class="l">Ø Zykluslänge (Tage)</div></div>
        <div class="stat"><div class="v">${S.pAvg ? n1(S.pAvg) : '–'}</div><div class="l">Ø Periodenlänge (Tage)</div></div>
        <div class="stat"><div class="v">${S.n ? `${S.min}–${S.max}` : '–'}</div><div class="l">kürzester – längster</div></div>
        <div class="stat"><div class="v small-v">${S.regularity.label}</div><div class="l">Regelmäßigkeit</div></div>
      </div>
      ${S.n === 0 ? `<p class="hint">Für eine Zykluslänge braucht es mindestens zwei eingetragene Periodenbeginne.</p>` : ''}
      ${explain(`
        <p><strong>Zykluslänge</strong> = Tage vom ersten Tag einer Periode bis zum Tag vor der nächsten Periode. Ein neuer Periodenbeginn ist ein Tag mit Blutung (leicht/mittel/stark), vor dem mindestens 2 Tage ohne Blutung liegen. Schmierblutungen zählen nicht.</p>
        ${S.n ? `<p>Verwendet: deine letzten ${plural(S.n, 'gültigen Zyklus', 'gültigen Zyklen')} (max. ${MAX_CYCLES_USED}):<br>${lensList}</p>
        <p>Durchschnitt = Summe ÷ Anzahl = ${S.lens.join(' + ')} = ${S.lens.reduce((a, b) => a + b, 0)} ÷ ${S.n} = <strong>${n1(S.avg)} Tage</strong>. Der Median (mittlerer Wert) liegt bei ${n1(S.median)} Tagen.</p>` : ''}
        ${excl}
        ${S.plens.length ? `<p><strong>Periodenlänge</strong> = Anzahl Tage vom ersten bis letzten Blutungstag einer Periode (einzelne fehlende Tage dazwischen werden mitgezählt). Verwendet: ${S.plens.join(', ')} Tage → Ø ${n1(S.pAvg)}. Eine gerade laufende Periode wird nicht mitgezählt.</p>` : ''}
        <p><strong>Regelmäßigkeit</strong> richtet sich nach der Spanne zwischen kürzestem und längstem Zyklus (ab 3 Zyklen): bis 7 Tage = regelmäßig, 8–9 Tage = leicht schwankend, darüber = unregelmäßig. ${S.n >= 3 ? `Bei dir: ${S.max} − ${S.min} = <strong>${S.range} Tage</strong>.` : ''} Das orientiert sich an gynäkologischen Leitlinien (FIGO), nach denen bei Erwachsenen Zyklen von 24–38 Tagen als normal gelten.</p>
      `)}`));
  }

  /* ---------- 2. Nächste Periode ---------- */
  const cur = A.current;
  {
    const status = cur.overdue
      ? `<p class="big">überfällig seit ${plural(-cur.daysUntil, 'Tag', 'Tagen')}</p><p class="muted">Erwartet war ca. der ${fmt(cur.nextStartN, 'med')}. Zyklen schwanken – Stress, Krankheit oder Reisen können die Periode verschieben.</p>`
      : `<p class="big">${fmt(cur.nextStartN, 'long')}</p><p class="muted">wahrscheinlicher Zeitraum: ${fmt(cur.rangeStartN)} – ${fmt(cur.rangeEndN)}</p>`;
    parts.push(card('🩸 Nächste Periode', `${status}
      ${explain(`
        <p>Letzter Periodenbeginn: <strong>${fmt(cur.startN, 'med')}</strong>.</p>
        <p>Dazu wird ${A.basis === 'data'
          ? `deine durchschnittliche Zykluslänge von ${n1(S.avg)} Tagen (gerundet <strong>${A.cycleLen}</strong>) addiert`
          : `die Standard-Zykluslänge von <strong>${A.cycleLen} Tagen</strong> aus den Einstellungen addiert, weil noch kein vollständiger Zyklus erfasst ist`}:
          ${fmt(cur.startN)} + ${A.cycleLen} Tage = <strong>${fmt(cur.nextStartN)}</strong>.</p>
        <p>Der Zeitraum ± ${plural(A.uncertainty, 'Tag', 'Tage')} ${S.n >= 3
          ? `entspricht der Standardabweichung deiner Zykluslängen (${n1(S.sd)} Tage, gerundet). Sie gibt an, wie stark deine Zyklen typischerweise vom Durchschnitt abweichen.`
          : 'ist ein vorläufiger Wert, bis mindestens 3 Zyklen erfasst sind. Danach wird er aus der Schwankung deiner Zyklen berechnet.'}</p>
      `)}`));
  }

  /* ---------- 3. Fruchtbares Fenster ---------- */
  {
    const useCur = cur.fertileEndN >= A.todayN;
    const f = useCur ? cur : A.future[0];
    const src = useCur && cur.ovSource === 'temp';
    parts.push(card('🌼 Fruchtbare Tage &amp; Eisprung', `
      <dl class="facts">
        <dt>Fruchtbares Fenster</dt><dd>${fmt(f.fertileStartN)} – ${fmt(f.fertileEndN)}</dd>
        <dt>Eisprung ${src ? '(laut Temperatur)' : '(geschätzt)'}</dt><dd>${fmt(f.ovN, 'long')}</dd>
      </dl>
      <p class="hint warn-hint">⚠️ Dies ist eine statistische Schätzung und <strong>keine sichere Verhütungsmethode</strong>. Der Eisprung kann von Zyklus zu Zyklus um mehrere Tage schwanken.</p>
      ${explain(`
        ${src ? `<p>In diesem Zyklus wurde ein <strong>Temperaturanstieg</strong> erkannt (siehe Basaltemperatur). Der Eisprung wird auf den Tag vor der ersten erhöhten Messung gelegt: <strong>${fmt(cur.ovN)}</strong>.</p>`
          : `<p>Nach dem Eisprung dauert es relativ konstant etwa <strong>${cfg.luteal} Tage</strong> bis zur nächsten Periode (Lutealphase; einstellbar). Deshalb wird vom erwarteten Periodenbeginn zurückgerechnet:</p>
          <p>${fmt(f.ovN + A.luteal)} − ${A.luteal} Tage = <strong>${fmt(f.ovN)}</strong> (geschätzter Eisprung)</p>`}
        <p>Das fruchtbare Fenster umfasst die <strong>5 Tage vor</strong> dem Eisprung (so lange können Spermien überleben) bis <strong>1 Tag danach</strong> (Lebensdauer der Eizelle): ${fmt(f.fertileStartN)} – ${fmt(f.fertileEndN)}.</p>
        <p>Genauer wird es, wenn du zusätzlich <strong>Basaltemperatur</strong> und <strong>Zervixschleim</strong> erfasst (in den Einstellungen einblendbar). Spinnbarer, klarer Schleim zeigt die fruchtbarste Zeit an.</p>
      `)}`));
  }

  /* ---------- 4. Zykluslängen-Verlauf ---------- */
  if (A.cycles.length) {
    const last = A.cycles.slice(-12);
    const items = last.map((c) => ({
      label: fmt(c.startN, 'dm').slice(0, 5),
      value: c.length,
      color: c.valid ? (c.length < 24 || c.length > 38 ? 'var(--c-pms)' : 'var(--primary)') : 'var(--muted)',
      muted: !c.valid,
      title: `Zyklus ab ${fmt(c.startN, 'med')}: ${c.length} Tage`,
    }));
    parts.push(card('📊 Zykluslängen', `
      ${barChart({ items, avg: S.avg, band: [24, 38], max: Math.max(40, ...items.map((i) => i.value)) + 2, labelEvery: items.length > 8 ? 2 : 1, yTicks: [0, 24, 38] })}
      <p class="small muted">Jede Säule ist ein Zyklus (beschriftet mit Startdatum). Der helle Bereich zeigt 24–38 Tage, die gestrichelte Linie deinen Durchschnitt.</p>
      ${explain(`<p>Gezeigt werden deine letzten bis zu 12 abgeschlossenen Zyklen. Ein Zyklus ist abgeschlossen, sobald die nächste Periode begonnen hat. Säulen außerhalb von 24–38 Tagen sind farblich hervorgehoben; graue Säulen sind Ausreißer (unter ${MIN_CYCLE} oder über ${MAX_CYCLE} Tage), die nicht in den Durchschnitt eingehen.</p>`)}`));
  }

  /* ---------- 5. Periodenlänge ---------- */
  if (S.usedPeriods.length >= 2) {
    const items = S.usedPeriods.map((p) => ({
      label: fmt(p.startN, 'dm').slice(0, 5), value: p.length, color: 'var(--c-menstruation)',
      title: `Periode ab ${fmt(p.startN, 'med')}: ${p.length} Tage`,
    }));
    const flowAvg = periodFlowSummary(A);
    parts.push(card('🩸 Periodenlänge &amp; Stärke', `
      ${barChart({ items, avg: S.pAvg, max: Math.max(8, ...items.map((i) => i.value)) + 1, labelEvery: items.length > 8 ? 2 : 1, yTicks: [0, Math.max(8, ...items.map((i) => i.value)) + 1] })}
      ${flowAvg}
      ${explain(`<p>Gezählt werden die Tage vom ersten bis zum letzten Blutungstag jeder Periode. Liegt dazwischen ein einzelner Tag ohne Eintrag, wird er mitgezählt (vermutlich vergessen). Eine Periode von nur 1 Tag kann bedeuten, dass nur der Beginn eingetragen wurde.</p><p>Die Stärke pro Periodentag ist der Anteil der jeweiligen Angabe an allen Blutungstagen mit dieser Tagesnummer.</p>`)}`));
  }

  /* ---------- 6. Muster nach Phase ---------- */
  const P = phasePatterns(state, A);
  {
    let body;
    if (P.cyclesCount < 1 || P.totalLogged < 10) {
      body = `<p>Hier erscheinen Zusammenhänge zwischen deinem Befinden und den Zyklusphasen, z. B. <em>„Kopfschmerzen treten bei dir vor allem vor der Periode auf“</em>.</p>
        <p class="hint">Dafür braucht es mindestens einen abgeschlossenen Zyklus und etwa 10 Tage mit Einträgen (aktuell: ${plural(P.cyclesCount, 'Zyklus', 'Zyklen')}, ${plural(P.totalLogged, 'Tag', 'Tage')}). Aussagekräftig wird es ab ca. 3 Zyklen.</p>`;
    } else if (!P.insights.length) {
      body = `<p>Bisher gibt es keine deutlichen Häufungen in einzelnen Phasen. Je mehr Tage du einträgst, desto eher werden Muster sichtbar.</p>`;
    } else {
      body = `<ul class="insights">${P.insights.slice(0, 10).map((i) => {
        const ph = PHASES[i.phase];
        return `<li>
          <div class="ins-head">${i.rec.cat.icon} <strong>${esc(i.rec.option.label)}</strong> <span class="muted small">(${esc(i.rec.cat.name)})</span></div>
          <div>vor allem in der <span class="phase-tag" style="--pc:${ph.color}">${ph.dat}</span></div>
          <div class="ratebar"><span style="width:${Math.round(i.rate * 100)}%;background:${ph.color}"></span></div>
          <div class="small muted">${pct(i.rate)} der erfassten Tage dieser Phase (${i.inPhase} von ${i.phaseDays}) · sonst ${pct(i.restRate)} (${i.restCount} von ${i.restDays}) · in ${i.cyclesWith} von ${i.cyclesLogged} Zyklen</div>
        </li>`;
      }).join('')}</ul>`;
    }
    parts.push(card('🔍 Muster in deinen Zyklusphasen', `${body}
      ${phaseLegend()}
      ${explain(`
        <p>Jeder Tag eines <strong>abgeschlossenen</strong> Zyklus wird einer Phase zugeordnet:</p>
        <ul>${PHASE_ORDER.map((p) => `<li><strong>${PHASES[p].name}:</strong> ${PHASES[p].rule}</li>`).join('')}</ul>
        <p>Der Eisprung wird je Zyklus über die Temperatur bestimmt (falls erfasst), sonst als „Periodenbeginn des Folgezyklus minus ${cfg.luteal} Tage“.</p>
        <p>Als <strong>erfasster Tag</strong> zählt jeder Tag, an dem du mindestens eine Angabe außer Blutung eingetragen hast. Tage ohne Eintrag werden ignoriert, damit „nicht eingetragen“ nicht als „nicht vorhanden“ gewertet wird.</p>
        <p>Für jede Angabe wird verglichen: <em>Anteil der erfassten Tage in einer Phase, an denen sie vorkam</em> gegenüber <em>dem Anteil im restlichen Zyklus</em>. Als Muster angezeigt wird es, wenn die Angabe insgesamt mindestens 3-mal vorkam, in der Phase an mindestens 30 % der Tage auftrat und dort mindestens 1,5-mal so häufig war wie sonst.</p>
        <p>Bisher ausgewertet: ${P.cyclesCount} ${P.cyclesCount === 1 ? 'Zyklus' : 'Zyklen'}, ${P.totalLogged} erfasste Tage (${PHASE_ORDER.map((p) => `${PHASES[p].short}: ${P.logged[p]}`).join(', ')}).</p>
        <p class="small">Hinweis: Das sind Häufungen, keine Beweise für Ursachen. Bei wenigen Zyklen können auch Zufälle wie Muster aussehen.</p>
      `)}`));
  }

  /* ---------- 7. Befinden je Phase ---------- */
  {
    const blocks = [];
    for (const cat of state.settings.categories) {
      const src = cat.ordinal ? P.ordinal[cat.id] : cat.intensity ? P.intensity[cat.id] : null;
      if (!src) continue;
      const items = PHASE_ORDER.map((p) => ({
        label: PHASES[p].short,
        value: src[p] ? src[p].sum / src[p].n : null,
        color: PHASES[p].color,
        title: src[p] ? `${PHASES[p].name}: Ø ${n1(src[p].sum / src[p].n)} (${src[p].n} Tage)` : `${PHASES[p].name}: keine Daten`,
      }));
      if (items.filter((i) => i.value !== null).length < 2) continue;
      const maxScore = cat.ordinal ? Math.max(...cat.options.map((o) => o.score || 0)) : 5;
      const scale = cat.ordinal
        ? cat.options.filter((o) => o.score).map((o) => `${o.score} = ${esc(o.label)}`).join(', ')
        : '1 = sehr leicht … 5 = sehr stark';
      blocks.push(`<h3>${cat.icon} ${esc(cat.name)}${cat.intensity ? ' (Intensität)' : ''}</h3>
        ${barChart({ items, max: maxScore, min: 0, decimals: 1, height: 150, yTicks: [0, maxScore] })}
        <p class="small muted">Skala: ${scale}</p>`);
    }
    if (blocks.length) {
      parts.push(card('📈 Befinden je Phase', blocks.join('') + explain(`
        <p>Für Kategorien mit einer Rangfolge (z. B. Energie: erschöpft = 1 … voller Energie = 5) wird pro Phase der Durchschnitt aller erfassten Werte gebildet. Bei Schmerzen wird die eingetragene Intensität (1–5) gemittelt – nur an Tagen, an denen Schmerzen eingetragen wurden.</p>
        <p>Grundlage sind nur abgeschlossene Zyklen. Fährst du mit dem Finger / der Maus über eine Säule, siehst du, auf wie vielen Tagen der Wert beruht.</p>`)));
    }
  }

  /* ---------- 8. Symptom im Zyklusverlauf ---------- */
  if (A.cycles.length) {
    const options = [];
    for (const cat of state.settings.categories) {
      if (cat.type === 'number') continue;
      for (const o of cat.options) {
        const rec = P.opt[cat.id + ':' + o.id];
        if (rec || cat.id === 'period') options.push({ key: cat.id + ':' + o.id, label: `${cat.icon} ${cat.name}: ${o.label}`, count: rec ? rec.total : 0, cat, o });
      }
    }
    const withData = options.filter((o) => o.count > 0 || o.cat.id === 'period');
    if (!selKey || !withData.some((o) => o.key === selKey)) {
      const best = [...withData].filter((o) => o.cat.id !== 'period').sort((a, b) => b.count - a.count)[0];
      selKey = best ? best.key : 'period:medium';
    }
    const [catId, optId] = selKey.split(':');
    const maxDays = selMode === 'start' ? Math.min(Math.max(...A.cycles.map((c) => c.length)), 45) : 14;
    const series = cycleDaySeries(state, A, catId, optId, selMode, maxDays);
    const items = series.map((s) => ({
      label: selMode === 'start' ? String(s.k) : `-${s.k}`,
      value: s.total ? Math.round((s.hits / s.total) * 100) : 0,
      muted: s.total === 0,
      color: 'var(--primary)',
      title: s.total ? `${selMode === 'start' ? `Zyklustag ${s.k}` : `${s.k} Tage vor der Periode`}: ${s.hits} von ${s.total} erfassten Zyklen` : 'keine Daten',
    }));
    if (selMode === 'before') items.reverse();
    parts.push(card('🗓️ Symptom im Zyklusverlauf', `
      <label class="field"><select data-sel>${withData.map((o) => `<option value="${o.key}" ${o.key === selKey ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
      <div class="seg wide">
        <button data-mode="start" class="${selMode === 'start' ? 'on' : ''}">ab Periodenbeginn</button>
        <button data-mode="before" class="${selMode === 'before' ? 'on' : ''}">vor nächster Periode</button>
      </div>
      ${barChart({ items, max: 100, valueLabels: false, labelEvery: selMode === 'start' ? 5 : 2, unit: ' %', yTicks: [0, 50, 100] })}
      <p class="small muted">${selMode === 'start' ? 'X-Achse: Zyklustag (1 = erster Periodentag).' : 'X-Achse: Tage vor Beginn der nächsten Periode.'} Y-Achse: in wie viel % deiner Zyklen die Angabe an diesem Tag eingetragen war.</p>
      ${explain(`<p>Für jeden Tag (gezählt ${selMode === 'start' ? 'ab dem ersten Periodentag' : 'rückwärts vom nächsten Periodenbeginn'}) wird geprüft, in wie vielen abgeschlossenen Zyklen die gewählte Angabe eingetragen war – geteilt durch die Zyklen, in denen du an diesem Tag überhaupt etwas eingetragen hast. ${catId === 'period' ? 'Bei der Blutung zählt jeder Tag als erfasst.' : ''}</p><p>Die Ansicht „vor nächster Periode“ eignet sich besonders für PMS-Beschwerden, weil die Lutealphase konstanter ist als der Zyklusbeginn.</p>`)}`));
  }

  /* ---------- 9. Basaltemperatur ---------- */
  {
    const tCycles = [];
    for (const c of A.cycles) if (c.temps.length >= 3) tCycles.push({ ...c, label: `Zyklus ab ${fmt(c.startN, 'shortY')}` });
    if (cur.temps && cur.temps.length >= 3) tCycles.push({ ...cur, length: Math.max(cur.day, A.cycleLen), label: 'aktueller Zyklus' });
    if (tCycles.length) {
      if (selTempCycle === null || selTempCycle >= tCycles.length) selTempCycle = tCycles.length - 1;
      const tc = tCycles[selTempCycle];
      const temps = tempsIn(state.entries, tc.startN, tc.endN);
      const shift = detectTempShift(temps);
      const points = temps.map((t) => ({ x: t.n - tc.startN + 1, y: t.t, label: fmt(t.n) }));
      parts.push(card('🌡️ Basaltemperatur', `
        ${tCycles.length > 1 ? `<label class="field"><select data-tsel>${tCycles.map((c, i) => `<option value="${i}" ${i === selTempCycle ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>` : `<p class="muted small">${tc.label}</p>`}
        ${lineChart({ points, xMax: tc.length, coverline: shift ? shift.coverline : null, markX: shift ? shift.ovN - tc.startN + 1 : null })}
        <p class="small">${shift ? `Temperaturanstieg erkannt → Eisprung vermutlich am <strong>${fmt(shift.ovN, 'long')}</strong> (Zyklustag ${shift.ovN - tc.startN + 1}, senkrechte Linie).` : 'Noch kein eindeutiger Temperaturanstieg erkannt.'}</p>
        ${explain(`<p>Verwendet wird eine vereinfachte <strong>„3-über-6“-Regel</strong>: Ein Anstieg gilt als erkannt, wenn drei aufeinanderfolgende Messungen höher sind als die sechs Messungen davor, und die dritte mindestens 0,2 °C über dem höchsten dieser sechs Werte liegt. Die Hilfslinie zeigt diesen höchsten Wert.</p><p>Der Eisprung wird dann auf den Tag vor der ersten erhöhten Messung gelegt. Störfaktoren wie Krankheit, Alkohol oder wenig Schlaf können die Werte verfälschen.</p>`)}`));
    }
  }

  /* ---------- 10. Zyklus-Historie ---------- */
  {
    const rows = [];
    rows.push(`<tr class="cur"><td>${fmt(cur.startN, 'shortY')}</td><td>läuft (Tag ${cur.day})</td><td>${cur.periodOngoing ? 'läuft' : cur.periodLength}</td><td>${fmt(cur.ovN)}${cur.ovSource === 'temp' ? ' 🌡️' : ''}</td></tr>`);
    for (const c of [...A.cycles].reverse()) {
      rows.push(`<tr class="${c.valid ? '' : 'muted'}"><td>${fmt(c.startN, 'shortY')}</td><td>${c.length}</td><td>${c.periodLength}</td><td>${fmt(c.ovN)}${c.ovSource === 'temp' ? ' 🌡️' : ''}</td></tr>`);
    }
    parts.push(card('📜 Zyklus-Historie', `
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Beginn</th><th>Zyklus</th><th>Periode</th><th>Eisprung*</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table></div>
      <p class="small muted">Längen in Tagen. *Eisprung geschätzt (Periodenbeginn des Folgezyklus − ${cfg.luteal} Tage) bzw. 🌡️ = per Temperatur bestimmt. Graue Zeilen sind Ausreißer.</p>`));
  }

  parts.push('<p class="disclaimer">Diese App ersetzt keine ärztliche Beratung. Bei starken Schmerzen, sehr unregelmäßigen Zyklen oder anderen Auffälligkeiten sprich mit deiner Frauenärztin / deinem Frauenarzt.</p>');
  el.innerHTML = parts.join('');

  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-sel]')) { selKey = e.target.value; rerender(); }
    if (e.target.matches('[data-tsel]')) { selTempCycle = Number(e.target.value); rerender(); }
  });
  el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { selMode = m.dataset.mode; rerender(); }
  });
}

function phaseLegend() {
  return `<div class="legend">${PHASE_ORDER.map((p) => `<span><i class="lg" style="background:${PHASES[p].color}"></i>${PHASES[p].name}</span>`).join('')}</div>`;
}

function periodFlowSummary(A) {
  // Anteil Stärke je Periodentag (1..7)
  const days = [];
  for (const p of A.periods) {
    for (let k = 0; k < Math.min(p.length, 7); k++) {
      const e = state.entries.get(new Date((p.startN + k) * 86400000).toISOString().slice(0, 10));
      const f = e?.v?.period?.o?.[0];
      if (!f) continue;
      const d = (days[k] ||= { light: 0, medium: 0, heavy: 0, spotting: 0, n: 0 });
      if (d[f] !== undefined) { d[f]++; d.n++; }
    }
  }
  if (!days.length) return '';
  const row = days.map((d, k) => {
    if (!d || !d.n) return `<div class="flowcol"><div class="flowbar"></div><span>${k + 1}</span></div>`;
    const seg = ['heavy', 'medium', 'light', 'spotting'].map((f) => d[f] ? `<i class="f-${f}" style="height:${(d[f] / d.n) * 100}%"></i>` : '').join('');
    return `<div class="flowcol" title="Tag ${k + 1}: stark ${d.heavy}, mittel ${d.medium}, leicht ${d.light}"><div class="flowbar">${seg}</div><span>${k + 1}</span></div>`;
  }).join('');
  return `<h3>Typische Blutungsstärke je Periodentag</h3>
    <div class="flowchart">${row}</div>
    <div class="legend"><span><i class="lg f-heavy"></i>stark</span><span><i class="lg f-medium"></i>mittel</span><span><i class="lg f-light"></i>leicht</span><span><i class="lg f-spotting"></i>Schmier.</span></div>`;
}
