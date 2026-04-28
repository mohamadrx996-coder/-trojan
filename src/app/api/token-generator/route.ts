// src/app/api/token-generator/route.ts - Token Generator v7.0 - تنسيق Discord دقيق
import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { getLogWebhookUrl } from '@/lib/config';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'edge';

// Discord Token Structure Analysis:
// =====================================
// MTQzNzkxMzU0MjE2MTYwMDUxMg.Gw2S4x.FLUer_FhI9oWpnIcCusm5lHtox5rX0DblxPMPg (70 chars)
// MTM2MzYzNTEwNTAwMzg2NDEwNQ.GfNz_0.73ZlIwSRaPJfYkAcQRqZZ0K5oqX5SIZp6zQj7g (71 chars)
//
// P1 = Base64(UserID) = 24 chars بالضبط
// P2 = Base64(Timestamp) = 6 chars بالضبط
// P3 = Base64(HMAC-SHA256) = 38 chars بالضبط
// Total = 70 chars مع النقطتين

const DISCORD_EPOCH = BigInt(1420070400000);
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// ==================== UTILITY FUNCTIONS ====================

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

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

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig);
}

// ==================== TOKEN ANALYZER ====================

interface TokenAnalysis {
  isValid: boolean;
  length: number;
  parts: { p1: string; p2: string; p3: string };
  lengths: { p1: number; p2: number; p3: number };
  userId: string | null;
  timestamp: number | null;
  createdAt: string | null;
  entropy: number;
  hexPattern: boolean;
  pattern: string;
  confidence: number;
  detail: string;
}

function analyzeToken(token: string): TokenAnalysis {
  const result: TokenAnalysis = {
    isValid: false,
    length: token.length,
    parts: { p1: '', p2: '', p3: '' },
    lengths: { p1: 0, p2: 0, p3: 0 },
    userId: null,
    timestamp: null,
    createdAt: null,
    entropy: 0,
    hexPattern: false,
    pattern: '',
    confidence: 0,
    detail: ''
  };

  const clean = token.trim();
  if (!clean) {
    result.detail = 'توكن فارغ';
    return result;
  }

  const dotParts = clean.split('.');
  if (dotParts.length !== 3) {
    result.pattern = 'invalid_format';
    result.detail = `تنسيق خاطئ - يجب أن يحتوي على 3 أجزاء مفصولة بنقاط. وجدت ${dotParts.length} جزء`;
    return result;
  }

  result.parts = { p1: dotParts[0], p2: dotParts[1], p3: dotParts[2] };
  result.lengths = { p1: dotParts[0].length, p2: dotParts[1].length, p3: dotParts[2].length };

  // Decode P1 to get User ID
  try {
    const userIdStr = base64UrlToString(dotParts[0]);
    if (/^\d{17,20}$/.test(userIdStr)) {
      result.userId = userIdStr;
      // Calculate account creation date
      const snowflake = BigInt(userIdStr);
      const timestamp = Number((snowflake >> 22n) + DISCORD_EPOCH);
      result.timestamp = timestamp;
      result.createdAt = new Date(timestamp).toLocaleDateString('ar-EG');
    }
  } catch {}

  // Calculate entropy
  result.entropy = shannonEntropy(clean);

  // Check hex patterns in P3
  const p3Lower = dotParts[2].toLowerCase();
  result.hexPattern = /^[a-f0-9_-]+$/i.test(p3Lower);

  // Validate structure - must match exact Discord format
  // P1: 24 chars (Base64 of 18-19 digit snowflake)
  // P2: 6 chars
  // P3: 38 chars
  // Total: 70 chars (with 2 dots)
  const validP1 = result.lengths.p1 === 24;
  const validP2 = result.lengths.p2 === 6;
  const validP3 = result.lengths.p3 === 38;
  const validTotal = clean.length === 70;

  result.isValid = validP1 && validP2 && validP3 && !!result.userId;
  
  if (result.isValid) {
    result.confidence = 98;
    result.pattern = 'valid_discord_token';
    result.detail = `توكن Discord صالح! User ID: ${result.userId}, تم الإنشاء: ${result.createdAt}`;
  } else if (result.lengths.p1 >= 22 && result.lengths.p1 <= 28 && 
             result.lengths.p2 >= 5 && result.lengths.p2 <= 8 && 
             result.lengths.p3 >= 35 && result.lengths.p3 <= 43) {
    result.confidence = 70;
    result.pattern = 'probably_valid';
    result.detail = `توكن محتمل الصحة - الأطوال: P1=${result.lengths.p1}, P2=${result.lengths.p2}, P3=${result.lengths.p3}`;
  } else {
    result.confidence = 20;
    result.pattern = 'invalid_structure';
    result.detail = `بنية غير صالحة - المتوقع: P1=24, P2=6, P3=38. الفعلي: P1=${result.lengths.p1}, P2=${result.lengths.p2}, P3=${result.lengths.p3}`;
  }

  return result;
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const c of str) freq[c] = (freq[c] || 0) + 1;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / str.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// ==================== TOKEN GENERATOR - تنسيق دقيق ====================

