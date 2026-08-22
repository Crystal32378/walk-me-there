# Owl Charm — 硬體接口卡（MVP）

> 給硬體隊友的一頁規格。原則一句話：**娃娃是 state machine 的身體，不是電腦。**
> 手機做完所有事（GPS、導航判斷、Gemini、網路）；娃娃只負責把 state 變成光和震動。
> 所以娃娃上「不需要」：GPS ✗、Wi-Fi ✗、Gemini ✗、喇叭 ✗（聲音由手機播）。

## MVP 定義（能 demo 的最小版本）

**收到一個 byte，變一種燈色＋震一種模式。就這樣。**

按頭說話、左右轉提示、喇叭都是第二期，MVP 一律不做。

## App 會送什麼（BLE 契約）

App 端由飛寶實作（Web Bluetooth，藏在 `?ble=1` flag 後面），韌體可以先照這個契約開發：

- **BLE 名稱**：`WMT-Owl`
- **Service UUID**：`b5f9a001-2b6c-4f6a-93a1-5a1a0a6e0001`
- **Characteristic UUID**（Write, 1 byte）：`b5f9a002-2b6c-4f6a-93a1-5a1a0a6e0001`

| Byte | State | 燈 | 震動 |
|---|---|---|---|
| `0x01` | ON_ROUTE | 綠 | 無（安靜就是「一切都好」） |
| `0x02` | WRONG_DIRECTION | 紅 | **雙短震**（這是主角，最需要被注意的一幕） |
| `0x03` | OFF_ROUTE | 紅（慢閃） | 單長震 |
| `0x04` | STATIONARY | 黃 | 無 |
| `0x05` | UNCERTAIN_GPS | 白（呼吸閃） | 無 |
| `0x06` | RECOVERED | 綠（閃兩下） | 一短震（「對，就是這個方向」的實體版） |

規則：收到新 byte 就切換；同 byte 重複收到不重播震動（app 端也會去重，雙保險）。
左轉紫／右轉藍（概念圖上的）是第二期——現在的 app 還沒有 turn-by-turn 事件可送。

## 建議料單（都是常見件，光華/淘寶有）

- **ESP32-C3 開發板**（小尺寸款，內建 BLE）
- 鈕扣震動馬達 ×1（+ NPN 電晶體或 MOSFET 驅動，別直接接 GPIO）
- RGB LED ×1（WS2812 一顆最省腳位；普通共陰 RGB 也行）
- 供電：MVP 階段**直接用小行動電源＋USB 線**最省事；要塞進肚子再換 3.7V LiPo + TP4056 充電板＋開關
- 毛可以透光，LED 藏在毛下面效果反而好（塞娃娃臉頰或肚皮）

## 地雷（先知道省一天）

1. **Web Bluetooth 只支援 Android Chrome / 桌面 Chrome，iOS Safari 不行**——demo 用 Android 手機或筆電，不要用 iPhone 測。
2. ESP32 韌體用 Arduino IDE / PlatformIO 的 `BLECharacteristic` 標準寫法即可，不需要配對加密（demo 用）。
3. 震動馬達啟動瞬間電流大，供電不穩會讓 ESP32 重開機——馬達電源並一顆電容（100µF+）。

## 驗收（跟 app 接之前就能自測）

手機裝 **nRF Connect**（免費 app）→ 連 `WMT-Owl` → 手動對 characteristic 寫 `0x02` → 娃娃紅燈＋雙震 = 硬體側完工。之後 app 接上只是換一個發送者。

## 分工線

- 韌體＋電路＋塞肚子：隊友
- App 端 Web Bluetooth 發送（`?ble=1`）：飛寶（等硬體用 nRF Connect 驗收過後我再寫，主線 submission 不依賴這條）
- 兩邊都好了 → 補拍 15 秒進影片結尾

有任何契約想改的（UUID、byte 表、震動模式）直接說，以妳方便為準——這頁是草案不是聖旨。🦉
