// 記録の推移グラフ（SVG・依存ライブラリなし）
// 縦軸＝クリアタイム（下へ行くほど速い）。称号の時間区分を横線で示す（未獲得の級名は伏せる）。
import { TITLE_TIMES } from './config.js';
import { TITLES, thresholds } from './core/titles.js';
import { collection, loadRecords, timeFactor } from './storage.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

/**
 * @param {HTMLElement} host
 * @param {Array} records そのコースの記録（古い順）
 * @param {string} course
 */
export function renderChart(host, records, course, { last = 30 } = {}) {
  host.innerHTML = '';
  host.classList.add('chart');
  const data = records.slice(-last);
  if (data.length === 0) {
    host.innerHTML = '<p class="chart-empty">まだ記録がありません。本番に挑戦すると、ここにタイムの推移が表示されます。</p>';
    return;
  }
  const offset = records.length - data.length;
  const n = data[0].n;
  const W = Math.max(300, Math.round(host.clientWidth || 640));
  const H = W < 520 ? 240 : 280;
  const m = { l: 44, r: W < 520 ? 92 : 120, t: 16, b: 30 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const th = thresholds(n, TITLE_TIMES, timeFactor(course));
  const maxT = Math.max(...data.map(d => d.timeSec));
  const yMax = Math.ceil(Math.max(maxT * 1.08, th[9] * 1.5) / 10) * 10;
  const yMin = 0;
  const x = i => m.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = v => m.t + ih - (ih * (Math.min(v, yMax) - yMin)) / (yMax - yMin);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart-svg', 'aria-label': 'クリアタイムの推移' }, host);

  // 目盛（秒）
  const step = yMax <= 60 ? 10 : yMax <= 150 ? 30 : 60;
  for (let v = 0; v <= yMax; v += step) {
    el('line', { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v), class: 'chart-grid' }, svg);
    const t = el('text', { x: m.l - 8, y: y(v) + 4, class: 'chart-tick', 'text-anchor': 'end' }, svg);
    t.textContent = `${v}s`;
  }

  // 称号の区分線（区分内に入るものだけ）
  const coll = collection(loadRecords());
  for (let k = 1; k < th.length; k++) {
    if (th[k] > yMax) continue;
    const yy = y(th[k]);
    el('line', { x1: m.l, x2: m.l + iw, y1: yy, y2: yy, class: 'chart-band' }, svg);
    const lbl = el('text', { x: m.l + iw + 4, y: yy + 4, class: 'chart-band-lbl' }, svg);
    lbl.textContent = coll[k].plain.size ? TITLES[k].name.replace(/級$/, '') : '？？？';
  }

  const xEvery = Math.ceil(data.length / 10);
  data.forEach((d, i) => {
    if (i % xEvery !== 0 && i !== data.length - 1) return;
    const t = el('text', { x: x(i), y: H - 10, class: 'chart-tick', 'text-anchor': 'middle' }, svg);
    t.textContent = `${offset + i + 1}`;
  });

  const path = data.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.timeSec).toFixed(1)}`).join(' ');
  el('path', { d: path, class: 'chart-line' }, svg);

  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  host.appendChild(tip);

  data.forEach((r, i) => {
    const cx = x(i), cy = y(r.timeSec);
    const isLast = i === data.length - 1;
    el('circle', { cx, cy, r: isLast ? 5.5 : 4, class: `chart-dot${r.star ? ' is-star' : ''}` }, svg);
    const hit = el('circle', { cx, cy, r: 14, class: 'chart-hit', tabindex: 0 }, svg);
    const show = () => {
      tip.innerHTML = `<b>${offset + i + 1}回目</b>（${r.date}）<br>${r.timeSec}秒・ミス${r.misses}<br>${TITLES[r.level].name}${r.star ? '★' : ''}`;
      tip.hidden = false;
      const box = host.getBoundingClientRect();
      tip.style.left = `${Math.min(Math.max((cx / W) * box.width, 70), box.width - 70)}px`;
      tip.style.top = `${(cy / H) * box.height}px`;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; });
    hit.addEventListener('blur', () => { tip.hidden = true; });
  });

  const lr = data[data.length - 1];
  const ly = y(lr.timeSec);
  const lt = el('text', { x: x(data.length - 1), y: ly - 12 < 12 ? ly + 22 : ly - 12, class: 'chart-last-lbl', 'text-anchor': data.length > 1 ? 'end' : 'middle' }, svg);
  lt.textContent = `${lr.timeSec}s`;
}
