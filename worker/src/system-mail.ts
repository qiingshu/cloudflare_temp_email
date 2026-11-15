const escapeHtml = (value: unknown): string => String(value).replace(/[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

const frame = (title: string, englishTitle: string, content: string): string => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f7f5;color:#24332b;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7f5"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;background-color:#ffffff;border:1px solid #e4ebe6;border-radius:16px"><tr><td style="padding:28px 24px">
<p style="margin:0 0 24px;color:#348152;font-size:13px;font-weight:bold;letter-spacing:1px">Qiingshu Mail</p>
<h1 style="margin:0;font-size:23px;line-height:1.4;font-weight:700;color:#24332b">${escapeHtml(title)}</h1>
<p lang="en" style="margin:6px 0 24px;font-size:14px;line-height:1.6;color:#6b7870">${escapeHtml(englishTitle)}</p>
${content}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:28px;border-top:1px solid #e5ebe7"><tr><td style="padding-top:20px;font-size:12px;line-height:1.7;color:#718077">
<p style="margin:0 0 8px">此邮件由系统自动生成，请勿直接回复。</p>
<p lang="en" style="margin:0 0 16px">This is an automated email. Please do not reply.</p>
<p style="margin:0">需要帮助 / Need help?<br><a href="mailto:hi@imqing.cc" style="color:#348152;text-decoration:underline">hi@imqing.cc</a></p>
</td></tr></table></td></tr></table></td></tr></table></body></html>`;

export const renderVerificationMail = (code: string): string => frame('邮箱验证码', 'Email verification code', `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:22px 12px;background-color:#f1f7f3;border:1px solid #dfebe2;border-radius:10px">
<span style="font-family:Arial,sans-serif;font-size:32px;line-height:1.3;font-weight:700;letter-spacing:5px;color:#215d38;white-space:nowrap">${escapeHtml(code)}</span>
</td></tr></table>
<p style="margin:14px 0 0;text-align:center;font-size:14px;line-height:1.6;color:#4e6155">5 分钟内有效<br><span lang="en" style="font-size:13px;color:#718077">Valid for 5 minutes</span></p>
<p style="margin:28px 0 0;font-size:15px;line-height:1.8;color:#3c4b42">请勿向他人泄露验证码。如非本人操作，请忽略此邮件。</p>
<p lang="en" style="margin:16px 0 0;font-size:14px;line-height:1.8;color:#6b7870">Do not share this code. If you did not request it, please ignore this email.</p>`);

export const renderSendAccessMail = (enabled: boolean | number, balance: unknown): string => frame('发信权限已更新', 'Sending permissions updated', `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f7f3;border:1px solid #dfebe2;border-radius:10px"><tr><td style="padding:20px">
<p style="margin:0;font-size:18px;line-height:1.6;font-weight:700;color:#215d38">发信权限已${enabled ? '开启' : '关闭'}</p>
<p lang="en" style="margin:6px 0 20px;font-size:14px;line-height:1.6;color:#6b7870">Sending ${enabled ? 'enabled' : 'disabled'}</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b7870">剩余发信额度 / Remaining quota</p>
<p style="margin:0;font-family:Arial,sans-serif;font-size:30px;line-height:1.3;font-weight:700;color:#24332b;overflow-wrap:anywhere;word-break:break-all">${escapeHtml(balance)}</p>
</td></tr></table>
<p style="margin:24px 0 0;font-size:15px;line-height:1.8;color:#3c4b42">您的发信权限或额度已更新，请以账户当前设置为准。</p>
<p lang="en" style="margin:16px 0 0;font-size:14px;line-height:1.8;color:#6b7870">Your sending permissions or quota have been updated. Your current account settings apply.</p>`);
