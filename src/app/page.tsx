'use client'

import { useState, useEffect, useCallback } from 'react'

type Section = 'verify' | 'nuker' | 'copy' | 'spam' | 'leveling' | 'sniper' | 'checker' | 'multi-spam' | 'mass-dm' | 'leaver' | 'react' | 'webhook-spam' | 'external-checker'

interface Stats {
  deleted?: number; created?: number; spam_sent?: number; banned?: number; roles?: number
  txt?: number; voice?: number; cats?: number; sent?: number; failed?: number
  blocked?: number; left?: number; total?: number; emojis?: number; permissions?: number
}

interface Result { username: string; status: string; color: string; debug?: string }
interface VerifyInfo { type: string; name: string; id: string; email?: string; nitro?: string; verified?: string; createdAt?: string; flags?: number }
interface TokenCheckResult { token: string; valid: boolean; type: string; name: string; id: string; email?: string; nitro?: string; verified?: string; createdAt?: string; phone?: string; mfa?: string; error?: string }
interface GuildInfo { id: string; name: string; owner: boolean; members: number }

export default function Home() {
  const [section, setSection] = useState<Section>('verify')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [verifyData, setVerifyData] = useState<VerifyInfo | null>(null)
  const [sniperResults, setSniperResults] = useState<Result[]>([])
  const [checkerResults, setCheckerResults] = useState<TokenCheckResult[]>([])
  const [checkerStats, setCheckerStats] = useState<{ total: number; valid: number; invalid: number; bots: number; users: number; nitro: number } | null>(null)
  const [progress, setProgress] = useState('')
  const [guildList, setGuildList] = useState<GuildInfo[]>([])
  const [extraData, setExtraData] = useState<any>(null)

  const [verifyToken, setVerifyToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_verify_token') || '' })
  const [nukerToken, setNukerToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_nuker_token') || '' })
  const [copyToken, setCopyToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_copy_token') || '' })
  const [spamToken, setSpamToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_spam_token') || '' })
  const [levelingToken, setLevelingToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_leveling_token') || '' })
  const [sniperToken, setSniperToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_sniper_token') || '' })
  const [checkerTokens, setCheckerTokens] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_checker_tokens') || '' })
  const [multiSpamTokens, setMultiSpamTokens] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_multi_tokens') || '' })
  const [massDmToken, setMassDmToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_dm_token') || '' })
  const [leaverToken, setLeaverToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_leaver_token') || '' })
  const [reactToken, setReactToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_react_token') || '' })
  const [whSpamToken, setWhSpamToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_whspam_token') || '' })

  const [guildId, setGuildId] = useState('')
  const [nukeMsg, setNukeMsg] = useState('@everyone NUKED BY TRJ BOT 💀🔥')
  const [nukeChannelName, setNukeChannelName] = useState('nuked-by-trj')
  const [nukeChannelCount, setNukeChannelCount] = useState(25)
  const [nukeMsgPerChannel, setNukeMsgPerChannel] = useState(5)

  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [copyOptions, setCopyOptions] = useState({ roles: true, channels: true, settings: true })

  const [channelId, setChannelId] = useState('')
  const [messages, setMessages] = useState('')
  const [duration, setDuration] = useState(60)
  const [speed, setSpeed] = useState(0.3)

  const [levelingChannelId, setLevelingChannelId] = useState('')
  const [levelingDuration, setLevelingDuration] = useState(300)
  const [levelingSpeed, setLevelingSpeed] = useState(0.8)

  const [sniperMode, setSniperMode] = useState<'auto' | 'manual'>('auto')
  const [usernames, setUsernames] = useState('')
  const [sniperCount, setSniperCount] = useState(10)
  const [sniperLength, setSniperLength] = useState(4)
  const [useDot, setUseDot] = useState(false)
  const [useUnderscore, setUseUnderscore] = useState(false)
  // sniperPassword removed - not needed
  const [sniperAccountInfo, setSniperAccountInfo] = useState<any>(null)
  const [sniperStats, setSniperStats] = useState<any>(null)
  const [availableNames, setAvailableNames] = useState<string[]>([])
  const [sniperPattern, setSniperPattern] = useState('random')

  // Multi-Spam
  const [msChannelId, setMsChannelId] = useState('')
  const [msMessages, setMsMessages] = useState('')
  const [msDuration, setMsDuration] = useState(60)
  const [msSpeed, setMsSpeed] = useState(0.3)

  // Mass DM
  const [dmGuildId, setDmGuildId] = useState('')
  const [dmMessage, setDmMessage] = useState('')
  const [dmMaxMembers, setDmMaxMembers] = useState(100)

  // React
  const [reactChannelId, setReactChannelId] = useState('')
  const [reactEmoji, setReactEmoji] = useState('👍 ❤️ 🔥 🎉 💯')
  const [reactMessageId, setReactMessageId] = useState('')
  const [reactMode, setReactMode] = useState<'manual' | 'auto'>('manual')
  const [reactDuration, setReactDuration] = useState(60)

  // Webhook Spam
  const [whSpamUrl, setWhSpamUrl] = useState('')
  const [whSpamMessage, setWhSpamMessage] = useState('')
  const [whSpamCount, setWhSpamCount] = useState(50)
  const [whSpamUsername, setWhSpamUsername] = useState('')
  // External Checker
  const [extCount, setExtCount] = useState(10)
  const [extLength, setExtLength] = useState(4)
  const [extPattern, setExtPattern] = useState('random')
  const [extUseDot, setExtUseDot] = useState(false)
  const [extUseUnderscore, setExtUseUnderscore] = useState(false)
  const [extUsernames, setExtUsernames] = useState('')

  // Save to localStorage
  useEffect(() => { if (verifyToken) localStorage.setItem('trj_verify_token', verifyToken) }, [verifyToken])
  useEffect(() => { if (nukerToken) localStorage.setItem('trj_nuker_token', nukerToken) }, [nukerToken])
  useEffect(() => { if (copyToken) localStorage.setItem('trj_copy_token', copyToken) }, [copyToken])
  useEffect(() => { if (spamToken) localStorage.setItem('trj_spam_token', spamToken) }, [spamToken])
  useEffect(() => { if (levelingToken) localStorage.setItem('trj_leveling_token', levelingToken) }, [levelingToken])
  useEffect(() => { if (sniperToken) localStorage.setItem('trj_sniper_token', sniperToken) }, [sniperToken])
  useEffect(() => { if (checkerTokens) localStorage.setItem('trj_checker_tokens', checkerTokens) }, [checkerTokens])
  useEffect(() => { if (multiSpamTokens) localStorage.setItem('trj_multi_tokens', multiSpamTokens) }, [multiSpamTokens])
  useEffect(() => { if (massDmToken) localStorage.setItem('trj_dm_token', massDmToken) }, [massDmToken])
  useEffect(() => { if (leaverToken) localStorage.setItem('trj_leaver_token', leaverToken) }, [leaverToken])
  useEffect(() => { if (reactToken) localStorage.setItem('trj_react_token', reactToken) }, [reactToken])
  useEffect(() => { if (whSpamToken) localStorage.setItem('trj_whspam_token', whSpamToken) }, [whSpamToken])

  const genUsername = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const special = (useDot ? '.' : '') + (useUnderscore ? '_' : '')
    const allChars = chars + special
    if (sniperPattern === 'consonants') { const cons = 'bcdfghjklmnpqrstvwxyz'; let u = cons[Math.floor(Math.random() * cons.length)]; for (let i = 1; i < sniperLength; i++) u += allChars[Math.floor(Math.random() * allChars.length)]; return u }
    if (sniperPattern === 'numbers') { let u = chars[Math.floor(Math.random() * 26)]; for (let i = 1; i < sniperLength; i++) u += chars[Math.floor(Math.random() * chars.length)]; return u }
    if (sniperPattern === 'dictionary') { const words = ['the','new','old','big','one','two','red','sun','sky','ice','fire','dark','cool','fast','top','zen','neo','pro','vex','lux','arc','sol','nox','pyx','zex','kai','ray','fox','owl','gem']; return words[Math.floor(Math.random() * words.length)] + String(Math.floor(Math.random() * 999)).padStart(3, '0') }
    if (sniperPattern === 'rare') { const p = [() => { const c = chars[Math.floor(Math.random()*26)]; return c+c+String(Math.floor(Math.random()*9999)).padStart(4,'0') }, () => { const c = chars[Math.floor(Math.random()*26)]; return c+String(Math.floor(Math.random()*99))+c+String(Math.floor(Math.random()*99)) }]; return p[Math.floor(Math.random()*p.length)]() }
    let u = chars[Math.floor(Math.random() * 26)]; for (let i = 1; i < sniperLength; i++) u += allChars[Math.floor(Math.random() * allChars.length)]; return u
  }

  const clearState = useCallback(() => { setResult(''); setStats(null); setVerifyData(null); setSniperResults([]); setSniperAccountInfo(null); setSniperStats(null); setAvailableNames([]); setCheckerResults([]); setCheckerStats(null); setProgress(''); setGuildList([]); setExtraData(null) }, [])

  const api = async (endpoint: string, body: any) => {
    setLoading(true); setResult(''); setStats(null); setSniperResults([]); setSniperAccountInfo(null); setSniperStats(null); setAvailableNames([]); setCheckerResults([]); setCheckerStats(null); setProgress('جاري التنفيذ...'); setGuildList([]); setExtraData(null)
    try {
      const payload = { ...body }
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000) // 2 دقيقة timeout
      const res = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.success) {
        setResult('✅ تم بنجاح!')
        if (endpoint === 'sniper' || endpoint === 'external-checker') { setSniperResults(data.results); if (data.stats) setSniperStats(data.stats); if (data.availableNames) setAvailableNames(data.availableNames); if (data.accountInfo) setSniperAccountInfo(data.accountInfo) }
        else if (endpoint === 'token-checker') { setCheckerResults(data.results); if (data.stats) setCheckerStats(data.stats) }
        else if (endpoint === 'leaver' && data.guilds) { setGuildList(data.guilds) }
        else if (endpoint === 'leaver' && data.servers) { setGuildList(data.servers.map((s: any) => ({ id: s.id, name: s.name, owner: s.name?.includes('owner'), members: 0 }))) }
        else if (endpoint === 'multi-spam' && data.stats?.tokenStats) { setExtraData(data.stats.tokenStats) }
        if (data.stats) setStats(data.stats)
        setLoading(false); setProgress(''); return data
      } else { setResult(`❌ ${data.error}`); setLoading(false); setProgress(''); return null }
    } catch (e) { 
      if (e instanceof Error && e.name === 'AbortError') setResult('❌ انتهى وقت الانتظار - حاول عدد أقل')
      else setResult('❌ خطأ في الاتصال')
      setLoading(false); setProgress(''); return null 
    }
  }

  const sections = [
    { id: 'verify' as Section, name: 'تحقق', icon: '🔑' },
    { id: 'nuker' as Section, name: 'نيوكر', icon: '💥' },
    { id: 'copy' as Section, name: 'نسخ', icon: '📋' },
    { id: 'spam' as Section, name: 'تسطير', icon: '⚡' },
    { id: 'leveling' as Section, name: 'تلفيل', icon: '📈' },
    { id: 'sniper' as Section, name: 'صيد', icon: '🎯' },
    { id: 'multi-spam' as Section, name: 'سبام متعدد', icon: '🔥' },
    { id: 'mass-dm' as Section, name: 'DM جماعي', icon: '📧' },
    { id: 'leaver' as Section, name: 'مغادرة', icon: '🚪' },
    { id: 'react' as Section, name: 'رياكشن', icon: '🎭' },
    { id: 'checker' as Section, name: 'فحص توكنات', icon: '🔍' },
    { id: 'webhook-spam' as Section, name: 'ويب هوك سبام', icon: '🔗' },
    { id: 'external-checker' as Section, name: 'فحص خارجي', icon: '🌐' },
  ]

  return (
    <div className="min-h-screen relative">
      <div className="bg-animated"><div className="bg-grid" /><div className="bg-orb bg-orb-1" /><div className="bg-orb bg-orb-2" /><div className="bg-orb bg-orb-3" /><div className="bg-lines"><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /></div></div>

      <header className="glass sticky top-0 z-50 border-b border-green-500/20 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-400 flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent font-black text-2xl">TRJ BOT</span>
            <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 ml-1">v3.0</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">⚡ 14 ميزة</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex relative z-10">
        <aside className="w-64 min-h-screen glass-card p-3 hidden lg:block sticky top-[57px] self-start border-l border-green-500/10 overflow-auto max-h-[calc(100vh-57px)]">
          <div className="text-center mb-5 pb-4 border-b border-green-500/15"><div className="text-3xl mb-1">🛡️</div><h2 className="text-base font-black text-green-400">TRJ BOT</h2><p className="text-[10px] text-green-600 mt-0.5">v3.0 - محسّن و سريع</p></div>
          <nav className="space-y-1">
            {sections.map(s => (
              <button key={s.id} onClick={() => { setSection(s.id); clearState() }} className={`nav-item w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm ${section === s.id ? 'active bg-green-500/15 text-green-400 border border-green-500/30 shadow-lg shadow-green-500/5' : 'text-green-600 hover:bg-green-500/8 hover:text-green-400 border border-transparent'}`}>
                <span className="text-lg">{s.icon}</span><span className="font-medium">{s.name}</span>
              </button>
            ))}
          </nav>
          <div className="mt-6 pt-3 border-t border-green-500/15 text-center"><p className="text-[10px] text-green-700">صنع بواسطة</p><p className="text-xs font-bold text-green-500">Discord: trj.py</p></div>
        </aside>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-green-500/20 p-1.5 z-50">
          <div className="flex justify-around overflow-x-auto">
            {sections.slice(0, 6).map(s => (
              <button key={s.id} onClick={() => { setSection(s.id); clearState() }} className={`flex flex-col items-center p-1.5 rounded-xl transition-all min-w-[48px] ${section === s.id ? 'bg-green-500/20 text-green-400' : 'text-green-700'}`}>
                <span className="text-lg">{s.icon}</span><span className="text-[9px] mt-0.5">{s.name}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-around mt-1.5 pt-1.5 border-t border-green-500/10 overflow-x-auto">
            {sections.slice(6).map(s => (
              <button key={s.id} onClick={() => { setSection(s.id); clearState() }} className={`flex flex-col items-center p-1.5 rounded-xl transition-all min-w-[48px] ${section === s.id ? 'bg-green-500/20 text-green-400' : 'text-green-700'}`}>
                <span className="text-lg">{s.icon}</span><span className="text-[9px] mt-0.5">{s.name}</span>
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 p-4 lg:p-6 pb-28 lg:pb-8">
          <div className="max-w-2xl mx-auto">

            {loading && (<div className="mb-4 animate-fade-in"><div className="glass-card rounded-xl p-3 border border-green-500/20 flex items-center gap-3"><div className="trj-spinner" /><span className="text-sm text-green-400">{progress || '⏳ جاري التنفيذ...'}</span></div></div>)}

            {/* ==================== VERIFY ==================== */}
            {section === 'verify' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-green-500/20 shadow-xl shadow-green-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🔑</span><h2 className="text-xl font-black text-green-400">تحقق من التوكن</h2></div>
                <p className="text-green-600 text-sm mb-5">تحقق من صلاحية أي توكن (بوت / يوزر) مع معلومات تفصيلية</p>
                <TokenInput label="🎫 التوكن" value={verifyToken} onChange={setVerifyToken} />
                <ActionBtn text="🔍 تحقق الآن" loading={loading} onClick={async () => { const data = await api('verify', { token: verifyToken }); if (data) setVerifyData({ type: data.type, name: data.name, id: data.id, email: data.email, nitro: data.nitro, verified: data.verified, createdAt: data.createdAt, flags: data.flags }) }} />
                {verifyData && (<div className="mt-5 bg-green-500/8 rounded-2xl p-6 border border-green-500/20 text-center animate-fade-in">
                  <div className="text-5xl mb-3">{verifyData.type === 'bot' ? '🤖' : '👤'}</div>
                  <div className="text-xl font-black text-green-400 mb-1">{verifyData.type === 'bot' ? 'بوت' : 'حساب يوزر'}</div>
                  <div className="text-green-300 text-lg font-medium">{verifyData.name}</div>
                  <div className="text-xs text-green-600 font-mono mt-2">{verifyData.id}</div>
                  <div className="grid grid-cols-2 gap-2 mt-4">{verifyData.email && <InfoPill label="البريد" value={verifyData.email} />}{verifyData.nitro && <InfoPill label="نيترو" value={verifyData.nitro} />}{verifyData.verified && <InfoPill label="الحالة" value={verifyData.verified} />}{verifyData.createdAt && <InfoPill label="التسجيل" value={verifyData.createdAt} />}</div>
                </div>)}
              </div></div>
            )}

            {/* ==================== NUKER ==================== */}
            {section === 'nuker' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border-2 border-red-500/30 shadow-xl shadow-red-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">💥</span><h2 className="text-xl font-black text-red-400">نيوكر سيرفر</h2></div>
                <p className="text-red-500/60 text-sm mb-5">⚡ أسرع نيوكر - 25 روم بالتوازي + 30 حظر بالتوازي!</p>
                <TokenInput label="🎫 التوكن" value={nukerToken} onChange={setNukerToken} accent="red" />
                <TextInput label="📋 أيدي السيرفر" value={guildId} onChange={setGuildId} placeholder="Guild ID" accent="red" />
                <div className="bg-red-500/5 rounded-xl p-4 mb-5 border border-red-500/15">
                  <h3 className="text-xs font-bold text-red-400 mb-3 flex items-center gap-1.5">⚙️ خيارات متقدمة</h3>
                  <div className="mb-3"><label className="text-[11px] text-red-300/70">اسم الرومات</label><input type="text" value={nukeChannelName} onChange={e => setNukeChannelName(e.target.value)} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="text-[11px] text-red-300/70">عدد الرومات (max 100)</label><input type="number" value={nukeChannelCount} onChange={e => setNukeChannelCount(Math.min(Number(e.target.value), 100))} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-red-300/70">رسائل لكل روم</label><input type="number" value={nukeMsgPerChannel} onChange={e => setNukeMsgPerChannel(Number(e.target.value))} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                  </div>
                  <div><label className="text-[11px] text-red-300/70">💬 رسالة السبام</label><textarea value={nukeMsg} onChange={e => setNukeMsg(e.target.value)} rows={2} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 resize-none focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <NukerBtn text="💥 نيوكر كامل" color="red" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'nuke', channelName: nukeChannelName, channelCount: nukeChannelCount, msgPerChannel: nukeMsgPerChannel, message: nukeMsg })} />
                  <NukerBtn text="🔨 حظر الكل" color="red" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'banall' })} />
                  <NukerBtn text="🗑️ حذف الرومات" color="gray" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'delete_channels' })} />
                  <NukerBtn text="🗑️ حذف الرتب" color="gray" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'delete_roles' })} />
                  <NukerBtn text="📢 سبام سريع" color="orange" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'spam', message: nukeMsg })} />
                  <NukerBtn text="🔤 تغيير الاسم" color="gray" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'rename', name: nukeChannelName })} />
                </div>
              </div></div>
            )}

            {/* ==================== COPY ==================== */}
            {section === 'copy' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-green-500/20 shadow-xl shadow-green-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">📋</span><h2 className="text-xl font-black text-green-400">نسخ سيرفر</h2></div>
                <p className="text-green-600 text-sm mb-5">نسخ سيرفر كامل بالتوازي - رتب + رومات + إعدادات + إيموجي + صلاحيات</p>
                <TokenInput label="🎫 التوكن" value={copyToken} onChange={setCopyToken} /><TextInput label="📥 أيدي المصدر" value={sourceId} onChange={setSourceId} placeholder="Source Guild ID" /><TextInput label="📤 أيدي الهدف" value={targetId} onChange={setTargetId} placeholder="Target Guild ID" />
                <div className="flex gap-3 mb-5 flex-wrap">{[{ key: 'roles' as const, label: '🎭 رتب' }, { key: 'channels' as const, label: '📺 رومات' }, { key: 'settings' as const, label: '⚙️ إعدادات' }].map(opt => (<label key={opt.key} className="flex items-center gap-2 text-xs text-green-300 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/15 cursor-pointer hover:bg-green-500/12 transition-colors"><input type="checkbox" checked={copyOptions[opt.key]} onChange={e => setCopyOptions({ ...copyOptions, [opt.key]: e.target.checked })} className="accent-green-500 w-3.5 h-3.5" />{opt.label}</label>))}</div>
                <ActionBtn text="📋 بدء النسخ" loading={loading} onClick={() => api('copy', { token: copyToken, sourceId, targetId, options: copyOptions })} />
              </div></div>
            )}

            {/* ==================== SPAM ==================== */}
            {section === 'spam' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-orange-500/20 shadow-xl shadow-orange-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">⚡</span><h2 className="text-xl font-black text-orange-400">تسطير - ماكرو</h2></div>
                <p className="text-orange-500/60 text-sm mb-5">إرسال 5 رسائل بالتوازي - أسرع بمرتين!</p>
                <TokenInput label="🎫 التوكن" value={spamToken} onChange={setSpamToken} accent="orange" /><TextInput label="📺 أيدي الروم" value={channelId} onChange={setChannelId} placeholder="Channel ID" accent="orange" />
                <div className="mb-4"><label className="text-[11px] text-orange-300/70 mb-1 block">📝 الرسائل (كل سطر يرسل لوحده)</label><textarea value={messages} onChange={e => setMessages(e.target.value)} placeholder={"رسالة 1\nرسالة 2\nرسالة 3"} rows={4} className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-orange-700/30 focus:outline-none focus:border-orange-400/50 resize-none transition-colors" /></div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div><label className="text-[11px] text-orange-300/70 mb-1 block">⏱️ المدة (ثانية)</label><input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                  <div><label className="text-[11px] text-orange-300/70 mb-1 block">🚀 السرعة (ثانية)</label><input type="number" value={speed} onChange={e => setSpeed(Number(e.target.value))} step="0.1" className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                </div>
                <ActionBtn text="⚡ بدء التسطير" loading={loading} color="orange" onClick={() => { const msgList = messages.split('\n').map(m => m.trim()).filter(Boolean); if (msgList.length === 0) { setResult('❌ أدخل رسالة واحدة على الأقل'); return }; api('macro', { token: spamToken, channelId, messages: msgList, duration, speed }) }} />
              </div></div>
            )}

            {/* ==================== LEVELING ==================== */}
            {section === 'leveling' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-green-500/20 shadow-xl shadow-green-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">📈</span><h2 className="text-xl font-black text-green-400">تلفيل حساب</h2></div>
                <p className="text-green-600 text-sm mb-5">رفع لفل الحساب - 5 رسائل بالتوازي</p>
                <TokenInput label="🎫 التوكن" value={levelingToken} onChange={setLevelingToken} /><TextInput label="📺 أيدي الروم" value={levelingChannelId} onChange={setLevelingChannelId} placeholder="Channel ID" />
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div><label className="text-[11px] text-green-300/70 mb-1 block">⏱️ المدة (ثانية)</label><input type="number" value={levelingDuration} onChange={e => setLevelingDuration(Number(e.target.value))} className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-400/50 transition-colors" /></div>
                  <div><label className="text-[11px] text-green-300/70 mb-1 block">🚀 السرعة (ثانية)</label><input type="number" value={levelingSpeed} onChange={e => setLevelingSpeed(Number(e.target.value))} step="0.1" className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-400/50 transition-colors" /></div>
                </div>
                <ActionBtn text="📈 بدء التلفيل" loading={loading} onClick={() => api('leveling', { token: levelingToken, channelId: levelingChannelId, duration: levelingDuration, speed: levelingSpeed })} />
              </div></div>
            )}

            {/* ==================== SNIPER ==================== */}
            {section === 'sniper' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-green-500/20 shadow-xl shadow-green-500/5">
                <div className="flex items-center justify-between mb-1"><div className="flex items-center gap-3"><span className="text-2xl">🎯</span><h2 className="text-xl font-black text-green-400">صيد يوزرات</h2></div>
                  <div className="flex gap-1.5">
                    <button onClick={async () => { if (!sniperToken) { setResult('❌ أدخل التوكن أولاً'); return }; setLoading(true); setProgress('🔍 جلب معلومات الحساب...'); try { const res = await fetch('/api/sniper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sniperToken, action: 'accountInfo' }) }); const data = await res.json(); if (data.success) { setSniperAccountInfo(data.info); setResult('') } else { setResult(`❌ ${data.error}`) } } catch { setResult('❌ خطأ في الاتصال') }; setLoading(false); setProgress('') }} className="text-xs text-cyan-400 bg-cyan-500/10 px-2.5 py-1.5 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer">👤</button>
                    <button onClick={async () => { if (!sniperToken) { setResult('❌ أدخل التوكن أولاً'); return }; setLoading(true); setProgress('🧪 فحص تجريبي بـ 3 طرق...'); try { const res = await fetch('/api/sniper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sniperToken, action: 'test' }) }); const data = await res.json(); if (data.success) { const t = data.test; let out = '🧪 فحص تجريبي - 3 طرق\nالحساب: ' + t.account + ' | MFA: ' + (t.mfa ? 'نعم' : 'لا') + ' | Phone: ' + (t.phone ? 'نعم' : 'لا') + ' | Verified: ' + (t.verified ? 'نعم' : 'لا') + '\n'; for (const r of t.results) { out += '\n━━ ' + r.label + ' ━━\n'; for (const m of r.results) { out += '  [' + (m.method || '?') + '] ' + m.status; if (m.debug) out += ' (' + m.debug + ')'; out += '\n'; } } setResult(out) } else { setResult('❌ ' + data.error) } } catch (e: any) { setResult('❌ خطأ: ' + (e.message || 'غير معروف')) }; setLoading(false); setProgress('') }} className="text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1.5 rounded-lg border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-pointer">🧪 فحص</button>
                  </div>
                </div>
                <p className="text-green-600 text-sm mb-5">⚡ يستخدم 3 طرق: pomelo-attempt + PATCH /users/@me + GET /users/{name}</p>
                {sniperAccountInfo && (<div className="mb-4 bg-cyan-500/5 rounded-xl p-4 border border-cyan-500/15 animate-fade-in">
                  <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">{(sniperAccountInfo.username || '?')[0].toUpperCase()}</div><div><div className="text-sm font-bold text-cyan-300">{sniperAccountInfo.username}</div><div className="text-[10px] text-cyan-500/60 font-mono">{sniperAccountInfo.id}</div></div><div className="ml-auto flex gap-2">{sniperAccountInfo.mfa && <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">🔒 MFA</span>}{sniperAccountInfo.nitro !== 'None' && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">💎 {sniperAccountInfo.nitro}</span>}</div></div>
                  {availableNames.length > 0 && (<div className="mt-3"><button onClick={async () => { const name = availableNames[0]; setLoading(true); setProgress(`🔄 جاري تغيير اليوزر إلى: ${name}...`); try { const res = await fetch('/api/sniper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sniperToken, action: 'changeUsername', targetUsername: name }) }); const data = await res.json(); if (data.success) setResult(`✅ تم تغيير اليوزر إلى: ${name}`); else setResult(`❌ ${data.error}`) } catch { setResult('❌ خطأ') }; setLoading(false); setProgress('') }} className="text-xs text-green-400 bg-green-500/15 px-3 py-2 rounded-lg border border-green-500/25 hover:bg-green-500/25 transition-colors cursor-pointer font-bold">🎯 خذ {availableNames[0]}</button></div>)}
                </div>)}
                <TokenInput label="🎫 توكن يوزر" value={sniperToken} onChange={setSniperToken} />
                <div className="bg-red-500/5 rounded-xl p-3 mb-4 border border-red-500/10"><p className="text-[11px] text-red-400/80">⚠️ يجب استخدام توكن يوزر (User Token) وليس توكن بوت!</p></div>
                <div className="flex gap-2 mb-4">{['auto', 'manual'].map(mode => (<button key={mode} onClick={() => setSniperMode(mode as any)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${sniperMode === mode ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-black/20 text-green-600 hover:text-green-400 border border-transparent'}`}>{mode === 'auto' ? '🎲 تلقائي' : '✏️ يدوي'}</button>))}</div>
                {sniperMode === 'auto' ? (<>
                  <div className="grid grid-cols-2 gap-3 mb-4"><div><label className="text-[11px] text-green-300/70 mb-1 block">🔢 العدد</label><input type="number" value={sniperCount} onChange={e => setSniperCount(Number(e.target.value))} className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-400/50 transition-colors" /></div><div><label className="text-[11px] text-green-300/70 mb-1 block">📏 الطول</label><input type="number" value={sniperLength} onChange={e => setSniperLength(Number(e.target.value))} className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-400/50 transition-colors" /></div></div>
                  <div className="mb-4"><label className="text-[11px] text-green-300/70 mb-2 block">🎨 نمط التوليد</label><div className="grid grid-cols-5 gap-1.5">{[{ id: 'random', label: 'عشوائي', icon: '🎲' }, { id: 'consonants', label: 'ساكنات', icon: '🔤' }, { id: 'numbers', label: 'أرقام', icon: '🔢' }, { id: 'dictionary', label: 'كلمات', icon: '📖' }, { id: 'rare', label: 'نادر', icon: '💎' }].map(p => (<button key={p.id} onClick={() => setSniperPattern(p.id)} className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${sniperPattern === p.id ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-black/20 text-green-600 hover:text-green-400 border border-transparent'}`}><span className="text-base block mb-0.5">{p.icon}</span>{p.label}</button>))}</div></div>
                  <div className="flex gap-3 mb-4"><label className="flex items-center gap-2 text-xs text-green-300 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/15 cursor-pointer"><input type="checkbox" checked={useDot} onChange={e => setUseDot(e.target.checked)} className="accent-green-500" /> نقطة (.)</label><label className="flex items-center gap-2 text-xs text-green-300 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/15 cursor-pointer"><input type="checkbox" checked={useUnderscore} onChange={e => setUseUnderscore(e.target.checked)} className="accent-green-500" /> شرطة (_)</label></div>
                </>) : (<div className="mb-4"><label className="text-[11px] text-green-300/70 mb-1 block">📝 اليوزرات (كل يوزر سطر)</label><textarea value={usernames} onChange={e => setUsernames(e.target.value)} placeholder={"username1\nusername2"} rows={4} className="w-full bg-black/30 border border-green-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-green-700/30 focus:outline-none focus:border-green-400/50 resize-none font-mono transition-colors" /></div>)}
                <ActionBtn text="🎯 بدء الفحص" loading={loading} onClick={async () => { const list = sniperMode === 'auto' ? Array.from({ length: sniperCount }, () => genUsername()) : usernames.split('\n').map(u => u.trim()).filter(Boolean); if (list.length === 0) { setResult('❌ أدخل يوزر واحد على الأقل'); return }; await api('sniper', { token: sniperToken, usernames: list, debug: true }) }} />
                {sniperStats && (<div className="mt-4 grid grid-cols-4 gap-2 animate-fade-in"><div className="bg-green-500/8 rounded-xl p-2.5 border border-green-500/10 text-center"><div className="text-lg font-black text-green-400">{sniperStats.available}</div><div className="text-[9px] text-green-300/60">✅ متاح</div></div><div className="bg-red-500/8 rounded-xl p-2.5 border border-red-500/10 text-center"><div className="text-lg font-black text-red-400">{sniperStats.taken}</div><div className="text-[9px] text-red-300/60">❌ محجوز</div></div><div className="bg-yellow-500/8 rounded-xl p-2.5 border border-yellow-500/10 text-center"><div className="text-lg font-black text-yellow-400">{sniperStats.errors}</div><div className="text-[9px] text-yellow-300/60">⚠️ خطأ</div></div><div className="bg-blue-500/8 rounded-xl p-2.5 border border-blue-500/10 text-center"><div className="text-lg font-black text-blue-400">{sniperStats.rateLimitHits || 0}</div><div className="text-[9px] text-blue-300/60">⏳ RL</div></div></div>)}
                {availableNames.length > 0 && (<div className="mt-4 bg-green-500/8 rounded-xl p-4 border border-green-500/20 animate-fade-in"><div className="flex items-center justify-between mb-2"><h3 className="font-bold text-green-400 text-sm">🏆 اليوزرات المتاحة! ({availableNames.length})</h3><button onClick={() => { navigator.clipboard.writeText(availableNames.join('\n')); setResult('📋 تم النسخ!') }} className="text-[10px] text-green-300 bg-green-500/15 px-2.5 py-1 rounded-lg border border-green-500/20 hover:bg-green-500/25 cursor-pointer transition-colors">📋 نسخ الكل</button></div><div className="flex flex-wrap gap-1.5">{availableNames.map((name, i) => (<button key={i} onClick={() => { navigator.clipboard.writeText(name); setResult(`📋 تم نسخ: ${name}`) }} className="text-xs font-mono text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-lg border border-green-500/20 hover:bg-green-500/20 cursor-pointer transition-colors">{name} 📋</button>))}</div></div>)}
                {sniperResults.length > 0 && (<div className="mt-4 bg-black/30 rounded-2xl p-4 border border-green-500/15 animate-fade-in"><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-green-400 text-sm">📊 النتائج ({sniperResults.length})</h3><button onClick={() => { const text = sniperResults.map(r => `${r.username} | ${r.status}${r.debug ? ' | ' + r.debug : ''}`).join('\n'); navigator.clipboard.writeText(text); setResult('📋 تم النسخ!') }} className="text-[10px] text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">📋 نسخ الكل</button></div><div className="space-y-1 max-h-72 overflow-auto">{sniperResults.map((r, i) => (<div key={i} className={`px-3 py-2 rounded-lg text-xs font-mono ${r.color === 'green' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : r.color === 'red' ? 'bg-red-500/8 text-red-400/70 border border-red-500/10' : 'bg-yellow-500/8 text-yellow-400/70 border border-yellow-500/10'}`}><div className="flex justify-between items-center"><span className="cursor-pointer hover:underline" onClick={() => { navigator.clipboard.writeText(r.username); setResult(`📋 ${r.username}`) }}>{r.username}</span><span className="font-medium">{r.status}</span></div>{r.debug && <div className="text-[9px] opacity-60 mt-0.5">{r.debug}</div>}</div>))}</div></div>)}
              </div></div>
            )}

            {/* ==================== EXTERNAL CHECKER ==================== */}
            {section === 'external-checker' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-blue-500/20 shadow-xl shadow-blue-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🌐</span><h2 className="text-xl font-black text-blue-400">فحص خارجي</h2></div>
                <p className="text-blue-500/60 text-sm mb-2">🔍 فحص يوزرات بدون توكن — طريقة خارجية</p>
                <div className="bg-blue-500/5 rounded-xl p-3 mb-4 border border-blue-500/10"><p className="text-[11px] text-blue-400/80">⚡ يستخدم نقطة نهاية التسجيل في Discord لفحص توفر اليوزرات بدون توكن</p></div>
                <div className="flex gap-2 mb-4">{['auto', 'manual'].map(mode => (<button key={mode} onClick={() => setExtPattern(mode === 'auto' ? 'random' : 'manual')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${extPattern === (mode === 'auto' ? 'random' : 'manual') ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-black/20 text-blue-600 hover:text-blue-400 border border-transparent'}`}>{mode === 'auto' ? '🎲 تلقائي' : '✏️ يدوي'}</button>))}</div>
                {extPattern !== 'manual' ? (<>
                  <div className="grid grid-cols-2 gap-3 mb-4"><div><label className="text-[11px] text-blue-300/70 mb-1 block">🔢 العدد</label><input type="number" value={extCount} onChange={e => setExtCount(Number(e.target.value))} className="w-full bg-black/30 border border-blue-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400/50 transition-colors" /></div><div><label className="text-[11px] text-blue-300/70 mb-1 block">📏 الطول</label><input type="number" value={extLength} onChange={e => setExtLength(Number(e.target.value))} className="w-full bg-black/30 border border-blue-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-400/50 transition-colors" /></div></div>
                  <div className="mb-4"><label className="text-[11px] text-blue-300/70 mb-2 block">🎨 نمط التوليد</label><div className="grid grid-cols-5 gap-1.5">{[{ id: 'random', label: 'عشوائي', icon: '🎲' }, { id: 'consonants', label: 'ساكنات', icon: '🔤' }, { id: 'numbers', label: 'أرقام', icon: '🔢' }, { id: 'dictionary', label: 'كلمات', icon: '📖' }, { id: 'rare', label: 'نادر', icon: '💎' }].map(p => (<button key={p.id} onClick={() => setExtPattern(p.id)} className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer text-center ${extPattern === p.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-black/20 text-blue-600 hover:text-blue-400 border border-transparent'}`}><span className="text-base block mb-0.5">{p.icon}</span>{p.label}</button>))}</div></div>
                  <div className="flex gap-3 mb-4"><label className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/8 px-3 py-2 rounded-lg border border-blue-500/15 cursor-pointer"><input type="checkbox" checked={extUseDot} onChange={e => setExtUseDot(e.target.checked)} className="accent-blue-500" /> نقطة (.)</label><label className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/8 px-3 py-2 rounded-lg border border-blue-500/15 cursor-pointer"><input type="checkbox" checked={extUseUnderscore} onChange={e => setExtUseUnderscore(e.target.checked)} className="accent-blue-500" /> شرطة (_)</label></div>
                </>) : (<div className="mb-4"><label className="text-[11px] text-blue-300/70 mb-1 block">📝 اليوزرات (كل يوزر سطر)</label><textarea value={extUsernames} onChange={e => setExtUsernames(e.target.value)} placeholder={"username1\nusername2"} rows={4} className="w-full bg-black/30 border border-blue-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-blue-700/30 focus:outline-none focus:border-blue-400/50 resize-none font-mono transition-colors" /></div>)}
                <ActionBtn text="🌐 بدء الفحص (بدون توكن)" loading={loading} onClick={async () => { const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'; const special = (extUseDot ? '.' : '') + (extUseUnderscore ? '_' : ''); const allChars = chars + special; const gen = () => { if (extPattern === 'dictionary') { const words = ['the','new','old','big','one','two','red','sun','sky','ice','fire','dark','cool','fast','top','zen','neo','pro','vex','lux','arc','sol','nox','kai','ray','fox','owl','gem']; return words[Math.floor(Math.random() * words.length)] + String(Math.floor(Math.random() * 999)).padStart(3, '0') } if (extPattern === 'rare') { const c = chars[Math.floor(Math.random() * 26)]; return c + c + String(Math.floor(Math.random() * 9999)).padStart(4, '0') } if (extPattern === 'numbers') { let u = chars[Math.floor(Math.random() * 26)]; for (let i = 1; i < extLength; i++) u += chars[Math.floor(Math.random() * chars.length)]; return u } if (extPattern === 'consonants') { const cons = 'bcdfghjklmnpqrstvwxyz'; let u = cons[Math.floor(Math.random() * cons.length)]; for (let i = 1; i < extLength; i++) u += allChars[Math.floor(Math.random() * allChars.length)]; return u } let u = chars[Math.floor(Math.random() * 26)]; for (let i = 1; i < extLength; i++) u += allChars[Math.floor(Math.random() * allChars.length)]; return u }; const list = extPattern === 'manual' ? extUsernames.split('\n').map(u => u.trim()).filter(Boolean) : Array.from({ length: extCount }, () => gen()); if (list.length === 0) { setResult('❌ أدخل يوزر واحد على الأقل'); return }; await api('external-checker', { usernames: list }) }} />
                {sniperStats && (<div className="mt-4 grid grid-cols-4 gap-2 animate-fade-in"><div className="bg-green-500/8 rounded-xl p-2.5 border border-green-500/10 text-center"><div className="text-lg font-black text-green-400">{sniperStats.available}</div><div className="text-[9px] text-green-300/60">✅ متاح</div></div><div className="bg-red-500/8 rounded-xl p-2.5 border border-red-500/10 text-center"><div className="text-lg font-black text-red-400">{sniperStats.taken}</div><div className="text-[9px] text-red-300/60">❌ محجوز</div></div><div className="bg-yellow-500/8 rounded-xl p-2.5 border border-yellow-500/10 text-center"><div className="text-lg font-black text-yellow-400">{sniperStats.errors}</div><div className="text-[9px] text-yellow-300/60">⚠️ غير معروف</div></div><div className="bg-blue-500/8 rounded-xl p-2.5 border border-blue-500/10 text-center"><div className="text-lg font-black text-blue-400">{sniperStats.total}</div><div className="text-[9px] text-blue-300/60">📋 المجموع</div></div></div>)}
                {availableNames.length > 0 && (<div className="mt-4 bg-green-500/8 rounded-xl p-4 border border-green-500/20 animate-fade-in"><div className="flex items-center justify-between mb-2"><h3 className="font-bold text-green-400 text-sm">🏆 اليوزرات المتاحة! ({availableNames.length})</h3><button onClick={() => { navigator.clipboard.writeText(availableNames.join('\n')); setResult('📋 تم النسخ!') }} className="text-[10px] text-green-300 bg-green-500/15 px-2.5 py-1 rounded-lg border border-green-500/20 hover:bg-green-500/25 cursor-pointer transition-colors">📋 نسخ الكل</button></div><div className="flex flex-wrap gap-1.5">{availableNames.map((name, i) => (<button key={i} onClick={() => { navigator.clipboard.writeText(name); setResult(`📋 تم نسخ: ${name}`) }} className="text-xs font-mono text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-lg border border-green-500/20 hover:bg-green-500/20 cursor-pointer transition-colors">{name} 📋</button>))}</div></div>)}
                {sniperResults.length > 0 && (<div className="mt-4 bg-black/30 rounded-2xl p-4 border border-blue-500/15 animate-fade-in"><div className="flex items-center justify-between mb-3"><h3 className="font-bold text-blue-400 text-sm">📊 النتائج ({sniperResults.length})</h3><button onClick={() => { const text = sniperResults.map(r => `${r.username} | ${r.status}${r.method ? ' [' + r.method + ']' : ''}`).join('\n'); navigator.clipboard.writeText(text); setResult('📋 تم النسخ!') }} className="text-[10px] text-white/50 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors">📋 نسخ الكل</button></div><div className="space-y-1 max-h-72 overflow-auto">{sniperResults.map((r, i) => (<div key={i} className={`px-3 py-2 rounded-lg text-xs font-mono ${r.color === 'green' ? 'bg-green-500/15 text-green-400 border border-green-500/20' : r.color === 'red' ? 'bg-red-500/8 text-red-400/70 border border-red-500/10' : 'bg-yellow-500/8 text-yellow-400/70 border border-yellow-500/10'}`}><div className="flex justify-between items-center"><span className="cursor-pointer hover:underline" onClick={() => { navigator.clipboard.writeText(r.username); setResult(`📋 ${r.username}`) }}>{r.username}</span><span className="font-medium">{r.status}</span></div>{r.method && <div className="text-[9px] opacity-50 mt-0.5">method: {r.method}</div>}</div>))}</div></div>)}
              </div></div>
            )}

            {/* ==================== MULTI-SPAM ==================== */}
            {section === 'multi-spam' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border-2 border-orange-500/30 shadow-xl shadow-orange-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🔥</span><h2 className="text-xl font-black text-orange-400">سبام بأكثر من توكن</h2></div>
                <p className="text-orange-500/60 text-sm mb-5">⚡ أقوى سبام - عدة توكنات ترسل بالتوازي! حتى 15 رسالة في نفس الوقت</p>
                <div className="mb-4"><label className="text-[11px] text-orange-300/70 mb-1 block">🎫 التوكنات (كل توكن سطر - أكثر توكن = أسرع)</label><textarea value={multiSpamTokens} onChange={e => setMultiSpamTokens(e.target.value)} placeholder={"توكن 1\nتوكن 2\nتوكن 3"} rows={4} className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-orange-700/30 focus:outline-none focus:border-orange-400/50 resize-none font-mono transition-colors" /></div>
                <TextInput label="📺 أيدي الروم" value={msChannelId} onChange={setMsChannelId} placeholder="Channel ID" accent="orange" />
                <div className="mb-4"><label className="text-[11px] text-orange-300/70 mb-1 block">📝 الرسائل (كل سطر يرسل لوحده)</label><textarea value={msMessages} onChange={e => setMsMessages(e.target.value)} placeholder={"رسالة 1\nرسالة 2"} rows={3} className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-orange-700/30 focus:outline-none focus:border-orange-400/50 resize-none transition-colors" /></div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div><label className="text-[11px] text-orange-300/70 mb-1 block">⏱️ المدة (ثانية)</label><input type="number" value={msDuration} onChange={e => setMsDuration(Number(e.target.value))} className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                  <div><label className="text-[11px] text-orange-300/70 mb-1 block">🚀 السرعة (ثانية)</label><input type="number" value={msSpeed} onChange={e => setMsSpeed(Number(e.target.value))} step="0.1" className="w-full bg-black/30 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                </div>
                <div className="bg-orange-500/5 rounded-xl p-3 mb-5 border border-orange-500/10"><p className="text-[11px] text-orange-500/70 leading-relaxed">⚡ التزامن = توكنات × 2 (أقصى 15)<br />🔄 التوكنات تتناوب بالتساوي</p></div>
                <ActionBtn text="🔥 بدء السبام المتعدد" loading={loading} color="orange" onClick={() => { const tokenList = multiSpamTokens.split('\n').map(t => t.trim()).filter(t => t.length >= 20); if (tokenList.length === 0) { setResult('❌ أدخل توكن واحد على الأقل'); return }; const msgList = msMessages.split('\n').map(m => m.trim()).filter(Boolean); if (msgList.length === 0) { setResult('❌ أدخل رسالة'); return }; api('multi-spam', { tokens: tokenList, channelId: msChannelId, messages: msgList, duration: msDuration, speed: msSpeed }) }} />
              </div></div>
            )}

            {/* ==================== MASS DM ==================== */}
            {section === 'mass-dm' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-purple-500/20 shadow-xl shadow-purple-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">📧</span><h2 className="text-xl font-black text-purple-400">DM جماعي</h2></div>
                <p className="text-purple-500/60 text-sm mb-5">إرسال رسالة خاصة لكل أعضاء سيرفر - 10 بالتوازي</p>
                <TokenInput label="🎫 التوكن" value={massDmToken} onChange={setMassDmToken} accent="purple" />
                <TextInput label="🏰 أيدي السيرفر" value={dmGuildId} onChange={setDmGuildId} placeholder="Guild ID" accent="purple" />
                <div className="mb-4"><label className="text-[11px] text-purple-300/70 mb-1 block">💬 رسالة DM</label><textarea value={dmMessage} onChange={e => setDmMessage(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={3} className="w-full bg-black/30 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-purple-700/30 focus:outline-none focus:border-purple-400/50 resize-none transition-colors" /></div>
                <div className="mb-5"><label className="text-[11px] text-purple-300/70 mb-1 block">👥 الحد الأقصى للأعضاء</label><input type="number" value={dmMaxMembers} onChange={e => setDmMaxMembers(Number(e.target.value))} className="w-full bg-black/30 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-400/50 transition-colors" /></div>
                <ActionBtn text="📧 بدء الإرسال الجماعي" loading={loading} color="purple" onClick={() => { if (!dmMessage) { setResult('❌ أدخل الرسالة'); return }; api('mass-dm', { token: massDmToken, guildId: dmGuildId, message: dmMessage, maxMembers: dmMaxMembers }) }} />
              </div></div>
            )}

            {/* ==================== LEAVER ==================== */}
            {section === 'leaver' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-red-500/20 shadow-xl shadow-red-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🚪</span><h2 className="text-xl font-black text-red-400">مغادرة السيرفرات</h2></div>
                <p className="text-red-500/60 text-sm mb-5">مغادرة كل السيرفرات بضغطة واحدة - السيرفرات المملوكة تُتجنّب</p>
                <TokenInput label="🎫 التوكن" value={leaverToken} onChange={setLeaverToken} accent="red" />
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  <ActionBtn text="🚪 مغادرة الكل" loading={loading} color="red" onClick={() => api('leaver', { token: leaverToken, action: 'leave_all' })} />
                  <ActionBtn text="📋 عرض السيرفرات" loading={loading} onClick={async () => { if (!leaverToken) { setResult('❌ أدخل التوكن'); return }; setLoading(true); setProgress('🔍 جلب السيرفرات...'); try { const res = await fetch('/api/leaver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: leaverToken, action: 'list' }) }); const data = await res.json(); if (data.success) { setGuildList(data.guilds); setResult(`📋 لديك ${data.total} سيرفر`) } else { setResult(`❌ ${data.error}`) } } catch { setResult('❌ خطأ') }; setLoading(false); setProgress('') }} />
                </div>
                {guildList.length > 0 && (<div className="mt-4 bg-black/30 rounded-2xl p-4 border border-red-500/15 animate-fade-in">
                  <h3 className="font-bold text-red-400 text-sm mb-3">🏰 السيرفرات ({guildList.length})</h3>
                  <div className="space-y-1 max-h-96 overflow-auto">{guildList.map((g, i) => (<div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg text-xs bg-black/20 border border-white/5"><div><span className="text-white/80 font-medium">{g.name}</span>{g.owner && <span className="text-yellow-400 ml-2">👑 مالك</span>}</div><span className="text-white/40">{g.members || '?'} عضو</span></div>))}</div>
                </div>)}
              </div></div>
            )}

            {/* ==================== MASS REACT ==================== */}
            {section === 'react' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-yellow-500/20 shadow-xl shadow-yellow-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🎭</span><h2 className="text-xl font-black text-yellow-400">رياكشن جماعي</h2></div>
                <p className="text-yellow-500/60 text-sm mb-5">{reactMode === 'auto' ? '🔄 رياكشن تلقائي لكل رسالة جديدة' : 'وضع رياكشنات على رسائل - عدة إيموجيات بالتوازي'}</p>
                <TokenInput label="🎫 التوكن" value={reactToken} onChange={setReactToken} accent="yellow" />
                <TextInput label="📺 أيدي الروم" value={reactChannelId} onChange={setReactChannelId} placeholder="Channel ID" accent="yellow" />
                <div className="flex gap-2 mb-4">{['manual', 'auto'].map(mode => (<button key={mode} onClick={() => setReactMode(mode as any)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${reactMode === mode ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-black/20 text-yellow-600 hover:text-yellow-400 border border-transparent'}`}>{mode === 'auto' ? '🔄 تلقائي' : '✏️ يدوي'}</button>))}</div>
                <div className="mb-4"><label className="text-[11px] text-yellow-300/70 mb-1 block">🎭 الإيموجيات (مسافة بين كل واحد)</label><input type="text" value={reactEmoji} onChange={e => setReactEmoji(e.target.value)} placeholder="👍 ❤️ 🔥 🎉" className="w-full bg-black/30 border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-yellow-700/30 focus:outline-none focus:border-yellow-400/50 transition-colors" /></div>
                {reactMode === 'manual' ? (
                  <TextInput label="📩 أيدي رسالة محددة (اختياري)" value={reactMessageId} onChange={setReactMessageId} placeholder="Message ID (اتركه فاضي للرسائل الأخيرة)" accent="yellow" />
                ) : (
                  <div className="mb-4"><label className="text-[11px] text-yellow-300/70 mb-1 block">⏱️ المدة (ثانية)</label><input type="number" value={reactDuration} onChange={e => setReactDuration(Number(e.target.value))} className="w-full bg-black/30 border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-400/50 transition-colors" /></div>
                )}
                <ActionBtn text={reactMode === 'auto' ? '🔄 بدء الرايكشن التلقائي' : '🎭 وضع رياكشنات'} loading={loading} color="yellow" onClick={() => { if (!reactEmoji) { setResult('❌ أدخل إيموجي واحد على الأقل'); return }; api('mass-react', { token: reactToken, channelId: reactChannelId, emoji: reactEmoji, messageId: reactMessageId || undefined, mode: reactMode, duration: reactMode === 'auto' ? reactDuration : undefined }) }} />
              </div></div>
            )}

            {/* ==================== TOKEN CHECKER ==================== */}
            {section === 'checker' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-cyan-500/20 shadow-xl shadow-cyan-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🔍</span><h2 className="text-xl font-black text-cyan-400">فحص توكنات متعددة</h2></div>
                <p className="text-cyan-500/60 text-sm mb-5">فحص مجموعة توكنات بالتوازي - 10 دفعات</p>
                <div className="mb-4"><label className="text-[11px] text-cyan-300/70 mb-1 block">🎫 التوكنات (كل توكن سطر)</label><textarea value={checkerTokens} onChange={e => setCheckerTokens(e.target.value)} placeholder={"توكن 1\nتوكن 2\nتوكن 3"} rows={6} className="w-full bg-black/30 border border-cyan-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-cyan-700/30 focus:outline-none focus:border-cyan-400/50 resize-none font-mono transition-colors" /></div>
                <ActionBtn text="🔍 فحص التوكنات" loading={loading} color="cyan" onClick={async () => { const list = checkerTokens.split('\n').map(t => t.trim()).filter(t => t.length >= 20); if (list.length === 0) { setResult('❌ أدخل توكن'); return }; await api('token-checker', { tokens: list }) }} />
                {checkerStats && (<div className="mt-5 grid grid-cols-3 gap-2 animate-fade-in"><div className="bg-green-500/8 rounded-xl p-3 border border-green-500/10 text-center"><div className="text-xl font-black text-green-400">{checkerStats.valid}</div><div className="text-[10px] text-green-300/60">صالح ✅</div></div><div className="bg-red-500/8 rounded-xl p-3 border border-red-500/10 text-center"><div className="text-xl font-black text-red-400">{checkerStats.invalid}</div><div className="text-[10px] text-red-300/60">غير صالح ❌</div></div><div className="bg-cyan-500/8 rounded-xl p-3 border border-cyan-500/10 text-center"><div className="text-xl font-black text-cyan-400">{checkerStats.nitro}</div><div className="text-[10px] text-cyan-300/60">نيترو 💎</div></div></div>)}
                {checkerResults.length > 0 && (<div className="mt-4 bg-black/30 rounded-2xl p-4 border border-cyan-500/15 animate-fade-in"><h3 className="font-bold text-cyan-400 text-sm mb-3 text-center">📋 نتائج الفحص ({checkerResults.length})</h3><div className="space-y-2 max-h-96 overflow-auto">{checkerResults.map((r, i) => (<div key={i} className={`rounded-xl p-3 border ${r.valid ? 'bg-green-500/8 border-green-500/15' : 'bg-red-500/8 border-red-500/10'}`}><div className="flex justify-between items-center mb-1"><span className={`font-mono text-xs ${r.valid ? 'text-green-400' : 'text-red-400'}`}>{r.token}</span><span className="text-xs">{r.valid ? <span className={r.type === 'bot' ? 'text-blue-400' : 'text-purple-400'}>{r.type === 'bot' ? '🤖 بوت' : '👤 يوزر'}</span> : <span className="text-red-400">❌ {r.error || 'غير صالح'}</span>}</span></div>{r.valid && (<div className="grid grid-cols-2 gap-1 text-[10px]"><span className="text-cyan-300/70">👤 {r.name}</span><span className="text-cyan-300/70">🆔 {r.id}</span>{r.nitro && <span className="text-cyan-300/70">{r.nitro}</span>}{r.email && <span className="text-cyan-300/70">{r.email}</span>}{r.mfa && <span className="text-cyan-300/70">{r.mfa}</span>}{r.createdAt && r.createdAt !== 'N/A' && <span className="text-cyan-300/70">📅 {r.createdAt}</span>}</div>)}</div>))}</div></div>)}
              </div></div>
            )}

            {/* ==================== WEBHOOK SPAM ==================== */}
            {section === 'webhook-spam' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-pink-500/20 shadow-xl shadow-pink-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🔗</span><h2 className="text-xl font-black text-pink-400">ويب هوك سبام</h2></div>
                <p className="text-pink-500/60 text-sm mb-5">إرسال رسائل عبر ويب هوك Discord بسرعة عالية - 10 رسائل بالتوازي</p>
                <TokenInput label="🎫 التوكن (للتسجيل)" value={whSpamToken} onChange={setWhSpamToken} accent="pink" />
                <div className="mb-4"><label className="text-[11px] text-pink-300/70 mb-1 block">🔗 رابط الويب هوك</label><input type="text" value={whSpamUrl} onChange={e => setWhSpamUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 transition-colors font-mono" /></div>
                <div className="mb-4"><label className="text-[11px] text-pink-300/70 mb-1 block">💬 محتوى الرسالة</label><textarea value={whSpamMessage} onChange={e => setWhSpamMessage(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={3} className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 resize-none transition-colors" /></div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="text-[11px] text-pink-300/70 mb-1 block">🔢 العدد</label><input type="number" value={whSpamCount} onChange={e => setWhSpamCount(Number(e.target.value))} className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-400/50 transition-colors" /></div>
                  <div><label className="text-[11px] text-pink-300/70 mb-1 block">👤 اسم المرسل (اختياري)</label><input type="text" value={whSpamUsername} onChange={e => setWhSpamUsername(e.target.value)} placeholder="TRJ BOT" className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 transition-colors" /></div>
                </div>
                <ActionBtn text="🔗 بدء السبام" loading={loading} color="pink" onClick={() => { if (!whSpamUrl || !whSpamUrl.includes('discord.com/api/webhooks')) { setResult('❌ أدخل رابط ويب هوك صالح'); return }; if (!whSpamMessage) { setResult('❌ أدخل الرسالة'); return }; api('webhook-spam', { token: whSpamToken, webhookUrl: whSpamUrl, message: whSpamMessage, count: whSpamCount, username: whSpamUsername || undefined }) }} />
              </div></div>
            )}

            {/* ===== RESULT ===== */}
            {result && (<div className={`mt-4 p-4 rounded-2xl text-center text-sm font-medium border animate-fade-in ${result.startsWith('✅') ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{result}</div>)}

            {/* ===== STATS ===== */}
            {stats && (<div className="mt-4 glass-card rounded-2xl p-4 border border-green-500/15 animate-fade-in"><div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              {stats.deleted !== undefined && stats.deleted > 0 && (<div className="bg-red-500/8 rounded-xl p-3 border border-red-500/10"><div className="text-2xl font-black text-red-400 stat-number">{stats.deleted}</div><div className="text-[10px] text-red-300/60">محذوف</div></div>)}
              {stats.created !== undefined && stats.created > 0 && (<div className="bg-green-500/8 rounded-xl p-3 border border-green-500/10"><div className="text-2xl font-black text-green-400 stat-number">{stats.created}</div><div className="text-[10px] text-green-300/60">منشأ</div></div>)}
              {stats.spam_sent !== undefined && stats.spam_sent > 0 && (<div className="bg-orange-500/8 rounded-xl p-3 border border-orange-500/10"><div className="text-2xl font-black text-orange-400 stat-number">{stats.spam_sent}</div><div className="text-[10px] text-orange-300/60">سبام</div></div>)}
              {stats.banned !== undefined && stats.banned > 0 && (<div className="bg-red-500/8 rounded-xl p-3 border border-red-500/10"><div className="text-2xl font-black text-red-500 stat-number">{stats.banned}</div><div className="text-[10px] text-red-400/60">محظور</div></div>)}
              {stats.roles !== undefined && stats.roles > 0 && (<div className="bg-purple-500/8 rounded-xl p-3 border border-purple-500/10"><div className="text-2xl font-black text-purple-400 stat-number">{stats.roles}</div><div className="text-[10px] text-purple-300/60">رتب</div></div>)}
              {stats.sent !== undefined && stats.sent > 0 && (<div className="bg-green-500/8 rounded-xl p-3 border border-green-500/10"><div className="text-2xl font-black text-green-400 stat-number">{stats.sent}</div><div className="text-[10px] text-green-300/60">مرسلة</div></div>)}
              {stats.failed !== undefined && stats.failed > 0 && (<div className="bg-red-500/8 rounded-xl p-3 border border-red-500/10"><div className="text-2xl font-black text-red-400 stat-number">{stats.failed}</div><div className="text-[10px] text-red-300/60">فشل</div></div>)}
              {stats.blocked !== undefined && stats.blocked > 0 && (<div className="bg-yellow-500/8 rounded-xl p-3 border border-yellow-500/10"><div className="text-2xl font-black text-yellow-400 stat-number">{stats.blocked}</div><div className="text-[10px] text-yellow-300/60">محظور DM</div></div>)}
              {stats.left !== undefined && stats.left > 0 && (<div className="bg-orange-500/8 rounded-xl p-3 border border-orange-500/10"><div className="text-2xl font-black text-orange-400 stat-number">{stats.left}</div><div className="text-[10px] text-orange-300/60">مغادرة</div></div>)}
              {stats.txt !== undefined && stats.txt > 0 && (<div className="bg-blue-500/8 rounded-xl p-3 border border-blue-500/10"><div className="text-2xl font-black text-blue-400 stat-number">{stats.txt}</div><div className="text-[10px] text-blue-300/60">روم كتابي</div></div>)}
              {stats.voice !== undefined && stats.voice > 0 && (<div className="bg-green-500/8 rounded-xl p-3 border border-green-500/10"><div className="text-2xl font-black text-green-400 stat-number">{stats.voice}</div><div className="text-[10px] text-green-300/60">روم صوتي</div></div>)}
              {stats.cats !== undefined && stats.cats > 0 && (<div className="bg-indigo-500/8 rounded-xl p-3 border border-indigo-500/10"><div className="text-2xl font-black text-indigo-400 stat-number">{stats.cats}</div><div className="text-[10px] text-indigo-300/60">كاتيجوري</div></div>)}
              {stats.emojis !== undefined && stats.emojis > 0 && (<div className="bg-pink-500/8 rounded-xl p-3 border border-pink-500/10"><div className="text-2xl font-black text-pink-400 stat-number">{stats.emojis}</div><div className="text-[10px] text-pink-300/60">إيموجي</div></div>)}
              {stats.permissions !== undefined && stats.permissions > 0 && (<div className="bg-cyan-500/8 rounded-xl p-3 border border-cyan-500/10"><div className="text-2xl font-black text-cyan-400 stat-number">{stats.permissions}</div><div className="text-[10px] text-cyan-300/60">صلاحية</div></div>)}
            </div></div>)}

          </div>
        </main>
      </div>
    </div>
  )
}

/* ==================== UI COMPONENTS ==================== */

function TokenInput({ label, value, onChange, accent = 'green' }: { label: string; value: string; onChange: (v: string) => void; accent?: string }) {
  const colors: Record<string, string> = { green: 'border-green-500/30 focus:border-green-400/50', red: 'border-red-500/30 focus:border-red-400/50', orange: 'border-orange-500/30 focus:border-orange-400/50', purple: 'border-purple-500/30 focus:border-purple-400/50', yellow: 'border-yellow-500/30 focus:border-yellow-400/50', cyan: 'border-cyan-500/30 focus:border-cyan-400/50', pink: 'border-pink-500/30 focus:border-pink-400/50' }
  return (<div className="mb-4"><label className="text-[11px] text-white/50 mb-1 block">{label}</label><div className="relative"><input type="password" value={value} onChange={e => onChange(e.target.value)} placeholder="••••••••" className={`w-full bg-black/30 border ${colors[accent] || colors.green} rounded-xl px-4 py-3 text-white text-sm pr-16 placeholder-white/20 focus:outline-none transition-colors`} /><button onClick={() => { navigator.clipboard.writeText(value).catch(() => { const inp = document.createElement('input'); inp.value = value; document.body.appendChild(inp); inp.select(); document.execCommand('copy'); document.body.removeChild(inp); }); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-white/40 bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-white/10">📋</button></div></div>)
}

function TextInput({ label, value, onChange, placeholder, accent = 'green' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; accent?: string }) {
  const colors: Record<string, string> = { green: 'border-green-500/30 focus:border-green-400/50', red: 'border-red-500/30 focus:border-red-400/50', orange: 'border-orange-500/30 focus:border-orange-400/50', purple: 'border-purple-500/30 focus:border-purple-400/50', yellow: 'border-yellow-500/30 focus:border-yellow-400/50', pink: 'border-pink-500/30 focus:border-pink-400/50' }
  return (<div className="mb-4"><label className="text-[11px] text-white/50 mb-1 block">{label}</label><input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full bg-black/30 border ${colors[accent] || colors.green} rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition-colors`} /></div>)
}

function ActionBtn({ text, loading, onClick, color = 'green' }: { text: string; loading: boolean; onClick: () => void; color?: string }) {
  const colors: Record<string, string> = { green: 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30', red: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30', orange: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30', purple: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30', yellow: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30', cyan: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30', pink: 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-pink-500/30' }
  return (<button onClick={onClick} disabled={loading} className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer border ${colors[color] || colors.green} ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}>{loading ? '⏳ جاري...' : text}</button>)
}

function NukerBtn({ text, color, loading, onClick }: { text: string; color: string; loading: boolean; onClick: () => void }) {
  const colors: Record<string, string> = { red: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30', gray: 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10', orange: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30' }
  return (<button onClick={onClick} disabled={loading} className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${colors[color] || colors.gray} ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}>{loading ? '⏳' : text}</button>)
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (<div className="bg-black/20 rounded-xl px-3 py-2 border border-white/5 text-center"><div className="text-[10px] text-white/40">{label}</div><div className="text-xs text-green-300 font-medium mt-0.5">{value}</div></div>)
}
