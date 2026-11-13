// Alle Berechnungen der App. Die Funktionen sind bewusst einfach gehalten,
// damit jede Auswertung in der App nachvollziehbar erklärt werden kann.

import { toNum, toIso } from './dates.js';
import { hasValue } from './store.js';

export const FLOW = ['light', 'medium', 'heavy'];
export const MIN_CYCLE = 15; // kürzere/längere Abstände gelten als Ausreißer
export const MAX_CYCLE = 60; // (z. B. vergessene Einträge) und fließen nicht in Mittelwerte
export const MAX_CYCLES_USED = 12;
export const PERIOD_GAP = 2; // Blutungstage mit max. 1 Tag Lücke gehören zur selben Periode

export const PHASE_ORDER = ['menstruation', 'follicular', 'fertile', 'luteal', 'pms'];

export const PHASES = {
  menstruation: {
    name: 'Menstruation', dat: 'Menstruation', short: 'Periode', color: 'var(--c-menstruation)',
    desc: 'Die Gebärmutterschleimhaut wird abgestoßen. Östrogen und Progesteron sind auf ihrem Tiefpunkt – viele fühlen sich in diesen Tagen eher erschöpft.',
    rule: 'deine tatsächlich eingetragenen Blutungstage (bei Prognosen: deine durchschnittliche Periodenlänge)',
  },
  follicular: {
    name: 'Follikelphase', dat: 'Follikelphase', short: 'Follikel', color: 'var(--c-follicular)',
    desc: 'Nach der Periode steigt das Östrogen, im Eierstock reift ein Eibläschen heran. Energie und Stimmung nehmen bei vielen spürbar zu.',
    rule: 'von nach der Periode bis zum Beginn des fruchtbaren Fensters',
  },
  fertile: {
    name: 'Fruchtbare Phase', dat: 'fruchtbaren Phase', short: 'fruchtbar', color: 'var(--c-fertile)',
    desc: 'Die Tage rund um den Eisprung. Spermien können bis zu 5 Tage überleben, die Eizelle etwa 12–24 Stunden – daher beginnt das Fenster schon 5 Tage vor dem Eisprung.',
    rule: '5 Tage vor bis 1 Tag nach dem (geschätzten) Eisprung',
  },
  luteal: {
    name: 'Lutealphase', dat: 'Lutealphase', short: 'Luteal', color: 'var(--c-luteal)',
    desc: 'Nach dem Eisprung bildet der Gelbkörper Progesteron. Die Körpertemperatur ist leicht erhöht, viele werden ruhiger oder müder.',
    rule: 'nach dem fruchtbaren Fenster bis 5 Tage vor der nächsten Periode',
  },
  pms: {
    name: 'Prämenstruelle Phase', dat: 'prämenstruellen Phase', short: 'vor Periode', color: 'var(--c-pms)',
    desc: 'Die letzten Tage vor der Periode. Die Hormonspiegel fallen ab – typische Zeit für PMS-Beschwerden wie Reizbarkeit, Brustspannen oder Heißhunger.',
    rule: 'die letzten 5 Tage vor Beginn der nächsten Periode',
  },
};

/* ---------- kleine Statistik-Helfer ---------- */
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}
export function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const h = Math.floor(s.length / 2);
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export const round1 = (x) => Math.round(x * 10) / 10;

/* ---------- Einträge auswerten ---------- */
export function isPeriodDay(entry) {
  const o = entry?.v?.period?.o;
  return !!o && o.some((x) => FLOW.includes(x));
}

/** Hat der Tag mindestens einen Eintrag außer Blutung/Notiz? */
export function hasSymptoms(entry) {
  if (!entry || !entry.v) return false;
  return Object.entries(entry.v).some(([k, val]) => k !== 'period' && k !== 'temp' && hasValue(val));
}

/** Fasst Blutungstage zu Perioden zusammen. */
export function findPeriods(entries) {
  const days = [...entries.values()].filter(isPeriodDay).map((e) => toNum(e.date)).sort((a, b) => a - b);
  const periods = [];
  for (const d of days) {
    const last = periods[periods.length - 1];
    if (last && d - last.endN <= PERIOD_GAP) last.endN = d;
    else periods.push({ startN: d, endN: d });
  }
  return periods.map((p) => ({ ...p, length: p.endN - p.startN + 1 }));
}

