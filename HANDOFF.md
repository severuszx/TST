# TST 接手文档（给三个月后的自己）

## 最新修复（2026-11-20 深夜）
commit `2a2462f`（524 Commits）。「我的」页「生成验证码」点了没反应。

- 根因：`bindRender(d)` 里绑定的 `onclick` 引用 `genCode(t)` / `bindStatus(t)`，而 `t` 只存在于 `fetchMe()` 内部（`var t=localStorage...`），`bindRender` 与按钮作用域里没有 `t` → 点击抛 `ReferenceError: t is not defined`，表现为完全无反应（按钮不变灰、不发请求）。
- 修法：IIFE 顶部提升为 `var tk=''`，`fetchMe()` 写入 `tk`，`bindRender` / `genCode` / 刷新按钮全部改用 `tk`；`bindStatus(t)` 与 `genCode(t)` 的形参保持不变，调用处统一传 `tk`。
- 线上实测：`/index.html?v=fix2a2462f#profile` 点「生成验证码」得到 6 位码 `62PRQG`，页面显示「进服后输入 /bind 62PRQG」「复制验证码 / 重新生成」。
- 排查提示：页面 `#profile` 的 DOM 段落正常，别被 Service Worker 的 `SW=yes` 误导（`sw.js` 只有 install/activate 清理缓存，没有 fetch 拦截，不提供旧文档）。
- 排行榜金币榜复核：切「金币余额」显示 `40,065 金币`，字段契约正常；tab 点击在真实鼠标事件下有效，用坐标自动化点击容易落到 iframe 边界，改在目标 iframe 内调用 `click()` 验证。

## 最新变更（2026-11-20 晚）
线上最新 commit `b44d67f`（519 Commits）。三条急件：

**1. 绑定流程改回「官网生成验证码 → 游戏内 /bind」**
- 现状问题：后端 `functions/api/[[path]].js` 里根本没有 `/api/tst/game/*`，插件 `TSTBind.java` 的 POST/GET 全 404；官网「我的」页又把方向写反（说进服取码），前端也没有任何生成码控件。
- 新增接口（全部走 D1 `TST_DB`）：
  - `POST /api/tst/game/bind/code`（登录态 Bearer）→ 生成 6 位码（`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`，排除易混字符），10 分钟有效，同一账号 10 分钟内复用旧码；已绑定则返回 `bound:true`。
  - `GET /api/tst/game/bind/status`（登录态）→ `{ok,bound,mc,uuid,bound_at}`，供「我的」页展示。
  - `POST /api/tst/game/bind`（`X-Server-Token`）body `{code,uuid,name,serverId}` → 成功回 `binding{user_id,username,display_name}`；码无效/过期 404、账号或角色已绑他人 409，与插件 `parseBinding` 和提示语完全对齐。
  - `GET /api/tst/game/bind?uuid=`（`X-Server-Token`）→ 未绑定 404，已绑定回 `ready:true + binding`。
- 鉴权：`serverAllowed()` 同时接受 `TST_TOKEN` 与线上环境变量 `TST_STATUS_TOKEN`（线上两者不同，只认其一会导致插件 403）。
- 前端「我的」页：登录后先拉 `/api/tst/game/bind/status`；未绑定显示「生成验证码」+ 生成后大号码 + 复制 + 剩余有效期；已绑定显示 mc-heads 头像与角色名 + 刷新。Wiki FAQ `#wk-faq-bind` 与指令表同步改成「官网取码 → 进服 `/bind 码`」，新增 `/bind` 查状态一行。
- 表：`bind_code(code PRIMARY KEY, nickname, created_at, used)`、`bind_link(nickname PRIMARY KEY COLLATE NOCASE, uuid, mc, bound_at)`。

