# 定制版清理任务失败隔离

2026-11-09：从当前Codex维护的线上Worker选择性借鉴上游 fb490f0470fd87559514847ad0f1e689051384ad 的失败隔离思路，未整包同步上游。

## 实际发布

旧版本：9f6d49dd-e435-4ebf-966c-d20f0d49f5b5
新版本：3a73ce6e-bd26-4fab-af5a-4455904efe33
部署：c226c9c0-277b-4032-a1e1-0aee894d3ae9（100%）

只替换构建产物的 scheduled 清理函数。保留原有三类任务、顺序、开关和 days>0 条件；分别捕获失败后继续下一项，只记录任务类型，不输出邮件内容。没有手动触发生产清理、修改数据库索引/结构或保留天数。未修改Pages、登录、OAuth和收发代码；原绑定全部继承。

对准确候选函数注入首项失败，验证后两项继续；验证禁用和零天数跳过。Cloudflare候选上传成功并保留fetch/email/scheduled处理器。上线后未授权邮件接口仍401。真实定时清理尚待下次Cron运行，不声称已验证生产删除操作。

回滚：将email的100%流量恢复至上述旧版本。

## 候选函数（线上打包符号，不能直接当作TS源码部署）

```js
async function vQ(e34, t, r) {
  console.log("Scheduled event: ", e34);
  const settings = new xp(await Rt({ env: t }, pe.AUTO_CLEANUP_KEY));
  for (const [enabled, days, kind] of [
    [settings.enableMailsAutoCleanup, settings.cleanMailsDays, "mails"],
    [settings.enableUnknowMailsAutoCleanup, settings.cleanUnknowMailsDays, "mails_unknow"],
    [settings.enableSendBoxAutoCleanup, settings.cleanSendBoxDays, "sendbox"]
  ]) {
    if (!enabled || !(days > 0)) continue;
    try { await Wm({ env: t }, kind, days); }
    catch { console.error(JSON.stringify({event:"scheduled_cleanup_failure",kind})); }
  }
}
```

## 其他候选决定

手机页眉改动暂不套用：当前Pages是自用定制版，布局没有确认的新故障。TG两级模型菜单涉及上游2.0架构，不在此次稳定性修复中整体迁移。批量建邮箱、导出登录链接暂不引入。

本PR仅记录定制版已上线补丁，不代表仓库其他旧源码已与线上完全一致。后续部署必须先确认线上基线，禁止以旧仓库整包覆盖。
