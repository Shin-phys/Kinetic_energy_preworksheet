// 称号（仕様書 v2 7章）。クリアタイムから級を決める。DOMに依存しない。
//
// 級 0 は「完走」。級 1〜9 の秒数は、級1（歩く人級）と級9（光速級）の秒数の間を等比で割り振る。
// 秒数は10問あたり。問題数 n のときは n/10 倍する。

// trivia：獲得時の一言／explain：図鑑で速さをタップすると出る解説（高校物理の内容とつなげる）
export const TITLES = [
  { name: '導線中の電子級', speed: '約 0.1 mm/s', trivia: '電流はすぐ伝わるが、導線の中の電子そのものはカタツムリより遅い。',
    explain: '電流は I = envS で表される。断面積 1 mm² の銅線に 1 A 流しても、電子の速さは約 0.07 mm/s。それでもスイッチを入れるとすぐ電灯がつくのは、導線の中の電子が一斉に動き出すから。' },
  { name: '歩く人級', speed: '約 1.3 m/s', trivia: '時速にすると約 4.7 km/h。',
    explain: 'm/s を km/h に直すには 3.6 倍する（1.3 m/s ≒ 4.7 km/h）。体重 60 kg の人が歩くときの運動エネルギーは ½mv² ≒ 50 J。' },
  { name: '雨粒級', speed: '約 9 m/s', trivia: '雨粒は空気抵抗のおかげで、これ以上は速くならない（終端速度）。',
    explain: '空気抵抗は速くなるほど大きくなり、重力とつり合うと等速になる（終端速度）。空気抵抗がなければ、1000 m 上空から落ちた雨粒は √(2gh) ≒ 140 m/s にもなる。空気抵抗が負の仕事をするので、力学的エネルギーは保存されない。' },
  { name: '人類最速級', speed: '約 12 m/s', trivia: '100 m 走のトップスピードの瞬間の速さ。',
    explain: '100 m を 9.58 秒で走ると平均の速さは約 10.4 m/s だが、瞬間の最高速度は約 12 m/s になる。この速さで真上に跳べたとすると、v²/2g ≒ 7 m の高さまで上がる計算になる。' },
  { name: '新幹線級', speed: '約 90 m/s', trivia: '時速 320 km は秒速にすると約 90 m。',
    explain: '320 km/h ÷ 3.6 ≒ 89 m/s。運動エネルギーは速さの2乗に比例するので、速さが2倍になれば、同じ力のブレーキで止まるのに必要な距離は4倍になる（仕事と運動エネルギーの関係）。' },
  { name: '音速級', speed: '約 340 m/s', trivia: '音の速さは気温が高いほど速くなる。',
    explain: '空気中の音の速さは V = 331.5 + 0.6t（t は気温 ℃）。雷が光ってから音が聞こえるまでの秒数に 340 m をかけると、雷までの距離がわかる。' },
  { name: '空気分子級', speed: '約 500 m/s', trivia: '常温の空気の分子は、音速より速く飛び回っている。',
    explain: '温度は、分子の運動エネルギーの平均の目安になる。常温の空気の分子は約 500 m/s で飛び回っている。音は分子どうしの衝突で伝わるため、音速は分子の速さと同じくらいになる。' },
  { name: '第一宇宙速度級', speed: '約 7.9 km/s', trivia: '地面すれすれを回り続ける人工衛星の速さ。',
    explain: '地面すれすれを回る円運動では、重力が向心力になる。mg = mv²/R より v = √(gR) = √(9.8 × 6.4×10⁶) ≒ 7.9×10³ m/s。' },
  { name: '原子の中の電子級', speed: '約 2200 km/s', trivia: '水素原子の中の電子の速さは、光速の約 1/137。',
    explain: 'ボーアの原子模型では、クーロン力を向心力として電子が原子核のまわりを回る。水素原子の電子の速さは約 2.2×10⁶ m/s で、光速の約 1/137。' },
  { name: '光速級', speed: '約 30万 km/s', trivia: '1秒で地球を7周半。',
    explain: '3.0×10⁸ m/s。地球一周は 4 万 km なので、1秒で約 7.5 周する。太陽の光が地球に届くまでには約 8 分 20 秒かかる。' },
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
