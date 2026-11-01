# 下载站 Worker（Cloudflare R2 + KV）

这个 Worker 提供授权上传与私有下载：

- 登录：任意用户名 + 共享注册码（`AUTH_CODE` secret）
- 上传：预签名 URL 直传 R2（支持 1GB+，不经过 Worker 请求体）
- 文件列表：公开
- 文件密码：服务端 PBKDF2 校验；下载经 Worker 流式转发，不暴露 R2 公共 URL
- 元数据：Workers KV（`file:<id>`、`pending:<id>`）
- 文件：R2 私有桶

## 1. 安装

```bash
cd worker
npm install
```

## 2. 创建资源

```bash
npx wrangler login
npx wrangler r2 bucket create wankuyuanmeng-files
npx wrangler kv namespace create META
```

把 KV 输出里的 `id` 填到 `wrangler.toml` 的 `[[kv_namespaces]] id`。

## 3. R2 API 凭据

在 Cloudflare Dashboard → R2 → **Manage R2 API Tokens** 创建 token：

- Permissions：Object Read & Write
- Bucket：只选 `wankuyuanmeng-files`

记下 Access Key ID、Secret Access Key 和 Account ID。

## 4. 设置 Secrets

```bash
npx wrangler secret put AUTH_CODE          # 输入共享注册码
npx wrangler secret put AUTH_SECRET        # 随机长字符串，例如 openssl rand -hex 32
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

`AUTH_CODE` 不要写进公开页面或仓库；它只存在 Worker secret 里。

## 5. R2 CORS（浏览器直传必需）

用 Dashboard → R2 → 桶 → Settings → CORS Policy 粘贴 `r2-cors.json`，或使用 wrangler 支持的命令：

```bash
npx wrangler r2 bucket cors put wankuyuanmeng-files --file r2-cors.json
```

允许的来源已包含正式站点和本地 `localhost:8080`。

## 6. 部署

```bash
npx wrangler deploy
```

拿到 `https://wankuyuanmeng-downloads.<subdomain>.workers.dev`。

## 7. 接入下载站

登录 `/admin/ → 站点`，在「上传服务地址」填入 Worker URL，保存。下载页会在 1–2 分钟后显示「投稿 / 上传」按钮，并开始读取上传文件列表。

或者直接改 `content/site.json`：

```json
"downloadsApi": "https://wankuyuanmeng-downloads.<subdomain>.workers.dev"
```

## 8. 验证

1. 打开 `/downloads/`，点「投稿 / 上传」。
2. 任意用户名 + 共享注册码登录。
3. 上传一个小文件（带密码和不带密码各试一次）。
4. 下载页应出现新条目；公开文件直接下载，密码文件需输入密码。
5. 1GB+ 文件建议最后再测，确认浏览器/网络稳定；单个文件上限由 `MAX_UPLOAD_BYTES` 控制（默认 5 GiB）。

## API

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/login` | `{username, code}` → `{token}` |
| GET | `/api/files` | 公开文件列表 |
| POST | `/api/uploads/init` | `X-Session`，返回预签名 R2 PUT URL |
| POST | `/api/uploads/complete` | `X-Session`，`{id}`，登记元数据 |
| POST | `/api/files/:id/unlock` | `{password}` → 短期下载 token |
| GET | `/api/files/:id/download` | 公开文件直接下载；密码文件带 `token` |
| GET | `/api/health` | 健康检查 |

## 安全与限制

- 注册码是**共享门槛**，不是独立账号；拿到码的人都能上传。建议定期更换 `AUTH_CODE`。
- 文件密码使用 PBKDF2-SHA256 存储，服务端校验；R2 桶保持私有，下载只经 Worker。
- 免费 Workers 有 CPU/请求限制；PBKDF2 迭代次数在 `src/index.js` 顶部，若遇到 CPU 超限可适当降低。
- R2 免费额度有限（存储/操作），请定期在 Dashboard 清理不需要的对象和 KV 记录。
- 大文件上传需要稳定的网络；直传 R2 不经过 Worker，避免 Worker 请求体限制。
- 删除文件需要同时删除 R2 对象与 KV `file:<id>` 记录；目前未提供删除 UI。