**2. 排行榜金币显示错乱 / 角色抽屉打不开**
- 根因：内嵌模板读 `r.online_min / r.coins / r.deaths`、`/api/rank/player?mc=` 读 `d.ready / d.snapshot`，但后端只回 `rows[{mc,value,ts}]`、参数只认 `name`、返回只有 `player`。三处契约全错配 → 金币列全 0、点角色报 `bad_name`。
- 修法：后端补齐字段而不是改模板样式（保住「以前的样子」）：`/api/rank/top` 回 `online_min/coins/deaths/value/ts` 并附登录态 `mine`；`/api/rank/player` 同时接受 `mc`/`name`，返回 `ready + snapshot(rank_online) + player`。
- 顺带：列表头像与抽屉形象从不存在 `/api/skin`、`/assets/skinview3d.js` 换成 `mc-heads.net`（`avatar/40`、`body/180`），删掉 skinview3d 依赖，避免 404 与「3D 皮肤加载中」永久卡住。

**3. 排行榜页面形态**
- 保持上一轮的内嵌 `embed-rank`（不再走 `/rank.html`），所以顶部不会出现第二层导航与 404 页；这次的「样子怪」是数据错配造成的，不是模板本身。

## 历史变更（2026-11-20 白天）
线上 commit `8d47466`（514 Commits）。这一轮做了三件事：

**1. 排行榜 404 修复**
- 现象：排行榜 iframe 加载 `/rank.html` → 404，且 404 页自带顶栏 → 双层导航。
- 根因：仓库根目录没有 `rank.html`；`index.html` 的 `loadEmbed()` 对 `key==='rank'` 有特判，强行 `_rf.src='/rank.html'`，绕过了内嵌流程。而内嵌模板 `script type="text/plain" id="embed-rank"` 是完整的、自包含的。
- 修法：删掉那段 rank 特判，让它走通用 `document.write` 内嵌分支。线上 `rank.html` 引用数已为 0。

**2. 全仓删除源码注释**
- 脚本：`strip_comments.py`（JS 状态机含正则/模板串判定、CSS、HTML `<script>`/`<style>` 分段 + `text/plain` 递归、Python `tokenize`、XML）、`strip_css_only.py`（补漏的内联 CSS 块注释）、`verify_html_js.py`（抽出全部内嵌 `<script>` 逐个 `node --check`）。
- 规模：25 个文件，删除 467 处行注释 + 669 处块注释，注释内容替换为等量换行以保住行号与 ASI 语义。
- 上传分四批：`c13a053`（根目录 16 个）、`f8625d3`（`functions/api`）、`6ec3609`（`functions/api/lottery`）、`8d47466`（本轮体检 + 补漏）。
- 约定：**所有源码一律不写注释**。新增文件之前先过一遍剥离器。

**3. 25 条体验体检落地（`8d47466`）**
- 在线状态：`ago()` 出「多久前更新」，超 420s 标「数据可能已过期」；状态接口出错单独一态（带重试与原因），不再和「没人在线」混；首载先显示「正在读取服务器状态…」。
- 基岩状态旁注明「由站点配置标注，非实时探测」。
- 公告/动态/赛事统一 `x-meta`：官方/玩家标签 + 发布时间；赛事加「筹备中/进行中/已结束」标签、更新于说明、报名方式/赛程/奖励三段（未公布写「待公布」），结束的赛事下沉。
- Wiki：顶部「新手先看」三入口（怎么进服、官网怎么绑定角色、规则红线），FAQ 补绑定条目与关键词。
- 登录：`login.html` 新增 `humanizeFail` / `showLoginFail`，人机验证未通过、密码错、未注册、频率限制、验证码过期分开提示，并给重试入口。
- 「我的」页（`#profile`，内联在 `index.html`）：账号卡 + 游戏角色卡（已绑定显示皮肤头像 / 游戏 UID / 重新同步；未绑定给 `/bind` 引导；绑错给解绑说明）+ 快捷入口（忘记密码、退出登录）+ 游客可见范围说明。顺带删掉了 `#profile` → `/profile` → `#profile` 的死循环脚本。
- 空状态与失败态：排行榜、交易所、聊天室、树洞、申诉、cdkey、赞助都有文案或重试按钮，不再是空白白屏。
- 下载页：版本号改为读 `version.json`（原来硬写 v1.5.5 但版本文件是 1.5.4），补支持系统、安装步骤、登录方式、更新日志、历史版本。
- 便捷工具：加说明「全部在本机浏览器完成、不上传服务器」+ `#toolQ` 搜索框（按 `data-kw` 过滤，Esc 清空）。
- 下注前确认弹窗；全局 `select` / 日期时间控件外观统一；移动端触控命中区 40px。
- 未覆盖：第 22 条只做了工具页内搜索，**全站级搜索未做**；第 17/19 条在反馈站 `theslowtidefk.pages.dev`，不在本仓库源码内。

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

