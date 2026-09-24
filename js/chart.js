// 記録の推移グラフ（SVG・依存ライブラリなし）
// rule=time: 縦軸=正答数（0〜問題数、卒業ラインつき）/ rule=complete: 縦軸=所要時間（秒、小さいほど良い）
import { GRADUATION } from './config.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

function niceMax(v) {
  if (v <= 0) return 60;
  const step = v <= 60 ? 15 : v <= 180 ? 30 : 60;
  return Math.ceil((v * 1.1) / step) * step;
}

/**
 * @param {HTMLElement} host
 * @param {Array} records 表示する記録（古い順）
 * @param {'time'|'complete'} rule
 * @param {{total?:number, last?:number}} opt
 */
export function renderChart(host, records, rule, { total = 20, last = 30 } = {}) {
  host.innerHTML = '';
  host.classList.add('chart');
  const data = records.slice(-last);
  if (data.length === 0) {
    host.innerHTML = '<p class="chart-empty">まだ記録がありません。本番モードに挑戦すると、ここに推移が表示されます。</p>';
    return;
  }
  const offset = records.length - data.length; // 通し番号
  // 実際の表示幅で描く（文字が縮まないように）
  const W = Math.max(300, Math.round(host.clientWidth || 640));
  const H = W < 520 ? 220 : 260;
  const m = { l: 44, r: 16, t: 20, b: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const yMax = rule === 'time' ? total : niceMax(Math.max(...data.map(d => d.timeSec)));
  const yStep = rule === 'time' ? 5 : yMax / 4;
  const val = d => (rule === 'time' ? d.correct : d.timeSec);
  const x = i => m.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = v => m.t + ih - (ih * v) / yMax;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chart-svg',
    'aria-label': rule === 'time' ? '正答数の推移' : '全問正答までの時間の推移' }, host);

  // グリッドと目盛
  for (let v = 0; v <= yMax + 1e-9; v += yStep) {
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'chart-grid' }, svg);
    const t = el('text', { x: m.l - 8, y: y(v) + 4, class: 'chart-tick', 'text-anchor': 'end' }, svg);
    t.textContent = rule === 'time' ? v : `${Math.round(v)}s`;
  }
  const xEvery = Math.ceil(data.length / 10);
  data.forEach((d, i) => {
    if (i % xEvery !== 0 && i !== data.length - 1) return;
    const t = el('text', { x: x(i), y: H - 12, class: 'chart-tick', 'text-anchor': 'middle' }, svg);
    t.textContent = `${offset + i + 1}`;
  });

  // 卒業ライン
  if (rule === 'time') {
    const gy = y(GRADUATION.minCorrect);
    el('line', { x1: m.l, x2: W - m.r, y1: gy, y2: gy, class: 'chart-goal' }, svg);
    const gt = el('text', { x: m.l + 6, y: gy - 6, class: 'chart-goal-lbl', 'text-anchor': 'start' }, svg);
    gt.textContent = `卒業ライン ${GRADUATION.minCorrect}問`;
  }

  // 折れ線と点
  const d = data.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(val(r)).toFixed(1)}`).join(' ');
  el('path', { d, class: 'chart-line' }, svg);
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;
  host.appendChild(tip);

  data.forEach((r, i) => {
    const cx = x(i), cy = y(val(r));
    const isLast = i === data.length - 1;
    el('circle', { cx, cy, r: isLast ? 5.5 : 4, class: isLast ? 'chart-dot chart-dot-last' : 'chart-dot' }, svg);
    const hit = el('circle', { cx, cy, r: 14, class: 'chart-hit', tabindex: 0 }, svg);
    const show = () => {
      tip.innerHTML = `<b>${offset + i + 1}回目</b>（${r.date}）<br>`
        + (rule === 'time' ? `正答 ${r.correct} / ${r.total}` : `${r.timeSec} 秒（誤答 ${r.misses}回）`)
        + `<br>V${r.version}${r.wrong.length ? `・誤答 ${r.wrong.join(' ')}` : ''}`;
      tip.hidden = false;
      const box = host.getBoundingClientRect();
      const px = (cx / W) * box.width, py = (cy / H) * box.height;
      tip.style.left = `${Math.min(Math.max(px, 70), box.width - 70)}px`;
      tip.style.top = `${py}px`;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', () => { tip.hidden = true; });
    hit.addEventListener('blur', () => { tip.hidden = true; });
  });

  // 最新値の直接ラベル
  const lr = data[data.length - 1];
  const ly = y(val(lr));
  const lt = el('text', { x: x(data.length - 1), y: ly - 12 < 12 ? ly + 22 : ly - 12, class: 'chart-last-lbl', 'text-anchor': data.length > 1 ? 'end' : 'middle' }, svg);
  lt.textContent = rule === 'time' ? `${lr.correct}問` : `${lr.timeSec}s`;
}
