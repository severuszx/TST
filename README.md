# The Slow Tide (TST)

《我的世界》基岩版服务器 **The Slow Tide** 的官网与官方客户端源码。

## 官网

- 主站: https://theslowtide.pages.dev (Cloudflare Pages 自动部署自本仓库 main 分支)
- 索引页: index.html（统一页，PC 与手机共用）
- 子页面: shop.html(积分商店) / profile.html(个人中心) / planning.html(策划,管理员) / hogwarts.html(哈利波特世界观RPG子站,部署在 theslowtidetor.pages.dev)
- 后端 API: functions/api/ (Cloudflare Workers,认证/发帖/积分/兑换等,配合 D1 数据库)

## 官方客户端（安卓）

- 安装包: TheSlowTide.apk（本仓库根目录）
- 源码: TheSlowTide-App-src.zip（压缩包内附 README）
- 客户端开源: https://github.com/severuszx/TST

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
- 更新公告（软件内推送 + 官网下载页双通道）
- 官网直达（自动注入登录态，同账号通用）

所有下载均在应用内完成，不跳系统浏览器。

- 官网: https://theslowtide.pages.dev
- 指令库(客户端自动读取): https://theslowtide.pages.dev/templates.txt
- 更新公告: https://theslowtide.pages.dev/announcements.json

## 部署

推送 main 分支后 Cloudflare Pages 自动构建: `npx wrangler pages deploy . --project-name=theslowtide`
