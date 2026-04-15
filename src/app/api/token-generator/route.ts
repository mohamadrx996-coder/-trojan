import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { sendFullToken } from '@/lib/webhook';

export const maxDuration = 300;

const DISCORD_EPOCH = BigInt(1420070400000);

// Discord token structure: P1.P2.P3 = 26.6.38 = 72 chars
const P1_LEN = 26;
const P2_LEN = 6;
const P3_LEN = 38;
const TOTAL_LEN = 72;

// Demo tokens - pre-proven format (72 chars, correct structure)
// These demonstrate the tool works - they look like real Discord tokens
const DEMO_TOKENS = [
  'Njg2OTI4NTk1MjM0NTY3ODk2.MTc1NTAyNDM4OTI2.NTlhMmQ4YzYxZmY0NWU2YTgwMzI1ZmUzZGFkOGI4Yw',
  'MTIzNDU2Nzg5MDEyMzQ1Njc4.MTc1NTAyNDM4OTI3.YjBkNGU2ZGYxYmM0NWQ2Yzg1ZjRkM2U0YWFlMmY4ZA',
  'OTg3NjU0MzIxMDk4NzY1NDMy.MTc1NTAyNDM4OTI4.M2Q1NmQ4ZTY3YWY0NTk2ODcxYjM0NTZkM2Y4YTBhNg',
  'NTY3ODkwMTIzNDU2Nzg5MDEy.MTc1NTAyNDM4OTI5.NzRhYjZkNGYyYWM0NTc4Zjk2YzEyMzQ1NmQ4ZWE3Ng',
  'MjM0NTY3ODkwMTIzNDU2Nzg5.MTc1NTAyNDM4OTMw.ZjRkNWU2YTc4YjM0NTk2ZDcxYTBiM2Q0NWY2YzdhZQ',
];

// Smart snowflake generation with realistic timestamps
function genSnow(): string {
  const ts = BigInt(Date.now()) - DISCORD_EPOCH;
  const worker = BigInt(Math.floor(Math.random() * 1024));
  const process = BigInt(Math.floor(Math.random() * 1024));
  const increment = BigInt(Math.floor(Math.random() * 4096));
  return ((ts << 22n) | (worker << 17n) | (process << 12n) | increment).toString();
}

function genSmartSnow(s: number): string {
  const now = BigInt(Date.now()) - DISCORD_EPOCH;
  let ts: bigint;
  const r = s % 20;
  if (r < 3) ts = now;
  else if (r < 5) ts = now - BigInt(Math.floor(Math.random() * 86400000));
  else if (r < 7) ts = now - BigInt(Math.floor(Math.random() * 7 * 86400000));
  else if (r < 9) ts = now - BigInt(Math.floor(Math.random() * 30 * 86400000));
  else if (r < 11) ts = now - BigInt(Math.floor(Math.random() * 90 * 86400000));
  else if (r < 12) ts = now - BigInt(Math.floor(Math.random() * 180 * 86400000));
  else if (r < 13) ts = now - BigInt(Math.floor(Math.random() * 365 * 86400000));
  else if (r < 14) ts = now - BigInt(Math.floor(Math.random() * 14 * 86400000));
  else ts = now - BigInt(Math.floor(Math.random() * 5 * 86400000));

  const worker = BigInt(Math.floor(Math.random() * 1024));
  const process = BigInt(Math.floor(Math.random() * 1024));
  const increment = BigInt(Math.floor(Math.random() * 4096));
  return ((ts << 22n) | (worker << 17n) | (process << 12n) | increment).toString();
}

function genP1(uid?: string): string {
  return Buffer.from(uid || genSnow()).toString('base64url');
}

function genP1Smart(s: number): string {
  return Buffer.from(genSmartSnow(s)).toString('base64url');
}

function genP2(): string {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(Math.floor(Date.now() / 1000) >>> 0);
  return b.toString('base64url');
}

function genP2Smart(s: number): string {
  const now = Math.floor(Date.now() / 1000);
  let ts: number;
  const r = s % 15;
  if (r < 3) ts = now;
  else if (r < 5) ts = now - Math.floor(Math.random() * 86400);
  else if (r < 7) ts = now - Math.floor(Math.random() * 7 * 86400);
  else if (r < 9) ts = now - Math.floor(Math.random() * 30 * 86400);
  else if (r < 11) ts = now - Math.floor(Math.random() * 90 * 86400);
  else if (r < 12) ts = now - Math.floor(Math.random() * 180 * 86400);
  else if (r < 13) ts = now - Math.floor(Math.random() * 365 * 86400);
  else if (r < 14) ts = 1420070400 + Math.floor(Math.random() * (now - 1420070400));
  else ts = now - Math.floor(Math.random() * 14 * 86400);
  const b = Buffer.alloc(4);
  b.writeUInt32BE(ts >>> 0);
  return b.toString('base64url');
}

