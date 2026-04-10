// src/lib/discord.ts - دالة موحدة للتعامل مع Discord API - محسّن v3

// @ts-ignore - accessible from all routes
export const DISCORD_API: string = 'https://discord.com/api/v10';

export interface DiscordResult {
  ok: boolean;
  data?: unknown;
  status: number;
}

interface DiscordFetchOptions {
  botOnly?: boolean;
  userOnly?: boolean;
  timeout?: number;
}

export function cleanToken(token: string): string {
  return String(token || '').trim().replace(/^(Bot |bearer |Bearer )/i, '');
}

// Rate limit global tracker
let globalRLUntil = 0;
let globalRLHits = 0;

export function getGlobalRLState() {
  return { until: globalRLUntil, hits: globalRLHits };
}

export function resetGlobalRL() {
  globalRLUntil = 0;
  globalRLHits = 0;
}

async function smartSleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function discordFetch(
  token: string,
  method: string,
  endpoint: string,
  body?: unknown,
  options: DiscordFetchOptions = {}
): Promise<DiscordResult> {
  const ct = cleanToken(token);
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/')
      ? `${DISCORD_API}${endpoint}`
      : `${DISCORD_API}/${endpoint}`;

  const { botOnly = false, userOnly = false, timeout = 15000 } = options;

  let authMethods: string[];
  if (botOnly) {
    authMethods = [`Bot ${ct}`];
  } else if (userOnly) {
    authMethods = [ct];
  } else {
    authMethods = [ct, `Bot ${ct}`];
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json';
  }

  let lastError: DiscordResult = { ok: false, status: 0 };

  for (const auth of authMethods) {
    // انتظر global rate limit
    const now = Date.now();
    if (now < globalRLUntil) {
      await smartSleep(globalRLUntil - now);
    }

    for (let retry = 0; retry <= 2; retry++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const reqHeaders = { ...headers, 'Authorization': auth };
        const fetchBody = (method !== 'GET' && method !== 'HEAD' && body) ? JSON.stringify(body) : undefined;

        const res = await fetch(url, {
          method,
          headers: reqHeaders,
          body: fetchBody,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        // Rate Limit
        if (res.status === 429) {
          globalRLHits++;
          try {
            const errData = await res.json() as { retry_after?: number };
            const wait = Math.min((errData.retry_after || 2) * 1000, 8000);
            // Exponential backoff penalty
            const penalty = Math.min(globalRLHits * 1500, 10000);
            globalRLUntil = Date.now() + wait + penalty;
            await smartSleep(wait + penalty);
          } catch {
            globalRLUntil = Date.now() + 3000;
            await smartSleep(3000);
          }
          continue; // retry
        }

        // نجاح - أعد العداد
        if (res.ok) {
          globalRLHits = Math.max(0, globalRLHits - 1);
        }

        if (res.status === 401) {
          lastError = { ok: false, status: 401 };
          break;
        }

        if (res.status === 403) {
          lastError = { ok: false, status: 403 };
          break;
        }

        try {
          const data = await res.json();
          return { ok: res.ok, data, status: res.status };
        } catch {
          if (res.ok) {
            return { ok: true, status: res.status };
          }
          lastError = { ok: false, status: res.status };
          break;
        }

      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') {
          lastError = { ok: false, status: 0 };
          break;
        }
        lastError = { ok: false, status: 0 };
        break;
      }
    }
  }

  return lastError;
}

export async function batchProcess<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  batchSize = 15,
  delayBetweenBatches = 0
): Promise<{ results: R[]; successCount: number; failCount: number }> {
  const results: R[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((item, idx) => fn(item, i + idx))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        successCount++;
      } else {
        failCount++;
      }
    }

    if (delayBetweenBatches > 0 && i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, delayBetweenBatches));
    }
  }

  return { results, successCount, failCount };
}

export async function sequentialProcess<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  delayMs = 0
): Promise<{ results: R[]; successCount: number; failCount: number }> {
  const results: R[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < items.length; i++) {
    try {
      const result = await fn(items[i], i);
      results.push(result);
      successCount++;
    } catch {
      failCount++;
    }

    if (delayMs > 0 && i < items.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return { results, successCount, failCount };
}
