import { Context } from 'hono';
import { cleanup } from './common'
import { CONSTANTS } from './constants'
import { getJsonSetting } from './utils';
import { CleanupSettings } from './models';

export async function scheduled(event: ScheduledEvent, env: Bindings, ctx: any) {
    console.log("Scheduled event: ", event);
    const value = await getJsonSetting(
        { env: env, } as Context<HonoCustomType>,
        CONSTANTS.AUTO_CLEANUP_KEY
    );
    const autoCleanupSetting = new CleanupSettings(value);
    const tasks = [
        [autoCleanupSetting.enableMailsAutoCleanup, autoCleanupSetting.cleanMailsDays, "mails"],
        [autoCleanupSetting.enableUnknowMailsAutoCleanup, autoCleanupSetting.cleanUnknowMailsDays, "mails_unknow"],
        [autoCleanupSetting.enableSendBoxAutoCleanup, autoCleanupSetting.cleanSendBoxDays, "sendbox"],
    ] as const;
    for (const [enabled, days, kind] of tasks) {
        if (!enabled || !(days > 0)) continue;
        try { await cleanup({ env } as Context<HonoCustomType>, kind, days); }
        catch { console.error(JSON.stringify({event:"scheduled_cleanup_failure", kind})); }
    }
}
