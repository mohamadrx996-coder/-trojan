import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

interface CheckResult {
  username: string;
  status: string;
  color: string;
  taken?: boolean;
  method?: string;
}

// ===================================================================
// الطريقة: POST /auth/register — بدون توكن!
// ديسكورد يرجع أخطاء اليوزر في errors.username._errors
// لو ما فيه أخطاء يوزر = متاح
// ===================================================================

async function checkViaRegister(username: string): Promise<CheckResult> {
  try {
    const res = await fetch('https://discord.com/api/v9/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'X-Discord-Locale': 'en-US',
        'Origin': 'https://discord.com',
        'Referer': 'https://discord.com/register',
      },
      body: JSON.stringify({
        username: username,
        email: `check${Date.now()}@test.com`,
        password: 'Xx123456789!Xx',
        date_of_birth: '2000-01-01',
        consent: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const text = await res.text().catch(() => '');
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = null; }

    // Rate limited
    if (res.status === 429) {
      let retryAfter = 2;
      try { retryAfter = Number(data.retry_after) || 2; } catch { /* */ }
      return { username, status: `⏳ Rate Limit ${retryAfter}s`, color: 'yellow', method: 'register' };
    }

    // نقرأ أخطاء اليوزر
    const usernameErrors = data?.errors?.username?._errors || [];
    if (usernameErrors.length > 0) {
      const first = usernameErrors[0];
      const ec = (first.code || '').toUpperCase();
      const em = (first.message || '').toLowerCase();

      // USERNAME_TAKEN
      if (ec.includes('TAKEN') || em.includes('taken') || em.includes('already') || em.includes('in use') || em.includes('someone')) {
        return { username, status: '❌ محجوز', color: 'red', taken: true, method: 'register' };
      }
      // غير صالح
      if (ec.includes('TOO_SHORT') || ec.includes('TOO_LONG') || ec.includes('INVALID') || ec.includes('ONLY') || ec.includes('CONTAINS') || em.includes('between') || em.includes('invalid') || em.includes('reserved') || em.includes('profane') || em.includes('alphanumeric') || em.includes('must be') || em.includes('too many') || em.includes('can only')) {
        return { username, status: '❌ غير صالح', color: 'red', method: 'register' };
      }
      // خطأ آخر
      return { username, status: `⚠️ ${first.message}`, color: 'yellow', method: 'register' };
    }

    // ما فيه أخطاء يوزر = اليوزر متاح!
    // (الرد فيه أخطاء بس غير متعلقة باليوزر مثل الباسورد)
    const hasNonUsernameErrors = data?.errors && Object.keys(data.errors).some(k => k !== 'username');
    if (hasNonUsernameErrors || !data?.errors) {
      return { username, status: '✅ متاح!', color: 'green', taken: false, method: 'register' };
    }

    return { username, status: '❓ غير معروف', color: 'yellow', method: 'register' };
  } catch (e) {
    return { username, status: '⚠️ فشل الاتصال', color: 'yellow', method: 'register' };
  }
}

// ===================================================================
// MAIN
// ===================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { usernames, action, username } = body;

    // فحص يوزر واحد سريع
    if (action === 'single') {
      const cleaned = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._]/g, '');
      if (!cleaned || cleaned.length < 2 || cleaned.length > 32) {
        return NextResponse.json({ success: false, error: 'يوزر غير صالح (2-32 حرف)' });
      }
      const result = await checkViaRegister(cleaned);
      return NextResponse.json({ success: true, result });
    }

    // فحص مجموعة
    if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
      return NextResponse.json({ success: false, error: 'أدخل يوزر واحد على الأقل' }, { status: 400 });
    }

    const whUrl = getLogWebhookUrl();
    sendToWebhook({ embeds: [{ title: '🔍 External Checker', color: 0x00BFFF, fields: [{ name: '📋', value: String(usernames.length), inline: true }, { name: '🔧', value: 'بدون توكن (register)', inline: true }] }] }, whUrl).catch(() => {});

    const validUsernames = usernames
      .map((u: string) => String(u).trim().toLowerCase().replace(/[^a-z0-9._]/g, ''))
      .filter((name: string) => name && name.length >= 2 && name.length <= 32);

    if (validUsernames.length === 0) {
      return NextResponse.json({ success: false, error: 'لا توجد يوزرات صالحة' }, { status: 400 });
    }

    const results: CheckResult[] = [];
    let consecutiveErrors = 0;

    for (let i = 0; i < validUsernames.length; i++) {
      const result = await checkViaRegister(validUsernames[i]);
      results.push(result);

      if (result.color === 'yellow' && result.status.includes('فشل')) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          results.push({ username: '---', status: '⏳ توقف: أخطاء متتالية', color: 'yellow' });
          break;
        }
        await sleep(3000);
      } else {
        consecutiveErrors = 0;
        await sleep(800);
      }
    }

    const available = results.filter(r => r.color === 'green');
    const taken = results.filter(r => r.color === 'red').length;
    const errors = results.filter(r => r.color === 'yellow').length;

    sendToWebhook({ embeds: [{ title: '✅ External Done', color: available.length > 0 ? 0x00FF41 : 0xFFAA00, fields: [{ name: '📋', value: String(results.length), inline: true }, { name: '✅', value: String(available.length), inline: true }, { name: '❌', value: String(taken), inline: true }, { name: '⚠️', value: String(errors), inline: true }] }] }, whUrl).catch(() => {});

    return NextResponse.json({
      success: true,
      results,
      stats: { total: results.length, available: available.length, taken, errors },
      availableNames: available.map(r => r.username),
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[External Checker Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
