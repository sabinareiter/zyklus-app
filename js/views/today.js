import { state, saveEntry } from '../store.js';
import { analyze, PHASES, phaseOf, phasePatterns, isPeriodDay } from '../analysis.js';
import { todayIso, toIso, fmt, relDays, plural } from '../dates.js';
import { cycleRing } from '../charts.js';
import { esc, entryChips, periodDialog, toast, pct } from '../ui.js';

export function renderToday(el, _arg, rerender) {
  const today = todayIso();
  const A = analyze(state, today);
  const entry = state.entries.get(today);
  const cur = A.current;

  if (!cur) {
    el.innerHTML = `
      <header class="page-head"><h1>Hallo 👋</h1><p class="muted">${fmt(today, 'full')}</p></header>
      <section class="card hero-empty">
        <div class="big-emoji">🌸</div>
        <h2>Willkommen bei deinem Zyklus-Tracker</h2>
        <p>Trag zuerst deine <strong>letzte Periode</strong> ein. Je mehr vergangene Perioden du nachträgst, desto schneller werden Prognosen und Analysen genau.</p>
        <button class="btn primary block" data-act="period">🩸 Letzte Periode eintragen</button>
        <button class="btn ghost block" data-act="started">Meine Periode hat heute begonnen</button>
      </section>
      <section class="card">
        <h3>🔒 Deine Daten bleiben bei dir</h3>
        <p class="muted">Alle Einträge werden nur auf diesem Gerät gespeichert. Es gibt kein Konto und keinen Server. Denk daran, ab und zu unter <a href="#/einstellungen">Einstellungen</a> ein Backup zu exportieren.</p>
      </section>
      <a class="btn block" href="#/tag/${today}">Heute eintragen</a>`;
    bind(el, today, rerender);
    return;
  }

  const ph = cur.phase ? PHASES[cur.phase] : null;
  const ring = cycleRing({
    length: cur.length, day: cur.day,
    phaseFor: (d) => phaseOf(d, cur.length, cur.periodLength, cur.ovDay),
  });

  let headline, sub;
  const todayIsPeriod = isPeriodDay(entry);
  if (todayIsPeriod || (cur.periodOngoing && cur.day <= cur.periodLength)) {
    const pd = cur.periodEndN >= A.todayN - 1 ? cur.day : null;
    headline = pd ? `Periode · Tag ${pd}` : 'Periode';
    sub = `Nächste Periode ca. ${fmt(cur.nextStartN)}`;
  } else if (cur.overdue) {
    headline = `${plural(-cur.daysUntil, 'Tag', 'Tage')} über­fällig`;
    sub = `Erwartet war ca. der ${fmt(cur.nextStartN)}`;
  } else if (cur.daysUntil === 0) {
    headline = 'Periode heute erwartet';
    sub = `Zeitraum: ${fmt(cur.rangeStartN)} – ${fmt(cur.rangeEndN)}`;
  } else {
    headline = `Periode ${relDays(cur.daysUntil)}`;
    sub = `ca. ${fmt(cur.nextStartN)} (± ${plural(A.uncertainty, 'Tag', 'Tage')})`;
  }

  // Abfrage, ob die Periode noch anhält
  const yesterday = toIso(A.todayN - 1);
  const askOngoing = !entry?.v?.period && isPeriodDay(state.entries.get(yesterday)) && sessionStorage.getItem('ask-' + today) !== 'no';

  // Fruchtbares Fenster (aktuell oder nächstes)
  let fertileText = '';
  const f = cur.fertileEndN >= A.todayN ? cur : A.future[0];
  if (f) {
    const inWindow = A.todayN >= f.fertileStartN && A.todayN <= f.fertileEndN;
    fertileText = inWindow
      ? `<strong>Jetzt</strong> – bis ${fmt(f.fertileEndN)}`
      : `${fmt(f.fertileStartN)} – ${fmt(f.fertileEndN)}`;
  }
  const ovN = cur.ovN >= A.todayN - 1 ? cur.ovN : A.future[0]?.ovN;

  // Top-Muster
  const P = phasePatterns(state, A);
  const phaseInsights = P.insights.filter((i) => i.phase === cur.phase).slice(0, 3);

  // Backup-Erinnerung
  const lastBackup = state.settings.lastBackup ? new Date(state.settings.lastBackup) : null;
  const needBackup = state.entries.size >= 15 && (!lastBackup || Date.now() - lastBackup > 30 * 86400000);

  el.innerHTML = `
    <header class="page-head"><h1>Heute</h1><p class="muted">${fmt(today, 'full')}</p></header>

    <section class="card ring-card">
      <div class="ring-wrap">
        ${ring}
        <div class="ring-center">
          <div class="ring-day">Zyklustag <strong>${cur.day}</strong></div>
          <div class="ring-head">${esc(headline)}</div>
          <div class="ring-sub">${esc(sub)}</div>
        </div>
      </div>
      ${ph ? `<div class="phase-pill" style="--pc:${ph.color}">${ph.name}</div>` : ''}
      ${A.basis === 'default' ? `<p class="hint">Prognose basiert noch auf Standardwerten (${state.settings.cycle.defaultCycle}-Tage-Zyklus). Sobald du zwei Perioden erfasst hast, rechnet die App mit deinen echten Daten.</p>` : ''}
    </section>

    ${askOngoing ? `
    <section class="card ask">
      <h3>Hast du heute noch deine Periode?</h3>
      <div class="chips">
        <button class="chip" data-flow="light">leicht</button>
        <button class="chip" data-flow="medium">mittel</button>
        <button class="chip" data-flow="heavy">stark</button>
        <button class="chip" data-flow="spotting">Schmierblutung</button>
        <button class="chip ghost" data-act="no-period">Nein, vorbei</button>
      </div>
    </section>` : ''}

    <div class="row gap">
      <a class="btn primary grow" href="#/tag/${today}">${entry ? '✏️ Heute bearbeiten' : '＋ Heute eintragen'}</a>
      ${todayIsPeriod ? '' : '<button class="btn grow" data-act="started">🩸 Periode begonnen</button>'}
    </div>

    ${entry ? `<section class="card"><h3>Heute erfasst</h3><div class="chips">${entryChips(entry)}</div></section>` : ''}

    ${ph ? `
    <section class="card">
      <h3><span class="dot" style="background:${ph.color}"></span>${ph.name}</h3>
      <p>${ph.desc}</p>
      ${phaseInsights.length ? `
        <p class="muted small">Was dir in dieser Phase oft begegnet:</p>
        <ul class="plain">${phaseInsights.map((i) => `<li>${i.rec.cat.icon} <strong>${esc(i.rec.option.label)}</strong> – an ${pct(i.rate)} der erfassten Tage dieser Phase</li>`).join('')}</ul>` : ''}
    </section>` : ''}

    <section class="card">
      <h3>Ausblick</h3>
      <dl class="facts">
        <dt>🩸 Nächste Periode</dt><dd>${cur.overdue ? 'überfällig' : `${fmt(cur.rangeStartN)} – ${fmt(cur.rangeEndN)}`}</dd>
        ${fertileText ? `<dt>🌼 Fruchtbare Tage</dt><dd>${fertileText}</dd>` : ''}
        ${ovN ? `<dt>⭐ Eisprung ${cur.ovSource === 'temp' && ovN === cur.ovN ? '(laut Temperatur)' : '(geschätzt)'}</dt><dd>${fmt(ovN)}</dd>` : ''}
        <dt>🔄 Ø Zykluslänge</dt><dd>${A.basis === 'data' ? `${String(Math.round(A.stats.avg * 10) / 10).replace('.', ',')} Tage` : '–'}</dd>
      </dl>
      <a class="link" href="#/analyse">Alle Analysen &amp; Erklärungen →</a>
    </section>

    ${needBackup ? `
    <section class="card warn">
      <h3>💾 Zeit für ein Backup</h3>
      <p class="small">${lastBackup ? `Dein letztes Backup ist vom ${lastBackup.toLocaleDateString('de-DE')}.` : 'Du hast noch kein Backup gemacht.'} Deine Daten liegen nur auf diesem Gerät.</p>
      <a class="btn" href="#/einstellungen">Zum Backup</a>
    </section>` : ''}

    <p class="disclaimer">Prognosen sind Schätzungen und nicht zur Verhütung geeignet.</p>`;

  bind(el, today, rerender);
}

function bind(el, today, rerender) {
  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const flow = e.target.closest('[data-flow]')?.dataset.flow;
    if (act === 'period') periodDialog(rerender);
    if (act === 'started') {
      const entry = structuredClone(state.entries.get(today) || { date: today, v: {}, note: '' });
      entry.v.period = { o: ['medium'] };
      await saveEntry(entry);
      toast('Periodenbeginn eingetragen – Stärke kannst du im Tageseintrag anpassen.');
      rerender();
    }
    if (act === 'no-period') {
      sessionStorage.setItem('ask-' + today, 'no');
      rerender();
    }
    if (flow) {
      const entry = structuredClone(state.entries.get(today) || { date: today, v: {}, note: '' });
      entry.v.period = { o: [flow] };
      await saveEntry(entry);
      toast('Eingetragen');
      rerender();
    }
  });
}
