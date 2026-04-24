import { NextRequest, NextResponse } from 'next/server';
import { uint8ToBase64Url, stringToBase64Url, base64UrlToString, getRandomBytes, hmacSha256, sha256, sha512 } from '@/lib/edge-utils';
import { sendToWebhook } from '@/lib/webhook';
import { getLogWebhookUrl } from '@/lib/config';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'edge';

const DISCORD_EPOCH = BigInt(1420070400000);

// ============================================================
// Discord Token Structure: USERID_BASE64 . TIMESTAMP_BASE64 . HMAC_HEX
// P1 = base64url(userID) ~24-26 chars
// P2 = base64url(timestamp) ~16-18 chars  
// P3 = base64url(random hash) ~38 chars
// Total: ~78-84 chars
// ============================================================

function genSnow(): string {
  const ts = BigInt(Date.now()) - DISCORD_EPOCH;
  const worker = BigInt(Math.floor(Math.random() * 1024));
  const process = BigInt(Math.floor(Math.random() * 1024));
  const increment = BigInt(Math.floor(Math.random() * 4096));
  return ((ts << 22n) | (worker << 17n) | (process << 12n) | increment).toString();
}

// P1 = base64url of user ID string (always pad to 19 chars for consistent length)
function genP1(uid?: string): string {
  const snow = uid || genSnow();
  const padded = snow.padStart(19, '0').substring(0, 19);
  return stringToBase64Url(padded);
}

// P2 = base64url of timestamp
function genP2(): string {
  const ts = Date.now().toString();
  return stringToBase64Url(ts);
}

function genP2Smart(s: number): string {
  const now = Date.now();
  let ts: number;
  const r = s % 15;
  if (r < 3) ts = now;
  else if (r < 5) ts = now - Math.floor(Math.random() * 86400000);
  else if (r < 7) ts = now - Math.floor(Math.random() * 7 * 86400000);
  else if (r < 9) ts = now - Math.floor(Math.random() * 30 * 86400000);
  else if (r < 11) ts = now - Math.floor(Math.random() * 90 * 86400000);
  else if (r < 12) ts = now - Math.floor(Math.random() * 180 * 86400000);
  else if (r < 13) ts = now - Math.floor(Math.random() * 365 * 86400000);
  else ts = now - Math.floor(Math.random() * 14 * 86400000);
  return stringToBase64Url(ts.toString());
}

// P3 = base64url of random bytes (28 bytes = 38 chars base64url without padding)
function genP3(): string {
  return uint8ToBase64Url(getRandomBytes(28));
}

async function genP3Smart(s: number): Promise<string> {
  const r = s % 5;
  if (r === 0) return uint8ToBase64Url(getRandomBytes(28));
  if (r === 1) {
    const keyBytes = getRandomBytes(32);
    const dataBytes = getRandomBytes(48);
    const h = await hmacSha256(keyBytes, dataBytes);
    return uint8ToBase64Url(h.subarray(0, 28));
  }
  if (r === 2) {
    const h = await sha256(getRandomBytes(64));
    return uint8ToBase64Url(h.subarray(0, 28));
  }
  if (r === 3) {
    const h = await sha512(getRandomBytes(64));
    return uint8ToBase64Url(h.subarray(0, 28));
  }
  return uint8ToBase64Url(getRandomBytes(28));
}

function build(p1: string, p2: string, p3: string): string {
  return `${p1}.${p2}.${p3}`;
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Dedup
const usedTokens = new Set<string>();
function track(t: string): boolean {
  if (usedTokens.has(t)) return false;
  usedTokens.add(t);
  if (usedTokens.size > 500000) {
    const a = [...usedTokens];
    for (let i = 0; i < 250000; i++) usedTokens.delete(a[i]);
  }
  return true;
}

async function genToken(s: number, fP1?: string, fP2?: string, fP3?: string, exclude?: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const p1 = fP1 || genP1();
    const p2 = fP2 || genP2Smart(s + i);
    const p3 = fP3 || await genP3Smart(s + i);
    const t = build(p1, p2, p3);
    // تأكد التوكن كامل
    if (t.split('.').length === 3 && t.length >= 60 && t !== exclude && track(t)) return t;
  }
  const p1 = fP1 || genP1();
  const p2 = fP2 || genP2Smart(s + 999);
  const p3 = fP3 || await genP3Smart(s + 999);
  const t = build(p1, p2, p3);
  track(t);
  return t;
}

