# 🌿 健康日記（雲端同步版）

登入帳號後，所有裝置自動同步。

---

## 部署步驟

### 第一步：Supabase 建立資料表

到你的 Supabase 專案 → SQL Editor，執行以下 SQL：

```sql
create table health_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  key text not null,
  value jsonb not null,
  updated_at timestamp with time zone default now(),
  unique(user_id, key)
);

alter table health_data enable row level security;

create policy "Users can only access own data"
on health_data for all
using (auth.uid() = user_id);
```

### 第二步：開啟 Google 登入（選用）

Supabase → Authentication → Providers → Google → 開啟

需要到 Google Cloud Console 建立 OAuth 憑證：
- 授權重新導向 URI 填：`https://puaqztqlujcuwgxpexht.supabase.co/auth/v1/callback`

### 第三步：上傳到 GitHub

1. 到 github.com 建立新 repo（例如 `health-tracker-cloud`）
2. 把這整個資料夾上傳（不要上傳 `node_modules`）
3. Commit changes

### 第四步：部署到 Vercel

1. 到 vercel.com 用 GitHub 登入
2. Add New Project → 選你的 repo
3. 設定全部預設，點 Deploy
4. 拿到網址（例如 `health-tracker-cloud.vercel.app`）

### 第五步：設定 Supabase 允許你的網址

Supabase → Authentication → URL Configuration：
- Site URL：填你的 Vercel 網址
- Redirect URLs：加入你的 Vercel 網址

---

完成後，用手機瀏覽器開 Vercel 網址，「加到主畫面」就像 App 一樣使用！