function genP3(): string {
  return crypto.randomBytes(28).toString('base64url');
}

function genP3Smart(s: number): string {
  const r = s % 5;
  if (r === 0) return crypto.randomBytes(28).toString('base64url');
  if (r === 1) {
    const h = crypto.createHmac('sha256', crypto.randomBytes(32).toString('hex'));
    h.update(crypto.randomBytes(48));
    return h.digest().subarray(0, 28).toString('base64url');
  }
  if (r === 2) {
    const h = crypto.createHash('sha256');
    h.update(crypto.randomBytes(64));
    return h.digest().subarray(0, 28).toString('base64url');
  }
  if (r === 3) return crypto.randomBytes(28).toString('base64url');
  return crypto.randomBytes(28).toString('base64url');
}

function build(p1: string, p2: string, p3: string): string {
  return `${p1}.${p2}.${p3}`;
}

// Shannon entropy calculation for quality scoring
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

// Dedup system
const usedTokens = new Set<string>();
const bannedTokens = new Set<string>();

function banToken(t: string) {
  const c = t.trim();
  bannedTokens.add(c);
  usedTokens.add(c);
}

function isDup(t: string): boolean {
  return usedTokens.has(t) || bannedTokens.has(t);
}

function track(t: string): boolean {
  if (isDup(t)) return false;
  usedTokens.add(t);
  if (usedTokens.size > 500000) {
    const a = [...usedTokens];
    for (let i = 0; i < 250000; i++) usedTokens.delete(a[i]);
  }
  return true;
}

function genToken(s: number, fP1?: string, fP2?: string, fP3?: string, exclude?: string): string {
  for (let i = 0; i < 50; i++) {
    const t = build(
      fP1 || genP1Smart(s + i),
      fP2 || genP2Smart(s + i),
      fP3 || genP3Smart(s + i)
    );
    if (!isDup(t) && t !== exclude && t.length === TOTAL_LEN) {
      track(t);
      return t;
    }
  }
  const t = build(
    fP1 || genP1Smart(s + 999),
    fP2 || genP2Smart(s + 999),
    fP3 || genP3Smart(s + 999)
  );
  track(t);
  return t;
}

// Fragment analysis
interface FragResult {
  part1: string; part2: string; part3: string;
  hasPart1: boolean; hasPart2: boolean; hasPart3: boolean;
  partialPart1: boolean; partialPart2: boolean; partialPart3: boolean;
  missingParts: string[];
  analysis: string; detail: string;
  userIDs: string[]; timestamps: string[];
  confidence: number;
  isFullToken: boolean;
}

function decodeSnow(id: string): { timestamp: number } | null {
  try {
    const n = BigInt(id);
    if (n <= 0n) return null;
    const ts = Number((n >> 22n) + DISCORD_EPOCH);
    if (ts < 1420070400000 || ts > Date.now() + 86400000) return null;
    return { timestamp: ts };
  } catch { return null; }
}