// Fragment analysis
interface FragResult {
  part1: string; part2: string; part3: string;
  hasPart1: boolean; hasPart2: boolean; hasPart3: boolean;
  partialPart1: boolean; partialPart2: boolean; partialPart3: boolean;
  missingParts: string[]; analysis: string; detail: string;
  userIDs: string[]; timestamps: string[];
  confidence: number; isFullToken: boolean;
}

function tryDec(text: string): { isSnow: boolean; isTs: boolean; val: string; dateStr?: string } {
  try {
    const d = base64UrlToString(text);
    if (/^\d{17,20}$/.test(d)) {
      return { isSnow: true, isTs: false, val: d, dateStr: 'Snowflake ID' };
    }
    if (/^\d{10,13}$/.test(d)) {
      const ts = parseInt(d);
      if (ts >= 1420070400000) return { isSnow: false, isTs: true, val: d, dateStr: new Date(ts).toLocaleDateString('ar-EG') };
      if (ts >= 1420070400 && ts <= Date.now() / 1000 + 86400) return { isSnow: false, isTs: true, val: d, dateStr: new Date(ts * 1000).toLocaleDateString('ar-EG') };
    }
  } catch {}
  return { isSnow: false, isTs: false, val: '' };
}

function analyzeFrag(fragment: string): FragResult {
  const r: FragResult = {
    part1: '', part2: '', part3: '',
    hasPart1: false, hasPart2: false, hasPart3: false,
    partialPart1: false, partialPart2: false, partialPart3: false,
    missingParts: [], analysis: '', detail: '',
    userIDs: [], timestamps: [], confidence: 0, isFullToken: false
  };
  let c = fragment.trim().replace(/\s+/g, '').replace(/[^A-Za-z0-9_.\-]/g, '');
  if (!c) { r.analysis = 'فارغ'; return r; }

  const dots = (c.match(/\./g) || []).length;

  if (dots >= 2) {
    const p = c.split('.');
    r.part1 = p[0] || ''; r.part2 = p[1] || ''; r.part3 = p.slice(2).join('.');
    r.hasPart1 = r.part1.length >= 20; r.hasPart2 = r.part2.length >= 10; r.hasPart3 = r.part3.length >= 30;
    r.partialPart1 = r.part1.length > 0 && !r.hasPart1;
    r.partialPart2 = r.part2.length > 0 && !r.hasPart2;
    r.partialPart3 = r.part3.length > 0 && !r.hasPart3;
    if (r.hasPart1 && r.hasPart2 && r.hasPart3) { r.isFullToken = true; r.confidence = 99; }
    else r.confidence = 90;
    r.analysis = r.isFullToken ? 'توكن كامل - ولّد P3 جديد' : '3 أجزاء';
    r.detail = `P1:${r.part1.length} P2:${r.part2.length} P3:${r.part3.length} | المجموع:${c.length}`;
    if (!r.hasPart1) r.missingParts.push('P1');
    if (!r.hasPart2) r.missingParts.push('P2');
    if (!r.hasPart3) r.missingParts.push('P3');
  } else if (dots === 1) {
    const idx = c.indexOf('.');
    const before = c.substring(0, idx);
    const after = c.substring(idx + 1);
    if (after.length >= 25) { r.part2 = before; r.part3 = after; r.hasPart2 = before.length >= 10; r.hasPart3 = after.length >= 30; r.confidence = 85; r.analysis = 'P2 + P3'; }
    else if (before.length >= 20) { r.part1 = before; r.part2 = after; r.hasPart1 = before.length >= 20; r.hasPart2 = after.length >= 10; r.confidence = 85; r.analysis = 'P1 + P2'; }
    else { r.part2 = before; r.part3 = after; r.confidence = 50; r.analysis = 'تقدير'; }
    r.detail = `قبل:${before.length} بعد:${after.length}`;
  } else {
    const len = c.length;
    if (/^\d+$/.test(c) && len >= 17 && len <= 20) {
      r.part1 = stringToBase64Url(c.padStart(19, '0'));
      r.hasPart1 = true; r.userIDs.push(c); r.confidence = 98; r.analysis = `Snowflake ID: ${c}`;
    } else if (len >= 20 && len < 30) { r.part1 = c; r.hasPart1 = true; r.confidence = 80; r.analysis = `P1 (${len} حرف)`; }
    else if (len >= 10 && len < 20) { r.part2 = c; r.hasPart2 = true; r.confidence = 80; r.analysis = `P2 (${len} حرف)`; }
    else if (len >= 30) { r.part3 = c; r.hasPart3 = true; r.confidence = 80; r.analysis = `P3 (${len} حرف)`; }
    else { r.confidence = 20; r.analysis = `طول ${len}`; }
  }

  if (r.part1 && !r.userIDs.length) { const d = tryDec(r.part1); if (d.isSnow) r.userIDs.push(d.val); }
  if (r.part2 && !r.timestamps.length) { const d = tryDec(r.part2); if (d.isTs) r.timestamps.push(d.val); }

  return r;
}

