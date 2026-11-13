// Einfache SVG-Diagramme ohne externe Bibliotheken.

import { esc } from './ui.js';

const fmtNum = (v, d = 0) => (v === null || v === undefined ? '' : Number(v).toFixed(d).replace('.', ','));

/**
 * Säulendiagramm.
 * items: [{ label, value, color?, title?, muted? }]
 */
export function barChart({
  items, height = 170, max, min = 0, avg = null, avgLabel = 'Ø', band = null,
  labelEvery = 1, valueLabels = true, decimals = 0, unit = '', yTicks = null,
}) {
  const W = 340, H = height;
  const pad = { l: 30, r: avg !== null && avg !== undefined ? 40 : 8, t: 18, b: 24 };
  const n = Math.max(items.length, 1);
  const iw = (W - pad.l - pad.r) / n;
  const values = items.map((i) => i.value ?? 0);
  const top = max ?? Math.max(1, ...values, avg ?? 0, band ? band[1] : 0);
  const ih = H - pad.t - pad.b;
  const y = (v) => pad.t + ih - ((v - min) / (top - min)) * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;

  if (band) {
    svg += `<rect x="${pad.l}" y="${y(Math.min(band[1], top))}" width="${W - pad.l - pad.r}" height="${Math.max(0, y(band[0]) - y(Math.min(band[1], top)))}" class="band"/>`;
  }
  const ticks = yTicks || [min, Math.round(((min + top) / 2) * 10) / 10, top];
  for (const t of ticks) {
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/>`;
    svg += `<text x="${pad.l - 4}" y="${y(t) + 3}" class="ax" text-anchor="end">${fmtNum(t, Number.isInteger(t) ? 0 : 1)}</text>`;
  }
  items.forEach((it, i) => {
    const v = it.value ?? 0;
    const bw = Math.max(2, iw * 0.68);
    const x = pad.l + i * iw + (iw - bw) / 2;
    const h = Math.max(v > min ? 1.5 : 0, y(min) - y(v));
    const fill = it.color || 'var(--primary)';
    svg += `<rect x="${x}" y="${y(min) - h}" width="${bw}" height="${h}" rx="${Math.min(4, bw / 3)}" fill="${fill}" opacity="${it.muted ? 0.35 : 1}"><title>${esc(it.title || `${it.label}: ${fmtNum(v, decimals)}${unit}`)}</title></rect>`;
    if (valueLabels && it.value !== null && it.value !== undefined && n <= 16) {
      svg += `<text x="${x + bw / 2}" y="${y(min) - h - 4}" class="val" text-anchor="middle">${fmtNum(v, decimals)}</text>`;
    }
    if (i % labelEvery === 0 || i === n - 1) {
      svg += `<text x="${x + bw / 2}" y="${H - 8}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
    }
  });
  if (avg !== null && avg !== undefined) {
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(avg)}" y2="${y(avg)}" class="avg"/>`;
    svg += `<text x="${W - pad.r + 4}" y="${y(avg) + 3}" class="avg-label" text-anchor="start">${esc(avgLabel)} ${fmtNum(avg, 1)}</text>`;
  }
  return svg + '</svg>';
}

/** Liniendiagramm (z. B. Basaltemperatur). points: [{x, y, label}] */
export function lineChart({ points, xMax, height = 180, coverline = null, markX = null, decimals = 2 }) {
  const W = 340, H = height;
  const pad = { l: 36, r: 10, t: 14, b: 24 };
  const ys = points.map((p) => p.y);
  const minY = Math.floor((Math.min(...ys, coverline ?? Infinity) - 0.1) * 10) / 10;
  const maxY = Math.ceil((Math.max(...ys, coverline ?? -Infinity) + 0.1) * 10) / 10;
  const xm = Math.max(xMax, ...points.map((p) => p.x));
  const X = (x) => pad.l + ((x - 1) / Math.max(1, xm - 1)) * (W - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - minY) / (maxY - minY || 1)) * (H - pad.t - pad.b);
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const v = minY + ((maxY - minY) * i) / steps;
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`;
    svg += `<text x="${pad.l - 4}" y="${Y(v) + 3}" class="ax" text-anchor="end">${fmtNum(v, 1)}</text>`;
  }
  for (let d = 1; d <= xm; d += xm > 20 ? 5 : 2) {
    svg += `<text x="${X(d)}" y="${H - 8}" class="ax" text-anchor="middle">${d}</text>`;
  }
  if (coverline !== null) {
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(coverline)}" y2="${Y(coverline)}" class="avg"/>`;
    svg += `<text x="${W - pad.r}" y="${Y(coverline) - 4}" class="avg-label" text-anchor="end">Hilfslinie ${fmtNum(coverline, 2)}</text>`;
  }
  if (markX !== null) {
    svg += `<line x1="${X(markX)}" x2="${X(markX)}" y1="${pad.t}" y2="${H - pad.b}" class="mark"/>`;
  }
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  svg += `<path d="${path}" class="line"/>`;
  for (const p of points) {
    svg += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="3" class="dot"><title>${esc(p.label || '')}: ${fmtNum(p.y, decimals)} °C</title></circle>`;
  }
  return svg + '</svg>';
}

/** Zyklus-Ring: ein Punkt pro Zyklustag, eingefärbt nach Phase. */
export function cycleRing({ length, day, phaseFor, size = 260 }) {
  const L = Math.min(Math.max(length, day, 1), 60);
  const c = size / 2, r = size / 2 - 16;
  let svg = `<svg viewBox="0 0 ${size} ${size}" class="ring" aria-hidden="true">`;
  svg += `<circle cx="${c}" cy="${c}" r="${r}" class="ring-track"/>`;
  const dotR = Math.max(3, Math.min(7, (Math.PI * 2 * r) / L / 2.6));
  for (let d = 1; d <= L; d++) {
    const a = ((d - 1) / L) * Math.PI * 2 - Math.PI / 2;
    const x = c + r * Math.cos(a), y = c + r * Math.sin(a);
    const ph = phaseFor(d);
    const isToday = d === day;
    const past = d < day;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${isToday ? dotR + 4 : dotR}" fill="var(--c-${ph})" opacity="${past ? 0.45 : 1}" ${isToday ? 'class="ring-today"' : ''}/>`;
  }
  return svg + '</svg>';
}
