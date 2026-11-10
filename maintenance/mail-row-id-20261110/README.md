# 邮件行 ID 增量候选（2026-11-10）

仅供增量复核；未合并、未上传候选、未部署、未修改生产配置或数据。等待 ChatGPT 汇总外部增量审查和用户下达发布指令。

## 当前线上与仓库

当前 main `1bc122b7d07a61c96f955bf509981795c425d208`。Cloudflare email 的线上 deployment `5d555693-b3d9-4f74-875d-f487083d7d2c`，100% version `6ca47042-7f2b-4da5-9a26-7b9717ce182c`。本次重新 GET 线上完整包，index.js SHA256 `0a109e789a8081f80604c9a30a2ad48d923a30ab6f513027f3ce94499dcbb9c4`，与上一轮已验收产物完全一致。兼容日期2025-05-19、nodejs_compat；脱敏绑定类型和只读 PRAGMA table_info(raw_mails) 结果在 evidence/。没有读取邮件正文或写生产数据库。

仓库与线上都仍有 address + message_id 反查。当前无 ai_extract 模块、无 raw_mails.metadata 列；不为了移植新上游而增加 AI 或迁移数据库。既有 webhook 邮件元信息和 Telegram 查看链接是本次实际适配路径。上游来源 https://github.com/dreamhunter2333/cloudflare_temp_email/pull/1194 （合并fe3a1062723d6fcda58b77534d5dcc7d365b4332，审查head acaeb6dcc362b47ee29216bb27b52279e503f5fb）。

## 必要改动

源码仅3文件：从本次 INSERT.run() 返回的 meta.last_row_id 取得安全正整数；按请求局部变量沿 webhook 元信息和 Telegram 传递。Message-ID 原样存储、协议用途保留，不再用它反查行。不用 MAX、最新一行或独立 last_insert_rowid 查询。INSERT失败/抛异常/缺失合法返回ID时，不产生关联链接或推送；原有转发、RPC及自动回复流程保留。

个人推送仍调用 telegramOwnsCurrentAddress，ID不授权访问。Telegram地址隔离、会话/退出、权限校验、发件箱Shadow清洗和全部Pages保持。仓库根源码与线上有历史定制差异，禁止整包重建覆盖：runtime/candidate.js以当前线上包为底，仅修改email的INSERT/传参和sendMailToTelegram、triggerWebhook三处函数。runtime.patch可逐行审查；三处函数之外的规范化字节哈希相同（increment-integrity.json）。hello邮箱现有副本转发、AuthInbox RPC、清理、登录和权限等线上定制不变。

## 验证与复现

11组行ID回归通过，完整TAP在evidence/row-id-tests.txt。实际候选包执行接收邮件函数及真实解析/签名/地址归属函数，数据库为Node内存SQLite；INSERT返回结果映射为D1 meta.last_row_id，并故意交错完成16路同地址收件。覆盖重复/缺失Message-ID、不同地址相同Message-ID、失败/异常/缺失ID、个人链接和收件人归属、旧凭证拒绝。数据库夹具禁止反查raw_mails。Telegram仅在测试中替换一次callApi并通过AsyncLocalStorage按请求记录；webhook全局fetch同样只记录夹具，不真实发送。当前没有AI提取路径，因此没有伪称测试AI输出。

独立准备：在本目录放入重新获取且哈希一致的runtime/baseline.js，使用已锁定worker开发依赖，执行 `node prepare.cjs`。它验证基线哈希，输出candidate.js及只用于Node的candidate-test.mjs（仅将cloudflare:sockets替换成拒绝访问桩，并添加测试导出），不会上传或部署。执行 `node row-id.test.mjs`，检查TAP为11通过0失败。当前实际使用Node22.23.3及esbuild0.25.4。Wrangler4.151.1对无绑定临时配置完成dry-run打包，输出见evidence/dry-run.txt；未升级项目锁文件或依赖。原生workerd/D1、真实邮件和Telegram端到端未执行，不将SQLite契约夹具称为原生D1测试。

已验收登录/退出和发件箱浏览器证据沿用上一轮（maintenance/security-20261109及telegram-sendbox-20261109.md）。相关运行字节和Pages此次完全不变，不重复宽泛扫描。没有整体同步上游前端、依赖或迁移。

## 候选发布及恢复

先复核本增量、完整候选源码和SHA256SUMS。发布前再次只读确认线上version/包哈希/配置未漂移，记录独立候选包SHA；若不一致停止并重新变基。隔离预览必须使用独立D1/KV和邮件/模型/Telegram桩，不使用生产绑定；本轮没有创建远程预览。

只有用户明确发布指令后才按既有部署流程上传已审查runtime/candidate.js，保留所有当前绑定、变量、secret、compatibility及路由。Pages无需发布。切换前保留当前version可用性和完整原包；不执行迁移、不重放邮件、不批量更新历史行。

恢复只将email的流量切回版本6ca47042-7f2b-4da5-9a26-7b9717ce182c，保持现有设置和Pages；若版本不可取得，用校验过的原包及当前配置恢复，不能从旧fork重建。回滚不会撤销已发送通知/新邮件；本次未发送真实通知。无需数据库回滚。完整源码、差异、复核输出均附哈希；剩余既有KV传播和并发读改写限制保持原记录。

D1契约依据 https://developers.cloudflare.com/d1/worker-api/prepared-statements/ 。

## 本轮最小修正

源码telegram-isolation.test.mjs三处旧字符串参数改为正整数行ID；同名重建两组各有相同有效行ID的正向投递对照。源码test:security 8/8通过。仅删除telegramOwnsCurrentAddress校验的定向变异被源码入口检出，数字行ID守卫始终保留；源码恢复后8/8再次通过。未按变异数量扩大范围。

INSERT成功与ID有效性现独立判断：success=true但ID为0、1.5、字符串或缺失时，SQLite夹具确认已插入行保留，setReject=0、Telegram=0、webhook=0，并仅记录固定mail_row_id_unavailable事件（无地址/Message-ID/原始ID/邮件正文）。success=false或INSERT抛异常时，setReject=1、插入行=0、推送=0。正常正整数仍完整投递，旧凭证仍拒绝。行ID链路11/11通过，源码和完整线上派生bundle同步。

只读PRAGMA返回的last_row_id=0是该只读语句的元信息，不能据此推断INSERT会返回0。新增异常ID用例是防御性契约夹具，不是对生产INSERT行为的断言。本轮没有真实收信、生产SQL写入或真实Telegram调用。相关证据source-security.txt、row-id-tests.txt、ownership-mutation.json/txt均附实际哈希。
