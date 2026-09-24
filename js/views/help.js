// 使い方（ホーム画面のモーダル）
export const HELP_HTML = `
<h3>答え方</h3>
<ol>
  <li>【はじめ】か【あと】の箱をタップして選ぶ（最初は【はじめ】）。</li>
  <li>下の <b>K</b>・<b>U</b>・<b>E</b> のタイルをタップすると、選んだ箱に入る。<code>+</code> は自動で入る。</li>
  <li>置いたタイルをもう一度タップすると取り消し。<b>U</b> だけは 1回目で <b>−U</b>（負の位置エネルギー）、2回目で取り消し。</li>
  <li>【あと】が空のときは「あと へ →」、入っていれば「判定」。摩擦などで使えない場面は「保存則は使えない」。</li>
</ol>
<p class="help-terms"><b>K</b> = ½mv²（運動エネルギー） <b>U</b> = mgh（重力による位置エネルギー） <b>E</b> = ½kx²（弾性力による位置エネルギー）</p>

<h3>キーボード（PC・タブレット）</h3>
<table class="kbd-table">
  <tr><td><kbd>K</kbd> <kbd>U</kbd> <kbd>E</kbd>（または <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>）</td><td>タイルを置く／もう一度で取り消し（U は +U→−U→取り消し）</td></tr>
  <tr><td><kbd>←</kbd> <kbd>→</kbd> <kbd>Tab</kbd></td><td>【はじめ】【あと】の切り替え</td></tr>
  <tr><td><kbd>Enter</kbd> / <kbd>Space</kbd></td><td>あとへ → ／ 判定</td></tr>
  <tr><td><kbd>0</kbd> / <kbd>N</kbd></td><td>保存則は使えない</td></tr>
  <tr><td><kbd>Backspace</kbd></td><td>選んでいる箱の最後のタイルを消す</td></tr>
  <tr><td><kbd>Esc</kbd></td><td>中断してホームへ</td></tr>
</table>
<p>ホーム画面では <kbd>Enter</kbd> で本番、<kbd>P</kbd> で練習を開始。</p>

<h3>モード</h3>
<p><b>本番</b>：まちがえても解説は出さず、すぐ次へ。終わったあとにまとめて振り返る。記録はこの端末に保存され、グラフになる。<br>
<b>練習</b>：1問ごとに○×と解説。まちがえたらその場で解き直せる。記録は残らない。</p>
`;
