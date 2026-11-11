# TST 接手文档（给三个月后的自己）

> 最后更新：2026-11-11（发布 v1.5.4 客户端 + 新增独立管理后台 admin.html）

## 一、目录

| 文件 | 作用 |
| --- | --- |
| `index.html` | 主站全部页面 + 管理员覆盖层 + 5 套子页模板（`script type="text/plain" id="embed-*"`），约 1MB 单文件 |
| `admin.html` | **新的独立管理后台**（单独页面、单独标签页打开）。表格化界面，无饼图/环形图 |
| `login.html` | 登录 / 注册 / 重置密码三视图 |
| `404.html`、`up_profile.html`、`_idx_fix.html` | 备用/历史页面，正常情况用不到 |
| `functions/api/[[path]].js` | Cloudflare Pages Functions 路由：`/api/data`、`/api/admin` 转发数据站；`/api/auth/*`、`/api/rest/*` 代理 Supabase；`/api/lottery/*` 抽奖 |
| `version.json` | 客户端更新清单，App 更新公告页直接读它 |
| `TheSlowTide.apk` | 下载按钮用的固定文件名安装包（**每次发版覆盖它**） |
| `TheSlowTide-v1.5.4.apk` 等 | 历史版本归档，只增不改 |
| `HANDOFF.md` | 本文件 |
| `README.md` | 项目说明 |
| `TECH_DEBT.md` | 已知技术债 |
| `RELEASE_CHECKLIST.md` | 发版勾选清单 |
| `predeploy_check.py` | 部署前结构门禁 |

## 二、数据与接口

- 数据服务：`https://tst-server-site.pages.dev`（无源站，可 API 直传）
- `GET /api/data` → `{ok,announcements[],feeds[],sponsors[],images[],replays[],server{address,qq,start}}`
  - `announcements` 项：`{id,title,content,date}`，历史公告用 `title:"hist:<日期>"` 前缀区分
  - `feeds` 项：`{id,title,content,image,pinned,date}`
  - `sponsors` 项：`{id,name,amount}`
  - `images` 项：`{id,name,data|url}`
  - `replays` 项：`{id,title,url,date}`
- 后台接口：`POST https://tst-server-site.pages.dev/api/admin`
  - 登录：`{action:"login",password:"<ADMIN_PWD>"}` → `{ok,token}`
  - 其余：`Authorization: Bearer <token>`，body `{action,data,...extra}`
- 已存在 action（前端只用这些）：
  - `addAnnouncement{title,content,date}` / `updateAnnouncement{...}`（带 `{id}`）/ `deleteAnnouncement`（data 里放 `{id}`）
  - `addFeed{title,content,image,pinned,date}` / `updateFeed` / `deleteFeed`
  - `addSponsor{name,amount}` / `updateSponsor` / `deleteSponsor`
  - `addReplay{title,url,date}` / `updateReplay` / `deleteReplay`
  - `uploadImage{name,data:<dataURL>}`（前端限 1.5MB）/ `deleteImage{id}`
  - **成功返回里通常直接带上被改动的整个集合**（如 `{ok,announcements:[...]}`），前端应该用它整体替换本地列表
- 管理员口令在服务端环境变量 `ADMIN_PWD`，仓库里不含明文
- 抽奖核销：`/api/lottery/*`，用 isolate 内存 Map 限抽 + 奖品名加 `【已使用】` 前缀做核销标记（不是真原子操作）

## 三、管理后台 admin.html（2026-11-11 新做）

- 地址：`https://theslowtide.pages.dev/admin.html`，单独页面，建议单独标签页常开
- 标签：概览 / 服务器公告 / 赛事动态 / 赞助名单 / 图片素材 / 录像 / 服务器信息 / 版本发布
- 设计约束（用户明确要求，改动时不要退回旧做法）：
  - **不要饼图、环形图**；统计用数字卡 + 横向条形 + 表格
  - 列表必须表格化，可搜索、可翻页（每页 12 条）
  - 数据只拉一次（`/api/data`，缓存 30 秒，右上「刷新数据」强制重取），**不要加轮询**
  - 提交时按钮禁用 + 全局 `busy` 锁，成功后接收服务端返回的集合整体替换本地列表，渲染按 `id` 去重
    → 这是"上传一次出现好多条"的根治方法：旧后台把新条目 append 进列表、同时又整表刷新，导致重复渲染
  - 删除类操作：`deleteXxx` 的 `id` 放进 `data` 里；`updateXxx` 的 `id` 放在 body 顶层（沿用旧前端习惯，不要混）

## 四、发版流程（客户端）

1. 构建：`& "C:\Users\Lenovo\Doubao\chats\2026-09-13\new-chat\build_apk\build.ps1"`，产物 `build_apk\out\TheSlowTide.apk`（本机没有 `powershell.exe`、没有 `git`）
2. 上传 GitHub（网页 `/upload/main`）：
   - 二进制改名为 `TheSlowTide-v<版本>.apk` 上传 —— **同名覆盖经常被静默吞掉**，用版本化文件名才可靠
   - 再把同一个包命名为 `TheSlowTide.apk` 覆盖根目录（下载按钮写死这个名字）
3. 改 `version.json`：`url` 指向 `https://theslowtide.pages.dev/TheSlowTide-v<版本>.apk`，同时改 `versionCode` / `versionName` / `note`
4. 等 Cloudflare Pages 自动构建 1–2 分钟
5. 线上核对：`https://theslowtide.pages.dev/version.json` 内容、`HEAD` 安装包 200、下载回来算 SHA256 与本地一致

**v1.5.4 已发布**：`versionCode 19`，包 303,799 B，SHA256 `5F9164789622C8D43404ECC5789B008F44135D318402A329514C13213008193D`

## 五、每次做完必须更新

- 更新 `HANDOFF.md`（本文件）与 `README.md`
- 更新 `admin.html` 里的「版本/发布」页说明（如流程有变）
- 记下本次踩的坑（操作方式、被平台吞掉的行为、绕路方案）

## 六、已知坑（踩过的）

- 本机 `hosts` 里有 29 行 `127.0.0.1 github*`，文件不可写、提权失败；实测 GitHub 仍可访问，暂不处理
- GitHub 网页编辑器提交后可能没有真正覆盖二进制文件，必须用 GitHub API 复核 `size`
- 产品浏览器（`bu`）在本机已失效（`no browser tab is available`），GitHub 操作走桌面 `cu` + 用户 Edge（`severuszx` 已登录）
- `cu` 坐标是 0–1000 归一化，传像素会报 `PY_COORDINATE_SPACE_ERROR`
- D1 每日 10 万行写配额可能被打满（曾发生在 2026-11-10，次日 00:00 UTC 重置）；打满期间写操作报错，存量数据不受影响

## 七、验证手段

- 本地：`python -m http.server 8899 --directory _deploy`
- 线上：`https://theslowtide.pages.dev/?v=<时间戳>`，确认无重复数据、导航正常
- 接口：直接 `GET https://tst-server-site.pages.dev/api/data` 看集合条数
