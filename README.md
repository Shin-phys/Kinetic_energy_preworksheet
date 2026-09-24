# 力学的エネルギー 立式ドリル

力学的エネルギー保存則の「立式」を反復練習するWebアプリです。
状況（文章＋図）を見て、**はじめ**と**あと**に残る項（K・U・E）をタイルで並べます。
選択肢から探すのではなく**式を自分で組み立てる操作のまま自動採点**するのが設計の中心です（仕様は [docs/spec.md](docs/spec.md)）。

- 公開URL（GitHub Pages）：`https://shin-phys.github.io/Kinetic_energy_preworksheet/`
- ビルド不要・外部ライブラリなし（HTML／CSS／JavaScript モジュールのみ）
- 記録は端末の localStorage に保存（サーバ・ログイン不要）

## ファイル構成

```
index.html              エントリ（読み込むだけ）
css/style.css           見た目（色は :root のトークンに集約。ダークモード対応）
js/
  config.js             ★教員が編集する設定（既定値・卒業基準・GAS送信先・URLパラメータ）
  main.js               起動・画面切り替え
  core/                 DOMに依存しないロジック（Node でテスト可能）
    answer.js           タイル操作（+U→−U→取消）と判定
    questions.js        問題データの結合・セット生成・構成チェック
    session.js          本番／練習の進行（時間・正答数・誤答の再出題）
  views/                画面ごとのモジュール
    home.js / play.js / result.js / history.js / settings.js / help.js
  diagrams.js           図テンプレートの読み込みとラベル差し込み
  chart.js              推移グラフ（SVG）
  storage.js            記録・設定の保存、CSV／結果コード、卒業判定
  sender.js             GASへの送信（段階3）
  sound.js              効果音（WebAudio）
  ui.js                 小さなUI部品
data/
  patterns.json         ★出題パターン A1〜D1 の定義（正答・trap解説）
  questions.json        ★問題文（4バージョン×20問）
assets/diagrams/*.svg   ★パターンごとの図テンプレート（A1〜D1の15種）
gas/Code.gs             段階3用 Google Apps Script
tools/validate.mjs      問題データの構成チェック
tests/core.test.mjs     判定・進行ロジックのテスト
docs/spec.md            仕様書
```

★ が日常的に編集するファイルです。

## 使い方（生徒）

1. 【はじめ】か【あと】の箱を選ぶ（最初は【はじめ】）
2. `K` `U` `E` のタイルをタップ（`+` は自動）。置いたタイルを再タップで取り消し
3. `U` だけは 再タップで `−U`、もう一度で取り消し（A8：基準面より下）
4. 【あと】が空なら「あと へ →」、入っていれば「判定」。摩擦などは「保存則は使えない」

キーボード：`K` `U` `E`（`1` `2` `3`）／`←` `→` `Tab` 箱の切替／`Enter` `Space` 次へ・判定／`0` `N` 使えない／`Backspace` 1つ消す／`Esc` 中断

- **本番**：誤答時は画面フラッシュと効果音のみで即次へ。終了後に誤答パターンの解説をまとめて表示。
- **練習**：時間無制限。1問ごとに○×、誤答時はその場で解説と解き直し。記録は残らない。
- 結果画面の「まちがえた問題だけ練習」で、苦手な問題だけを練習モードで解き直せます。

## 教員向け：条件を指定したリンクを配る

URLパラメータで本番の条件を指定できます（生徒の端末の設定より優先）。

| パラメータ | 値 | 意味 |
|---|---|---|
| `rule` | `time` / `complete` | 時間内の正答数 ／ 全問正答までの時間 |
| `limit` | 秒数（例 `120`） | 制限時間 |
| `v` | `auto` / `1`〜`4` | バージョンの順送り ／ 固定 |
| `warmup` | `1` / `0` | ウォームアップの有無 |
| `shuffle` | `1` / `0` | セット内の出題順シャッフル |
| `lock` | `1` | 指定した項目を設定画面で変更不可にする |

例：`…/Kinetic_energy_preworksheet/?rule=time&limit=120&warmup=1&lock=1`

## 問題を編集・追加する

- 問題文は `data/questions.json`。1問は次の形です（`start` `end` `trap` `diagram` は `patterns.json` から継承）。

  ```json
  { "id": "A5-1", "type": "A5", "label": "ボール", "text": "地面からボールを斜め上に投げ、…基準面は投げた点。" }
  ```

  読み込み後は仕様書7章と同じ形（`id, type, diagram, text, start, end, trap`）になります。個別に `trap` などを書けば上書きできます。
- 負の位置エネルギーは `"-U"` と書きます（例：A8 の `end` は `["K", "-U"]`）。D群は `"applicable": false`。
- 1バージョン＝20問（A10・B4・C4・D2、A5・A8・C1・A6・A7 を含む）。編集後に構成チェックを実行してください。

  ```sh
  node tools/validate.mjs     # 問題データのチェックと一覧表示
  npm test                    # 判定・進行ロジックのテスト
  ```

- 図は `assets/diagrams/<パターンID>.svg`。`{{obj}}` が問題の `label`（物体名）に置き換わります。数値は入れず、`v = 0`・基準面・初速の矢印など**項の生死を決める条件だけ**を描きます。Inkscape 等で直接編集できます（`class="dg-…"` を残すとダークモードでも色が切り替わります）。

## 記録（段階的実装）

1. **localStorage のみ**（既定）：端末内で記録・グラフ・卒業判定まで完結。
2. **書き出し**：結果画面の「結果コードをコピー」→ 既存の Googleフォームに貼り付け。記録画面から CSV 保存も可能。
3. **GAS＋スプレッドシート**：`gas/Code.gs` の冒頭の手順でウェブアプリをデプロイし、URL を `js/config.js` の `GAS_ENDPOINT` に設定すると「記録を送信」ボタンが現れます。出席番号を設定済みなら本番終了時に自動送信します。

卒業基準（`js/config.js` の `GRADUATION`）：120秒で18問以上を3回連続。
記録は振り返りの材料として扱い、評価に使う場合は「グラフを見て何を変えたか」の記述と組み合わせる想定です（仕様書 8.3）。

## ローカルで動かす

JavaScript モジュールと `fetch` を使うため、`index.html` をダブルクリックで開くと動きません。

```sh
python3 -m http.server 8000   # → http://localhost:8000/
```

## GitHub Pages で公開

リポジトリの Settings → Pages → Branch: `main` / `(root)` を選んで保存。