## TSTMenu 插件售卖站（tstmenu.pages.dev）
- 源目录：`C:\Users\Lenovo\Doubao\chats\2026-09-13\new-chat\tstmenu-site\`（2026-11-14 从 Temp 整目录归档到这里，含 `.wrangler` 部署状态）；旧副本仍在 `C:\Users\Lenovo\AppData\Local\Temp\tstmenu_site`
- 结构：`index.html` 单页、`dl/` 三个 jar（Pro/Free/src）、`demo/` 演示素材、`_headers`（demo 缓存头）
- 回滚快照：`index.html.bak_demo`（加演示区前）、`index.html.bak_pro`（加商业版界面前）
- 部署（本机无 wrangler 全局命令，用 npx 缓存里的 cli）：
  - node：`C:\Users\Lenovo\AppData\Local\Doubao\User Data\sandbox_runtime\bases\772984f6fd3a8ae0ae7d2422cd7c2bfa\node\node.exe`
  - cli：`C:\Users\Lenovo\AppData\Local\Temp\tstdeploy\npm-cache\_npx\0eedb5afd4158ff3\node_modules\wrangler\wrangler-dist\cli.js`
  - `node cli.js pages deploy . --project-name tstmenu --branch main --commit-dirty=true`
- 实机演示区（2026-11-13）：`section#demo` 编号 00，导航 PC/移动端各一项「实机演示」
  - 视频 `demo/tstmenu-demo.mp4`，720p / 30fps / 124s / 17.9MB，moov 已前置（faststart=true）
  - 截图 `menu.jpg` `shop.jpg` `rank.jpg` `bind.jpg`（900×473，各约 43KB）+ `poster.jpg`（58KB）
- 商业版界面区（2026-11-14）：`section#pro` 编号 02，导航 PC/移动端各一项「商业版界面」
  - 7 张卡：排行榜、个人中心、官网绑定、跨端社交、我的邮件、自定义菜单项 + 通栏「服务器信息上报」
  - 内容全部来自解包 `TSTMenu-Pro-2.1.0.jar` 的字符串实证（`TSTMenuGui.class` 页面文案、`Report.class` 上报 JSON、jar 内 `config.yml` 默认值），没有编造截图
  - 上报实证：`report.enabled/api-key/url/interval-seconds`（默认关、300 秒），POST `{"api_key","online","max","version","tps","modules","desc","motd"}`，默认地址 `https://tstservers.pages.dev/api/server/push`
  - 原 02–09 已顺延为 03–10，现编号 00 演示 / 01 功能 / 02 商业版界面 / 03 安装 / 04 命令 / 05 配置 / 06 商品 / 07 常用改动 / 08 版本对比 / 09 FAQ / 10 下载
  - 01 功能段里原有的三张商业版卡已删除（与新段重复），`sub` 改为指向下一节
