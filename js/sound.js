// 短い効果音（WebAudio。音声ファイル不要）
let ctx = null;
let enabled = true;

export function setSoundEnabled(on) { enabled = on; }

/** iOS などはユーザー操作中に一度呼んでおく必要がある */
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) ctx = new AC();
}

function tone(freq, dur, type = 'sine', gain = 0.12, delay = 0) {
  if (!enabled || !ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  correct() { tone(880, 0.08, 'sine', 0.1); },
  wrong() { tone(150, 0.16, 'square', 0.06); },
  tick() { tone(660, 0.05, 'sine', 0.06); },
  start() { tone(990, 0.12, 'sine', 0.1); },
  finish() { tone(660, 0.1, 'sine', 0.1); tone(990, 0.16, 'sine', 0.1, 0.12); },
};
