// 印刷ページ（仕様書 v2 9章）：問題プリント／解答プリント／記録用紙（A4縦）
// アプリと同じ問題データ・図から生成するので、問題を直せばプリントも一致する。
import { h, esc } from '../ui.js';
import { formatEquation } from '../core/answer.js';
import { COURSES } from '../core/questions.js';
import { thresholds } from '../core/titles.js';
import { renderDiagram } from '../diagrams.js';
import { TITLE_TIMES, CHALLENGE_TIME_FACTOR, APP_TITLE } from '../config.js';

const KINDS = { problems: '問題プリント', answers: '解答プリント', record: '記録用紙' };

function problemSheets(app, withAnswer) {
  return [1, 2].map(half => {
    const qs = app.bank.main.filter(q => q.half === half);
    const items = qs.map(q => `
      <div class="pr-item">
        <p class="pr-text"><b>No.${q.no}</b> ${esc(q.text)}</p>
        <div class="pr-dg">${renderDiagram(q.diagram, q.label)}</div>
        ${withAnswer
          ? `<p class="pr-ans">${esc(formatEquation(q))}</p><p class="pr-trap">${esc(q.trap)}</p>`
          : '<p class="pr-blank"><span>はじめ</span><i></i><span>＝</span><span>あと</span><i></i></p>'}
      </div>`).join('');
    return `<section class="sheet">
      <header class="sh-head">
        <span class="sh-title">${esc(APP_TITLE)}　${half === 1 ? '前半（No.1〜10）' : '後半（No.11〜20）'}${withAnswer ? '　解答' : ''}</span>
        <span class="sh-name">番号＿＿＿　名前＿＿＿＿＿＿＿＿</span>
      </header>
      ${withAnswer ? '' : '<p class="sh-note">残るエネルギーだけで式を書こう。はじめの量は添字 0（½mv₀²、mgh₀、½kx₀²）、あとの量は添字なし（½mv²、mgh、½kx²）。基準面より下は −mgh。摩擦などで使えないときは「×」。</p>'}
      <div class="pr-grid">${items}</div>
    </section>`;
  }).join('');
}

function recordSheet(course) {
  const n = COURSES[course].n;
  const factor = course === 'basic' ? CHALLENGE_TIME_FACTOR : 1;
  const th = thresholds(n, TITLE_TIMES, factor);
  const W = 680, H = 410, m = { l: 46, r: 120, t: 26, b: 28 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const cols = 25;
  const yMax = Math.ceil((th[1] * 1.15) / 10) * 10;
  const x = i => m.l + (iw * (i - 0.5)) / cols;
  const y = v => m.t + ih - (ih * v) / yMax;
  let svg = `<svg class="rs-graph" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  const step = yMax <= 150 ? 10 : 20;
  for (let v = 0; v <= yMax; v += step) {
    svg += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(v)}" y2="${y(v)}" class="rs-grid"/>`;
    svg += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end" class="rs-tick">${v}</text>`;
  }
  for (let i = 1; i <= cols; i++) {
    svg += `<line x1="${x(i)}" x2="${x(i)}" y1="${m.t}" y2="${m.t + ih}" class="rs-grid rs-vgrid"/>`;
    svg += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="rs-tick">${i}</text>`;
  }
  // 時間区分の帯（級名は空欄。獲得したら書き込む）
  for (let k = 1; k < th.length; k++) {
    if (th[k] > yMax) continue;
    svg += `<line x1="${m.l}" x2="${m.l + iw}" y1="${y(th[k])}" y2="${y(th[k])}" class="rs-band"/>`;
    svg += `<text x="${m.l + iw + 6}" y="${y(th[k]) + 4}" class="rs-band-lbl">${th[k]}秒 ＿＿＿＿級</text>`;
  }
  svg += `<text x="${m.l}" y="12" text-anchor="middle" class="rs-tick">（秒）</text>`;
  svg += `<text x="${m.l + iw}" y="${H - 10}" text-anchor="start" class="rs-tick"> 回</text></svg>`;

  const rows = Array.from({ length: 25 }, (_, i) => `<tr><td>${i + 1}</td><td></td><td></td><td></td><td></td></tr>`).join('');
  return `<section class="sheet">
    <header class="sh-head">
      <span class="sh-title">記録用紙　${esc(COURSES[course].label)}（${esc(COURSES[course].detail)}）</span>
      <span class="sh-name">番号＿＿＿　名前＿＿＿＿＿＿＿＿</span>
    </header>
    <p class="sh-note">クリアタイムを点で打ち、線でつなごう。横線は称号の区切り。新しい称号を取ったら、級名を書き込もう（完走は「導線中の電子級」）。</p>
    ${svg}
    <table class="rs-table"><thead><tr><th>回</th><th>日付</th><th>タイム（秒）</th><th>ミス</th><th>称号・気づいたこと</th></tr></thead><tbody>${rows}</tbody></table>
  </section>`;
}

export function renderPrint(root, app) {
  let kind = 'problems';
  let course = 'first';

  const draw = () => {
    root.innerHTML = '';
    const body = kind === 'record' ? recordSheet(course) : problemSheets(app, kind === 'answers');
    const el = h(`<div class="print">
      <div class="print-ctrl no-print">
        <button class="icon-btn" data-home aria-label="ホームへ">←</button>
        <div class="seg">${Object.entries(KINDS).map(([k, v]) => `<button class="${k === kind ? 'on' : ''}" data-kind="${k}">${v}</button>`).join('')}</div>
        ${kind === 'record' ? `<div class="seg">${['first', 'second', 'full', 'basic'].map(c => `<button class="${c === course ? 'on' : ''}" data-course="${c}">${COURSES[c].label}</button>`).join('')}</div>` : ''}
        <button class="btn btn-primary" data-print>印刷する</button>
        <p class="muted small">A4縦。${kind === 'record' ? '' : '前半・後半で2ページ（両面印刷で表裏）。'}ブラウザの印刷設定で「背景のグラフィック」をオンにすると図がきれいに出ます。</p>
      </div>
      <div class="sheets">${body}</div>
    </div>`);
    root.appendChild(el);
  };

  const onClick = e => {
    const t = e.target;
    if (t.closest('[data-home]')) { app.go('home'); return; }
    const k = t.closest('[data-kind]');
    if (k) { kind = k.dataset.kind; draw(); return; }
    const c = t.closest('[data-course]');
    if (c) { course = c.dataset.course; draw(); return; }
    if (t.closest('[data-print]')) window.print();
  };
  root.addEventListener('click', onClick);
  draw();
  return () => root.removeEventListener('click', onClick);
}
