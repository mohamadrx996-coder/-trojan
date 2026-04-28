// src/app/api/guard/route.ts - Token validation & TRJ server check - TRJ BOT v4.3

import { NextRequest, NextResponse } from 'next/server';
import { cleanToken } from '@/lib/discord';
import { TRJ_SERVER_ID, SERVER_INVITE_URL } from '@/lib/config';

export const runtime = 'edge';

const DISCORD_API = 'https://discord.com/api/v10';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 20) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 });
    }

    const cleanedToken = cleanToken(token);

    // Verify token by fetching /users/@me
    const meRes = await fetch(`${DISCORD_API}/users/@me`, {
      method: 'GET',
      headers: {
        'Authorization': cleanedToken,
        'Accept': 'application/json',
      },
    });

    if (!meRes.ok) {
      // Try as bot token
      const botRes = await fetch(`${DISCORD_API}/users/@me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bot ${cleanedToken}`,
          'Accept': 'application/json',
        },
      });

      if (!botRes.ok) {
        return NextResponse.json({ success: false, error: 'Token is invalid or expired' }, { status: 401 });
      }

      const botUser = await botRes.json() as Record<string, unknown>;
      const botId = String(botUser.id || '');
      const botName = String(botUser.username || 'Unknown');
      const isBot = Boolean(botUser.bot);

      // Check if bot is in TRJ server
      let inServer = false;
      try {
        const memberRes = await fetch(`${DISCORD_API}/guilds/${TRJ_SERVER_ID}/members/${botId}`, {
          method: 'GET',
          headers: {
            'Authorization': cleanedToken,
            'Accept': 'application/json',
          },
        });
        inServer = memberRes.ok;
      } catch {
        inServer = false;
      }

      // Get guild count
      let guildCount = 0;
      try {
        const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
          method: 'GET',
          headers: {
            'Authorization': `Bot ${cleanedToken}`,
            'Accept': 'application/json',
          },
        });
        if (guildsRes.ok) {
          const guilds = await guildsRes.json() as unknown[];
          guildCount = Array.isArray(guilds) ? guilds.length : 0;
        }
      } catch {
        guildCount = 0;
      }

      return NextResponse.json({
        success: true,
        inServer,
        userId: botId,
        userName: botName,
        isBot,
        inviteUrl: SERVER_INVITE_URL,
        serverId: TRJ_SERVER_ID,
        guildCount,
      });
    }

    const user = await meRes.json() as Record<string, unknown>;
    const userId = String(user.id || '');
    const userName = String(user.global_name || user.username || 'Unknown');
    const isBot = Boolean(user.bot);

    // Check if user is in TRJ server
    let inServer = false;
    try {
      const memberRes = await fetch(`${DISCORD_API}/guilds/${TRJ_SERVER_ID}/members/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': cleanedToken,
          'Accept': 'application/json',
        },
      });
      inServer = memberRes.ok;
    } catch {
      inServer = false;
    }

    // Get guild count
    let guildCount = 0;
    try {
      const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        method: 'GET',
        headers: {
          'Authorization': cleanedToken,
          'Accept': 'application/json',
        },
      });
      if (guildsRes.ok) {
        const guilds = await guildsRes.json() as unknown[];
        guildCount = Array.isArray(guilds) ? guilds.length : 0;
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
