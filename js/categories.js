// Standard-Kategorien zum Tracken. Alles hier kann in den Einstellungen
// umsortiert und ausgeblendet werden (außer "Blutung"), und man kann eigene
// Kategorien und Optionen ergänzen.
//
// type:   'single' = eine Option wählbar, 'multi' = mehrere, 'number' = Zahl
// ordinal: Optionen haben einen Wert (score) → Durchschnitt pro Phase möglich
// intensity: zusätzlich Intensität 1–5 erfassen

export const INTENSITY_LABELS = ['', 'sehr leicht', 'leicht', 'mittel', 'stark', 'sehr stark'];

export const BUILTIN = [
  {
    id: 'period', name: 'Blutung', icon: '🩸', type: 'single', fixed: true,
    desc: 'Grundlage für alle Berechnungen. Schmierblutung zählt nicht als Periodenbeginn.',
    options: [
      { id: 'spotting', label: 'Schmierblutung' },
      { id: 'light', label: 'leicht' },
      { id: 'medium', label: 'mittel' },
      { id: 'heavy', label: 'stark' },
    ],
  },
  {
    id: 'pain', name: 'Schmerzen', icon: '⚡', type: 'multi', intensity: true,
    options: [
      { id: 'cramps', label: 'Unterleibskrämpfe' },
      { id: 'headache', label: 'Kopfschmerzen' },
      { id: 'migraine', label: 'Migräne' },
      { id: 'back', label: 'Rückenschmerzen' },
      { id: 'breasts', label: 'Brustspannen' },
      { id: 'ovulation', label: 'Mittelschmerz' },
      { id: 'joints', label: 'Gliederschmerzen' },
    ],
  },
  {
    id: 'energy', name: 'Energie', icon: '🔋', type: 'single', ordinal: true,
    options: [
      { id: 'exhausted', label: 'erschöpft', score: 1 },
      { id: 'tired', label: 'müde', score: 2 },
      { id: 'normal', label: 'normal', score: 3 },
      { id: 'fit', label: 'fit', score: 4 },
      { id: 'energetic', label: 'voller Energie', score: 5 },
    ],
  },
  {
    id: 'mood', name: 'Stimmung', icon: '💭', type: 'multi',
    options: [
      { id: 'happy', label: 'glücklich' },
      { id: 'calm', label: 'ausgeglichen' },
      { id: 'irritable', label: 'gereizt' },
      { id: 'sad', label: 'traurig' },
      { id: 'anxious', label: 'ängstlich' },
      { id: 'swings', label: 'Stimmungsschwankungen' },
      { id: 'sensitive', label: 'dünnhäutig' },
      { id: 'stressed', label: 'gestresst' },
    ],
  },
  {
    id: 'sleep', name: 'Schlaf', icon: '🌙', type: 'single', ordinal: true,
    options: [
      { id: 'bad', label: 'schlecht', score: 1 },
      { id: 'restless', label: 'unruhig', score: 2 },
      { id: 'good', label: 'gut', score: 3 },
      { id: 'great', label: 'sehr gut', score: 4 },
    ],
  },
  {
    id: 'skin', name: 'Haut', icon: '✨', type: 'multi',
    options: [
      { id: 'clear', label: 'rein' },
      { id: 'blemishes', label: 'unrein' },
      { id: 'oily', label: 'fettig' },
      { id: 'dry', label: 'trocken' },
    ],
  },
  {
    id: 'digestion', name: 'Verdauung', icon: '🌀', type: 'multi',
    options: [
      { id: 'good', label: 'gut' },
      { id: 'bloated', label: 'Blähbauch' },
      { id: 'nausea', label: 'Übelkeit' },
      { id: 'constipation', label: 'Verstopfung' },
      { id: 'diarrhea', label: 'Durchfall' },
    ],
  },
  {
    id: 'cravings', name: 'Appetit', icon: '🍫', type: 'multi',
    options: [
      { id: 'sweet', label: 'Lust auf Süßes' },
      { id: 'salty', label: 'Lust auf Salziges' },
      { id: 'hungry', label: 'großer Hunger' },
      { id: 'noappetite', label: 'wenig Appetit' },
    ],
  },
  {
    id: 'discharge', name: 'Zervixschleim', icon: '💧', type: 'single',
    desc: 'Spinnbarer, klarer Schleim (wie rohes Eiweiß) ist ein typisches Zeichen der fruchtbaren Tage.',
    options: [
      { id: 'dry', label: 'trocken / nichts' },
      { id: 'sticky', label: 'klebrig' },
      { id: 'creamy', label: 'cremig' },
      { id: 'eggwhite', label: 'spinnbar (wie Eiweiß)' },
      { id: 'watery', label: 'wässrig' },
    ],
  },
  {
    id: 'libido', name: 'Lust', icon: '💗', type: 'single', ordinal: true,
    options: [
      { id: 'low', label: 'wenig', score: 1 },
      { id: 'medium', label: 'mittel', score: 2 },
      { id: 'high', label: 'viel', score: 3 },
    ],
  },
  {
    id: 'sex', name: 'Sex', icon: '❤️', type: 'multi',
    options: [
      { id: 'protected', label: 'geschützt' },
      { id: 'unprotected', label: 'ungeschützt' },
    ],
  },
  {
    id: 'meds', name: 'Medikamente', icon: '💊', type: 'multi',
    options: [
      { id: 'painkiller', label: 'Schmerzmittel' },
      { id: 'hormones', label: 'Pille / Hormone' },
      { id: 'supplements', label: 'Nahrungsergänzung' },
      { id: 'other', label: 'Sonstige' },
    ],
  },
  {
    id: 'temp', name: 'Basaltemperatur', icon: '🌡️', type: 'number', hidden: true,
    unit: '°C', min: 35, max: 38.5, step: 0.01,
    desc: 'Morgens direkt nach dem Aufwachen messen, immer zur gleichen Zeit. Ein anhaltender Anstieg zeigt an, dass der Eisprung stattgefunden hat.',
    options: [],
  },
];

export function defaultCategories() {
  return BUILTIN.map((c) => ({ ...structuredClone(c), builtin: true }));
}

/** Ergänzt neue Standard-Kategorien/-Optionen aus späteren App-Versionen,
 *  ohne die Anpassungen der Nutzerin zu überschreiben. */
export function mergeCategories(saved) {
  if (!Array.isArray(saved)) return defaultCategories();
  const out = saved.map((c) => ({ ...c, options: [...(c.options || [])] }));
  for (const def of BUILTIN) {
    const existing = out.find((c) => c.id === def.id);
    if (!existing) {
      out.push({ ...structuredClone(def), builtin: true });
      continue;
    }
    for (const o of def.options) {
      if (!existing.options.some((x) => x.id === o.id)) existing.options.push({ ...o });
    }
  }
  return out;
}

export function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
