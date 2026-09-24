// エントリポイント：データ読み込み・設定・画面切り替え
import { APP_TITLE, readUrlOverrides } from './config.js';
import { buildBank } from './core/questions.js';
import { loadDiagrams } from './diagrams.js';
import { loadSettings, saveSettings, getNextVersion } from './storage.js';
import { setSoundEnabled } from './sound.js';
import { renderHome } from './views/home.js';
import { renderPlay } from './views/play.js';
import { renderResult } from './views/result.js';
import { renderHistory } from './views/history.js';
import { renderSettings } from './views/settings.js';

const views = { home: renderHome, play: renderPlay, result: renderResult, history: renderHistory, settings: renderSettings };

const root = document.getElementById('app');
let cleanup = null;
let stored = loadSettings();
const { overrides, locked } = readUrlOverrides();

const app = {
  title: APP_TITLE,
  bank: null,
  locked,
  overrides,
  get settings() { return { ...stored, ...overrides }; },
  setSettings(patch) {
    stored = { ...stored, ...patch };
    if (!locked) for (const k of Object.keys(patch)) delete overrides[k];
    saveSettings(stored);
    setSoundEnabled(this.settings.sound);
  },
  get versionCount() { return this.bank.versions.length; },
  /** 次に出題するバージョン番号 */
  currentVersion() {
    const v = this.settings.version;
    if (v === 'auto') return getNextVersion(this.versionCount);
    const n = Number(v);
    return n >= 1 && n <= this.versionCount ? n : 1;
  },
  go(name, params = {}) {
    if (typeof cleanup === 'function') cleanup();
    cleanup = null;
    root.innerHTML = '';
    root.dataset.view = name;
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
    await loadDiagrams(Object.keys(app.bank.patterns));
  } catch (err) {
    root.innerHTML = `<div class="boot-error"><h1>読み込みエラー</h1><p>${String(err.message)}</p>
      <p class="muted">index.html をファイルとして直接開くと動きません。GitHub Pages か、ローカルサーバ（例：<code>python3 -m http.server</code>）で開いてください。</p></div>`;
    console.error(err);
    return;
  }
  setSoundEnabled(app.settings.sound);
  app.go('home');
}

boot();
