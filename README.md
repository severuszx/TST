# The Slow Tide (TST)

《我的世界》基岩版服务器 The Slow Tide 的官网与官方客户端源码。

## 官网

- 主站: https://theslowtide.pages.dev (Cloudflare Pages 自动部署自本仓库 main 分支)
- 索引页: index.html(PC) / mobile.html(手机)
- 子页面: shop.html(积分商店) / tool.html(便捷工具) / profile.html(个人中心) / planning.html(策划,管理员) / hogwarts.html(哈利波特世界观RPG子站,部署在 theslowtidetor.pages.dev)
- 后端 API: functions/api/ (Cloudflare Workers,认证/发帖/积分/兑换等,配合 D1 数据库)

## 官方客户端

安卓指令工具 TheSlowTide.apk(本仓库根目录)源码见 TheSlowTide-App-src.zip,功能与构建方法见压缩包内 README。

- 官网: https://theslowtide.pages.dev
- 指令库(客户端自动读取): https://theslowtide.pages.dev/templates.txt
- 更新公告: https://theslowtide.pages.dev/announcements.json

## 部署

推送 main 分支后 Cloudflare Pages 自动构建: `npx wrangler pages deploy . --project-name=theslowtide`
