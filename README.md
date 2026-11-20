# The Slow Tide (TST)

《我的世界》基岩版服务器 **The Slow Tide** 的官网与官方客户端源码。

## 官网

- 主站: https://theslowtide.pages.dev (Cloudflare Pages 自动部署自本仓库 main 分支)
- 索引页: index.html（统一页，PC 与手机共用）
- 管理后台: **https://theslowtide.pages.dev/admin.html**（独立页面，单独标签页打开；表格化界面，无饼图/环形图）
- 子页面: shop.html(积分商店) / profile.html(个人中心) / planning.html(策划,管理员) / hogwarts.html(哈利波特世界观RPG子站,部署在 theslowtidetor.pages.dev)
- 后端 API: functions/api/ (Cloudflare Workers,认证/发帖/积分/兑换等,配合 D1 数据库)

## 官方客户端（安卓）

- 当前版本: **v1.5.4**（versionCode 19，包 303,799 B）
- 安装包: TheSlowTide.apk（本仓库根目录，下载按钮用）
- 历史版本: TheSlowTide-v1.4.0.apk … TheSlowTide-v1.5.4.apk（只增不改）
- 更新清单: https://theslowtide.pages.dev/version.json
- 源码: TheSlowTide-App-src.zip（压缩包内附 README）
- 客户端开源: https://github.com/severuszx/TST

v1.5.4 更新点：登录注册全部重做（密码登录、邮箱验证码、注册双协议、忘记密码），设置页登录改为跳转主界面新面板，修复旧设置页残留控件导致的编译失败。

内置功能：
- 指令工具（长指令拆分 + 悬浮窗/无障碍自动部署进命令方块）
- 指令库（云端同步 templates.txt）
- 选区助手（坐标圈人 / 目标选择器 / 填充指令）
- Base64 图片互译
- JSON 文本组件显示（基岩 / Java 版 tellraw 生成）
- 雪球菜单生成（计分板 + T 显悬浮文本）
- MC 下载（Java / 基岩版官方入口 + PCL2 2.1.4 启动器）
- 网站直达（MC Wiki / 网易 / 国际版 / 苦力怕 / MC 百科 / TST 官网，全部应用内打开）
- 皮肤查询（正版 ID → 皮肤贴图 + 下载）
- 种子查找（输入种子看世界地形与村庄/要塞标注，扫描消耗 800 积分，与官网积分互通）
- 账号体系（密码登录 / 邮箱验证码登录 / 注册双协议 / 忘记密码，与官网同账号）
- 更新公告（软件内推送 + 官网下载页双通道）
- 官网直达（自动注入登录态，同账号通用）

所有下载均在应用内完成，不跳系统浏览器。

- 官网: https://theslowtide.pages.dev
- 指令库(客户端自动读取): https://theslowtide.pages.dev/templates.txt
- 更新公告: https://theslowtide.pages.dev/announcements.json

## 部署

推送 main 分支后 Cloudflare Pages 自动构建: `npx wrangler pages deploy . --project-name=theslowtide`

发版流程、接口契约与踩坑记录见 `HANDOFF.md`。每次改动完成后同步更新 `README.md` 和 `HANDOFF.md`。

## 数据接口性能（2026-11-20）

读到数据库的页面不再每次等 Worker 回源：

- `functions/api/[[path]].js` 加了三级缓存：isolate 内存（10 分钟）→ KV `site_data_v1`（单次 `getWithMetadata`，时间戳在 metadata，TTL 1800s）→ `caches.default` 边缘缓存。响应头 `X-Cache` 会写 `MEM / KV / HIT / STALE / MISS`，加 `?nocache=1` 可绕过。
- `/api/data` 命中直接返回；超过 20 分钟才 `waitUntil` 后台刷新，并发刷新有单飞锁；回源失败返回 503 `data_unavailable`，前端不会再干等。
- `/api/tools/*` 45s、`/api/posts/*` 20s、`/api/server-status` 10s 走边缘缓存。
- `index.html` 打开先渲染本地 `tst_site_cache`，再后台覆盖；请求 9 秒超时、重试 3×300ms；任何 `/api/*` 请求 pending 超过 150ms 显示顶部 `#loadBar`，无缓存时显示 `.sk-row` 骨架。

实测（本机，链路基线本身有 1–2.4s）：`/api/data` 由 1.2–3.3s 降到命中后 0.76s 起，`/api/tools/items` 由 1.6–2.6s 降到 0.78s。反馈站（`theslowtidefk.pages.dev`）不在本仓库，其 `posts/list` 建表 DDL 与 `Feedback` 全量查询仍是源头慢。

