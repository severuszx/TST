# TST 技术债登记

| # | 债务 | 影响 | 处理 |
|---|---|---|---|
| 1 | 首页仍是单文件站点，内嵌 5 套子页源码 | 改一行样式要重下整个 1MB 文件；模板内 `</html>` 让静态检查误报 | 中期拆成真实子页 + 公共 `base.css` / `common.js` |
| 2 | 子页用 `document.write` 注入 iframe | `srcdoc` 下脚本不执行，外部工具无法解析 | 子页落成真实文件后改 `iframe src` |
| 3 | 主文档和 5 个子页各有一份 header | 改导航要改 6 处，漏一处就不一致 | 抽 `renderHeader()` 或 `header.html` |
| 4 | 全站 `getElementById` 约 559 次、340 个 id，3 个 id 不存在 | 死引用靠 `if(x)` 兜着，功能点了没反应 | 加 `$()` 封装 + 启动 id 差集断言 |
| 5 | `chatTimer` 无 `clearInterval`，`setInterval(loadChatStatus,30000)` 无句柄 | 离开聊天室仍轮询 | 定时器注册表 `startTimer/stopTimer/clearPageTimers` |
| 6 | `/api/posts` 是 404 死常量 | 调用点静默失败 | 删除常量，统一走 `/api/tst/*` |
| 7 | 投票页无服务端统计 | 入口存在但只能显示维护中 | 接 `/api/vote` 或摘入口；当前已改成明确空状态 |
| 8 | `/api/data` 返回 51KB 全量数据 | 每次打开全量拉，慢 | 拆列表接口 + 分页 + ETag（服务端已先去重） |
| 9 | 调试码前端残留 `if(code==='TST-GLASS')` 死代码 | 前端可绕过/误判 | 统一走 `/api/debug/verify`，删本地判断 |
| 10 | `glassToast` / `lgEditCard` / `planLink` 死引用 | 功能入口点了无反应 | 逐个删或补实现 |
| 11 | 管理页 `admin.html` 源文件曾在 `</html>` 后带 632 字符数字 | 浏览器当正文，撑出 6063px | 源文件已截断；加 `predeploy_check.py` 防回归 |
| 12 | 无版本 tag / 无 dev 预览 | 回滚只能靠记忆 | 发版打 `vYYYY.MM.DD-x` tag；开 dev 分支预览 |

## 规则
- 功能下线必须同时：摘入口、删页面、删接口调用。
- 每周清一条，不攒。