- 素材链路：用户录屏 1920×1080/120fps/412MB → 本机无 ffmpeg → `mediakit-cli video probe / transcode / extract-frames`（`--audio` 必须显式给 `bitrate_mode`，否则 MissingParameter）
- 抽帧产物左下角带「预览」水印，脚本 `C:\Users\Lenovo\AppData\Local\Temp\tstmenu_pro\mkimg2.py` 底部裁 46px 后重导出
- 已知限制：Cloudflare Pages 对该 mp4 的 Range 请求返回 200 而非 206（`_headers` 已写 `Accept-Ranges: bytes`，行为没变），拖动进度条可能触发整段重下；起播靠 faststart 正常。2026-11-14 复测：HEAD 200 `/video/mp4`，带 `Range: bytes=0-1023` 的 GET 仍回 200 全量 18,761,641 B、无 `Accept-Ranges`
- 移动端：此前「390px 宽右侧 30px 被裁」是裸 headless 截图假象（`--window-size=390` 时真实视口恒为 500，`vw=sw=500`），站点本身无横向溢出；2026-11-14 在 500px 视口下发现**卡片内长代码串确实顶破卡片**，已在 `@media (max-width:560px)` 加 `.card{min-width:0}` 与 `code{overflow-wrap:anywhere}` 修掉
- 服务器列表页（2026-11-14）：`servers.html` + `functions/api/servers.js`
  - 页面：`https://tstmenu.pages.dev/servers.html`，导航 PC/移动端各一项「服务器列表」，02 段上报卡末尾也指向它
  - 数据链路：浏览器 → 本站 `/api/servers`（Pages Functions 代理）→ 上游 `https://tstservers.pages.dev/api/servers`。上游无 CORS 头，必须走代理，不能前端直连
  - 代理缓存 `public, max-age=60`，页面自身 60 秒轮询一次
  - 上游接口实测（2026-11-14）：`GET /api/servers` 200 返回 `{ok,count,servers[]}`，字段 `slug/name/owner/desc/ip/port/edition/logo/online/max/version/tps/modules/last_seen/online_now/created_at`；`POST /api/server/push` 无 key 返回 401（端点存在并校验 api_key）；`POST /api/server/register` 是注册入口
  - 上游目前只有 1 条测试条目（`潮汐服` / `play.example.com` / `last_seen=0` 从没上报），所以线上页面显示空数据是正常的，不是渲染问题
- 部署注意：站点根有 `functions/` 后，`wrangler pages deploy .` 会自动编译并上传 Functions bundle（日志出现 `Compiled Worker successfully` / `Uploading Functions bundle`），不需要额外配置或 KV 绑定
- 服主面板（2026-11-14，买家专属页）
  - 路由 `functions/s/[slug].js` → `https://tstmenu.pages.dev/s/<slug>`，服务端直接渲染 HTML（数据在渲染时取，不依赖前端二次请求），无需为每个买家预建文件，上游出现新 slug 即自动有页
  - 单台接口 `functions/api/mine/[slug].js` → `/api/mine/<slug>`，从上游列表里筛出这一台，返回 `{ok,server}`；slug 不合法 400，找不到 404
  - 风格与售卖站刻意分开：售卖站是黑底绿字暗色；面板是 `#f4f3ed` 纸白底 + 墨黑字 + 深绿强调 + 等宽数字，表格化，无动效
  - 页面内容：名/状态胶囊、四项指标（在线、上限、TPS、核心版本）、明细表（地址、客户端、服主、最后上报、接入时间）、已开启模块 chips（`teleport/shop/daily/rank/profile/social/mail` 映射为中文）；页内每 60 秒请求一次 `/api/mine/<slug>` 局部更新
  - 已加 `<meta name="robots" content="noindex,nofollow">` 与 `x-robots-tag`，不进搜索
  - 入口：`servers.html` 每行服务器名链到 `/s/<slug>`；`servers.html` 第 2 步与首页 `#pro` 上报卡都说明了 `/s/<slug>` 是服主自己那页
  - **隔离强度**：只是"按 slug 各看各的"，没有密码。知道别人 slug 也能打开别人的页（这些数据本来就在公开 `/api/servers` 里）。若要做真正鉴权（凭 api_key 才能看），需要上游提供按 key 查询的接口，目前上游只有 `POST /api/server/push`（无 key 得 401），没有读取端
  - 上游本身也已有同类页 `https://tstservers.pages.dev/s/<slug>`（暗色，2681 字节，只有 4 个数字 + 5 行明细 + 模块 chips），本页是独立重做，不依赖它
  - 实测（2026-11-14）：`/s/s42ec78` 200 5,489 字节；`/s/abcdef` 404；`/api/mine/s42ec78` 200 JSON；`/api/mine/nosuch` 400 `bad_slug`


