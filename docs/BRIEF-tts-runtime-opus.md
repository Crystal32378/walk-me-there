# Implementation Brief：Runtime TTS（Owl Voice）— 給 Opus 5

> 發包人：飛寶（briefing／review／deploy／E2E 由飛寶負責，**不要自行部署或碰 main**）。
> 在 branch `feat/owl-voice` 上工作，完成後停手，交 diff 給飛寶。
> 凍結日：**8/28 晚**。做不完就縮，不延。

## 一句話

把 validator 放行的 companion speech 用 Gemini TTS（Puck 聲線）唸出來。TTS 是純 presentation 層，**位置在 validator 之後**。

## 鐵律（違反任何一條 = review 打回）

1. **TTS 只能唸 validator 放行的原文，逐字**。不得為了口語化改寫任何字。
2. **不碰** `src/logic/`（frozen engine）、`server/engine.js`、`server/validator.js` 的判定邏輯。
3. 聲音藏在 UI 🔊 開關後（default off，localStorage `wmt-voice` 記憶）——同時解 browser autoplay 手勢限制。
4. **Staleness gate**：音檔抵達時，若 navData.state 已不在該次 guidance 的 recovery 狀態（或 episode 已關），丟棄不播。判定用現有 engine state，不新增判定邏輯。
5. TTS 失敗/超時（8s）= 靜默降級，純文字照常。不 retry。

## Server 端（`server/`）

- 新檔 `server/voice.js`：`synthesizeSpeech({main, sub}, lang)` → 呼叫 Vertex `gemini-2.5-flash-preview-tts`，回 base64 mp3/pcm。
  - **可用的現成呼叫法**（飛寶已在 production 專案驗證過）：
    - Endpoint：`POST https://aiplatform.googleapis.com/v1/projects/walk-me-there/locations/global/publishers/google/models/gemini-2.5-flash-preview-tts:generateContent`
    - `generationConfig: {"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":"Puck"}}}}`
    - 回傳 `inlineData`：`audio/L16;codec=pcm;rate=24000` → 用 `data:` 直接回給前端前先轉（PCM→WAV header 包裝即可，不必 mp3）
  - 風格指令常數（逐字，不可改）：
    `Speak as a calm, clever boy about ten years old - composed like a little adult. Steady, reassuring, quietly confident. Slightly childlike timbre, but never cutesy, never performative. He knows the way, and people genuinely trust him to navigate. Say: {main} {sub}`
  - **快取**：以 sha256(text+lang+voice) 為 key，記憶體 Map 即可（Cloud Run 單實例夠用；不用 Firestore）。
- `server/companion.js`：在 `recovery_needed` 和 `user_message` 回傳 speech 的地方，若 `body.voice === true`，附 `audio`（base64 WAV）欄位。**只在 validator 放行後才合成**；合成失敗回 `audio: null`，不影響原有回應。

## 前端（`src/`）

- `App.tsx` header 加 🔊 toggle（樣式仿 `.lang-toggle-btn`，放它旁邊），存 `wmt-voice`。
- `useCompanion.ts`：request 帶 `voice` flag；收到 `audio` 時經 staleness gate 後以 `Audio` 播放；新語音打斷舊語音；episode 關閉時停止播放。
- 不改 OwlNavigator 的視覺行為。

## 測試（全部要過，現有 31 個不得動）

- `server/voice.test.js`：風格指令逐字包含 main+sub（音畫一致契約）；PCM→WAV 包裝正確性（header 欄位）；cache key 穩定性。
- 契約測試：companion 只對 validator-approved speech 呼叫 synthesize（mock 驗呼叫順序）。

## 驗收標準（飛寶執行）

1. `npm test`、`npm run lint`、`npm run build` 全綠
2. Flag off 時：行為與現狀完全一致（diff 級驗證）
3. Flag on＋production E2E：走反 → 有聲引導；教學回覆有聲；文字與聲音逐字一致
4. TTS 超時模擬：文字照常顯示、無錯誤外漏
5. `?sim=1` 全程跑一遍無 console error

## 明確不做

Pre-baked 靜態 fallback 音檔、音量控制、語速設定、iOS 原生殼、任何 UI redesign。
