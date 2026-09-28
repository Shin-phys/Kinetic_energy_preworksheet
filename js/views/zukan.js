// 称号図鑑（仕様書 v2 7.3）：未獲得は名前を伏せ、時間区分だけを小さく表示
import { h, esc } from '../ui.js';
import { TITLES, thresholds } from '../core/titles.js';
import { loadRecords, collection } from '../storage.js';
import { TITLE_TIMES } from '../config.js';

const MARK = { first: '前', second: '後', full: '通', basic: '腕' };

export function renderZukan(root, app) {
  const coll = collection(loadRecords());
  const th10 = thresholds(10, TITLE_TIMES);
  const th20 = thresholds(20, TITLE_TIMES);
  const got = coll.reduce((a, c) => a + (c.plain.size ? 1 : 0) + (c.star.size ? 1 : 0), 0);
  const range = k => (k === 0 ? '完走' : `10問 ${th10[k]}秒以内／20問 ${th20[k]}秒以内`);
  const marks = set => Object.entries(MARK).map(([c, m]) => `<i class="${set.has(c) ? 'on' : ''}" title="${m}">${m}</i>`).join('');

  const cell = (k, star) => {
    const set = star ? coll[k].star : coll[k].plain;
    const t = TITLES[k];
    if (!set.size) {
      return `<div class="zk-cell locked ${star ? 'is-star' : ''}">
        <p class="zk-name">？？？級${star ? '★' : ''}</p>
        <p class="zk-range">${range(k)}${star ? '・ノーミス' : ''}</p>
      </div>`;
    }
    return `<div class="zk-cell ${star ? 'is-star' : ''}">
      <p class="zk-name">${esc(t.name)}${star ? '★' : ''}</p>
      <p class="zk-speed">${esc(t.speed)}</p>
      <p class="zk-trivia">${esc(t.trivia)}</p>
      <p class="zk-marks">${marks(set)}</p>
      <p class="zk-range">${range(k)}</p>
    </div>`;
  };

  const rows = TITLES.map((_, k) => TITLES.length - 1 - k) // 速い級を上に
    .map(k => `<div class="zk-row"><span class="zk-lv">${k}</span>${cell(k, false)}${cell(k, true)}</div>`).join('');

  const el = h(`<div class="zukan">
    <header class="sub-head">
      <button class="icon-btn" data-home aria-label="ホームへ">←</button>
      <h1>称号図鑑</h1>
      <span class="zk-count">${got} / ${TITLES.length * 2}</span>
    </header>
    <p class="note">クリアタイムで称号が決まります。ノーミスなら ★。まだ取っていない称号は、名前が「？？？」のまま。<br>
      印：<i class="mk">前</i>前半　<i class="mk">後</i>後半　<i class="mk">通</i>通し　<i class="mk">腕</i>腕試し（どのコースで取ったか）</p>
    <div class="zk-head"><span></span><span>ふつう</span><span>ノーミス ★</span></div>
    <div class="zk-grid">${rows}</div>
  </div>`);
  root.appendChild(el);
  el.querySelector('[data-home]').addEventListener('click', () => app.go('home'));
  const onKey = e => { if (e.key === 'Escape') app.go('home'); };
  document.addEventListener('keydown', onKey);
  return () => document.removeEventListener('keydown', onKey);
}
