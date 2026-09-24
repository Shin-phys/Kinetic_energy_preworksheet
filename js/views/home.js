// ホーム画面
import { h, esc, infoDialog } from '../ui.js';
import { loadRecords, graduationStatus, RULE_LABEL } from '../storage.js';
import { GRADUATION } from '../config.js';
import { unlockAudio } from '../sound.js';
import { HELP_HTML } from './help.js';

export function renderHome(root, app) {
  const s = app.settings;
  const records = loadRecords();
  const grad = graduationStatus(records);
  const version = app.currentVersion();
  const theme = app.bank.versions.find(v => v.version === version)?.theme ?? '';
  const ruleText = s.rule === 'time'
    ? `${s.limitSec}秒で何問正解できるか`
    : '全20問に正解するまでのタイム';
  const last = records[records.length - 1];

  const gradHtml = grad.graduated
    ? `<div class="grad grad-done">★ 卒業済み（${esc(grad.graduatedAt)}）— 数値入りの文章題へ進もう</div>`
    : `<div class="grad">卒業まで：${GRADUATION.limitSec}秒で${GRADUATION.minCorrect}問以上を<b>あと${grad.need}回</b>連続
        <span class="grad-dots">${Array.from({ length: GRADUATION.streak }, (_, i) => `<i class="${i < grad.currentStreak ? 'on' : ''}"></i>`).join('')}</span></div>`;

  const el = h(`<div class="home">
    <header class="home-head">
      <h1>${esc(app.title)}</h1>
      <p class="lead">状況を見て、<b>はじめ</b>と<b>あと</b>に残るエネルギーを並べよう。</p>
    </header>

    <div class="home-modes">
      <button class="mode-card mode-exam" data-mode="exam">
        <span class="mode-name">本番</span>
        <span class="mode-desc">${esc(ruleText)}</span>
        <span class="mode-meta">バージョン${version}（${esc(theme)}）・20問${s.warmup ? '・ウォームアップあり' : ''}</span>
      </button>
      <button class="mode-card mode-practice" data-mode="practice">
        <span class="mode-name">練習</span>
        <span class="mode-desc">時間無制限・1問ごとに○×と解説</span>
        <span class="mode-meta">バージョン${version}の20問</span>
      </button>
    </div>

    ${records.length ? gradHtml : ''}
    ${last ? `<p class="home-last">前回：${esc(last.date)} ${last.rule === 'time' ? `正答 <b>${last.correct}</b> / ${last.total}` : `<b>${last.timeSec}</b> 秒`}（${esc(RULE_LABEL[last.rule])}）</p>` : ''}

    <nav class="home-nav">
      <button class="btn" data-go="history">記録とグラフ</button>
      <button class="btn" data-go="settings">設定</button>
      <button class="btn" data-help>使い方</button>
    </nav>
    ${s.student ? `<p class="home-student muted">出席番号：${esc(s.student)}</p>` : ''}
  </div>`);

  el.addEventListener('click', e => {
    const m = e.target.closest('[data-mode]');
    if (m) { unlockAudio(); app.go('play', { mode: m.dataset.mode }); return; }
    const g = e.target.closest('[data-go]');
    if (g) { app.go(g.dataset.go); return; }
    if (e.target.closest('[data-help]')) infoDialog(HELP_HTML, { title: '使い方' });
  });

  const onKey = e => {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'Enter') { unlockAudio(); app.go('play', { mode: 'exam' }); }
    if (e.key === 'p' || e.key === 'P') { unlockAudio(); app.go('play', { mode: 'practice' }); }
  };
  document.addEventListener('keydown', onKey);
  root.appendChild(el);
  return () => document.removeEventListener('keydown', onKey);
}
