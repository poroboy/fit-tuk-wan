// Tiny SVG charts
import { fmt } from './ui.js';

export function lineChart(series, { height = 170, xLabels = [], unit = '', yPad = 0.5, decimals = 1 } = {}) {
  const W = 320, H = height, L = 34, R = 10, T = 12, B = 22;
  const all = series.flatMap(s => s.points);
  if (!all.length) return '';
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  const pad = Math.max(yPad, (y1 - y0) * 0.15);
  y0 -= pad; y1 += pad;
  const sx = x => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let i = 0; i <= 3; i++) {
    const v = y0 + ((y1 - y0) * i) / 3;
    const y = sy(v);
    s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    s += `<text x="${L - 6}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmt(v, decimals)}</text>`;
  }
  for (const xl of xLabels) {
    s += `<text x="${sx(xl.x).toFixed(1)}" y="${H - 6}" text-anchor="middle">${xl.label}</text>`;
  }
  for (const se of series) {
    if (!se.points.length) continue;
    const d = se.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('');
    s += `<path class="line draw" pathLength="1" d="${d}" stroke="${se.color}" ${se.dashed ? 'stroke-dasharray="4 4" style="animation:none;stroke-dashoffset:0;opacity:.85"' : ''} stroke-width="${se.width || 2.5}"/>`;
    if (se.dots) for (const p of se.points) s += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" fill="${se.color}"/>`;
    const lp = se.points[se.points.length - 1];
    if (se.label) s += `<circle cx="${sx(lp.x).toFixed(1)}" cy="${sy(lp.y).toFixed(1)}" r="4.5" fill="var(--surface)" stroke="${se.color}" stroke-width="2.5"/>`;
  }
  return s + '</svg>';
}

export function barChart(bars, { height = 150, color = 'var(--brand)', unit = '' } = {}) {
  const W = 320, H = height, L = 6, R = 6, T = 18, B = 22;
  const max = Math.max(1, ...bars.map(b => b.value));
  const bw = (W - L - R) / Math.max(1, bars.length);
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  bars.forEach((b, i) => {
    const h = (b.value / max) * (H - T - B);
    const x = L + i * bw + bw * 0.18, w = bw * 0.64;
    const y = H - B - h;
    s += `<rect class="barr" style="animation-delay:${i * 40}ms" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(h, 1.5).toFixed(1)}" rx="5" fill="${b.highlight ? color : `color-mix(in srgb, ${color} 45%, var(--surface-2))`}"/>`;
    if (b.value > 0) s += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle">${fmt(b.value)}${unit}</text>`;
    s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${b.label}</text>`;
  });
  return s + '</svg>';
}

export function sparkline(values, { color = 'var(--brand)', w = 110, h = 36 } = {}) {
  if (values.length < 2) return '';
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)} ${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join('');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
