# 系统发信模板统一（2026-11-15）

完整核对固定系统邮件入口：额度通知 sendAdminInternalMail 已在PR6统一；注册/重置密码共用 user_api/user.ts 的verifyCode，本次补齐。未发现其他固定系统邮件模板。管理员/用户手写发信、用户自设自动回复、移除附件后重建原邮件、Webhook测试载荷均不覆盖成系统通知。

本次只修改验证码模板：名称Admin；标题“邮箱验证码 / Email verification code”；正文中英双语，保留同一个六位验证码，说明5分钟有效、不要泄露、非本人操作忽略，以及请勿回复/联系hi@imqing.cc。发送地址继续取后台verifyMailSender，不改变用户已设的admin@imqing.cc。额度通知保持PR6模板。

源码仅worker/src/user_api/user.ts。直接在已核对线上版本496cb33f-36a8-4f77-8fad-5ed20d799fa3执行3处模板替换，详见runtime-replacements.json和runtime.patch。完整包前后哈希见hashes.json；候选dff30cc6-c683-4fa0-bf12-81862b442cb8。其余运行字节、发信流程、验证码生成/KV键/300秒TTL、配置和绑定、权限/额度、Pages均保留。

验证：候选模块语法检查、diff检查、实际候选模板经mimetext3.0.27生成后用postal-mime解析通过；检查Admin、双语标题正文、同一验证码、5分钟及联系提示。没有发送真实验证码，没有修改账号密码、余额、数据或历史邮件。未重复全站审查。

回滚仅将email流量恢复496cb33f-36a8-4f77-8fad-5ed20d799fa3。