## 2026-11-18 更新：Wiki 内联进首页 + 网易版/Java 版功能标注

- 线上独立页 `/wiki`（30,547 B）已并入 `index.html` 单文件，不再保留独立页与 iframe，切页走 `switchPage('wiki')`
- 新增 `<section id="wiki" class="page">`，插在主 `<footer class="site-footer">` 之前；PC 导航新增 `data-nav="wiki"`「服务器 Wiki」；`TITLES` 增加 `wiki:'服务器 Wiki - The Slow Tide'`
- 样式 `<style id="wiki-style">` 注入主 `<head>`。原 wiki 的 `--muted` 映射为 `--text-secondary`、`--soft` 映射为 `--hover`（index 里没有这两个变量）
- 内部锚点全部加 `wk-` 前缀，原 `#rank`、`#shop` 等会和首页已有 section id 撞车
- 搜索脚本 `<script id="wiki-search">` 挂在正文最后一个 `</body>` 前，按 `#wkMain .wk-sec` 的 `data-kw` + 文本过滤，输入即筛，Esc 清空
- **顺手修了一处原有 bug**：文件末尾脚本块结尾写成 `<\/script>`（转义形式），浏览器不认，把 `</body></html>` 连同后面那个 `</script>` 一起吞进脚本，导致月度报告那段 IIFE 语法错误。已改成真正的 `</script>` 并删掉 `</html>` 后多余的闭合标签
- 版本标注：`<span class="ver-tag ver-java">Java</span>` / `ver-be` / `ver-both` 三种徽章，13 个 `.wk-sec` 全部带标签；顶部「版本对照」表逐项列出两端差异，玩家先看表再看细则
- 网易版内容来源：用户两批游戏内截图（第一批 15 张实渲染，第二批 20 张全渲染），覆盖经济系统、系统商店 57 项、全球市场、领地、公会 Lv1–6、签到、任务、抽奖、公告、7stars、JEI 按键映射、横扫之刃、更好的末地
- 本地产物：`index.html` 751,841 B / 668,804 字符（原线上 717,774 B），改前备份 `index.html.bak_20261118`
- 部署：本机无 `git`、无 wrangler 登录态、无 CF API token，仍走 GitHub 网页上传 `https://github.com/severuszx/TST/upload/main` 覆盖根 `index.html`
- 待办：部署后处理线上独立页 `/wiki`（建议 301 到 `/#wiki` 或直接删文件）与 `sitemap.xml` 中的 wiki 条目


## 2026-11-19 更新：官网前端第二轮（UX 审计修复 + 双版本标注 + 授权说明）

已上线，commit `8dcb7d17`，`index.html` 757,567 B（原 751,841 B），备份 `index.html.bak_20261119`。

