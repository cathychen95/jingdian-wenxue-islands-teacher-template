# 給分享者：建立 GitHub 範本

## 一、建立公開程式庫

1. 登入 GitHub。
2. 建立新的 repository。
3. 建議名稱：`jingdian-wenxue-islands-teacher-template`。
4. 選擇 **Public**。
5. 將本資料夾中的全部檔案上傳；不要上傳外層 ZIP。

## 二、替換一鍵部署網址

在 `README.md` 找到：

`https://github.com/YOUR_GITHUB_ACCOUNT/jingdian-wenxue-islands-teacher-template`

把 `YOUR_GITHUB_ACCOUNT` 換成您的 GitHub 帳號。若程式庫名稱不同，也要一起修改。

## 三、設為 Template repository

1. 進入 GitHub 程式庫的 **Settings**。
2. 在 **General** 頁勾選 **Template repository**。
3. 回到首頁測試「Deploy to Cloudflare」按鈕。

## 四、分享給教師

可直接分享 GitHub 首頁網址，或分享 Deploy to Cloudflare 按鈕的連結。教師必須使用自己的 Cloudflare 與 GitHub 帳號完成部署。

## 五、正式分享前檢查

- 已填寫 `教育分享授權.md` 的權利人。
- 沒有 `.env`、`.dev.vars`、Token 或學生資料。
- `wrangler.jsonc` 沒有 `account_id` 與 `database_id`。
- README 的 GitHub 網址已替換。
- 線上示範網址仍可開啟。
- ZIP 與 GitHub 內容的版本號一致。
- `drizzle/0002_fantastic_preak.sql` 已包含在 repository 中。
- `package.json` 的部署流程會先執行 `wrangler d1 migrations apply DB --remote`。
- 已執行 `npm run check:share`、`npm run build` 與 `node --test tests/rendered-html.test.mjs`。
