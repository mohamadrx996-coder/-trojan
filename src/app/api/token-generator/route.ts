// src/app/api/token-generator/route.ts - Token Generator v9.0 - Simple & Reliable
import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { getLogWebhookUrl } from '@/lib/config';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'edge';

// Discord Token Format (2024-2026):
// P1 = Base64URL(UserID) = 24-26 chars
// P2 = Base64URL(Timestamp) = 6 chars  
// P3 = Base64URL(HMAC-SHA256) = 38 chars
// Total = 70-72 chars (with 2 dots)

const DISCORD_EPOCH = BigInt(1420070400000);

// ==================== UTILITY FUNCTIONS ====================

function stringToBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToString(b64: string): string {
  try {
    const standard = b64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard + '='.repeat((4 - (standard.length % 4)) % 4);
    return atob(padded);
  } catch {
    return '';
  }
}

function getRandomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return bytes;
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

// ==================== TOKEN GENERATOR ====================

function genSnowflake(): string {
  const ts = BigInt(Date.now()) - DISCORD_EPOCH;
  const worker = BigInt(Math.floor(Math.random() * 32));
  const process = BigInt(Math.floor(Math.random() * 32));
  const increment = BigInt(Math.floor(Math.random() * 4096));
  return ((ts << 22n) | (worker << 17n) | (process << 12n) | increment).toString();
}

// P1: 24-26 chars (base64 of snowflake)
function genP1(): string {
  for (let i = 0; i < 100; i++) {
    const snow = genSnowflake();
    const p1 = stringToBase64Url(snow);
    if (p1.length >= 24 && p1.length <= 26) return p1;
  }
  // Fallback: force 26-char by using random bytes that decode to digits
  const randomBytes = getRandomBytes(19);
  let num = '';
  for (let i = 0; i < 19; i++) {
    num += String(randomBytes[i] % 10);
  }
  num = num.replace(/^0+/, '') || '1';
  const padded = num.padEnd(19, '0');
  return stringToBase64Url(padded);
}

// P2: exactly 6 chars
function genP2(): string {
  const hash = getRandomBytes(4);
  const b64 = uint8ToBase64Url(hash);
  return b64.length >= 6 ? b64.substring(0, 6) : b64 + 'AA';
}

// P3: exactly 38 chars (base64 of 28 bytes)
async function genP3(): Promise<string> {
  const strategies = [
    async () => { return uint8ToBase64Url(getRandomBytes(28)); },
    async () => { const h = await hmacSha256(getRandomBytes(32), getRandomBytes(48)); return uint8ToBase64Url(h.subarray(0, 28)); },
    async () => { const h = await sha256(getRandomBytes(64)); return uint8ToBase64Url(h.subarray(0, 28)); }
  ];
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const result = await strategy();
  if (result.length >= 38) return result.substring(0, 38);
  const extra = uint8ToBase64Url(getRandomBytes(6));
  return (result + extra).substring(0, 38);
}

// Generate a complete Discord-format token
async function generateOneToken(): Promise<string> {
  const p1 = genP1();
  const p2 = genP2();
  const p3 = await genP3();
  return `${p1}.${p2}.${p3}`;
}

// Deduplication
const usedTokens = new Set<string>();
function track(token: string): boolean {
  if (usedTokens.has(token)) return false;
  usedTokens.add(token);
  if (usedTokens.size > 50000) {
    const arr = [...usedTokens].slice(0, 25000);
    usedTokens.clear();
    arr.forEach(t => usedTokens.add(t));
  }
  return true;
}

// ==================== API HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(`${ip}:token-generator`, { maxRequests: 15, windowMs: 60000 });
    if (rl.limited) {
      return NextResponse.json({ success: false, error: 'تم تجاوز الحد - حاول بعد دقيقة' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, count } = body;

    // ========== GENERATE TOKENS ==========
    if (action === 'generate') {
      const num = Math.min(Math.max(Number(count) || 10, 1), 200);
      const tokens: string[] = [];

      for (let i = 0; i < num; i++) {
        const token = await generateOneToken();
        if (track(token)) {
          tokens.push(token);
        }
      }

      // Send to webhook
      sendToWebhook({
        username: 'TRJ BOT Token Generator',
        embeds: [{
          title: '🎰 Token Generator',
          color: 0x8b5cf6,
          description: `تم توليد ${tokens.length} توكن`,
          fields: [
            { name: 'العدد', value: String(tokens.length), inline: true },
            { name: 'IP', value: ip, inline: true },
          ],
          footer: { text: 'TRJ BOT v9.0' },
          timestamp: new Date().toISOString(),
        }]
      }, getLogWebhookUrl()).catch(() => {});

      return NextResponse.json({
        success: true,
        tokens,
        message: `تم توليد ${tokens.length} توكن بنجاح`
      });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف' });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'خطأ' });
  }
}