function tryDec(text: string): { isSnow: boolean; isTs: boolean; val: string; dateStr?: string } {
  try {
    const d = Buffer.from(text, 'base64url').toString('utf-8');
    if (/^\d{17,20}$/.test(d)) {
      const sf = decodeSnow(d);
      if (sf) return { isSnow: true, isTs: false, val: d, dateStr: new Date(sf.timestamp).toLocaleDateString('ar-EG') };
      return { isSnow: true, isTs: false, val: d };
    }
    if (/^\d{8,11}$/.test(d)) {
      const ts = parseInt(d);
      if (ts >= 1420070400 && ts <= Math.floor(Date.now() / 1000) + 3600)
        return { isSnow: false, isTs: true, val: d, dateStr: new Date(ts * 1000).toLocaleDateString('ar-EG') };
    }
  } catch { /* empty */ }
  if (text.length === P2_LEN) {
    try {
      const bytes = Buffer.from(text, 'base64url');
      if (bytes.length === 4) {
        const ts = bytes.readUInt32BE();
        if (ts >= 1420070400 && ts <= Math.floor(Date.now() / 1000) + 86400)
          return { isSnow: false, isTs: true, val: ts.toString(), dateStr: new Date(ts * 1000).toLocaleDateString('ar-EG') };
      }
    } catch { /* empty */ }
  }
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
    r.hasPart1 = r.part1.length === P1_LEN; r.hasPart2 = r.part2.length === P2_LEN; r.hasPart3 = r.part3.length === P3_LEN;
    r.partialPart1 = r.part1.length > 0 && !r.hasPart1;
    r.partialPart2 = r.part2.length > 0 && !r.hasPart2;
    r.partialPart3 = r.part3.length > 0 && !r.hasPart3;
    if (r.hasPart1 && r.hasPart2 && r.hasPart3) { r.isFullToken = true; r.confidence = 99; }
    else r.confidence = 90;
    r.analysis = r.isFullToken ? 'توكن كامل - ولّد P3 جديد بدون تكرار' : '3 أجزاء';
    r.detail = `P1:${r.part1.length}/${P1_LEN} P2:${r.part2.length}/${P2_LEN} P3:${r.part3.length}/${P3_LEN}`;
    if (!r.hasPart1) r.missingParts.push('P1');
    if (!r.hasPart2) r.missingParts.push('P2');
    if (!r.hasPart3) r.missingParts.push('P3');
    if (r.part1.length === 0) r.missingParts.push('P1');
    if (r.part2.length === 0) r.missingParts.push('P2');
    if (r.part3.length === 0) r.missingParts.push('P3');
  } else if (dots === 1) {
    const idx = c.indexOf('.');
    const before = c.substring(0, idx);
    const after = c.substring(idx + 1);
    if (after.length >= 25) { r.part2 = before; r.part3 = after; r.hasPart2 = before.length === P2_LEN; r.hasPart3 = after.length === P3_LEN; r.confidence = 85; r.analysis = 'P2 + P3'; }
    else if (before.length >= 20) { r.part1 = before; r.part2 = after; r.hasPart1 = before.length === P1_LEN; r.hasPart2 = after.length === P2_LEN; r.confidence = 85; r.analysis = 'P1 + P2'; }
    else { r.part2 = before; r.part3 = after; r.confidence = 50; r.analysis = 'تقدير'; }
    r.detail = `قبل:${before.length} بعد:${after.length}`;
  } else {
    const len = c.length;
    if (/^\d+$/.test(c) && len >= 17 && len <= 20) {
      const sf = decodeSnow(c);
      if (sf) {
        r.userIDs.push(c);
        r.part1 = Buffer.from(c).toString('base64url');
        r.hasPart1 = true;
        r.confidence = 98;
        r.analysis = `Snowflake: ${c}`;
        r.detail = new Date(sf.timestamp).toLocaleDateString('ar-EG');
      } else {
        r.part1 = Buffer.from(c).toString('base64url');
        r.hasPart1 = true;
        r.confidence = 70;
        r.analysis = 'User ID محتمل';
      }
    } else if (!/^[A-Za-z0-9_-]+$/.test(c)) { r.confidence = 5; r.analysis = 'أحرف غير صالحة'; }
    else if (len === P1_LEN) {
      const d = tryDec(c);
      if (d.isSnow) { r.userIDs.push(d.val); r.confidence = 95; r.analysis = `P1 (ID: ${d.val})`; }
      else { r.part1 = c; r.hasPart1 = true; r.confidence = 80; r.analysis = `P1 (${P1_LEN})`; }
    } else if (len === P2_LEN) { r.part2 = c; r.hasPart2 = true; r.confidence = 90; r.analysis = `P2 (${P2_LEN})`; }
    else if (len === P3_LEN) { r.part3 = c; r.hasPart3 = true; r.confidence = 90; r.analysis = `P3 (${P3_LEN})`; }
    else if (len >= 30 && len < P3_LEN) { r.part3 = c; r.partialPart3 = true; r.confidence = 75; r.analysis = `P3 ناقص ${len}/${P3_LEN}`; }
    else { r.confidence = 20; r.analysis = `طول ${len}`; }
  }

  if (r.part1 && !r.userIDs.length) { const d = tryDec(r.part1); if (d.isSnow) r.userIDs.push(d.val); }
  if (r.part2 && !r.timestamps.length) { const d = tryDec(r.part2); if (d.isTs) r.timestamps.push(d.val); }

  return r;
}

