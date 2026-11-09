# 邮箱定制版安全候选：尚未切换生产

2026-11-09 北京时间。本次基于实际生产产物制作补丁，未将旧 main 整包部署。

## 当前状态

- 正式 Worker：`3a73ce6e-bd26-4fab-af5a-4455904efe33`，保持 100%。
- 正式 Pages：`d1fdedfc-5dad-4f5c-a821-860e40ec13dc`，未改变。
- 新 Worker 候选：`e924fd72-82b4-42c3-a7e8-95b181b501ee`，已上传，未分配生产流量。
- 预览：https://e924fd72-email.imqing.workers.dev 。真实预览 health_check 200、未带密钥的 webhook 401；未发送含用户消息的伪造 Update。
- 未新增/修改生产账号、邮箱、角色、邮件或数据库结构，未发送外部测试邮件。

## 修复范围

1. 邮件 HTML：自托管固定版本 DOMPurify 3.4.17（保留原许可证），Shadow DOM 和回退渲染均清洗；三个 srcdoc 入口清洗并 sandbox，不允许脚本或同源权限。纯文本先转义。图片、表格和本源 CID blob 图片保留。
2. Telegram webhook：在读 JSON 和运行机器人前校验官方 secret header。密钥以现有 JWT_SECRET 做 HMAC、用机器人 token 和独立用途字符串区分；不增加可泄露的管理入口、不回读/导出密钥。初始化注册时设置同一 secret_token。
3. 地址凭证：受保护 /api 路径、外部发信入口、Telegram 凭证列表增加当前地址 ID 与名称联合检查。有效现有凭证继续使用，已转让/删除地址的旧 ID 被拒绝。没有强制轮换全部 JWT，也没有把所有凭证改为短期到期。
4. 管理后台删除：关联收信、发信、发信权限、自动回复、用户绑定先删除，地址最后删除，同一个 D1 batch 原子执行。不对历史孤儿数据作批量删除。

仓库 TS/Vue 源码同步表达上述修复，scheduled.ts 同步先前已上线的任务失败隔离。为防旧源码误覆盖定制版，四个上游同步/生产部署工作流移出 .github/workflows，归档在 disabled-workflows；本分支尚未合并，不声称 main 的设置已经改变。其他依赖、密码存储、OAuth、收发余额和 UI 布局未在本批修改。

## 已验证与边界

- Node WebCrypto：正确/缺失/错误 webhook 密钥、机器人切换导致旧密钥失效。
- 对准确候选 fetch 的隔离集成测试：当前地址 200、旧/缺 ID 401、外部发信旧 ID 401；伪造 webhook 在任何外部调用前 401；健康检查和后台保护保持。仅测试副本把 cloudflare:sockets 替换成抛错桩，并补 self；不是完整 workerd 验收。
- SQLite：删除顺序、无关地址保留、同名重建不继承旧信、中途异常整体回滚。未在生产执行删除测试。
- jsdom：6 组脚本、事件、危险 URL 和嵌套标记载荷，Shadow 和回退路径；包含未清洗事件能执行的负向对照。普通文本转义，表格、远程图片、本源 blob 图片保留。
- 新 TS helper 用 2025-05-20 的 Workers 类型进行 strict 检查通过；完整旧仓库未重建。
- 本环境 Chromium 启动因进程 socket 权限失败；真实浏览器 iframe/附件/布局、真实 Telegram 消息仍待验收，不能宣称全部完成。
- 线上管理界面现已使用可撤销、8 小时有效会话，没有照搬报告的“仍长期保存明文管理员密码”结论。

## 发布顺序与实际阻碍

应由此前能通过 Wrangler OAuth 成功发布 mail 的环境接手；本会话现有连接器此前 Pages assets 上传有 403/8000013 记录，本轮没有反复重试，也没有扩大权限。当前浏览器没有可用邮箱后台管理员会话；不能伪造或绕过现有 Turnstile/会话来初始化机器人。

1. 复核正式 Worker/Pages 仍等于上述基线；如有新版本，停止套用旧补丁并重新对比。
2. 下载并备份完整生产 Pages 资源，按 apply-runtime.py 对准确产物应用补丁，保留全部其他资源。该脚本需要将 Worker index.js 与 Pages assets 放入同一基线目录，输出到独立目录。用新文件名或可靠的缓存刷新方案确保浏览器和已有 Service Worker 不继续加载旧 JS；不能仅宣称上传成功。
3. 在隔离预览中验证收件箱、后台邮件查看、Telegram 邮件详情的 HTML/纯文本/图片和 iframe，以及既有登录退出、OAuth入口、手机布局；通过后发布前端。
4. 只有具备有效后台会话、可立即初始化机器人时，才将候选 Worker 切到生产。随后从正式后台调用 POST https://apimail.imqing.cc/admin/telegram/init；不要从候选预览域名初始化，避免把 webhook 指向预览地址。保持积压消息，不使用 drop_pending_updates。
5. 检查正式 webhook 无密钥/错误密钥 401、机器人真实消息能正常响应、getWebhookInfo 无新增投递错误；验证当前邮箱仍可读、旧凭证拒绝。实际收发验收按原小额范围进行，不使用真实用户邮箱做破坏性测试。

不能在初始化前随意把候选 Worker 切换为生产，否则正常 Telegram 投递会因缺少新 header 暂时被拒绝。这是发布协调依赖，不是要求用户重新授权已有范围。

## 回滚

前端恢复完整基线资源并确认缓存更新；Worker 恢复上述正式版本。旧 Worker 不校验新 secret header，因此回滚不需要删除 Telegram 已设置的 secret，也不丢弃积压消息。不得为回滚重置 JWT_SECRET 或管理员密码。

## 本地复核

apply-runtime.py 只生成文件，不上传。isolated-tests.mjs 需要 jsdom；通过 MAIL_FRONTEND_CANDIDATE 指向生成的前端文件。integration-tests.mjs 需要 MAIL_WORKER_TEST_COPY 指向仅在测试中替换 cloudflare:sockets 的 Worker 副本。结果文件说明环境边界，不能代替真实浏览器和 Telegram 验收。
