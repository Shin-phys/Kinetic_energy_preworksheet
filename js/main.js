// エントリポイント：データ読み込み・設定・画面切り替え
import { APP_TITLE, readUrlOverrides } from './config.js';
import { buildBank } from './core/questions.js';
import { loadDiagrams } from './diagrams.js';
import { loadSettings, saveSettings } from './storage.js';
import { setSoundEnabled } from './sound.js';
import { renderHome } from './views/home.js';
import { renderPlay } from './views/play.js';
import { renderResult } from './views/result.js';
import { renderHistory } from './views/history.js';
import { renderZukan } from './views/zukan.js';
import { renderSettings } from './views/settings.js';
import { renderPrint } from './views/print.js';

const views = {
  home: renderHome, play: renderPlay, result: renderResult, history: renderHistory,
  zukan: renderZukan, settings: renderSettings, print: renderPrint,
};

const root = document.getElementById('app');
let cleanup = null;
let stored = loadSettings();
const { overrides, locked, challenge } = readUrlOverrides();

const app = {
  title: APP_TITLE,
  bank: null,
  locked,
  challengeForced: challenge,
  overrides,
  get settings() { return { ...stored, ...overrides }; },
  setSettings(patch) {
    stored = { ...stored, ...patch };
    for (const k of Object.keys(patch)) if (!(locked && k === 'course')) delete overrides[k];
    saveSettings(stored);
    setSoundEnabled(this.settings.sound);
  },
  go(name, params = {}) {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    root.innerHTML = '';
    root.dataset.view = name;
    document.body.dataset.view = name;
    window.scrollTo(0, 0);
    cleanup = views[name](root, app, params);
  },
};

async function fetchJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path} を読み込めません（${res.status}）`);
  return res.json();
}

async function boot() {
  document.title = APP_TITLE;
  try {
    const [patterns, questions] = await Promise.all([fetchJSON('data/patterns.json'), fetchJSON('data/questions.json')]);
    app.bank = buildBank(patterns, questions);
    const b = app.bank;
    await loadDiagrams([...new Set([...b.main, ...b.basic, ...b.advanced].map(q => q.diagram))]);
  } catch (err) {
    root.innerHTML = `<div class="boot-error"><h1>読み込みエラー</h1><p>${String(err.message)}</p>
      <p class="muted">index.html をファイルとして直接開くと動きません。GitHub Pages か、ローカルサーバ（例：<code>python3 -m http.server</code>）で開いてください。</p></div>`;
    console.error(err);
    return;
  }
  setSoundEnabled(app.settings.sound);
  app.go(new URLSearchParams(location.search).get('view') === 'print' ? 'print' : 'home');
}

boot();
