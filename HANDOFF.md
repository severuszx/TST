# TST 接手文档（给三个月后的自己）

## 目录
- `index.html`：主站全部页面 + 管理员覆盖层 + 5 套子页模板（`script type="text/plain" id="embed-*"`）
- `login.html`：登录 / 注册 / 重置密码三视图
- `404.html`、`profile.html`、`tool.html`、`shop.html`、`hogwarts.html`、`planning.html`
- `functions/api/[[path]].js`：Cloudflare Pages Functions 路由（登录、发帖、抽奖、数据代理、调试码）
- `_redirects`：旧地址 301
- `sitemap.xml`：搜索引擎索引
- `predeploy_check.py`：部署前结构门禁
- `RELEASE_CHECKLIST.md`：发版勾选清单
- `TECH_DEBT.md`：已知债务

## 数据与接口
- 主站前端接口域名：`https://theslowtidefk.pages.dev/api`
- 数据缓存：Cloudflare KV 键 `site_data_v1`（5 分钟）
- 管理密码、JWT 密钥、插件令牌都在服务端 / 环境变量，不写前端
- 反馈站：`https://theslowtidefk.pages.dev`，管理员列表接口带 `admin=1&pw=...`

## 部署
本机无 `git` 命令时走 GitHub 网页上传：
1. `https://github.com/severuszx/TST/upload/main`
2. 选文件 → 填 Commit summary → Commit changes
3. Functions 文件走 `/upload/main/functions/api`
4. 等 Cloudflare Pages 自动构建 1–2 分钟

## 验证
- 本地：`python -m http.server 8899 --directory _deploy`
- 无头 Chrome：`chrome.exe --headless=new --virtual-time-budget=6000 --dump-dom http://127.0.0.1:8899/...`
- 线上：打开 `https://theslowtide.pages.dev/?v=<时间戳>`，确认 `#navBurgerFix`、投票空状态、数据无重复

## 调试码
- 7 个码统一带 `TST-` 前缀，校验在 `functions/api/[[path]].js` 的 `DEBUG_CODES` 与 `/api/debug/verify`
- 旧短码只做兼容，不再新增

## 管理员页
- `window.TSTOpenAdminPage()` 首次调用时动态创建 iframe 覆盖层
- 管理员 HTML 以 base64 存在 `adminPageData`，源文件在 `_upload/admin.html`
