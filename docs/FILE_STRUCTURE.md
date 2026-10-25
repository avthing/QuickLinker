# 📁 QuickLinker 檔案結構說明

## 目錄結構

```
QuickLinker/
├── 📄 manifest.json              # Chrome 擴充功能配置檔（必須在根目錄）
├── 📄 README.md                  # 專案說明（給開發者看）
├── 📄 LICENSE                    # AGPL-3.0 授權條款
│
├── 📦 src/                       # 擴充功能原始碼
│   ├── background/
│   │   └── background.js         # Service Worker（右鍵選單、連結檢查、分頁去重）
│   ├── content/
│   │   ├── content.js            # 內容腳本（頁面偵測、浮動按鈕）
│   │   └── content.css           # 浮動按鈕樣式
│   ├── popup/
│   │   ├── popup.html            # 工具列彈出面板
│   │   └── popup.js              # 彈出面板邏輯（含 I18N 字典與主題切換）
│   └── options/
│       ├── options.html          # 選項頁
│       └── options.js            # 選項頁邏輯（含 I18N 字典與主題切換）
│
├── 🖼️ icons/                     # 擴充功能圖示（manifest.json 引用）
│   ├── icon16.png
│   ├── icon64.png
│   ├── icon128.png
│   ├── icon256.png
│   └── icon512.png
│
└── 📚 docs/                      # 文件
    ├── FILE_STRUCTURE.md         # 本文件
    └── USER_GUIDE.md             # 使用手冊（給一般用戶看）
```

---

## 📝 檔案說明

### 核心配置
- **manifest.json**：Chrome 擴充功能設定檔，定義名稱、版本、權限、圖示與各腳本路徑

### 擴充功能
- **src/popup/**：點擊工具列圖示時彈出的面板
- **src/options/**：擴充功能選項頁（搜尋網站、掃描模式、主題、語言等設定）
- **src/content/**：注入到網頁中的樣式與腳本（頁面偵測、浮動按鈕）
- **src/background/**：Service Worker，處理右鍵選單、連結可用性檢查等核心邏輯

### 資源
- **icons/**：擴充功能圖示（由 manifest.json 引用）

### 文件
- **README.md**：技術文件，給開發者看的專案說明
- **docs/USER_GUIDE.md**：使用手冊，給一般用戶看的簡易教學
- **LICENSE**：AGPL-3.0 開源授權條款

---

## 🔧 如何維護檔案結構

### 新增功能時
1. **新的頁面** → 在 `src/` 下建立對應資料夾，並更新 `manifest.json` 路徑
2. **新的圖示** → 統一放在 `icons/`
3. **官網新增文案** → 同步新增 `data-i18n` key 到四支 JSON

### 刪除功能時
1. 刪除對應的 HTML/JS/CSS 檔案
2. 更新 `manifest.json` 移除不需要的引用
3. 檢查其他檔案是否有引用到被刪除的檔案

### 重新命名時
1. 更新 `manifest.json` 中的路徑
2. 檢查其他 JS 檔案中的引用或連結
3. 重新載入擴充功能並實際測試
