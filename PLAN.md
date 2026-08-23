# 射門機（`pg-goalshot`）— 遊戲規劃文檔

> **用途：** 本 repo 的遊戲權威規格——coding agent 改動前必讀：這個遊戲是什麼、規則、設計限制、優化方向。
> **整理方式：** 從本 repo 實作反向整理（2026-08-23）。**改玩法先改此檔再改碼**；本檔與程式碼衝突時，以「規則（§3）」描述的設計意圖為準回報差異。
> **上游契約：** [PG-GAME-AGENT-GUIDE.md](https://github.com/sampot/playgrounds/blob/main/docs/PG-GAME-AGENT-GUIDE.md)（唯一必讀；本檔不重複其全文）· 型錄條目 `playgrounds/catalog/entries/pg-goalshot.yaml`

## 1. 一句話

40 秒限時的定點射門機：拖曳瞄準左右遠角、控制力道，避開來回巡邏的門將連續破網——致敬射門機玩法類型，非任一商業作品復刻。

## 2. 定案速覽

| 項 | 值 |
| --- | --- |
| catalog id / kind / series | `pg-goalshot` / `game` / `機台` |
| status | `listed` |
| 模式 | 單人限時局 **40** 秒（`ROUND_SECONDS`）；場上一次一球 |
| 計分 | 進球 10 分 ×連段倍率（上限 **×5**＝50 分）；被撲救／射偏歸零連段 |
| 球門／門將 | 門柱 x=58–302；門將寬 58、初始速度 92 px/s 巡邏 |
| 畫布 | 直向 360×520 canvas；俯視球場 |
| 最高分 | `/api/kv/pg-goalshot-best`（KV 權威） |
| 素材 | Kenney Sports Pack 球圖＋Kenney UI SFX（皆 CC0）；詳 `ATTRIBUTION.md` |
| 交付形 | 純 HTML＋CSS＋ESM JS；無 build；`npx vitest run` 測試 |

## 3. 完整規則（現行實作）

### 3.1 局流程

- `newGame()` 建立 40 秒局：score/combo/shots/goals 歸零、phase=`playing`、門將自中央以 vx=92 出發。
- 場上無球時可射門（`shoot`）；球落地判決後立即清空可再射；時間歸零 phase=`over`、丟棄在飛球並發 `end`，之後 `shoot` 一律拒絕。

### 3.2 射門參數（實際公式）

- aim ∈ [−1,1]（左角至右角）：目標點 = `lerp(GOAL_LEFT+14, GOAL_RIGHT−14, (aim+1)/2)`——即門柱內縮 14px。
- power ∈ [0,1]：球速 `speedY = 310 + power×250`（310–560 px/s）；飛行時間 =(SHOOTER_Y−GOAL_LINE_Y)/speedY，vx 由此反推直線抵達目標點。
- 參數非法時鉗制不擋（NaN→預設 0/0.5）；已有球或非 playing 時 `shoot` 回 false。

### 3.3 判決（固定步長 1/120s 推進）

- 球 prevY >112 且 y ≤112 跨越門線那一刻判定：
  - x 在門柱外 → `miss`（射偏）；
  - `|x − 門將x| ≤ KEEPER_WIDTH/2 + 10` → `save`（撲救判定含 ±10px 手長寬容）；
  - 其餘 → 進球。
- 球飛出場外 ±24px 也算 miss。進球：combo+1、倍率=min(combo,5)、得 `10×mult` 分；save/miss 皆 combo=0。

### 3.4 門將行為

- 唯一 AI：等速直線巡邏 GOAL_LEFT..GOAL_RIGHT，撞牆反向（速度大小不變、無預判無加速）。難度恆定，強弱全靠玩家瞄準遠角與出手時機。

### 3.5 輸入映射

- 觸控／滑鼠：pointerdown 定錨並取 aim（`(x−中心)/(PITCH_W×0.38)` 鉗制 ±1）、power 起始 0.45；拖曳中 power=距離/180（鉗制 0.45–1）；放手若位移 <12px 以預設 power 0.7 出腳。
- 鍵盤：←→ 調 aim ±0.1、↑↓ 調 power ±0.05、空白鍵／Enter 射門。
- HUD 即時顯示準星虛線與落點光圈（僅瞄準中）、力度條。

## 4. 操作與畫面

| 輸入 | 動作 |
| --- | --- |
| 按住拖曳 → 放手 | 瞄準＋蓄力 → 射門 |
| 方向鍵 | 微調準星／力道 |
| 空白鍵／Enter | 出腳 |
| 開始／重新開始 | 新局 |
| 音效開關 | 靜音切換 |

- HUD：比分（四位補零）、連段 ×N、倒數、最佳分；狀態列播報「破網！N 分」「被門將撲出」「射偏了」。
- 場景程序繪製：草皮條紋、禁區線、球網格線；球用 `ball_soccer1.png` 貼圖（載入失敗退化為圓形），半徑隨離門距離近大遠小（9→21px）模擬透視。
- Mobile-first 直向；禁 `alert`／`confirm`／`prompt`。

## 5. 持久化（KV 權威）

| key | 內容 | 讀寫時機 |
| --- | --- | --- |
| `pg-goalshot-best`（KV，`BEST_KEY`） | 歷史最高單局分數（字串數字） | 載入 GET（僅接受純數字）；終場破紀錄 PUT |
| （無）localStorage | — | 未使用 |

- functions.js 為 stub（`onRequest` 回 `"ok"`），無自訂 API。
- KV 失敗靜默降級（try/catch，離線只顯示 session 內最佳）；新增統計一律走 `/api/kv/pg-goalshot-*`，禁止裸 localStorage 當權威。

## 6. 美術／音效／署名

- `assets/art/ball_soccer1.png` 實際使用；`ball_soccer2.png`、`ball_soccer3.png` 已入庫但**未被子程式引用**。來源：[Kenney Sports Pack](https://kenney.nl/)，CC0，授權全文 `assets/art/License.txt`。
- `assets/sfx/click1.ogg`、`switch1.ogg`：Kenney UI Audio，CC0，授權全文 `assets/sfx/License.txt`。遊戲內音效主體為 WebAudio 合成（kick 低頻＋noise、goal 三連音音高隨連段每級 +28Hz、save/end 合成琶音），ogg 未直接播放、屬備用素材。
- CC0 雖不要求署名，依專案慣例完整記錄於 [`ATTRIBUTION.md`](./ATTRIBUTION.md)。
- 新增素材一律拷進 `assets/`、更新 `ATTRIBUTION.md`、同步 `sam-manifest.json` files。

## 7. 測試（`npx vitest run`）

現有覆蓋（`game.test.js`，10 例）：新局欄位與門將移動中；自訂局時下限 1 秒；aim/power 鉗制與單球限制；合理力道球向門線前進；門柱內避開門將進球（+10 分）；射正撞門將撲救且連段歸零；出門柱 miss；瞄遠角可過停中央的門將；球出界判 miss；時間到進 over 且不能再射。

改動判決幾何／倍率／門將必補對應邊界測試；`app.js` DOM 不在測試範圍。

## 8. 硬約束（不可違反）

1. 僅 HTML＋CSS＋JS（ESM）；**無 build**、不入庫 `node_modules`、不安套件；工具一律 `npx <pkg>` 臨時執行。
2. 禁瀏覽器原生 `alert`／`confirm`／`prompt`；訊息一律狀態列。
3. Mobile-first；主操作（拖曳射門）不可 hover-only。
4. 最高分以 `/api/kv/pg-goalshot-best` 為權威；禁止裸 localStorage 當權威。
5. 不自行載入 `sdk.js`；宿主注入 `window.PG`。本作未用 `PG.libs`（vanilla canvas 即可）。
6. 改動可執行邏輯前先寫失敗測試（TDD）。
7. 檔案清單變動須同步 `sam-manifest.json`。
8. 素材替換須同步 `ATTRIBUTION.md` 與隨附 License 檔（CC0 也署名）。

## 9. 優化建議（可玩性與樂趣）

依優先級；實作前先在此登記並補測試。原則：強化「讀門將→出手」的博弈節奏，不改變定點射門的核心認同。

**高優先**

1. **門將難度曲線**：等速巡邏 30 秒後即被摸透；讓 vx 隨時間或連段提升（如每進 3 球 +12 px/s）或在滿倍時偶發魚發魚躍撲救，維持心流。
2. **滿倍風險回饋**：combo ≥4 時 UI 亮起「×5 在望」，但門將同時提速——高報酬掛高風險，讓連段歸零的痛有對應的賭注感。
3. **進球演出升級**：破網瞬間網幕波動＋短震動（`navigator.vibrate`）＋0.3s 慢速定格；得分音已隨連段升 key，視覺同步跟上。

**中優先**

4. **球種變化**：aim 大角度時帶弧線（香蕉球），power 影響球的高度視覺（吊射 vs 平射）——增加瞄準語彙而不改變判決幾何。
5. **時間獎勵**：連續 3 球 +3 秒（顯示加時動畫），把「穩穩踢」與「拚連段」變成節奏抉擇。
6. **戰績細分 KV**：goals/shots/最高 combo 存 `/api/kv/pg-goalshot-stats`，結算畫面顯示命中率趨勢。

**低優先**

7. 啟用入庫未用的 ball_soccer2/3.png：每局隨機球款或金球事件；否則自 manifest 移除。
8. 觀眾環境聲（合成 noise swell）於進球/失手時起伏。