/** Phase eines Zyklustags (1-basiert). */
export function phaseOf(day, length, periodLen, ovDay) {
  if (day <= periodLen) return 'menstruation';
  if (day >= ovDay - 5 && day <= ovDay + 1) return 'fertile';
  if (day < ovDay - 5) return 'follicular';
  if (day > length - 5) return 'pms';
  return 'luteal';
}

/* ---------- Basaltemperatur: vereinfachte "3-über-6"-Regel ---------- */
export function tempsIn(entries, startN, endN) {
  const out = [];
  for (let n = startN; n <= endN; n++) {
    const t = entries.get(toIso(n))?.v?.temp?.n;
    if (t !== undefined && t !== null && !Number.isNaN(Number(t))) out.push({ n, t: Number(t) });
  }
  return out;
}

export function detectTempShift(temps) {
  for (let i = 6; i + 2 < temps.length; i++) {
    const base = Math.max(...temps.slice(i - 6, i).map((x) => x.t));
    if (temps[i].t > base && temps[i + 1].t > base && temps[i + 2].t >= base + 0.2) {
      return { ovN: temps[i].n - 1, coverline: base, firstHighN: temps[i].n };
    }
  }
  return null;
}

function ovulationFor(entries, startN, endN, fallbackOvN) {
  const temps = tempsIn(entries, startN, endN);
  const shift = detectTempShift(temps);
  if (shift && shift.ovN > startN) return { ovN: shift.ovN, ovSource: 'temp', coverline: shift.coverline, temps };
  return { ovN: fallbackOvN, ovSource: 'estimate', coverline: null, temps };
}

