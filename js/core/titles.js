// 称号（仕様書 v2 7章）。クリアタイムから級を決める。DOMに依存しない。
//
// 級 0 は「完走」。級 1〜9 の秒数は、級1（歩く人級）と級9（光速級）の秒数の間を等比で割り振る。
// 秒数は10問あたり。問題数 n のときは n/10 倍する。

export const TITLES = [
  { name: '導線中の電子級', speed: '約 0.1 mm/s', trivia: '電流はすぐ伝わるが、導線の中の電子そのものはカタツムリより遅い。' },
  { name: '歩く人級', speed: '約 1.3 m/s', trivia: '時速にすると約 4.5 km/h。' },
  { name: '雨粒級', speed: '約 9 m/s', trivia: '雨粒は空気抵抗のおかげで、これ以上は速くならない（終端速度）。' },
  { name: '人類最速級', speed: '約 12 m/s', trivia: '100 m 走のトップスピードの瞬間の速さ。' },
  { name: '新幹線級', speed: '約 90 m/s', trivia: '時速 320 km は秒速にすると約 90 m。' },
  { name: '音速級', speed: '約 340 m/s', trivia: '音の速さは気温が高いほど速くなる。' },
  { name: '空気分子級', speed: '約 500 m/s', trivia: '常温の空気の分子は、音速より速く飛び回っている。' },
  { name: '第一宇宙速度級', speed: '約 7.9 km/s', trivia: '地面すれすれを回り続ける人工衛星の速さ。' },
  { name: '原子の中の電子級', speed: '約 2200 km/s', trivia: '水素原子の中の電子の速さは、光速の約 1/137。' },
  { name: '光速級', speed: '約 30万 km/s', trivia: '1秒で地球を7周半。' },
];

/**
 * 級ごとの上限秒数（級0は Infinity）
 * @param {number} n 問題数
 * @param {{walk:number, light:number}} times 10問あたりの 歩く人級・光速級 の秒数
 * @param {number} factor 追加の倍率（腕試しなど）
 */
export function thresholds(n, times, factor = 1) {
  const scale = (n / 10) * factor;
  const steps = TITLES.length - 2; // 級1→級9 の間の段数
  const r = Math.pow(times.light / times.walk, 1 / steps);
  return TITLES.map((_, k) => (k === 0 ? Infinity : Math.round(times.walk * Math.pow(r, k - 1) * scale)));
}

/** タイムから級番号 */
export function levelFor(timeSec, n, times, factor = 1) {
  const th = thresholds(n, times, factor);
  let level = 0;
  for (let k = 1; k < th.length; k++) if (timeSec <= th[k]) level = k;
  return level;
}

/** 次の級までの差（最上位なら null） */
export function nextGap(timeSec, n, times, factor = 1) {
  const level = levelFor(timeSec, n, times, factor);
  if (level >= TITLES.length - 1) return null;
  const th = thresholds(n, times, factor)[level + 1];
  return { level: level + 1, name: TITLES[level + 1].name, gap: Math.round((timeSec - th) * 10) / 10, limit: th };
}

export const titleLabel = (level, star) => `${TITLES[level].name}${star ? '★' : ''}`;