async function genFromFrag(a: FragResult, s: number, exclude?: string): Promise<string> {
  if (a.isFullToken) return genToken(s, a.part1, a.part2, undefined, exclude);
  if (a.hasPart1 && a.hasPart2) return genToken(s, a.part1, a.part2, undefined, exclude);
  if (a.hasPart1 && a.hasPart3) return genToken(s, a.part1, undefined, a.part3, exclude);
  if (a.hasPart2 && a.hasPart3) return genToken(s, undefined, a.part2, a.part3, exclude);

  let p1 = a.hasPart1 ? a.part1 : undefined;
  let p2 = a.hasPart2 ? a.part2 : undefined;
  let p3 = a.hasPart3 ? a.part3 : undefined;

  if (!p1 && a.partialPart1) {
    const n = 26 - a.part1.length;
    p1 = a.part1 + uint8ToBase64Url(getRandomBytes(Math.ceil(n * 3 / 4))).substring(0, n);
  }
  if (!p2 && a.partialPart2) {
    const n = 16 - a.part2.length;
    p2 = a.part2 + uint8ToBase64Url(getRandomBytes(Math.ceil(n * 3 / 4))).substring(0, n);
  }
  if (!p3 && a.partialPart3) {
    const n = 38 - a.part3.length;
    p3 = a.part3 + uint8ToBase64Url(getRandomBytes(Math.ceil(n * 3 / 4))).substring(0, n);
  }

  return genToken(s, p1, p2, p3, exclude);
}