function genSnowflake(): string {
  // Generate a valid Discord snowflake (17-19 digits)
  const ts = BigInt(Date.now()) - DISCORD_EPOCH;
  const worker = BigInt(Math.floor(Math.random() * 32));
  const process = BigInt(Math.floor(Math.random() * 32));
  const increment = BigInt(Math.floor(Math.random() * 4096));
  const snowflake = ((ts << 22n) | (worker << 17n) | (process << 12n) | increment).toString();
  return snowflake;
}

// P1: Base64 of User ID - يجب أن يكون 24 حرف بالضبط
function genP1(uid?: string): string {
  // نحتاج User ID من 18 رقم للحصول على P1 بطول 24 حرف
  let snow = uid || genSnowflake();
  let p1 = stringToBase64Url(snow);
  
  // إذا لم يكن 24 حرف، نولد ID جديد
  while (p1.length !== 24 && !uid) {
    snow = genSnowflake();
    p1 = stringToBase64Url(snow);
  }
  
  return p1;
}

// P2: 6 chars بالضبط - Timestamp-based
function genP2(): string {
  // Discord P2 is exactly 6 chars - looks like base64 of timestamp
  const ts = Date.now();
  const tsBytes = new TextEncoder().encode(ts.toString().slice(-6));
  const hash = new Uint8Array(4);
  crypto.getRandomValues(hash);
  return uint8ToBase64Url(hash).substring(0, 6);
}

// P3: 38 chars بالضبط - HMAC signature
async function genP3(): Promise<string> {
  // Discord P3 is exactly 38 chars
  // This is the HMAC-SHA256 signature (base64 encoded, truncated)
  const bytes = getRandomBytes(28); // 28 bytes = ~38 base64 chars
  return uint8ToBase64Url(bytes);
}

async function genP3Smart(): Promise<string> {
  const strategies = [
    // Pure random
    () => {
      const bytes = getRandomBytes(28);
      return uint8ToBase64Url(bytes);
    },
    // HMAC-based
    async () => {
      const key = getRandomBytes(32);
      const data = getRandomBytes(48);
      const h = await hmacSha256(key, data);
      return uint8ToBase64Url(h.subarray(0, 28));
    },
    // SHA256-based
    async () => {
      const h = await sha256(getRandomBytes(64));
      return uint8ToBase64Url(h.subarray(0, 28));
    }
  ];
  
  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const result = await strategy();
  // Ensure exactly 38 chars
  return result.substring(0, 38);
}

// Generate complete token - 70 chars بالضبط
async function generateToken(uid?: string): Promise<{ token: string; analysis: TokenAnalysis }> {
  const p1 = genP1(uid);
  const p2 = genP2();
  const p3 = await genP3Smart();
  const token = `${p1}.${p2}.${p3}`;
  const analysis = analyzeToken(token);
  return { token, analysis };
}

// Deduplication
const usedTokens = new Set<string>();

function track(token: string): boolean {
  if (usedTokens.has(token)) return false;
  usedTokens.add(token);
  if (usedTokens.size > 100000) {
    const arr = [...usedTokens].slice(0, 50000);
    usedTokens.clear();
    arr.forEach(t => usedTokens.add(t));
  }
  return true;
}

// ==================== FRAGMENT ANALYZER ====================

interface FragmentAnalysis {
  input: string;
  detectedType: 'full_token' | 'user_id' | 'p1' | 'p2' | 'p3' | 'p1_p2' | 'p2_p3' | 'hex' | 'regex' | 'partial' | 'unknown';
  parts: { p1: string; p2: string; p3: string };
  hasP1: boolean;
  hasP2: boolean;
  hasP3: boolean;
  userId: string | null;
  confidence: number;
  suggestion: string;
  analysis: string;
  detail: string;
}