/* ---------- Hauptanalyse ---------- */
export function analyze(state, todayIsoStr) {
  const { entries } = state;
  const cfg = state.settings.cycle;
  const luteal = cfg.luteal;
  const todayN = toNum(todayIsoStr);
  const periods = findPeriods(entries);

  // Abgeschlossene Zyklen = Abstand zwischen zwei Periodenbeginnen
  const cycles = periods.slice(0, -1).map((p, i) => {
    const next = periods[i + 1];
    const length = next.startN - p.startN;
    const c = {
      index: i, startN: p.startN, endN: next.startN - 1, length,
      periodLength: p.length,
      valid: length >= MIN_CYCLE && length <= MAX_CYCLE,
    };
    Object.assign(c, ovulationFor(entries, c.startN, c.endN, next.startN - luteal));
    c.ovDay = c.ovN - c.startN + 1;
    c.fertileStartN = c.ovN - 5;
    c.fertileEndN = c.ovN + 1;
    return c;
  });

  const validCycles = cycles.filter((c) => c.valid);
  const used = validCycles.slice(-MAX_CYCLES_USED);
  const lens = used.map((c) => c.length);

  // Periodenlänge: nur abgeschlossene Perioden (letzte evtl. noch laufend)
  const lastP = periods[periods.length - 1];
  const periodOngoing = !!lastP && lastP.endN >= todayN - 1;
  const finishedPeriods = (periodOngoing ? periods.slice(0, -1) : periods).filter((p) => p.length <= 15);
  const usedPeriods = finishedPeriods.slice(-MAX_CYCLES_USED);
  const plens = usedPeriods.map((p) => p.length);

  const stats = {
    n: lens.length,
    lens,
    used,
    avg: lens.length ? mean(lens) : null,
    median: lens.length ? median(lens) : null,
    sd: lens.length >= 2 ? sd(lens) : null,
    min: lens.length ? Math.min(...lens) : null,
    max: lens.length ? Math.max(...lens) : null,
    excluded: cycles.filter((c) => !c.valid),
    plens,
    usedPeriods,
    pAvg: plens.length ? mean(plens) : null,
    pSd: plens.length >= 2 ? sd(plens) : null,
  };
  stats.range = lens.length ? stats.max - stats.min : null;
  stats.regularity = regularity(stats);

  const cycleLen = lens.length ? Math.round(stats.avg) : cfg.defaultCycle;
  const periodLen = plens.length ? Math.round(stats.pAvg) : cfg.defaultPeriod;
  const basis = lens.length ? 'data' : 'default';
  const uncertainty = lens.length >= 3 ? Math.max(1, Math.round(stats.sd)) : 3;

  const A = {
    todayIso: todayIsoStr, todayN, periods, cycles, stats,
    cycleLen, periodLen, luteal, basis, uncertainty, current: null, future: [],
  };
  if (!lastP) return A;

  // Aktueller Zyklus
  const startN = lastP.startN;
  const nextStartN = startN + cycleLen;
  const day = todayN - startN + 1;
  const daysUntil = nextStartN - todayN;
  const overdue = daysUntil < 0;
  const curOv = ovulationFor(entries, startN, todayN, nextStartN - luteal);
  const curPeriodLen = periodOngoing ? Math.max(lastP.length, periodLen) : lastP.length;
  const length = overdue ? day : cycleLen;
  A.current = {
    startN, endN: overdue ? todayN : nextStartN - 1, day, length, nextStartN, daysUntil, overdue,
    rangeStartN: nextStartN - uncertainty, rangeEndN: nextStartN + uncertainty,
    periodLength: curPeriodLen, periodEndN: lastP.endN, periodOngoing,
    ...curOv,
    ovDay: curOv.ovN - startN + 1,
    fertileStartN: curOv.ovN - 5, fertileEndN: curOv.ovN + 1,
  };
  A.current.phase = day >= 1 ? phaseOf(day, length, curPeriodLen, A.current.ovDay) : null;

  // Prognose für die nächsten Zyklen
  let s = overdue ? todayN + 1 : nextStartN;
  for (let k = 0; k < 8; k++) {
    const ovN = s + cycleLen - luteal;
    A.future.push({
      startN: s, endN: s + cycleLen - 1, length: cycleLen, periodLength: periodLen,
      ovN, ovDay: ovN - s + 1, fertileStartN: ovN - 5, fertileEndN: ovN + 1, predicted: true,
    });
    s += cycleLen;
  }
  return A;
}

export function regularity(stats) {
  if (stats.n < 3) return { key: 'unknown', label: 'noch zu wenig Daten' };
  if (stats.range <= 7) return { key: 'regular', label: 'regelmäßig' };
  if (stats.range <= 9) return { key: 'slightly', label: 'leicht schwankend' };
  return { key: 'irregular', label: 'unregelmäßig' };
}

/** Infos zu einem einzelnen Kalendertag. */
export function dayInfo(A, iso) {
  const n = toNum(iso);
  const mk = (c, predicted, current) => {
    const cycleDay = n - c.startN + 1;
    return {
      cycleDay,
      phase: phaseOf(cycleDay, c.length, c.periodLength, c.ovDay),
      predicted,
      current,
      predictedPeriod: predicted && cycleDay <= c.periodLength,
      fertile: (predicted || current) && n >= c.fertileStartN && n <= c.fertileEndN,
      ovulation: (predicted || current) && n === c.ovN,
      ovSource: c.ovSource || 'estimate',
    };
  };
  for (const c of A.cycles) if (n >= c.startN && n <= c.endN) return mk(c, false, false);
  const cur = A.current;
  if (cur && n >= cur.startN && n <= cur.endN) {
    const info = mk(cur, false, true);
    // laufende Periode: zukünftige Tage als Prognose markieren
    if (n > A.todayN && cur.periodOngoing && info.cycleDay <= cur.periodLength) info.predictedPeriod = true;
    return info;
  }
  for (const f of A.future) if (n >= f.startN && n <= f.endN) return mk(f, true, false);
  return null;
}

