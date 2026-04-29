// src/app/api/guard/route.ts - Token validation & TRJ server check - TRJ BOT v4.3

import { NextRequest, NextResponse } from 'next/server';
import { cleanToken, discordFetch } from '@/lib/discord';
import { TRJ_SERVER_ID, SERVER_INVITE_URL } from '@/lib/config';
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting
    const ip = getClientIp(request);
    const rl = rateLimit(`${ip}:guard`, RATE_LIMITS.light);
    if (rl.limited) {
      return NextResponse.json({ success: false, error: 'تم تجاوز الحد - حاول لاحقاً' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 20) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 });
    }

    const ct = cleanToken(token);

    // Verify token using discordFetch (handles user/bot detection)
    const meResult = await discordFetch(ct, 'GET', '/users/@me', undefined, { timeout: 10000 });

    if (!meResult.ok || !meResult.data) {
      return NextResponse.json({ success: false, error: 'Token is invalid or expired' }, { status: 401 });
    }

    const user = meResult.data as Record<string, unknown>;
    const userId = String(user.id || '');
    const userName = String(user.global_name || user.username || 'Unknown');
    const isBot = Boolean(user.bot);

    // Check if in TRJ server
    let inServer = false;
    try {
      const memberRes = await discordFetch(ct, 'GET', `/guilds/${TRJ_SERVER_ID}/members/${userId}`, undefined, { timeout: 10000 });
      inServer = memberRes.ok || memberRes.status === 204;
    } catch {
      inServer = false;
    }

    // Get guild count
    let guildCount = 0;
    try {
      const guildsRes = await discordFetch(ct, 'GET', '/users/@me/guilds', undefined, { timeout: 10000 });
      if (guildsRes.ok && Array.isArray(guildsRes.data)) {
        guildCount = guildsRes.data.length;
      }
    } catch {
      guildCount = 0;
    }

    return NextResponse.json({
      success: true,
      inServer,
      userId,
      userName,
      isBot,
      inviteUrl: SERVER_INVITE_URL,
      serverId: TRJ_SERVER_ID,
      guildCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