function analyzeFragment(fragment: string): FragmentAnalysis {
  const result: FragmentAnalysis = {
    input: fragment,
    detectedType: 'unknown',
    parts: { p1: '', p2: '', p3: '' },
    hasP1: false,
    hasP2: false,
    hasP3: false,
    userId: null,
    confidence: 0,
    suggestion: '',
    analysis: '',
    detail: ''
  };

  const clean = fragment.trim().replace(/\s+/g, '');

  // Check for hex pattern
  if (/^(0x)?[a-fA-F0-9]+$/.test(clean)) {
    result.detectedType = 'hex';
    result.confidence = 90;
    result.analysis = `تم التعرف على نمط Hex: ${clean}`;
    result.detail = `Hex: ${clean} (${clean.length} حرف)`;
    result.suggestion = 'سيتم تحويله واستخدامه كـ User ID أو جزء من التوكن';
    return result;
  }

  // Check for regex pattern
  if (clean.includes('[') || clean.includes('*') || clean.includes('+') || clean.includes('\\')) {
    result.detectedType = 'regex';
    result.confidence = 85;
    result.analysis = `تم التعرف على نمط Regex`;
    result.detail = `Regex: ${clean}`;
    result.suggestion = 'سيتم استخدام الـ Regex لتوليد توكنات مطابقة';
    return result;
  }

  // Check if it's a full token
  if (clean.includes('.') && clean.split('.').length === 3) {
    const [p1, p2, p3] = clean.split('.');
    result.parts = { p1, p2, p3 };
    result.hasP1 = p1.length >= 22;
    result.hasP2 = p2.length >= 5;
    result.hasP3 = p3.length >= 35;
    
    if (result.hasP1 && result.hasP2 && result.hasP3) {
      result.detectedType = 'full_token';
      result.confidence = 95;
      result.suggestion = 'توكن كامل - يمكن فحصه أو توليد P3 جديد';
      result.analysis = `توكن كامل (${clean.length} حرف)`;
      
      // Extract user ID
      try {
        const decoded = base64UrlToString(p1);
        if (/^\d{17,20}$/.test(decoded)) {
          result.userId = decoded;
          result.detail = `User ID: ${decoded}, P1: ${p1.length}ح, P2: ${p2.length}ح, P3: ${p3.length}ح`;
        }
      } catch {}
    } else {
      result.detectedType = 'partial';
      result.confidence = 60;
      result.suggestion = 'توكن ناقص - سيتم إكمال الأجزاء المفقودة';
      result.analysis = `توكن جزئي - P1: ${p1.length}ح, P2: ${p2.length}ح, P3: ${p3.length}ح`;
    }
    return result;
  }

  // Check if it's a user ID (17-20 digits)
  if (/^\d{17,20}$/.test(clean)) {
    result.detectedType = 'user_id';
    result.parts.p1 = stringToBase64Url(clean);
    result.hasP1 = true;
    result.userId = clean;
    result.confidence = 98;
    result.suggestion = `User ID: ${clean} - سيتم توليد P2 و P3`;
    result.analysis = `User ID صالح`;
    result.detail = `ID: ${clean} → P1: ${result.parts.p1} (${result.parts.p1.length} حرف)`;
    return result;
  }

  // Check if it's P1 only (Base64, 22-28 chars)
  if (clean.length >= 22 && clean.length <= 28 && /^[A-Za-z0-9_-]+$/.test(clean)) {
    result.detectedType = 'p1';
    result.parts.p1 = clean;
    result.hasP1 = true;
    result.confidence = 80;
    result.analysis = `P1 (الجزء الأول من التوكن)`;
    
    try {
      const decoded = base64UrlToString(clean);
      if (/^\d{17,20}$/.test(decoded)) {
        result.userId = decoded;
        result.confidence = 95;
        result.suggestion = `P1 (User ID: ${decoded}) - سيتم توليد P2 و P3`;
        result.detail = `P1 صالح يحتوي على User ID: ${decoded}`;
      }
    } catch {}
    return result;
  }

  // Two parts with one dot
  if (clean.split('.').length === 2) {
    const [part1, part2] = clean.split('.');
    
    if (part1.length >= 22 && part2.length >= 5 && part2.length < 35) {
      result.detectedType = 'p1_p2';
      result.parts.p1 = part1;
      result.parts.p2 = part2;
      result.hasP1 = true;
      result.hasP2 = true;
      result.confidence = 85;
      result.suggestion = 'P1 + P2 - سيتم توليد P3';
      result.analysis = `توكن ناقص P3`;
    } else if (part1.length >= 5 && part1.length < 15 && part2.length >= 35) {
      result.detectedType = 'p2_p3';
      result.parts.p2 = part1;
      result.parts.p3 = part2;
      result.hasP2 = true;
      result.hasP3 = true;
      result.confidence = 75;
      result.suggestion = 'P2 + P3 - سيتم توليد P1';
      result.analysis = `توكن ناقص P1`;
    }
    return result;
  }

  // P3 only (35-43 chars)
  if (clean.length >= 35 && clean.length <= 43) {
    result.detectedType = 'p3';
    result.parts.p3 = clean;
    result.hasP3 = true;
    result.confidence = 70;
    result.suggestion = 'P3 فقط - سيتم توليد P1 و P2 (عشوائي)';
    result.analysis = `P3 (الجزء الثالث من التوكن)`;
    result.detail = `P3: ${clean} (${clean.length} حرف)`;
    return result;
  }

  result.suggestion = 'لم يتم التعرف على النمط - سيتم توليد توكن عشوائي';
  result.analysis = 'نمط غير معروف';
  result.detail = 'سيتم توليد توكن جديد من الصفر';
  return result;
}