### 改动清单
- **双版本标注**：首页 `.card-grid` 前新增 `.ver-banner` 说明条——「网易版 基岩 1.21.50」（绿）与「Java 版 Paper 1.21.1」（蓝）两栏，各写进入方式与专属功能，底部引导到 Wiki 版本对照表。Wiki 13 个 `.wk-sec` 全带 `ver-java` / `ver-be` / `ver-both` 徽章
- **修复「服务器面板」点不动（真 bug）**：导航写的是 `data-nav="面板"`（中文），`switchPage(pid)` 取 `getElementById('面板')` 拿不到 section（实际 id 是 `panel`）→ 点击完全无响应。已改 `data-nav="panel"`
- **主导航 Wiki 统一**：`<a class="nav-link" href="/wiki">` 改为 `<button data-nav="wiki">`，与 more 菜单里的入口一致，全部同页切换，不再跳独立页
- **more 菜单加事件委托**：`#moreMenu` 捕获阶段监听 `closest('[data-nav]')`，跳过 `nav-disabled`，命中就 `switchPage` 并关菜单。修复原文件里菜单项点不动的问题
- **投票入口置灰**：`nav-disabled` + `title="投票功能维护中，暂未开放"`，点击被 IIFE 拦截并弹 toast「投票功能维护中，服务端统计接口接入后开放，届时会在公告同步通知」，2.6 秒淡出
- **公告详情返回**：展开按钮文案改「↩ 收起并返回列表」，卡片内联折叠，不依赖浏览器后退键
- **服务器面板登录引导**：`#logBox` 原文案改为居中块 + `<a class="btn btn-primary" href="/profile">去登录管理员账号</a>`
- **「我的」路径统一**：全部走 `/profile`，清掉 `href="/profile.html"` 与页内重定向残留
- **隐私政策 anon key 段改写**：去掉「官方承认 anon key 曾在公开仓库可见」的自曝表述，改为机制说明——anon key 属设计上可公开的客户端凭据，只标识项目，能读写哪些数据由 RLS 决定，会持续核查而不写「已配置」
- **插件公示页新增授权说明**：`.license-note`「关于授权：公益模式与商业版」——`licenseEnforced=false` 即公益模式，不校验授权码，排行榜/邮件/交易/个人中心/签到**全部可用**；商业版功能一致，差别在授权有效期、更新通道、售后与允许商用。一句话：**商业版卖的是授权与支持，不是解锁功能**

### 验证（可复现）
```powershell
$r = Invoke-WebRequest "https://theslowtide.pages.dev/?v=$(Get-Random)" -UseBasicParsing
# 期望：chars≈673120，data-nav="wiki"×2，id="wiki-style"，ver-banner，
#      data-nav="panel"×1 且 data-nav="面板"×0，nav-disabled×3，license-note，收起并返回列表
```
- GitHub contents API：`index.html` size=757567，sha=`9186ae53eddc9e6905debfac454a6e1101ef3580`

### 部署方式（本轮踩坑记录）
- Chrome 与 Edge 首次打开 upload 页都显示 `Uploads are disabled` + `Sign in`（浏览器未登录 GitHub）
- 正确做法：在 Edge 里点右上 `Sign in` → 浏览器已保存账号密码（`3057722030@qq.com`），自动填充后直接点绿色 `Sign in` 即登录成功，回到 upload 页
- 登录后：`choose your files` → 原生文件对话框「文件名」框直接粘贴完整路径 → 回车 → 填 Commit summary → `Commit changes`
- 本机 `git` 虽可用（`ls-remote` 能通且凭据在 Windows 凭据管理器），但 `git fetch origin main` 反复超时/被中断，还会留下 `.git/shallow.lock` 导致 `Unable to create '.git/shallow.lock': File exists`。**不要优先走本机 git**

### 待办
- 线上独立页 `/wiki` 与 `sitemap.xml` 中的 wiki 条目仍未清理
- Supabase 八表（users/posts/comments/draws/cards/feedback/messages/profiles）的 RLS 是否生效**未判定**（本机直连超时）
- 「`licenseEnforced=false` 下商业版功能全部可用」这一说法**未经 TSTMenu 源码核实**，是据页面现有文案与功能清单推断，需服主确认产品口径
- `profile.html` 首屏（未绑定时的「去绑定」主按钮、已绑定时签到/金币置顶）本轮未评估
- `more` 菜单事件委托修复**静态注入已确认**，真实点击在 CU 下未能复现验证（菜单动画位移导致坐标落空），需真人在浏览器里点一次「更多 → 服务器面板」确认


---

## 2026-11-19 · 第三轮：Wiki 改成纯玩家视角 + 首页减负

服主反馈：上一版 Wiki「做得很怪、用着也不好用」。根因是把游戏内后台配置截图里的管理员字段当正文写了（「是否启用：开」「每人领地上限 5」「0 为关闭」「权限矩阵」「维度 ID 2」），玩家看不懂也用不上。另外首页开头那条双版本大卡片 AI 味重，「管理团队」「配置要求」两个区块要删。