/* ---------- Muster nach Zyklusphase ---------- */
export function phasePatterns(state, A) {
  const cats = state.settings.categories.filter((c) => c.id !== 'period' && c.type !== 'number');
  const logged = Object.fromEntries(PHASE_ORDER.map((p) => [p, 0]));
  const loggedCycles = Object.fromEntries(PHASE_ORDER.map((p) => [p, new Set()]));
  const opt = {}; // key -> { cat, option, total, byPhase:{}, cycles:{phase:Set} }
  const ordinal = {}; // catId -> { phase: {sum, n} }
  const intensity = {}; // catId -> { phase: {sum, n} }
  let totalLogged = 0;

  for (const c of A.cycles) {
    for (let n = c.startN; n <= c.endN; n++) {
      const e = state.entries.get(toIso(n));
      if (!hasSymptoms(e)) continue;
      const ph = phaseOf(n - c.startN + 1, c.length, c.periodLength, c.ovDay);
      logged[ph]++;
      loggedCycles[ph].add(c.index);
      totalLogged++;
      for (const cat of cats) {
        const val = e.v[cat.id];
        if (!val || !val.o) continue;
        for (const oid of val.o) {
          const option = cat.options.find((o) => o.id === oid);
          if (!option) continue;
          const key = cat.id + ':' + oid;
          const rec = opt[key] || (opt[key] = {
            key, cat, option, total: 0,
            byPhase: Object.fromEntries(PHASE_ORDER.map((p) => [p, 0])),
            cycles: Object.fromEntries(PHASE_ORDER.map((p) => [p, new Set()])),
          });
          rec.total++;
          rec.byPhase[ph]++;
          rec.cycles[ph].add(c.index);
          if (cat.ordinal && option.score) {
            const o = (ordinal[cat.id] ||= {});
            const b = (o[ph] ||= { sum: 0, n: 0 });
            b.sum += option.score; b.n++;
          }
        }
        if (cat.intensity && val.i) {
          const o = (intensity[cat.id] ||= {});
          const b = (o[ph] ||= { sum: 0, n: 0 });
          b.sum += val.i; b.n++;
        }
      }
    }
  }

  // Auffälligkeiten finden
  const insights = [];
  for (const rec of Object.values(opt)) {
    if (rec.total < 3) continue;
    let best = null;
    for (const ph of PHASE_ORDER) {
      if (logged[ph] < 3) continue;
      const inPhase = rec.byPhase[ph];
      const restDays = totalLogged - logged[ph];
      const rate = inPhase / logged[ph];
      const restRate = restDays > 0 ? (rec.total - inPhase) / restDays : 0;
      if (inPhase < 2 || rate < 0.3) continue;
      if (rate < 1.5 * restRate) continue;
      const score = rate - restRate;
      if (!best || score > best.score) {
        best = {
          rec, phase: ph, rate, restRate, inPhase, phaseDays: logged[ph],
          restCount: rec.total - inPhase, restDays,
          cyclesWith: rec.cycles[ph].size, cyclesLogged: loggedCycles[ph].size, score,
        };
      }
    }
    if (best) insights.push(best);
  }
  insights.sort((a, b) => b.score - a.score);

  return { logged, totalLogged, opt, ordinal, intensity, insights, cyclesCount: A.cycles.length };
}

/** Häufigkeit einer Option je Zyklustag (ab Periodenbeginn oder vor nächster Periode). */
export function cycleDaySeries(state, A, catId, optId, mode, maxDays) {
  const out = [];
  for (let k = 1; k <= maxDays; k++) out.push({ k, hits: 0, total: 0 });
  for (const c of A.cycles) {
    for (let k = 1; k <= maxDays; k++) {
      const n = mode === 'start' ? c.startN + k - 1 : c.endN + 1 - k;
      if (n < c.startN || n > c.endN) continue;
      const e = state.entries.get(toIso(n));
      // Blutung: jeder Tag zählt (keine Eintragung = keine Blutung).
      // Sonst zählt ein Tag nur, wenn irgendein Symptom eingetragen wurde.
      if (catId !== 'period' && !hasSymptoms(e)) continue;
      const val = e?.v?.[catId];
      out[k - 1].total++;
      if (val && val.o && val.o.includes(optId)) out[k - 1].hits++;
    }
  }
  return out;
}
