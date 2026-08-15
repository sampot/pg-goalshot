# 射門機

湯姆熊機台風格的限時射門遊戲。40 秒內瞄準左右遠角、控制力道，避開來回移動的門將；連續進球倍率最高 5 倍。

## 遊玩

這是零建置的 Playgrounds SAM，直接開啟 `index.html` 或由 Playgrounds 載入即可。

- 觸控／滑鼠：在球場按住拖曳，放手起腳
- 鍵盤：方向鍵調整準星與力道，空白鍵／Enter 射門
- 最高分寫入 Playgrounds KV：`pg-goalshot-best`

## 測試

```sh
npx --yes vitest@latest run
```

遊戲規則集中於 `game.js`，不依賴 DOM，測試位於 `game.test.js`。

## 素材

美術與音效來源及授權請見 [ATTRIBUTION.md](./ATTRIBUTION.md)。程式碼授權見 [LICENSE](./LICENSE)。
