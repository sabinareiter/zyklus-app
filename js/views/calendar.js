import { state } from '../store.js';
import { analyze, dayInfo, isPeriodDay, hasSymptoms } from '../analysis.js';
import { todayIso, toNum, toIso, fmt, weekdayIndex } from '../dates.js';
import { entryChips, periodDialog, toast } from '../ui.js';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function renderCalendar(el, arg, rerender) {
  const today = todayIso();
  const month = /^\d{4}-\d{2}$/.test(arg || '') ? arg : today.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const firstN = toNum(`${month}-01`);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = weekdayIndex(firstN);
  const A = analyze(state, today);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const n = firstN + d - 1;
    const iso = toIso(n);
    const e = state.entries.get(iso);
    const info = dayInfo(A, iso);
    const cls = ['cal-cell'];
    const flow = e?.v?.period?.o?.[0];
    if (isPeriodDay(e)) cls.push('period', 'flow-' + flow);
    else if (flow === 'spotting') cls.push('spotting');
    else if (info?.predictedPeriod) cls.push('pred-period');
    if (info?.fertile && !isPeriodDay(e)) cls.push('fertile');
    if (iso === today) cls.push('today');
    if (iso > today) cls.push('future');
    const marks = [];
    if (hasSymptoms(e) || e?.note) marks.push('<span class="m-dot"></span>');
    cells += `<button class="${cls.join(' ')}" data-day="${iso}">
      <span class="num">${d}</span>
      <span class="marks">${marks.join('')}</span>
      ${info?.ovulation ? '<span class="m-ov" title="Eisprung">★</span>' : ''}
    </button>`;
  }

  // Einträge des Monats
  const monthEntries = [...state.entries.values()]
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

  el.innerHTML = `
    <header class="page-head row between">
      <h1>Kalender</h1>
      <button class="btn sm" data-act="period">🩸 Periode nachtragen</button>
    </header>
    <section class="card cal">
      <div class="cal-nav">
        <a class="icon-btn" href="#/kalender/${prev}" aria-label="Vorheriger Monat">‹</a>
        <div class="cal-title">${fmt(firstN, 'month')}</div>
        <a class="icon-btn" href="#/kalender/${next}" aria-label="Nächster Monat">›</a>
      </div>
      ${month !== today.slice(0, 7) ? `<div class="center"><a class="link small" href="#/kalender">Zu heute springen</a></div>` : ''}
      <div class="cal-grid">
        ${WD.map((w) => `<div class="cal-wd">${w}</div>`).join('')}
        ${cells}
      </div>
      <div class="legend">
        <span><i class="lg period"></i>Periode</span>
        <span><i class="lg pred"></i>Prognose Periode</span>
        <span><i class="lg fertile"></i>fruchtbar</span>
        <span><b class="lg-star">★</b>Eisprung</span>
        <span><i class="lg dot"></i>Eintrag</span>
      </div>
    </section>
    ${monthEntries.length ? `
    <section class="card">
      <h3>Einträge im ${fmt(firstN, 'month').split(' ')[0]}</h3>
      <ul class="entry-list">
        ${monthEntries.map((e) => `<li><a href="#/tag/${e.date}">
          <div class="el-date">${fmt(e.date, 'long')}</div>
          <div class="chips">${entryChips(e, { limit: 6 })}</div>
        </a></li>`).join('')}
      </ul>
    </section>` : ''}
    <p class="disclaimer">Fruchtbare Tage &amp; Eisprung werden nur für den aktuellen und kommende Zyklen angezeigt und sind Schätzungen.</p>`;

  el.addEventListener('click', (e) => {
    const day = e.target.closest('[data-day]')?.dataset.day;
    if (day) {
      if (day > today) { toast('Zukünftige Tage können noch nicht eingetragen werden.'); return; }
      location.hash = '#/tag/' + day;
    }
    if (e.target.closest('[data-act="period"]')) periodDialog(rerender);
  });
}