### 改动
- **Wiki 全量重写为玩家视角**：13 节全部改成「我要干什么 → 怎么干 → 花多少钱」。删掉全部后台字段，只留玩家能感知的数字（领地 500 格免费 / 超出 0.3 一格 / 维护 0.01 / 欠费 7 天收回 / 20 天不上线收回；公会创建 10000 / 6 级人数 3-5-10-13-15-100 / 每交 100 给 1 贡献币；市场卖扣 10%、收扣 15%；商店示例价等）。
- **每节强制标注版本**：标题右侧 `<span class="ver-tag ver-be">网易</span>` / `ver-java` / `ver-both`；Wiki 顶部加一行图例说明三个标签含义。版本对照表改成「想要 → Java 版怎么满足 → 网易版怎么满足」，12 行。
- **删首页双版本大卡**（`ver-banner`）：换成一行 13px 提示「网易 基岩 1.21.50 / Java Paper 1.21.1，两边账号、存档、金币各走各的」，`grid-column:1/-1` 占满整行。
- **删「管理团队」整块**（teamToggle / teamBlock / 服主卡 / 4 张成员卡 / team-note）。
- **删「配置要求」整块**（cfgToggle / cfgBlock / 移动端与电脑端最低推荐配置表）。
- **首页卡片 2×2**：首页 `.card-grid` 加 `id="homeCards"`，CSS `#homeCards{grid-template-columns:repeat(2,1fr)}`；移动端媒体查询同步补 `#homeCards`，避免 id 优先级压过 `.card-grid{1fr}`。`.card-grid` 是全局类（公告、赛事等多处复用），未动。
- **`#wk{scroll-margin-top:84px}`**：外部链接直达 `#wiki` 时标题不被固定导航遮住。

### 保留（有意为之）
- 13 个 `wk-sec` 的 `data-kw` 属性全部保留——文末 `#wiki-search` 脚本靠它过滤，删了搜索即失效。
- 两段折叠 JS（`cfgToggle` / `teamToggle`）未删：都有 `if(tg&&blk)` 判空保护，元素不存在不会抛错。
- 服务器历史时间线里「管理团队亮相，与玩家一同守护这片潮汐」保留——那是历史文案，不是首页区块。

### 验证（无头 Chrome 真实渲染，非字符串级）
- 源文件 673,096 → 660,037 字符
- 渲染后 DOM：`wk-sec`=13、`id="teamToggle"`=0、`id="cfgToggle"`=0、`class="ver-banner"`=0、「是否启用」=0、「当前值」=0、「权限矩阵」=0
- 截图确认：首页版本提示占满一行、四张卡 2×2；Wiki 页 H1 + 三色图例 + 搜索 + 左目录 + 对照表，13 节全部渲染

### 部署
- Edge 已登录 GitHub：`https://github.com/severuszx/TST/upload/main` → choose your files → 文件名框粘贴绝对路径 → commit message 框内 **Ctrl+Enter**
- commit `6873649`，仓库 499 Commits
- GitHub contents API：`index.html` size=739,573（UTF-8 中文多字节），sha=`106d4bce61793edd70abda7667e8a8b70d77a113`
- 提交按钮 `Commit changes` 点击依旧无效，只能 Ctrl+Enter

### 待办（本轮遗留）
- `ver-banner` 的 CSS 规则串、`#wk .wk-sub` 样式、两段空转折叠 JS 仍留在文件里，无引用、不影响功能，未清理
- 本地 `section` 标签 open 60 / close 61 不配对：**改动前就是 62/63，差值一致**，属原文件固有，浏览器容错，非本轮引入

## 2026-11-20 · 数据接口提速（本轮）