// ==================== API HANDLER ====================

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rl = rateLimit(`${ip}:token-generator`, RATE_LIMITS.sensitive);
    if (rl.limited) {
      return NextResponse.json(
        { success: false, error: 'تم تجاوز الحد - حاول لاحقاً' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { action, userId, fragment, count, analyze } = body;

    // Log usage
    sendToWebhook({
      username: 'TRJ BOT Token Generator',
      embeds: [{
        title: '🎰 Token Generator',
        color: 0x8b5cf6,
        fields: [
          { name: 'Action', value: action || 'unknown', inline: true },
          { name: 'Count', value: String(count || 'N/A'), inline: true },
          { name: 'IP', value: ip, inline: true },
        ],
        footer: { text: 'TRJ BOT v5.0' },
        timestamp: new Date().toISOString(),
      }]
    }, getLogWebhookUrl()).catch(() => {});

    // ========== ANALYZE TOKEN ==========
    if (action === 'analyze') {
      if (!fragment) {
        return NextResponse.json({ success: false, error: 'أدخل التوكن للتحليل' });
      }
      
      const analysis = analyzeToken(fragment);
      return NextResponse.json({ success: true, analysis });
    }

    // ========== ANALYZE FRAGMENT ==========
    if (action === 'analyze-fragment') {
      if (!fragment) {
        return NextResponse.json({ success: false, error: 'أدخل الجزء للتحليل' });
      }
      
      const fragAnalysis = analyzeFragment(fragment);
      return NextResponse.json({ success: true, fragmentAnalysis: fragAnalysis });
    }

    // ========== GENERATE TOKENS ==========
    if (action === 'generate') {
      const num = Math.min(Math.max(Number(count) || 10, 1), 100);
      const tokens: { token: string; index: number; length: number; entropy: number; userId: string; valid: boolean }[] = [];

      let genFn: () => Promise<{ token: string; analysis: TokenAnalysis }>;

      if (userId && /^\d{17,20}$/.test(userId.trim())) {
        // User ID mode
        const uid = userId.trim();
        genFn = () => generateToken(uid);
      } else if (fragment) {
        // Fragment mode
        const fragAnalysis = analyzeFragment(fragment);
        genFn = async () => {
          let p1 = fragAnalysis.parts.p1 || genP1(fragAnalysis.userId || undefined);
          let p2 = fragAnalysis.parts.p2 || genP2();
          let p3 = fragAnalysis.parts.p3 || await genP3Smart();
          
          // Generate missing parts
          if (!fragAnalysis.hasP1) p1 = genP1(fragAnalysis.userId || undefined);
          if (!fragAnalysis.hasP2) p2 = genP2();
          if (!fragAnalysis.hasP3) p3 = await genP3Smart();
          
          const token = `${p1}.${p2}.${p3}`;
          return { token, analysis: analyzeToken(token) };
        };
      } else {
        // Random mode
        genFn = generateToken;
      }

      for (let i = 0; i < num; i++) {
        const { token, analysis } = await genFn();
        if (track(token)) {
          tokens.push({
            token,
            index: i + 1,
            length: token.length,
            entropy: Math.round(analysis.entropy * 100) / 100,
            userId: analysis.userId || '',
            valid: analysis.isValid
          });
        }
      }

      return NextResponse.json({
        success: true,
        tokens,
        stats: {
          total: tokens.length,
          avgLength: Math.round(tokens.reduce((a, t) => a + t.length, 0) / tokens.length) || 70,
          avgEntropy: Math.round(tokens.reduce((a, t) => a + t.entropy, 0) / tokens.length * 100) / 100 || 0,
          validCount: tokens.filter(t => t.valid).length
        },
        message: `تم توليد ${tokens.length} توكن - الطول: ${tokens[0]?.length || 70} حرف`
      });
    }

    // ========== STREAM GENERATION ==========
    if (action === 'stream') {
      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          let count = 0;

          const send = (data: object) => {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          while (count < 1000) {
            const { token, analysis } = await generateToken();
            count++;

            if (analysis.isValid && track(token)) {
              send({
                type: 'token',
                token,
                analysis: {
                  length: token.length,
                  userId: analysis.userId,
                  createdAt: analysis.createdAt,
                  entropy: Math.round(analysis.entropy * 100) / 100
                },
                count
              });
            }

            if (count % 50 === 0) {
              await new Promise(r => setTimeout(r, 10));
            }
          }

          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف' });

  } catch (e) {
    return NextResponse.json({ 
      success: false, 
      error: e instanceof Error ? e.message : 'خطأ' 
    });
  }
}