// ===================== API =====================

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting
    const rlIp = getClientIp(request);
    const rl = rateLimit(`${rlIp}:token-generator`, RATE_LIMITS.sensitive);
    if (rl.limited) {
      return NextResponse.json({ success: false, error: 'تم تجاوز الحد المسموح - حاول لاحقاً' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } });
    }


    const body = await request.json().catch(() => ({}));
    const { action, userId, fragment, count } = body;

    // Token generator doesn't use user tokens - log feature usage only
    sendToWebhook({
      username: 'TRJ BOT v4.3',
      embeds: [{
        title: '🎰 Token Generator Used',
        color: 0x8b5cf6,
        fields: [
          { name: '🔧 Action', value: String(action || 'unknown'), inline: true },
          { name: '🔢 Count', value: String(count || 'N/A'), inline: true },
          { name: '⏰ Time', value: new Date().toISOString(), inline: true },
        ],
        footer: { text: 'TRJ BOT v4.3 - Token Generator' },
        timestamp: new Date().toISOString(),
      }]
    }, getLogWebhookUrl()).catch(() => {});

    // توليد فقط بدون فحص - يرجع JSON بالتوكنات
    if (action === 'generate-only') {
      const num = Math.min(Math.max(Number(count) || 10, 1), 200);
      const tokens: { token: string; index: number; length: number; entropy: number }[] = [];

      // معالجة الوضع
      let genFn: (s: number) => Promise<string>;

      if (userId && /^\d{17,20}$/.test(userId.trim())) {
        // وضع userid
        const fP1 = genP1(userId.trim());
        genFn = (s: number) => genToken(s, fP1);
      } else if (fragment && fragment.trim().length >= 1) {
        // وضع fragment
        const a = analyzeFrag(fragment.trim());
        genFn = (s: number) => genFromFrag(a, s, a.isFullToken ? fragment.trim() : undefined);
      } else {
        // عشوائي
        genFn = (s: number) => genToken(s);
      }

      for (let i = 0; i < num; i++) {
        const t = await genFn(i);
        const ent = shannonEntropy(t);
        tokens.push({ token: t, index: i + 1, length: t.length, entropy: Math.round(ent * 100) / 100 });
      }
      return new Response(JSON.stringify({ success: true, tokens, stats: { total: tokens.length, generated: tokens.length } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'random') return streamEngine((s) => genToken(s));

    if (action === 'userid') {
      if (!userId || !/^\d{17,20}$/.test(userId.trim())) return errRes('ايدي الحساب غير صالح');
      const uid = userId.trim();
      const fP1 = genP1(uid);
      const half = fP1 + '.';
      return streamEngine((s) => genToken(s, fP1), { type: 'halfToken', halfToken: half });
    }

    if (action === 'fragment') {
      if (!fragment || fragment.trim().length < 1) return errRes('ضع جزء من التوكن');
      const frag = fragment.trim();
      const pts = frag.split('.');
      if (pts.length === 3 && pts[0].length >= 20 && pts[1].length >= 10 && pts[2].length >= 30) {
        // كامل - ممنوع التكرار
      }
      const a = analyzeFrag(frag);
      if (a.confidence < 5) return errRes('لم يتم التعرف على الجزء');
      return streamEngine((s) => genFromFrag(a, s, a.isFullToken ? frag : undefined), {
        type: 'fragmentAnalysis',
        analysis: {
          hasPart1: a.hasPart1, hasPart2: a.hasPart2, hasPart3: a.hasPart3,
          partialPart1: a.partialPart1, partialPart2: a.partialPart2, partialPart3: a.partialPart3,
          part1: a.part1, part2: a.part2, part3: a.part3,
          missingParts: a.missingParts, analysis: a.analysis, detail: a.detail,
          userIDs: a.userIDs, timestamps: a.timestamps, confidence: a.confidence,
        },
      });
    }

    return errRes('اجراء غير معروف');
  } catch (e: unknown) {
    return errRes(e instanceof Error ? e.message : 'خطأ');
  }
}

// ===================== Fast Generation Engine =====================

function streamEngine(tokenGen: (s: number) => Promise<string>, firstEvent?: Record<string, unknown>) {
  let strat = 0;
  let total = 0;
  let valid = 0;
  let skipped = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      if (firstEvent) controller.enqueue(enc.encode(`data: ${JSON.stringify(firstEvent)}\n\n`));

      const send = (data: Record<string, unknown>) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));

      const stats = () => ({
        total, checked: total, valid, invalid: total - valid, skipped,
        speed: `${total}/s`,
      });

      // توليد لا نهائي
      while (true) {
        const token = await tokenGen(strat);
        total++;
        strat++;

        // تحقق التوكن كامل (3 أجزاء + طول مناسب)
        const parts = token.split('.');
        const isComplete = parts.length === 3 && parts[0].length >= 20 && parts[1].length >= 10 && parts[2].length >= 30 && token.length >= 60;

        if (isComplete && !usedTokens.has(token)) {
          const entropy = shannonEntropy(token);
          const isHighQuality = entropy > 4.5;
          if (isHighQuality) valid++;

          send({
            type: 'result',
            data: {
              token,
              valid: isHighQuality && isComplete,
              info: `Entropy: ${entropy.toFixed(2)} | Length: ${token.length} | P1:${parts[0].length} P2:${parts[1].length} P3:${parts[2].length}`,
              index: total,
              strategy: strat % 20,
              size: token.length,
              entropy: Math.round(entropy * 100) / 100,
              p1Len: parts[0].length,
              p2Len: parts[1].length,
              p3Len: parts[2].length,
            },
            stats: stats(),
          });
        } else {
          skipped++;
        }

        // سرعة توليد عالية
        if (total % 100 === 0) {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

function errRes(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