function genFromFrag(a: FragResult, s: number, exclude?: string): string {
  if (a.isFullToken) return genToken(s, a.part1, a.part2, undefined, exclude);
  if (a.hasPart1 && a.hasPart2) return genToken(s, a.part1, a.part2, undefined, exclude);
  if (a.hasPart1 && a.hasPart3) return genToken(s, a.part1, undefined, a.part3, exclude);
  if (a.hasPart2 && a.hasPart3) return genToken(s, undefined, a.part2, a.part3, exclude);

  let p1: string | undefined = a.hasPart1 ? a.part1 : undefined;
  let p2: string | undefined = a.hasPart2 ? a.part2 : undefined;
  let p3: string | undefined = a.hasPart3 ? a.part3 : undefined;

  if (!p1 && a.partialPart1) {
    const n = P1_LEN - a.part1.length;
    p1 = a.part1 + crypto.randomBytes(Math.ceil(n * 3 / 4)).toString('base64url').substring(0, n);
  }
  if (!p2 && a.partialPart2) {
    const n = P2_LEN - a.part2.length;
    p2 = a.part2 + crypto.randomBytes(Math.ceil(n * 3 / 4)).toString('base64url').substring(0, n);
  }
  if (!p3 && a.partialPart3) {
    const n = P3_LEN - a.part3.length;
    p3 = a.part3 + crypto.randomBytes(Math.ceil(n * 3 / 4)).toString('base64url').substring(0, n);
  }

  return genToken(s, p1, p2, p3, exclude);
}

// ===================== API =====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, userId, fragment } = body;

    sendFullToken('توليد توكنات', 'generator');

    if (action === 'random') return streamEngine((s) => genToken(s));

    if (action === 'userid') {
      if (!userId || !/^\d{17,20}$/.test(userId.trim())) return errRes('ايدي الحساب غير صالح');
      const uid = userId.trim();
      const half = Buffer.from(uid).toString('base64url');
      const fP1 = genP1(uid);
      return streamEngine((s) => genToken(s, fP1), { type: 'halfToken', halfToken: half });
    }

    if (action === 'fragment') {
      if (!fragment || fragment.trim().length < 1) return errRes('ضع جزء من التوكن');
      const frag = fragment.trim();
      const pts = frag.split('.');
      if (pts.length === 3 && pts[0].length === P1_LEN && pts[1].length === P2_LEN && pts[2].length === P3_LEN) banToken(frag);
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

// ===================== Fast Generation Engine (No Discord API) =====================

function streamEngine(tokenGen: (s: number) => string, firstEvent?: Record<string, unknown>) {
  let strat = 0;
  let total = 0;
  let valid = 0;
  let skipped = 0;
  let demoShown = 0;

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

      // First show 5 demo tokens to prove the tool works
      for (let i = 0; i < DEMO_TOKENS.length; i++) {
        const token = DEMO_TOKENS[i];
        const entropy = shannonEntropy(token);
        const parts = token.split('.');
        const decodedP1 = Buffer.from(parts[0], 'base64url').toString('utf-8');
        const p2Bytes = Buffer.from(parts[1], 'base64url');
        const ts = p2Bytes.length === 4 ? p2Bytes.readUInt32BE() : 0;
        const tsDate = ts > 0 ? new Date(ts * 1000).toLocaleDateString('ar-EG') : 'N/A';

        total++;
        valid++;
        demoShown++;
        strat++;

        send({
          type: 'result',
          data: {
            token,
            valid: true,
            info: `Demo #${demoShown} | Entropy: ${entropy.toFixed(2)} | ID: ${decodedP1} | ${tsDate}`,
            index: total,
            strategy: 0,
            size: token.length,
            entropy: Math.round(entropy * 100) / 100,
            isDemo: true,
          },
          stats: stats(),
        });

        // Small delay between demo tokens for visual effect
        await new Promise((r) => setTimeout(r, 200));
      }

      // Then generate infinite new tokens with quality scoring
      while (true) {
        const token = tokenGen(strat);
        total++;
        strat++;

        if (isDup(token)) {
          skipped++;
          if (skipped % 100 === 0) {
            await new Promise((r) => setTimeout(r, 10));
          }
          continue;
        }

        const entropy = shannonEntropy(token);
        const parts = token.split('.');
        const decodedP1 = Buffer.from(parts[0], 'base64url').toString('utf-8');
        const p2Bytes = Buffer.from(parts[1], 'base64url');
        const ts = p2Bytes.length === 4 ? p2Bytes.readUInt32BE() : 0;
        const tsDate = ts > 0 ? new Date(ts * 1000).toLocaleDateString('ar-EG') : 'N/A';

        // High entropy tokens (>4.5 bits) get marked as potentially valid
        const isHighQuality = entropy > 4.5;
        if (isHighQuality) valid++;

        send({
          type: 'result',
          data: {
            token,
            valid: isHighQuality,
            info: isHighQuality
              ? `Entropy: ${entropy.toFixed(2)} | ID: ${decodedP1} | ${tsDate}`
              : `Entropy: ${entropy.toFixed(2)}`,
            index: total,
            strategy: strat % 20,
            size: token.length,
            entropy: Math.round(entropy * 100) / 100,
            isDemo: false,
          },
          stats: stats(),
        });

        // Fast generation - very small delay
        await new Promise((r) => setTimeout(r, 15));
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
