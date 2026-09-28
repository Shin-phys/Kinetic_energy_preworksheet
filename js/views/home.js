// ホーム画面：コース選択と3つのモード（記録するか・しないかを色と言葉で区別）
import { h, esc, infoDialog } from '../ui.js';
import { loadRecords, bestOf, challengeUnlocked } from '../storage.js';
import { COURSES } from '../core/questions.js';
import { TITLES, titleLabel } from '../core/titles.js';
import { CHALLENGE_UNLOCK_LEVEL } from '../config.js';
import { unlockAudio } from '../sound.js';
import { HELP_HTML } from './help.js';

export function renderHome(root, app) {
  const s = app.settings;
  const course = s.course;
  const records = loadRecords();
  const best = bestOf(records, course);
  const bestBasic = bestOf(records, 'basic');
  const unlocked = challengeUnlocked(records, app.challengeForced);

  const courseBtns = ['first', 'second', 'full'].map(c => `
    <button role="tab" class="${c === course ? 'on' : ''}" data-course="${c}" ${app.locked && c !== course ? 'disabled' : ''}>
      <b>${COURSES[c].label}</b><small>${COURSES[c].detail}</small>
    </button>`).join('');

  const el = h(`<div class="home">
    <header class="home-head">
      <h1>${esc(app.title)}</h1>
      <p class="lead">状況を読んで、<b>はじめ</b>と<b>あと</b>に残るエネルギーを選ぼう。</p>
    </header>

    <div class="seg course-seg" role="tablist" aria-label="コース">${courseBtns}</div>

    <div class="home-modes">
      <button class="mode-card mode-main" data-mode="main">
        <span class="rec-badge"><i></i>記録されます</span>
        <span class="mode-name">本番</span>
        <span class="mode-desc">タイムアタック：${COURSES[course].n}問すべて正解するまで</span>
        <span class="mode-meta">${best ? `自己ベスト ${best.timeSec}秒・${esc(titleLabel(best.level, best.star))}` : 'まだ記録がありません'}</span>
      </button>
      <button class="mode-card mode-practice" data-mode="practice">
        <span class="rec-badge off">記録なし</span>
        <span class="mode-name">練習</span>
        <span class="mode-desc">時間無制限：1問ずつ解説つき</span>
        <span class="mode-meta">${COURSES[course].detail}を一周</span>
      </button>
    </div>

    <div class="home-challenge">
      <button class="mode-card mode-challenge" data-mode="challenge" ${unlocked ? '' : 'disabled'}>
        <span class="rec-badge"><i></i>記録されます（別枠）</span>
        <span class="mode-name">腕試し・基礎</span>
        <span class="mode-desc">初めて見る問題からランダムに10問</span>
        <span class="mode-meta">${unlocked
          ? (bestBasic ? `自己ベスト ${bestBasic.timeSec}秒・${esc(titleLabel(bestBasic.level, bestBasic.star))}` : '挑戦してみよう')
          : `本番で「${esc(TITLES[CHALLENGE_UNLOCK_LEVEL].name)}」以上を取ると解放`}</span>
      </button>
      <div class="mode-card mode-soon" aria-disabled="true">
        <span class="mode-name">腕試し・難関</span>
        <span class="mode-meta">準備中</span>
      </div>
    </div>

    <nav class="home-nav">
      <button class="btn" data-go="zukan">称号図鑑</button>
      <button class="btn" data-go="history">記録とグラフ</button>
      <button class="btn" data-go="print">印刷</button>
      <button class="btn" data-go="settings">設定</button>
      <button class="btn" data-help>使い方</button>
    </nav>
    ${s.student ? `<p class="home-student muted">出席番号：${esc(s.student)}</p>` : ''}
  </div>`);

  const start = mode => {
    unlockAudio();
    if (mode === 'challenge') app.go('play', { mode: 'challenge', course: 'basic' });
    else app.go('play', { mode, course });
  };

  el.addEventListener('click', e => {
    const c = e.target.closest('[data-course]');
    if (c && !c.disabled) { app.setSettings({ course: c.dataset.course }); app.go('home'); return; }
    const m = e.target.closest('[data-mode]');
    if (m && !m.disabled) { start(m.dataset.mode); return; }
    const g = e.target.closest('[data-go]');
    if (g) { app.go(g.dataset.go); return; }
    if (e.target.closest('[data-help]')) infoDialog(HELP_HTML, { title: '使い方' });
  });

  const onKey = e => {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'Enter') { e.preventDefault(); start('main'); }
    if (e.key === 'p' || e.key === 'P') start('practice');
  };
  document.addEventListener('keydown', onKey);
  root.appendChild(el);
  return () => document.removeEventListener('keydown', onKey);
}
