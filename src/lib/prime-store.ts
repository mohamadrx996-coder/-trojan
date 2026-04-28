// src/lib/prime-store.ts - Prime activation storage - TRJ BOT v4.3

export const PRIME_KEY = 'Trojan3mklol';
export const ADMIN_CODE = 'ezlolyou';
export const OWNER_ID = '1460035924250333376';
export const PRIME_PRICE = 2000000;
export const SERVER_INVITE = 'https://discord.gg/MpwvCypA66';

/** Stores userId -> activation timestamp for key activations */
export const KEY_ACTIVATIONS = new Map<string, number>();

/** Stores userId -> { serverId, timestamp } for server-post activations */
export interface ServerPostActivation {
  serverId: string;
  serverName: string;
  timestamp: number;
}

export const SERVER_POST_ACTIVATIONS = new Map<string, ServerPostActivation>();

/** Check if a user has Prime (either via key or server-post) */
export function hasPrime(userId: string): boolean {
  if (KEY_ACTIVATIONS.has(userId)) return true;
  if (SERVER_POST_ACTIVATIONS.has(userId)) return true;
  return false;
}

/** Activate via key */
export function activateWithKey(userId: string): boolean {
  KEY_ACTIVATIONS.set(userId, Date.now());
  return true;
}

/** Activate via server-post */
export function activateWithServerPost(userId: string, serverId: string, serverName: string): boolean {
  SERVER_POST_ACTIVATIONS.set(userId, { serverId, serverName, timestamp: Date.now() });
  return true;
}

/** Get activation info for a user */
export function getActivationInfo(userId: string): { hasPrime: boolean; method?: string; activatedAt?: number } {
  const keyTime = KEY_ACTIVATIONS.get(userId);
  if (keyTime) {
    return { hasPrime: true, method: 'key', activatedAt: keyTime };
  }
  const serverInfo = SERVER_POST_ACTIVATIONS.get(userId);
  if (serverInfo) {
    return { hasPrime: true, method: 'server-post', activatedAt: serverInfo.timestamp };
  }
  return { hasPrime: false };
}