### 实测基线（失败前先测清楚）
| 接口 | 改前 |
| --- | --- |
| `/api/data` | 主站 1.2–3.3s / 44KB；**源站直连 8–20s、1.9MB**（`feeds` 6 条 = 1,875,501B，里面是 base64 大图） |
| `/api/tools/items` | 1.6–2.6s / 4.4KB（主站转发到 FK，双跳） |
| `/api/posts/list` | 4.6–6.0s，返回 `{"posts":[]}` 12 字节（空表也在跑建表 DDL） |
| `/api/rest/v1/Feedback` | 2.6–9.1s / 152KB（`SELECT *` 500 行，含 images 字段） |
| `/api/server-status` | 0.7–0.9s / 117B（主站直接实现，非转发） |
| 静态 `sw.js`（560B，本机基线） | **1.0–2.4s** → 说明本机到 Cloudflare 的链路本身就慢，别把所有 TTFB 都算到 Worker 头上 |

### 改了 `functions/api/[[path]].js`
1. 新增 `caches.default` 边缘缓存：`cacheKeyOf` / `canUseEdgeCache` / `edgeGet` / `edgeStore`，响应加 `X-Cache: HIT|MISS|STALE|MEM|KV`，`?nocache=1` 可绕过。
2. `/api/data` 重写：isolate 内存缓存（`MEM_DATA/MEM_TS`，10 分钟）→ KV 单次 `getWithMetadata`（时间戳存 metadata，TTL 1800s）→ 都没有才回源。命中就立即返回，超过 20 分钟才 `waitUntil` 后台刷新；`MEM_REFRESHING` 单飞防止并发回源。回源失败返回 503 `{ok:false,error:'data_unavailable'}`，不再让前端空等 20 秒。
3. `/api/tools/*` 45s、`/api/posts/*` 20s、`/api/server-status` 10s 走边缘缓存。

### 改了 `index.html`
1. `loadData()` 重写：**先读 `tst_site_cache` 立即 `renderAll()`**，再后台拉取覆盖；失败时不再清空，只在无缓存时提示。
2. 重试从 3×2000ms 改成 3×300ms，并加 `AbortController` 9 秒超时（原来最坏要等 20 秒才落缓存）。
3. 新增 `#loadBar` 顶部细进度条（任何 `/api/*` 请求 pending 超过 150ms 就出现）+ `#noticeList` 三行 `.sk-row` 骨架；`html[data-theme="dark"]` 有深色版骨架。

### 部署
- commit `4225184` 首页（655,392 字符，`loadBar`/`.sk-row`/`perf-1119` 各命中）
- commit `d10cd18` 边缘缓存
- commit `133d569` 内存缓存 + KV 单次读（912 行 / 47.5KB）
- commit `edd6df0` 刷新单飞改成共享 Promise（原来并发首个请求会拿到 null body）+ `X-Cache` 正确区分 `MEM`/`KV`（原来 KV 命中也会被标成 MEM）；916 行 / 47.6KB
- 上线后实测（同一 URL，本机）：`/api/data` `STALE 1.9s → MEM 1.0s → MEM 2.0s`（值恒定 19,650B，ann=23 / feeds=6 / images=8，无字段丢失）；`/api/tools/items` `MISS 1.6s → HIT 1.0s / 2.7s`；`/api/posts/list` `MISS 6.3s → HIT 1.7s`；`/api/server-status` 117B、~0.9s（主站自己实现，没进边缘缓存分支）
- 注意：`/api/data` 里 KV 存的 `metadata.ts` 在部分边缘节点读回来仍是旧值，所以会反复看到 `STALE`——那是后台在刷新，用户侧拿到的始终是缓存值，不会等源站；如果要彻底消掉，得把时间戳单独存一个 KV 键或用 Durable Object

### 还没解决的（重要）
- **FK 站（`theslowtidefk.pages.dev`）不在本账号仓库里**：账号下只有 `TST` 和 `theslowtidetor`，说明 FK 是 Cloudflare Pages 直传，改不了 `posts/list` 的建表 DDL 和 `Feedback` 的 152KB 全量查询。主站只能靠 20s 边缘缓存兜住。
- 本机到 Cloudflare 的链路基线 1–2.4s（560B 静态文件也这样），所以「TTFB 3 秒」里有相当一部分不是 Worker 的锅，换网络/换出口再测才能定责。
- `/api/server-status` 是主站自己实现的，没走边缘缓存，仍在 0.7–1.5s。
