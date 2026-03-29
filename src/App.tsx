import { Game } from './components/Game';
import { GADGET_DEFS } from './components/ParkourLevel';
import { useGameStore } from './store';
import { useAuthStore } from './store/auth';
import { useMultiplayerStore } from './store/multiplayer';
import { useI18nStore } from './store/i18n';
import { memo, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { uiRefs } from './utils/ui-refs';
import { ghettoDamageFlashRef, ghettoNearStationRef } from './utils/ghetto-refs';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Trophy, Play, User, LogOut, Loader2, LogIn, UserPlus, AlertCircle, Users, Copy, ArrowLeft, Coins, Star, X, RotateCcw, Volume2, VolumeX, TrendingUp } from 'lucide-react';
import { useProfileStore } from './store/profile';
import { supabase } from './lib/supabase';
import { UserProfile } from './components/UserProfile';
import { Leaderboard } from './components/Leaderboard';
import { Shop } from './components/Shop';
import { audio } from './utils/audio';
import { ErrorBoundary } from './components/ErrorBoundary';

/* ─── Palette: 3 colori — giallo, bianco, rosso(solo danger) ─── */
const C = {
  bg: '#070b14',
  panel: '#0d1828',
  yellow: '#ffee00',
  white: '#ffffff',
  dim: 'rgba(255,255,255,0.45)',
  danger: '#ff3366',
};

const PIXEL = { fontFamily: "'Press Start 2P', monospace" } as const;

/* Panel styles */
const PANEL = { background: 'rgba(5,9,18,0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid rgba(255,238,0,0.30)`, boxShadow: `0 0 0 1px rgba(255,238,0,0.06), 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)`, borderRadius: '8px' } as const;
const PANEL_DANGER = { ...PANEL, border: `1px solid rgba(255,51,102,0.40)`, boxShadow: `0 0 0 1px rgba(255,51,102,0.08), 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)` } as const;

/* Button styles — HUD/in-game (pixel) */
const BTN_Y = { background: C.yellow, color: C.bg, border: `2px solid ${C.bg}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.6)`, borderRadius: '3px', ...PIXEL, fontSize: '10px', cursor: 'pointer' } as const;
const BTN_W = { background: 'transparent', color: C.white, border: `2px solid ${C.white}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.4)`, borderRadius: '3px', ...PIXEL, fontSize: '10px', cursor: 'pointer' } as const;
const BTN_R = { background: C.danger, color: C.white, border: `2px solid ${C.bg}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.6)`, borderRadius: '3px', ...PIXEL, fontSize: '10px', cursor: 'pointer' } as const;

/* Menu button styles — pixel */
const MF = { fontFamily: "'Press Start 2P', monospace" } as const;
const MBTN_P = { ...MF, fontSize: '11px', background: C.yellow, color: C.bg, border: `3px solid ${C.bg}`, boxShadow: `4px 4px 0 rgba(0,0,0,0.8)`, borderRadius: '3px', cursor: 'pointer' } as const;
const MBTN_S = { ...MF, fontSize: '9px', background: 'transparent', color: C.white, border: `2px solid ${C.white}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.5)`, borderRadius: '3px', cursor: 'pointer' } as const;
const MBTN_D = { ...MF, fontSize: '9px', background: 'transparent', color: C.danger, border: `2px solid ${C.danger}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.5)`, borderRadius: '3px', cursor: 'pointer' } as const;

/* Neon text shadows */
const GLOW_Y = { color: C.yellow, textShadow: `0 0 10px ${C.yellow}, 2px 2px 0 #000` } as const;
const GLOW_W = { color: C.white, textShadow: `0 0 6px rgba(255,255,255,0.6), 1px 1px 0 #000` } as const;
const GLOW_R = { color: C.danger, textShadow: `0 0 12px ${C.danger}, 2px 2px 0 #000` } as const;

/* ─── Center Timer Bar — fixed top-center, prominent, segmented ─── */
const CenterTimerBar = memo(() => {
  const barRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    uiRefs.timerBar = barRef.current;
    uiRefs.timerText = textRef.current;
    return () => { uiRefs.timerBar = null; uiRefs.timerText = null; };
  }, []);
  // 8 segment tick marks at 12.5% intervals
  const ticks = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div style={{
      position: 'fixed', top: '130px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9995, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
      minWidth: '340px',
    }}>
      {/* Time label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div ref={textRef} style={{
          ...PIXEL, fontSize: '16px', color: C.yellow,
          textShadow: `0 0 16px ${C.yellow}, 0 0 32px rgba(255,238,0,0.4), 2px 2px 0 #000`,
          minWidth: '80px', textAlign: 'center',
        }}>--</div>
      </div>
      {/* Bar track */}
      <div style={{
        position: 'relative', width: '340px', height: '16px',
        background: 'rgba(0,0,0,0.65)',
        border: '1px solid rgba(255,238,0,0.25)',
        borderRadius: '3px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Fill */}
        <div ref={barRef} style={{
          position: 'absolute', inset: 0, width: '100%',
          backgroundColor: C.yellow,
          boxShadow: `0 0 8px rgba(255,238,0,0.7), 0 0 16px rgba(255,238,0,0.3)`,
          transition: 'background-color 0.4s',
          transformOrigin: 'left',
        }} />
        {/* Shine overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />
        {/* Tick marks */}
        {ticks.map(i => (
          <div key={i} style={{
            position: 'absolute', top: 0, bottom: 0, width: '1px',
            left: `${(i / 8) * 100}%`,
            background: 'rgba(0,0,0,0.45)',
          }} />
        ))}
        {/* Quarter notches (bigger) */}
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            position: 'absolute', top: 0, width: '2px', height: '100%',
            left: `${(i / 4) * 100}%`,
            background: 'rgba(0,0,0,0.6)',
          }} />
        ))}
      </div>

    </div>
  );
});

/* ─── CoinHero — supremely premium coin display for parkour right card ─── */
const CoinHero = memo(({ coins, pulse, coinRef }: {
  coins: number;
  pulse: number;
  coinRef: React.RefObject<HTMLDivElement | null>;
}) => {
  // Track previous coin count to show "+1" floaters
  const prevCoins = useRef(coins);
  const [floaters, setFloaters] = useState<number[]>([]);
  const floaterId = useRef(0);

  useEffect(() => {
    if (coins > prevCoins.current) {
      const id = ++floaterId.current;
      setFloaters(f => [...f, id]);
      setTimeout(() => setFloaters(f => f.filter(x => x !== id)), 700);
    }
    prevCoins.current = coins;
  }, [coins]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', position: 'relative' }}>
      {/* Outer glow panel */}
      <div style={{
        padding: '14px 20px 12px',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,200,0,0.18) 0%, rgba(5,9,18,0.92) 70%)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,200,0,0.45)',
        borderRadius: '16px',
        boxShadow: '0 0 0 1px rgba(255,200,0,0.10), 0 0 32px rgba(255,180,0,0.20), 0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Top shimmer line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(255,220,0,0.7), transparent)',
        }} />

        {/* Coin disc */}
        <motion.div
          key={`coin-${pulse}`}
          animate={pulse > 0 ? { scale: [1, 1.35, 1], rotate: [0, -8, 8, 0] } : {}}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ position: 'relative', width: '64px', height: '64px' }}
        >
          {/* Idle bob wrapper */}
          <div style={{ animation: 'coinBob 3s ease-in-out infinite', width: '100%', height: '100%' }}>
            {/* Coin body */}
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #fff7a0 0%, #ffd700 30%, #e6a000 65%, #b87800 100%)',
              boxShadow: '0 0 0 3px #b87800, 0 0 20px rgba(255,200,0,0.6), 0 0 50px rgba(255,160,0,0.25), inset 0 2px 4px rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {/* Shine sweep */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, width: '30%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)',
                animation: 'coinShine 2.4s ease-in-out infinite',
              }} />
              {/* Inner ring */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                border: '2px solid rgba(180,120,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {/* PB symbol */}
                <span style={{
                  fontFamily: "'Press Start 2P', monospace",
                  fontSize: '13px', color: '#7a4a00',
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  userSelect: 'none',
                }}>PB</span>
              </div>
            </div>
          </div>

          {/* Pulse ring — appears on collect */}
          {pulse > 0 && (
            <div key={pulse} style={{
              position: 'absolute', inset: '-4px',
              borderRadius: '50%',
              border: '3px solid rgba(255,220,0,0.9)',
              animation: 'coinRing 0.5s ease-out forwards',
              pointerEvents: 'none',
            }} />
          )}

          {/* +1 floaters */}
          {floaters.map(id => (
            <div key={id} style={{
              position: 'absolute', top: '-8px', left: '50%',
              transform: 'translateX(-50%)',
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '11px', color: '#ffe040',
              textShadow: '0 0 8px #ffd700, 2px 2px 0 #000',
              animation: 'coinPlus 0.7s ease-out forwards',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>+1</div>
          ))}
        </motion.div>

        {/* Coin count */}
        <motion.div
          ref={coinRef}
          key={`count-${pulse}`}
          animate={pulse > 0 ? { scale: [1, 1.25, 1] } : {}}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '22px',
            color: '#ffe040',
            textShadow: '0 0 16px #ffd700, 0 0 32px rgba(255,180,0,0.5), 2px 2px 0 #000',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          {coins}
        </motion.div>

        {/* "PARTY BLOCKS" sublabel */}
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: '6px',
          color: 'rgba(255,200,0,0.45)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>PARTY BLOCKS</div>
      </div>
    </div>
  );
});

/* ─── Parkour Left HUD Card — level + stopwatch + PB + timer + gadgets ─── */
const ParkourLeftCard = memo(({ level, activeGadgets, dbRecords }: {
  level: number;
  activeGadgets: Array<{ type: string; timeLeft: number; }>;
  dbRecords?: Record<string, number> | null;
}) => {
  const swRef = useRef<HTMLDivElement>(null);
  const resolvePb = (lv: number, records?: Record<string, number> | null): number | null => {
    // DB record takes priority when it exists for this specific level
    const dbVal = records?.[String(lv)];
    if (dbVal !== undefined) return dbVal;
    // Fall back to localStorage (works for guests + levels not yet in DB)
    try { const v = localStorage.getItem(`pkPB_${lv}`); return v ? parseFloat(v) : null; } catch { return null; }
  };
  const [pb, setPb] = useState<number | null>(() => resolvePb(level, dbRecords));
  useEffect(() => {
    setPb(resolvePb(level, dbRecords));
  }, [level, dbRecords]);
  useEffect(() => {
    uiRefs.stopwatch = swRef.current;
    return () => { uiRefs.stopwatch = null; };
  }, []);
  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}:${(s % 60).toFixed(0).padStart(2, '0')}` : `${s.toFixed(1)}s`;
  };
  return (
    <div className="flex flex-col gap-3 p-4"
      style={{ background: 'rgba(5,9,18,0.80)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,238,0,0.20)', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)', minWidth: '220px' }}>
      {/* Level */}
      <div className="flex items-center gap-2">
        <Trophy size={14} color={C.yellow} />
        <span style={{ ...PIXEL, fontSize: '11px', color: C.yellow, textShadow: `0 0 10px ${C.yellow}, 2px 2px 0 #000` }}>LVL {level}/15</span>
      </div>
      {/* Stopwatch */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: '15px', lineHeight: 1 }}>⏱</span>
        <div ref={swRef} style={{ ...PIXEL, fontSize: '14px', color: C.white, textShadow: '0 0 10px rgba(255,255,255,0.6), 2px 2px 0 #000' }}>0.0s</div>
      </div>
      {/* PB row */}
      {pb !== null && (
        <div className="flex items-center gap-2">
          <span style={{ ...PIXEL, fontSize: '8px', color: 'rgba(255,238,0,0.50)' }}>BEST</span>
          <span style={{ ...PIXEL, fontSize: '10px', color: 'rgba(255,238,0,0.85)', textShadow: `0 0 8px rgba(255,238,0,0.4)` }}>{fmt(pb)}</span>
        </div>
      )}
      {/* Active gadgets */}
      {activeGadgets.map((g: any) => {
        const def = GADGET_DEFS[g.type as keyof typeof GADGET_DEFS];
        return (
          <motion.div key={g.type}
            initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
            className="flex items-center gap-2">
            <span style={{ fontSize: '16px', lineHeight: 1 }}>{def.emoji}</span>
            <div className="flex-1 flex flex-col gap-1">
              <span style={{ ...PIXEL, fontSize: '8px', color: def.color }}>{def.label}</span>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-2 overflow-hidden"
                  style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${def.color}44`, borderRadius: '2px' }}>
                  <motion.div style={{ height: '100%', background: def.color, originX: 0 }}
                    animate={{ scaleX: g.timeLeft / def.duration }} transition={{ duration: 0.1, ease: 'linear' }} />
                </div>
                <span style={{ ...PIXEL, fontSize: '8px', color: 'rgba(255,255,255,0.55)' }}>{Math.ceil(g.timeLeft)}s</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
});

/* ─── Pixel hero background — more blocks, brighter ─── */
const PIXEL_BLOCK_DATA = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  color: ['#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#80C000', '#009688', '#0070C0', '#002094', '#4B0082', '#C00070'][i % 10],
  size: [6, 8, 10, 14, 18, 24][i % 6],
  x: ((i * 53 + 11) % 98) + 1,
  y: ((i * 41 + 7) % 96) + 2,
  dur: 8 + (i % 7) * 2.0,
  delay: (i % 11) * 0.9,
  dx: (((i * 7) % 5) - 2) * 45,
  dy: (((i * 3) % 5) - 2) * 38,
}));

const PixelBg = memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {/* Scanlines */}
    <div className="absolute inset-0" style={{
      backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 3px)',
      opacity: 0.5,
    }} />
    {/* Pixel grid */}
    <div className="absolute inset-0" style={{
      backgroundImage: `linear-gradient(rgba(255,238,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,238,0,0.04) 1px, transparent 1px)`,
      backgroundSize: '32px 32px',
    }} />
    {/* CRT vignette */}
    <div className="absolute inset-0" style={{
      background: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(0,0,0,0.7) 100%)',
    }} />
    {/* Flying pixel blocks */}
    {PIXEL_BLOCK_DATA.map(b => (
      <motion.div key={b.id}
        className="absolute"
        style={{ width: b.size, height: b.size, background: b.color, left: `${b.x}%`, top: `${b.y}%`, imageRendering: 'pixelated', borderRadius: '1px' }}
        animate={{ x: [0, b.dx, 0], y: [0, b.dy, 0], opacity: [0.08, 0.35, 0.08] }}
        transition={{ duration: b.dur, repeat: Infinity, ease: 'easeInOut', delay: b.delay }}
      />
    ))}
  </div>
));

/* ─── Volume button ─── */
function VolumeButton() {
  const [muted, setMuted] = useState(false);
  const toggle = () => {
    const nowMuted = audio.toggleMute();
    setMuted(nowMuted);
  };
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={toggle}
      className="fixed bottom-6 right-6 z-[300] flex items-center justify-center w-12 h-12"
      style={{ ...BTN_Y, boxShadow: `3px 3px 0 rgba(0,0,0,0.7)` }}
      title={muted ? 'Attiva audio' : 'Disattiva audio'}
    >
      {muted
        ? <VolumeX size={20} color={C.bg} strokeWidth={2.5} />
        : <Volume2 size={20} color={C.bg} strokeWidth={2.5} />
      }
    </motion.button>
  );
}

/* ─── Hero Title: COLOR BLOCK PARTY — each letter a different game color ─── */
const HERO_ROWS = [
  { text: 'COLOR', colors: ['#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#80C000'] },
  { text: 'BLOCK', colors: ['#009688', '#0070C0', '#002094', '#4B0082', '#C00070'] },
  { text: 'PARTY', colors: ['#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#80C000'] },
];

const rowsPrecomputed = HERO_ROWS.map((row, ri) => ({
  ...row,
  letters: row.text.split('').map((char, ci) => ({
    char,
    color: row.colors[ci],
    globalIdx: HERO_ROWS.slice(0, ri).reduce((a, r) => a + r.text.length + 1, 0) + ci,
  })),
}));

function HeroTitle() {
  return (
    <div className="flex flex-col items-center select-none" style={{ gap: 'clamp(2px, 0.6vw, 10px)' }}>
      {rowsPrecomputed.map((row, ri) => (
        <div key={ri} className="flex">
          {row.letters.map(({ char, color, globalIdx }, ci) => {
            const delay = globalIdx * 0.05;
            return (
              <motion.span key={ci} style={{ display: 'inline-block' }}
                initial={{ y: -70, opacity: 0, scale: 0.5 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 360, damping: 22, delay }}>
                <motion.span
                  style={{
                    display: 'inline-block',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: 'clamp(20px, 5.2vw, 72px)',
                    color,
                    textShadow: `0 0 18px ${color}, 0 0 36px ${color}55, 3px 3px 0 rgba(0,0,0,0.95)`,
                    padding: '0 0.015em',
                    letterSpacing: '-0.01em',
                  }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: delay + 0.9 }}
                >
                  {char}
                </motion.span>
              </motion.span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─── Mode selection card ─── */
interface ModeCardProps {
  icon: string;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
  animDelay: number;
  badge?: string;
}
function ModeCard({ icon, title, desc, color, onClick, animDelay, badge }: ModeCardProps) {
  return (
    <motion.button
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: animDelay }}
      whileHover={{ scale: 1.07, y: -8, boxShadow: `6px 6px 0 rgba(0,0,0,0.9), 0 0 32px ${color}66` }}
      whileTap={{ scale: 0.96, y: 0 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2 relative overflow-hidden w-full"
      style={{
        maxWidth: 200,
        padding: 'clamp(12px, 2vw, 18px) clamp(10px, 1.8vw, 16px)',
        background: '#0d1828',
        border: `3px solid ${color}`,
        boxShadow: `5px 5px 0 rgba(0,0,0,0.85), 0 0 16px ${color}33`,
        borderRadius: '4px',
        cursor: 'pointer',
        animation: `modeFloat 3s ease-in-out ${animDelay + 1}s infinite`,
      }}>
      {/* Hover glow */}
      <motion.div className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}22, transparent 70%)` }} />
      {/* Badge */}
      {badge && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5"
          style={{ background: color, borderRadius: '2px', fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: '#000', boxShadow: `2px 2px 0 rgba(0,0,0,0.6)` }}>
          {badge}
        </div>
      )}
      <span style={{ fontSize: 'clamp(22px, 3.5vw, 36px)', lineHeight: 1 }}>{icon}</span>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(7px, 1.1vw, 10px)', color, textShadow: `0 0 8px ${color}88`, lineHeight: 1.4, textAlign: 'center' }}>{title}</div>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 'clamp(5px, 0.6vw, 6px)', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, textAlign: 'center' }}>{desc}</div>
    </motion.button>
  );
}

/* ─── Login Modal ─── */
interface GuestTeaserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  t: (key: string) => string;
}

function TeaserParticle({ p, smoothX, smoothY }: { p: any, smoothX: any, smoothY: any }) {
  const tx = useTransform(smoothX, (v: number) => v * p.factor);
  const ty = useTransform(smoothY, (v: number) => v * p.factor);

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${p.x}%`,
        top: `${p.y}%`,
        x: tx,
        y: ty,
      }}
    >
      <motion.div
        className="bg-yellow-300 rounded-sm"
        style={{
          width: p.size,
          height: p.size,
          boxShadow: `0 0 ${p.size * 3}px #fef08a, 0 0 ${p.size * 6}px #eab308`,
        }}
        animate={{
          translateY: [0, -40, 0],
          opacity: [0.1, 0.7, 0.1],
        }}
        transition={{
          translateY: { duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" },
          opacity: { duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }
        }}
      />
    </motion.div>
  );
}

function GuestTeaserModal({ isOpen, onClose, onOpenLogin, t }: GuestTeaserModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  
  // Motion values per performance e fluidità (evita re-render continui)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Spring per rendere il movimento "morbido" e non a scatti
  const springConfig = { damping: 25, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Generiamo le posizioni delle particelle una sola volta al montaggio
  const particles = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      size: 2 + Math.random() * 3,
      duration: 3 + Math.random() * 4,
      delay: Math.random() * 2,
      factor: 20 + Math.random() * 40 // Quanto reagisce al mouse
    }));
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 400);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseMove={handleMouseMove}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-[#0a1124]/90 backdrop-blur-xl overflow-hidden"
          style={{ perspective: 1200 }}
        >
          {/* Sfondo fluttuante con i blocchi (Simulato con gradienti neon) */}
          <div className="absolute inset-0 pointer-events-none opacity-40">
             <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-fuchsia-600/30 blur-[120px] rounded-full animate-pulse" />
             <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/30 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          {/* Particelle di luce interattive con Parallasse Spring */}
          <div className="absolute inset-0 pointer-events-none">
            {particles.map((p) => (
              <TeaserParticle key={p.id} p={p} smoothX={smoothX} smoothY={smoothY} />
            ))}
          </div>

          {/* Wrapper per l'oscillazione flottante del Pop-up */}
          <motion.div
            animate={{ y: [-10, 10, -10] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="w-full max-w-[500px] relative pointer-events-auto"
          >
            {/* Tasto di Chiusura Esterno con Micro-Esplosione */}
            <div className="absolute -top-6 -right-6 z-[210]">
              <AnimatePresence>
                {isClosing && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 1 }} animate={{ scale: 4, opacity: 0 }}
                    className="absolute inset-0 bg-red-400 rounded-full blur-sm"
                  />
                )}
              </AnimatePresence>
              <motion.button 
                whileHover={{ scale: 1.15, rotate: 20 }} whileTap={{ scale: 0.85 }}
                onClick={handleClose} 
                className="relative text-white p-3.5 rounded-full cursor-pointer shadow-[0_0_30px_rgba(225,29,72,0.4)] flex items-center justify-center overflow-hidden z-10"
                style={{ backgroundColor: '#f43f5e', border: '5px solid #fff', borderBottomWidth: '10px', borderBottomColor: '#be123c' }}
              >
                <X size={28} strokeWidth={6} style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.4))' }} />
              </motion.button>
            </div>

            {/* Il Pop-up Centrale Holographico */}
            <div 
              className="w-full p-6 sm:p-9 relative overflow-hidden flex flex-col items-center text-center rounded-[2.5rem] border-[6px] border-indigo-500/50 backdrop-blur-2xl"
              style={{ 
                backgroundColor: 'rgba(25, 15, 60, 0.85)', 
                boxShadow: '0 0 80px rgba(99,102,241,0.25), inset 0 0 40px rgba(99,102,241,0.1)' 
              }}
            >
              {/* Robotini negli angoli */}
              <motion.div animate={{ rotate: [-10, -18, -10], y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}
                className="absolute -bottom-6 -left-6 text-[6rem] opacity-[0.2] pointer-events-none grayscale brightness-150">🤖</motion.div>
              <motion.div animate={{ rotate: [10, 18, 10], y: [0, -5, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
                className="absolute -bottom-6 -right-6 text-[6rem] opacity-[0.2] pointer-events-none grayscale brightness-150 contrast-125" style={{ filter: 'hue-rotate(180deg) brightness(1.5)' }}>🤖</motion.div>

              <div className="relative z-10 flex flex-col items-center w-full">
                
                {/* Trofeo d'Oro Rotante */}
                <div className="relative mb-8 flex justify-center items-center">
                  <div className="absolute w-32 h-32 bg-yellow-500/30 blur-[40px] rounded-full animate-pulse" />
                  <motion.div 
                    animate={{ rotateY: 360 }} 
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                    className="relative"
                  >
                    <Trophy size={90} className="text-[#fef3c7] fill-yellow-400" strokeWidth={0.5} style={{ filter: 'drop-shadow(0 0 20px rgba(251,191,36,0.9))' }} />
                  </motion.div>
                  {/* Scintille Pixel */}
                  {[...Array(6)].map((_, i) => (
                    <motion.div key={i}
                      animate={{ y: [0, -100], x: [(i - 2.5) * 40, (i - 2.5) * 60], opacity: [0, 1, 0], scale: [0.5, 1.2, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.4, ease: 'easeOut' }}
                      className="absolute w-1.5 h-1.5 bg-white shadow-[0_0_10px_#fff]"
                    />
                  ))}
                </div>
                
                {/* Titolo Sfarfallante */}
                <motion.h2 
                    animate={{ opacity: [1, 0.9, 1], textShadow: ['0 0 10px #c084fc', '0 0 20px #c084fc', '0 0 10px #c084fc'] }}
                    transition={{ duration: 0.15, repeat: Infinity }}
                    className="text-[2rem] sm:text-[2.6rem] uppercase tracking-[0.2em] mb-8 leading-[1.2]"
                    style={{ 
                      ...PIXEL, 
                      color: '#fff', 
                      WebkitTextStroke: '1px #a855f7',
                    }}>
                  Sblocca il<br/><span className="text-yellow-300 text-[2.4rem] sm:text-[3rem]" style={{ WebkitTextStroke: '2px #b45309', textShadow: '0 0 20px #facc15, 0 6px 0 #78350f' }}>Vero Potere</span>
                </motion.h2>
                
                {/* Lista Vantaggi */}
                <div className="flex flex-col gap-3.5 mb-10 w-full max-w-sm px-2">
                  {[
                    { icon: <Trophy size={20} className="text-yellow-400 fill-yellow-400" />, text: "Appari nella", highlight: "LEADERBOARD", color: "text-yellow-400" },
                    { icon: <span className="text-2xl">🤖😉</span>, text: "Skin", highlight: "UNICHE", color: "text-emerald-400" },
                    { icon: <div className="w-5 h-5 bg-amber-400 rounded-full border border-amber-200 flex items-center justify-center font-black text-[8px] text-amber-900">P</div>, text: "Accumula", highlight: "PARTY BLOCKS", color: "text-amber-400" }
                  ].map((item, i) => (
                    <motion.div key={i} whileHover={{ x: 8, backgroundColor: 'rgba(255,255,255,0.08)' }} className="flex items-center gap-4 bg-white/5 p-3.5 rounded-2xl border border-white/10 backdrop-blur-md transition-colors">
                      <div className="shrink-0 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{item.icon}</div>
                      <span className="text-indigo-50 uppercase tracking-tighter" style={{ ...PIXEL, fontSize: '9px' }}>
                        {item.text} <span className={`${item.color} font-bold`}>{item.highlight}</span>
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Grid Hologramma */}
                <div className="grid grid-cols-3 gap-4 w-full mb-12">
                  {[
                    { icon: <TrendingUp size={30} className="text-sky-400" />, label: "Statistiche", color: "from-sky-500/20", border: "border-sky-500/50", shadow: "group-hover:shadow-sky-500/40" },
                    { icon: <span className="text-4xl">🤖</span>, label: "Skins", color: "from-emerald-500/20", border: "border-emerald-500/50", shadow: "group-hover:shadow-emerald-500/40" },
                    { icon: <Coins size={30} className="text-amber-400" />, label: "Store", color: "from-amber-500/20", border: "border-amber-400/50", shadow: "group-hover:shadow-amber-500/40" }
                  ].map((btn, i) => (
                    <motion.div key={i} whileHover={{ y: -8, scale: 1.05 }} className={`group relative rounded-2xl flex flex-col items-center gap-3 py-5 px-1 cursor-pointer bg-gradient-to-b ${btn.color} to-transparent border-2 ${btn.border} backdrop-blur-sm transition-all ${btn.shadow} hover:shadow-2xl`}>
                      <div className="transition-transform group-hover:scale-125 duration-300">{btn.icon}</div>
                      <span className="text-white/70 group-hover:text-white uppercase text-[7px]" style={{ ...PIXEL }}>{btn.label}</span>
                    </motion.div>
                  ))}
                </div>

                {/* CTA Oro con Bordo Neon Rotante */}
                <div className="w-full relative group">
                  <div className="absolute -inset-1 rounded-[1.8rem] bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-yellow-400 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
                  <motion.button
                    animate={{ boxShadow: ['0 0 30px #d97706', '0 0 60px #f59e0b', '0 0 30px #d97706'] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95, y: 6 }}
                    onClick={onOpenLogin}
                    className="w-full py-6 sm:py-7 text-white text-[1.4rem] sm:text-[1.8rem] uppercase tracking-widest rounded-[1.5rem] relative overflow-hidden cursor-pointer z-10 flex items-center justify-center gap-4 font-black"
                    style={{ 
                      ...PIXEL,
                      backgroundColor: '#f59e0b',
                      border: '5px solid #fef3c7', 
                      borderBottomWidth: '12px',
                      borderBottomColor: '#b45309',
                      textShadow: '0 3px 0 #78350f'
                    }}
                  >
                    <span className="text-4xl leading-none animate-bounce">👑</span>
                    REGISTRATI ORA
                  </motion.button>
                </div>
                
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoginMode: boolean;
  setIsLoginMode: (v: boolean) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  authLoading: boolean;
  authError: string | null;
  setAuthError: (v: string | null) => void;
  handleAuth: (e: React.FormEvent) => void;
  t: (key: string) => string;
}
function LoginModal({ isOpen, onClose, isLoginMode, setIsLoginMode, email, setEmail, password, setPassword, authLoading, authError, setAuthError, handleAuth, t }: LoginModalProps) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        key="login-modal-backdrop"
        className="fixed inset-0 z-[10000] flex items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        onClick={onClose}>
        <motion.div
          initial={{ scale: 0.7, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 24 }}
          onClick={e => e.stopPropagation()}
          className="relative w-full max-w-md mx-4 p-6 flex flex-col gap-4"
          style={{
            background: 'rgba(5,9,18,0.88)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,238,0,0.35)',
            borderRadius: '10px',
            boxShadow: '0 0 0 1px rgba(255,238,0,0.08), 0 16px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}>
          {/* Top shimmer */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,238,0,0.6), transparent)', borderRadius: '10px 10px 0 0' }} />
          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 p-1.5"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', cursor: 'pointer' }}>
            <X size={14} color="rgba(255,255,255,0.5)" />
          </button>
          {/* Header */}
          <div className="flex justify-between items-center pr-8">
            <h3 style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', color: '#ffee00', textShadow: '0 0 10px #ffee00' }}>
              {isLoginMode ? t('welcome_back') : t('create_account')}
            </h3>
          </div>
          {/* Toggle */}
          <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(null); }}
            className="self-start"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: '#fff', background: 'transparent', border: '1px solid rgba(255,255,255,0.20)', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>
            {isLoginMode ? t('register_btn_switch') : t('login_btn_switch')}
          </motion.button>
          {/* Error */}
          <AnimatePresence>
            {authError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="p-3 flex items-start gap-2"
                style={{ background: 'rgba(255,51,102,0.08)', border: '1px solid rgba(255,51,102,0.25)', borderRadius: '4px' }}>
                <AlertCircle size={12} color="#ff3366" className="shrink-0 mt-0.5" />
                <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '7px', color: '#ff3366', lineHeight: '1.8' }}>{authError}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Form */}
          <form onSubmit={handleAuth} className="flex flex-col gap-3 relative">
            {authLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center"
                style={{ background: 'rgba(5,9,18,0.92)', borderRadius: '4px' }}>
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#ffee00' }} />
              </div>
            )}
            <div>
              <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>{t('email_address')}</p>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="player@email.com"
                style={{ fontFamily: "'Press Start 2P', monospace", background: 'transparent', color: '#ffee00', border: '1px solid rgba(255,238,0,0.30)', borderRadius: '4px', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '8px', boxShadow: '0 0 8px rgba(255,238,0,0.05) inset' }} />
            </div>
            <div>
              <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '6px', color: 'rgba(255,255,255,0.4)', marginBottom: '5px' }}>{t('password')}</p>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t('password_placeholder')} minLength={6}
                style={{ fontFamily: "'Press Start 2P', monospace", background: 'transparent', color: '#ffee00', border: '1px solid rgba(255,238,0,0.30)', borderRadius: '4px', outline: 'none', width: '100%', padding: '10px 12px', fontSize: '8px', boxShadow: '0 0 8px rgba(255,238,0,0.05) inset' }} />
            </div>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              type="submit" disabled={authLoading}
              className="w-full py-3 px-4 flex items-center justify-center gap-2"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px', background: '#ffee00', color: '#070b14', border: '2px solid #070b14', boxShadow: '4px 4px 0 rgba(0,0,0,0.8)', borderRadius: '3px', cursor: 'pointer' }}>
              {isLoginMode ? <><LogIn size={13} /> {t('enter_server')}</> : <><UserPlus size={13} /> {t('register_now')}</>}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── App ─── */
export default function App() {
  const { user, isLoading, initializeAuth, signOut } = useAuthStore();
  const targetColor = useGameStore(state => state.targetColor);
  const roundsSurvived = useGameStore(state => state.roundsSurvived);
  const gameState = useGameStore(state => state.gameState);
  const startGame = useGameStore(state => state.startGame);
  const startTesting = useGameStore(state => state.startTesting);
  const username = useGameStore(state => state.username);
  const setUsername = useGameStore(state => state.setUsername);
  const aliveBots = useGameStore(state => state.aliveBots);
  const isPaused = useGameStore(state => state.isPaused);
  const togglePause = useGameStore(state => state.togglePause);
  const gameMode = useGameStore(state => state.gameMode);
  const setGameMode = useGameStore(state => state.setGameMode);
  const startParkourGame = useGameStore(state => state.startParkourGame);
  const restartParkourLevel = useGameStore(state => state.restartParkourLevel);
  const startGhettoGame = useGameStore(state => state.startGhettoGame);
  const resetGhettoGame = useGameStore(state => state.resetGhettoGame);
  const primeGhettoFloor = useGameStore(state => state.primeGhettoFloor);
  const parkourLevel = useGameStore(state => state.parkourLevel);
  const ghettoHP = useGameStore(state => state.ghettoHP);
  const ghettoMaxHP = useGameStore(state => state.ghettoMaxHP);
  const ghettoRegenTimer = useGameStore(state => state.ghettoRegenTimer);
  const ghettoAmmo = useGameStore(state => state.ghettoAmmo);
  const ghettoMaxAmmo = useGameStore(state => state.ghettoMaxAmmo);
  const ghettoWeapon = useGameStore(state => state.ghettoWeapon);
  const ghettoOwnedWeapons = useGameStore(state => state.ghettoOwnedWeapons);
  const ghettoM16Ammo = useGameStore(state => state.ghettoM16Ammo);
  const ghettoMaxM16Ammo = useGameStore(state => state.ghettoMaxM16Ammo);
  const ghettoShotgunAmmo = useGameStore(state => state.ghettoShotgunAmmo);
  const ghettoMaxShotgunAmmo = useGameStore(state => state.ghettoMaxShotgunAmmo);
  const ghettoMachinegunAmmo = useGameStore(state => state.ghettoMachinegunAmmo);
  const ghettoMaxMachinegunAmmo = useGameStore(state => state.ghettoMaxMachinegunAmmo);
  const ghettoPoints = useGameStore(state => state.ghettoPoints);
  const ghettoWave = useGameStore(state => state.ghettoWave);
  const ghettoMaxWave = useGameStore(state => state.ghettoMaxWave);
  const ghettoEnemiesAlive = useGameStore(state => state.ghettoEnemiesAlive);
  const ghettoScore = useGameStore(state => state.ghettoScore);
  const activeGadgets = useGameStore(state => state.activeGadgets);
  const sessionCoins = useGameStore(state => state.sessionCoins);
  const profile = useProfileStore(state => state.profile);
  const notifications = useProfileStore(state => state.notifications);

  const [showShop, setShowShop] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showModeSplash, setShowModeSplash] = useState(false);
  const [ghettoArenaLoading, setGhettoArenaLoading] = useState(false);
  const ghettoLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageVignetteRef = useRef<HTMLDivElement>(null);
  const [nearStation, setNearStation] = useState<string | null>(null);
  const [gadgetFlashColor, setGadgetFlashColor] = useState<string | null>(null);
  const prevGadgetCount = useRef(0);

  // Flying coin animation
  const [flyingCoins, setFlyingCoins] = useState<{ id: number; tx: number; ty: number }[]>([]);
  const flyingCoinId = useRef(0);
  const prevSessionCoins = useRef(0);
  const coinCounterRef = useRef<HTMLDivElement>(null);
  const [counterPulse, setCounterPulse] = useState(0);

  // Reward toasts
  const [rewardToasts, setRewardToasts] = useState<{ id: number; text: string }[]>([]);
  const rewardToastId = useRef(0);
  const prevParkourLevel = useRef(1);
  const addRewardToast = useCallback((text: string) => {
    const id = ++rewardToastId.current;
    setRewardToasts(t => [...t, { id, text }]);
    setTimeout(() => setRewardToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // Damage vignette — rAF loop drives opacity imperatively (zero re-renders).
  // At 1 HP the vignette is locked to a minimum so the screen stays red until regeneration.
  // Also polls the buy station ref to update the HUD prompt.
  useEffect(() => {
    let rafId: number;
    let lastNear: string | null = null;
    const tick = () => {
      if (damageVignetteRef.current) {
        const { ghettoHP, gameMode, gameState } = useGameStore.getState();
        const dangerMode = gameMode === 'ghetto' && gameState === 'playing' && ghettoHP === 1;
        const minOpacity = dangerMode ? 0.5 : 0;
        ghettoDamageFlashRef.current = Math.max(minOpacity, ghettoDamageFlashRef.current - 0.038);
        damageVignetteRef.current.style.opacity = String(ghettoDamageFlashRef.current);
      }
      // Buy station proximity — only trigger setState when it changes
      const near = ghettoNearStationRef.current;
      if (near !== lastNear) { lastNear = near as any; setNearStation(near); }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const crosshairRef = useRef<HTMLDivElement>(null);
  const [splashMode, setSplashMode] = useState<'classic' | 'parkour' | 'ghetto'>('classic');
  const [inputName, setInputName] = useState(username);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showGuestTeaser, setShowGuestTeaser] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'classic' | 'parkour' | 'ghetto' | null>(null);
  const { t, language, setLanguage } = useI18nStore();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const { lobbyId, isHost, players, isLoading: mpLoading, error: mpError, createLobby, joinLobby, leaveLobby } = useMultiplayerStore();

  const getUiScale = () => {
    if (typeof window === 'undefined') return 1;
    if (window.innerWidth < 640) return 0.85;
    if (window.innerWidth > 1400 || window.innerHeight > 850) {
      const s = Math.max(1, Math.min((window.innerWidth * 0.95) / 1400, (window.innerHeight * 0.90) / 850));
      return s;
    }
    return 1;
  };
  const [uiScale, setUiScale] = useState(getUiScale());
  useEffect(() => {
    const h = () => setUiScale(getUiScale());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  useEffect(() => {
    if (user?.email) {
      import('./store/profile').then(m => {
        setTimeout(() => {
          const p = m.useProfileStore.getState().profile;
          setInputName(p?.username || user.email!.split('@')[0] || t('player'));
        }, 500);
      });
    }
  }, [user]);

  useEffect(() => {
    if (gameState === 'victory') {
      const end = Date.now() + 3000;
      const id: any = setInterval(() => {
        const left = end - Date.now();
        if (left <= 0) return clearInterval(id);
        confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 0, particleCount: 50 * (left / 3000), origin: { x: Math.random(), y: Math.random() - 0.2 } });
      }, 250);
      return () => clearInterval(id);
    } else if (gameState === 'levelcomplete') {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: [C.yellow, C.white, '#00ff88'] });
    } else if (roundsSurvived > 0) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.8 }, colors: [C.yellow, C.white, C.danger] });
    }
  }, [roundsSurvived, gameState]);

  const handleModeSwitch = () => {
    const m = gameMode === 'classic' ? 'parkour' : 'classic';
    setGameMode(m); setSplashMode(m); setShowModeSplash(true);
    setTimeout(() => setShowModeSplash(false), 1800);
  };

  const handleStart = () => {
    const n = inputName.trim() || (user ? user.email?.split('@')[0] || t('player') : t('guest'));
    setUsername(n); startGame();
  };
  const handleStartParkour = () => {
    const n = inputName.trim() || (user ? user.email?.split('@')[0] || t('player') : t('guest'));
    setUsername(n); startParkourGame();
  };
  // Shows loading screen first, then starts the game after it dismisses.
  // This way physics never runs during loading — the arena and player
  // only spawn once the screen is gone.
  const startGhettoWithLoading = useCallback(() => {
    if (ghettoLoadTimerRef.current) clearTimeout(ghettoLoadTimerRef.current);
    primeGhettoFloor();          // mount floor NOW so Rapier has 2s to register it
    setGhettoArenaLoading(true);
    ghettoLoadTimerRef.current = setTimeout(() => {
      setGhettoArenaLoading(false);
      startGhettoGame();
    }, 2000);
  }, [startGhettoGame, primeGhettoFloor]);

  const handleStartGhetto = () => {
    const n = inputName.trim() || (user ? user.email?.split('@')[0] || t('player') : t('guest'));
    setUsername(n);
    setSplashMode('ghetto');
    setShowModeSplash(true);
    setTimeout(() => { setShowModeSplash(false); startGhettoWithLoading(); }, 1000);
  };
  const handleCreateMP = () => {
    const n = inputName.trim() || (user ? user.email?.split('@')[0] || t('player') : t('guest'));
    setUsername(n); createLobby(n, user?.id);
  };
  const handleJoinMP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim() || joinCode.length !== 5) return;
    const n = inputName.trim() || (user ? user.email?.split('@')[0] || t('player') : t('guest'));
    setUsername(n); joinLobby(joinCode.trim(), n, user?.id);
  };
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(null);
    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
    } catch (err: any) { setAuthError(err.message || 'Errore'); }
    finally { setAuthLoading(false); }
  };

  useEffect(() => { if (mpError) alert(`Errore Lobby: ${mpError}`); }, [mpError]);

  // Ghetto mode: mouse crosshair tracking
  useEffect(() => {
    if (gameMode !== 'ghetto' || gameState !== 'playing') return;
    const h = (e: MouseEvent) => {
      if (crosshairRef.current) {
        crosshairRef.current.style.left = `${e.clientX}px`;
        crosshairRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener('mousemove', h, { passive: true });
    return () => window.removeEventListener('mousemove', h);
  }, [gameMode, gameState]);

  // Spawn flying coin when sessionCoins increases
  useEffect(() => {
    if (sessionCoins > prevSessionCoins.current && (gameState === 'playing' || gameState === 'elimination')) {
      const rect = coinCounterRef.current?.getBoundingClientRect();
      const tx = rect ? rect.left + rect.width / 2 - window.innerWidth / 2 : window.innerWidth * 0.38;
      const ty = rect ? rect.top + rect.height / 2 - window.innerHeight / 2 : -window.innerHeight * 0.46;
      const id = ++flyingCoinId.current;
      setFlyingCoins(c => [...c, { id, tx, ty }]);
      setTimeout(() => {
        setFlyingCoins(c => c.filter(x => x.id !== id));
        setCounterPulse(p => p + 1);
      }, 750);
    }
    prevSessionCoins.current = sessionCoins;
  }, [sessionCoins, gameState]);

  // Reward toast on level complete (PB save is now done in completeParkourLevel in store.ts)
  useEffect(() => {
    if (gameMode === 'parkour' && parkourLevel > prevParkourLevel.current && parkourLevel > 1) {
      addRewardToast(`LIVELLO ${parkourLevel - 1} COMPLETATO!`);
    }
    prevParkourLevel.current = parkourLevel;
  }, [parkourLevel, gameMode, addRewardToast]);

  // Reward toast on coin milestone (every 5 coins in parkour)
  useEffect(() => {
    if (gameMode === 'parkour' && sessionCoins > 0 && sessionCoins % 5 === 0) {
      addRewardToast(`${sessionCoins} MONETE RACCOLTE!`);
    }
  }, [sessionCoins, gameMode, addRewardToast]);

  // Gadget flash when a new gadget is collected
  useEffect(() => {
    if (activeGadgets.length > prevGadgetCount.current) {
      const latest = activeGadgets[activeGadgets.length - 1];
      setGadgetFlashColor(GADGET_DEFS[latest.type].color);
      setTimeout(() => setGadgetFlashColor(null), 400);
    }
    prevGadgetCount.current = activeGadgets.length;
  }, [activeGadgets]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ['playing', 'waiting', 'elimination'].includes(gameState)) togglePause();
      if (gameState === 'gameover') {
        if (e.key === 'Enter') {
          if (gameMode === 'ghetto') startGhettoWithLoading();
          else if (gameMode === 'parkour') restartParkourLevel();
          else startGame();
        } else if (e.key === 'Escape') {
          if (gameMode === 'ghetto') resetGhettoGame();
          else useGameStore.setState({ gameState: 'menu' });
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [gameState, gameMode, togglePause, startGame, startGhettoWithLoading, restartParkourLevel, resetGhettoGame]);

  /* ─── shared input style ─── */
  const inputStyle: React.CSSProperties = {
    background: C.bg, color: C.yellow, border: `2px solid rgba(255,238,0,0.35)`,
    borderRadius: '3px', outline: 'none', width: '100%',
    padding: '12px 14px', ...PIXEL, fontSize: '9px',
  };
  const menuInputStyle: React.CSSProperties = {
    ...PIXEL, background: C.bg, color: C.yellow,
    border: `2px solid rgba(255,238,0,0.4)`, borderRadius: '3px',
    outline: 'none', width: '100%', padding: '12px 14px', fontSize: '9px',
  };

  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: C.bg, cursor: gameMode === 'ghetto' && gameState === 'playing' ? 'none' : 'default' }}>
      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-[99999]" style={{ background: C.bg }}>
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: C.yellow }} />
            <p style={{ ...PIXEL, fontSize: '8px', color: C.yellow }}>LOADING...</p>
          </div>
        </div>
      )}

      <ErrorBoundary name="Game Canvas"><Game /></ErrorBoundary>

      {/* ── Damage vignette — opacity driven imperatively by rAF loop ── */}
      <div
        ref={damageVignetteRef}
        style={{
          position: 'fixed', inset: 0,
          pointerEvents: 'none',
          zIndex: 9998,
          opacity: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(200,10,20,0.55) 72%, rgba(180,0,10,0.88) 100%)',
          boxShadow: 'inset 0 0 140px rgba(200,10,20,0.75)',
        }}
      />

      {/* ── Parkour low-timer vignette — opacity driven from Game.tsx GameLogic ── */}
      <div
        ref={el => { uiRefs.parkourVignette = el; }}
        style={{
          position: 'fixed', inset: 0,
          pointerEvents: 'none',
          zIndex: 9997,
          opacity: 0,
          background: 'radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(255,51,0,0.35) 72%, rgba(220,30,0,0.65) 100%)',
          boxShadow: 'inset 0 0 120px rgba(255,51,0,0.45)',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* ── Ghetto arena loading screen ── */}
      <AnimatePresence>
        {ghettoArenaLoading && (
          <motion.div
            key="ghetto-loading"
            className="fixed inset-0 z-[99998] flex flex-col items-center justify-center gap-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: 'rgba(7,11,20,0.97)' }}>
            {/* Pixel scanlines */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 3px)',
            }} />
            {/* Animated color blocks */}
            <div className="flex gap-2 mb-2">
              {['#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#80C000', '#009688', '#0070C0', '#4B0082'].map((col, i) => (
                <motion.div key={i}
                  style={{ width: 12, height: 12, background: col, imageRendering: 'pixelated' }}
                  animate={{ scaleY: [1, 2.5, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.07, ease: 'easeInOut' }}
                />
              ))}
            </div>
            <div style={{ ...PIXEL, fontSize: 'clamp(12px, 3vw, 20px)', color: C.yellow, textShadow: `0 0 20px ${C.yellow}` }}>
              GHETTO MODE
            </div>
            <div style={{ ...PIXEL, fontSize: 'clamp(7px, 1.5vw, 10px)', color: C.white, letterSpacing: '0.2em' }}>
              CARICAMENTO ARENA...
            </div>
            {/* Pixel progress bar */}
            <div style={{ width: 220, height: 10, background: C.panel, border: `2px solid ${C.yellow}`, borderRadius: '2px', overflow: 'hidden' }}>
              <motion.div
                style={{ height: '100%', background: C.yellow, originX: 0 }}
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 1.8, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Ghetto crosshair ── */}
      {gameMode === 'ghetto' && gameState === 'playing' && (
        <div
          ref={crosshairRef}
          className="fixed pointer-events-none z-[9999]"
          style={{ transform: 'translate(-50%, -50%)', left: '50%', top: '50%' }}>
          {/* Outer ring */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `2px solid rgba(255,51,102,0.9)`,
            boxShadow: `0 0 6px rgba(255,51,102,0.7), inset 0 0 4px rgba(255,51,102,0.3)`,
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          }} />
          {/* Center dot */}
          <div style={{
            width: 4, height: 4, borderRadius: '50%',
            background: '#ff3366', boxShadow: `0 0 4px #ff3366`,
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          }} />
          {/* Cross lines */}
          {[[-14, -1, 8, 2], [6, -1, 8, 2], [-1, -14, 2, 8], [-1, 6, 2, 8]].map(([x, y, w, h], i) => (
            <div key={i} style={{
              position: 'absolute', left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`,
              width: w, height: h,
              background: 'rgba(255,51,102,0.9)', boxShadow: `0 0 3px rgba(255,51,102,0.6)`,
            }} />
          ))}
        </div>
      )}

      {/* ── Flying coin animation ── */}
      <AnimatePresence>
        {flyingCoins.map(fc => (
          <motion.div
            key={fc.id}
            className="fixed z-[999] pointer-events-none flex items-center justify-center"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #fff9aa, #ffd700 45%, #e69000)',
              border: '2px solid #ffe066',
              boxShadow: '0 0 16px #ffd700, 0 0 32px rgba(255,215,0,0.5)',
              left: '50%', top: '50%',
              perspective: 300,
              fontSize: 13, fontWeight: 'bold', color: '#b36a00',
            }}
            initial={{ x: '-50%', y: '-50%', scale: 0, opacity: 0, rotateY: 0 }}
            animate={{
              x: ['-50%', '-50%', `calc(-50% + ${fc.tx}px)`],
              y: ['-50%', '-80%', `calc(-50% + ${fc.ty}px)`],
              scale: [0, 1.5, 1.2, 0.35],
              opacity: [0, 1, 1, 0],
              rotateY: [0, 360, 720],
            }}
            transition={{
              duration: 0.78,
              ease: [0.2, 0.65, 0.35, 1.0],
              times: [0, 0.12, 0.78, 1],
              rotateY: { duration: 0.78, ease: 'linear', times: [0, 0.5, 1] },
            }}
          >
            $
          </motion.div>
        ))}
      </AnimatePresence>

      {/* ── Reward toasts ── */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence>
          {rewardToasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ y: 20, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              className="px-4 py-2 flex items-center gap-2"
              style={{ background: C.panel, border: `2px solid ${C.yellow}`, boxShadow: `0 0 14px rgba(255,238,0,0.4), 3px 3px 0 rgba(0,0,0,0.5)`, borderRadius: '3px' }}>
              <Star size={11} fill={C.yellow} color={C.yellow} />
              <span style={{ ...PIXEL, fontSize: '7px', color: C.yellow }}>{toast.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Gadget collect flash ── */}
      <AnimatePresence>
        {gadgetFlashColor && (
          <motion.div key="gadget-flash"
            className="fixed inset-0 pointer-events-none z-[100]"
            initial={{ opacity: 0.4 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ background: gadgetFlashColor }}
          />
        )}
      </AnimatePresence>

      {/* Volume button — sempre visibile */}
      <VolumeButton />

      {/* ── Mode Splash ── */}
      <AnimatePresence>
        {showModeSplash && (
          <motion.div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="absolute inset-0" style={{ background: 'rgba(7,11,20,0.85)' }} />
            <motion.div className="relative text-center px-10 py-8"
              initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              style={PANEL}>
              <h1 style={{ ...PIXEL, fontSize: 'clamp(22px,5vw,42px)', ...GLOW_Y }}>
                {splashMode === 'ghetto' ? 'GHETTO MODE' : splashMode === 'parkour' ? 'PARKOUR' : 'COLOR BLOCK'}
              </h1>
              <p style={{ ...PIXEL, fontSize: '9px', color: C.white, marginTop: '12px' }}>MODE ATTIVATA!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {gameState === 'menu' && <PixelBg />}
      {user && <Shop isOpen={showShop} onClose={() => setShowShop(false)} />}
      <GuestTeaserModal isOpen={showGuestTeaser} onClose={() => setShowGuestTeaser(false)} onOpenLogin={() => { setShowGuestTeaser(false); setShowLoginModal(true); setIsLoginMode(false); }} t={t} />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)}
        isLoginMode={isLoginMode} setIsLoginMode={setIsLoginMode}
        email={email} setEmail={setEmail} password={password} setPassword={setPassword}
        authLoading={authLoading} authError={authError} setAuthError={setAuthError}
        handleAuth={handleAuth} t={t} />
      <AnimatePresence>
        {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} />}
      </AnimatePresence>

      {/* ── Center Timer Bar — floating top-center, shown during play ── */}
      {(gameState === 'playing' || gameState === 'elimination') && gameMode !== 'ghetto' && gameMode !== 'testing' && (
        <CenterTimerBar />
      )}

      {/* ── UI Overlay ── */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-40">

        {/* ── Top HUD ── */}
        <AnimatePresence>
          {gameState !== 'menu' && (
            <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              className="flex justify-between items-start gap-3">

              {/* ════ LEFT CARD ════ */}
              {gameMode === 'ghetto' ? (
                <div className="flex flex-col gap-2 p-3"
                  style={{ background: 'rgba(5,9,18,0.80)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,51,102,0.28)', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.55)' }}>
                  {/* HP */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: ghettoMaxHP }).map((_, i) => (
                      <span key={i} style={{ opacity: i < ghettoHP ? 1 : 0.18, fontSize: '11px', lineHeight: 1 }}>❤️</span>
                    ))}
                    {ghettoHP < ghettoMaxHP && ghettoRegenTimer > 0 && (
                      <span style={{ ...PIXEL, fontSize: '6px', color: '#ff8888', marginLeft: '4px' }}>+{Math.ceil(ghettoRegenTimer)}s</span>
                    )}
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-3">
                    <span style={{ ...PIXEL, fontSize: '7px', color: C.yellow }}>WAVE {ghettoWave}/{ghettoMaxWave}</span>
                    <span style={{ ...PIXEL, fontSize: '7px', color: C.white }}>👾 {ghettoEnemiesAlive}</span>
                    <span style={{ ...PIXEL, fontSize: '7px', color: '#ff4466' }}>💀 {ghettoScore}</span>
                  </div>
                </div>
              ) : gameMode === 'testing' ? (
                /* Testing mode badge + exit */
                <div className="flex items-center gap-2 p-3"
                  style={{ background: 'rgba(5,9,18,0.80)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(0,255,128,0.35)', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.55)', pointerEvents: 'auto' }}>
                  <span style={{ ...PIXEL, fontSize: '8px', color: '#00ff80', textShadow: '0 0 10px #00ff80' }}>🧪 TESTING</span>
                  <button
                    onClick={() => useGameStore.setState({ gameState: 'menu', gameMode: 'classic', isPaused: false })}
                    style={{ ...BTN_R, fontSize: '7px', padding: '4px 8px' }}>
                    EXIT
                  </button>
                </div>
              ) : gameMode === 'parkour' ? (
                <ParkourLeftCard level={parkourLevel} activeGadgets={activeGadgets} dbRecords={profile?.parkour_records} />
              ) : (
                /* Classic */
                <div className="flex flex-col gap-2 p-3"
                  style={{ background: 'rgba(5,9,18,0.80)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: '1px solid rgba(255,238,0,0.20)', borderRadius: '10px', boxShadow: '0 4px 24px rgba(0,0,0,0.55)', minWidth: '185px' }}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                      <Trophy size={10} color={C.yellow} />
                      <span style={{ ...PIXEL, fontSize: '7px', color: C.yellow, textShadow: `0 0 8px ${C.yellow}` }}>{t('round')}: {roundsSurvived}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User size={9} color="rgba(255,255,255,0.4)" />
                      <span style={{ ...PIXEL, fontSize: '7px', color: 'rgba(255,255,255,0.6)' }}>{aliveBots.length + (gameState === 'gameover' ? 0 : 1)}/12</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ════ CENTER — classic color target only ════ */}
              {gameMode !== 'ghetto' && gameMode !== 'parkour' && gameMode !== 'testing' && (gameState === 'playing' || gameState === 'elimination') && targetColor && (
                <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9996, pointerEvents: 'none' }}>
                  <motion.div key={roundsSurvived}
                    initial={{ scale: 0.8, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="p-2.5 flex flex-col items-center gap-1.5"
                    style={{ background: 'rgba(5,9,18,0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid rgba(255,238,0,0.22)`, borderRadius: '10px', boxShadow: `0 4px 20px rgba(0,0,0,0.6)` }}>
                    <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
                      style={{ width: 72, height: 36, backgroundColor: targetColor.hex, border: '2px solid rgba(0,0,0,0.5)', boxShadow: `0 0 12px ${targetColor.hex}99`, borderRadius: '3px' }} />
                    <div style={{ ...PIXEL, fontSize: '8px', color: targetColor.hex, textShadow: `0 0 8px ${targetColor.hex}` }}>
                      {t(targetColor.name.toLowerCase())}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* ════ RIGHT CARD ════ */}
              <div className="flex flex-col items-end gap-1.5">
                {gameMode === 'ghetto' && gameState === 'playing' ? (
                  <>
                    <div className="flex gap-1.5">
                      {([
                        { key: '1', weapon: 'pistol', label: 'PISTOL', ammo: ghettoAmmo, maxAmmo: ghettoMaxAmmo },
                        { key: '2', weapon: 'm16', label: 'M16', ammo: ghettoM16Ammo, maxAmmo: ghettoMaxM16Ammo },
                        { key: '3', weapon: 'shotgun', label: 'SHOTGN', ammo: ghettoShotgunAmmo, maxAmmo: ghettoMaxShotgunAmmo },
                        { key: '4', weapon: 'machinegun', label: 'MGUN', ammo: ghettoMachinegunAmmo, maxAmmo: ghettoMaxMachinegunAmmo },
                      ] as Array<{ key: string; weapon: 'pistol' | 'm16' | 'shotgun' | 'machinegun'; label: string; ammo: number; maxAmmo: number }>).map(slot => {
                        const owned = ghettoOwnedWeapons.includes(slot.weapon);
                        const active = ghettoWeapon === slot.weapon;
                        const low = owned && slot.ammo <= 5;
                        return (
                          <div key={slot.weapon} className="px-2 py-1.5 flex flex-col items-center gap-0.5"
                            style={{
                              background: active ? 'rgba(255,204,0,0.14)' : 'rgba(5,9,18,0.76)',
                              backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                              border: `1px solid ${active ? C.yellow : owned ? 'rgba(255,204,0,0.32)' : 'rgba(255,255,255,0.10)'}`,
                              borderRadius: '6px', ...PIXEL, fontSize: '6px',
                              color: active ? C.yellow : owned ? 'rgba(255,204,0,0.6)' : 'rgba(255,255,255,0.22)',
                              opacity: owned ? 1 : 0.4,
                              boxShadow: active ? `0 0 10px rgba(255,238,0,0.22)` : 'none',
                            }}>
                            <span>[{slot.key}] {slot.label}</span>
                            <span style={{ color: low ? C.danger : 'inherit', fontSize: '7px' }}>
                              {owned ? `${slot.ammo}/${slot.maxAmmo}` : '---'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-2.5 py-1.5 flex items-center gap-1.5"
                      style={{ background: 'rgba(5,9,18,0.76)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid rgba(255,204,0,0.32)`, borderRadius: '6px', ...PIXEL, fontSize: '8px', color: '#ffcc00' }}>
                      ${ghettoPoints}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-end gap-2">
                    {(gameState === 'playing' || gameState === 'elimination' || gameState === 'levelcomplete') && (
                      <CoinHero coins={sessionCoins} pulse={counterPulse} coinRef={coinCounterRef} />
                    )}
                    <div className="flex items-center gap-1.5 px-2 py-1"
                      style={{ background: 'rgba(5,9,18,0.70)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px' }}>
                      <User size={10} color="rgba(255,255,255,0.38)" />
                      <span className="truncate" style={{ ...PIXEL, fontSize: '7px', color: 'rgba(255,255,255,0.55)', maxWidth: '110px' }}>
                        {username || user?.email?.split('@')[0] || t('player')}
                      </span>
                    </div>
                  </div>
                )}
                {user && (
                  <button onClick={async () => { await signOut(); }}
                    className="p-1.5 pointer-events-auto"
                    style={{ background: 'rgba(255,51,102,0.14)', backdropFilter: 'blur(8px)', border: `1px solid rgba(255,51,102,0.30)`, borderRadius: '6px', cursor: 'pointer' }}>
                    <LogOut size={12} color="rgba(255,51,102,0.75)" />
                  </button>
                )}
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Center ── */}
        <div className="flex-1 flex items-center justify-center relative">

          {/* Buy station prompt */}
          {gameMode === 'ghetto' && gameState === 'playing' && nearStation && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none z-50"
              style={{ ...PIXEL, textAlign: 'center' }}>
              <div className="px-4 py-2"
                style={{ background: 'rgba(0,0,0,0.82)', border: `2px solid #ffcc00`, borderRadius: '4px', fontSize: '9px', color: '#ffcc00' }}>
                {nearStation === 'm16'
                  ? (ghettoOwnedWeapons.includes('m16') ? `[F]  M16 RICARICA  ·  150$` : `[F]  ACQUISTA M16  ·  500$`)
                  : nearStation === 'shotgun'
                    ? (ghettoOwnedWeapons.includes('shotgun') ? `[F]  SHOTGUN RICARICA  ·  200$` : `[F]  ACQUISTA SHOTGUN  ·  800$`)
                    : nearStation === 'machinegun'
                      ? (ghettoOwnedWeapons.includes('machinegun') ? `[F]  MACHINEGUN RICARICA  ·  250$` : `[F]  ACQUISTA MACHINEGUN  ·  1000$`)
                      : nearStation === 'door_locked'
                        ? `[F]  SBLOCCA PORTA  ·  750$`
                        : nearStation === 'door_open'
                          ? `[ CAMMINA ]  ENTRA NELLA STANZA 2`
                          : null}
              </div>
            </div>
          )}

          {/* Right Side HUD: Profile & Shop */}
          <AnimatePresence>
            {gameState === 'menu' && !lobbyId && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                className="absolute top-[280px] right-[24px] z-[100] pointer-events-auto flex flex-col items-center gap-10">

                {user ? (
                  <UserProfile user={user} />
                ) : (
                  <motion.button
                    onClick={() => setShowGuestTeaser(true)}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                    className="relative group shrink-0 flex items-center justify-center cursor-pointer">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute -inset-2 rounded-full bg-gradient-to-tr from-rose-500 via-fuchsia-500 to-amber-500 opacity-0 group-hover:opacity-70 blur-md pointer-events-none transition-opacity"
                    />
                    <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-[4px] sm:border-[6px] border-slate-900 bg-slate-100 shadow-[2px_4px_0_#1e1b4b] sm:shadow-[2px_6px_0_#1e1b4b] overflow-hidden flex items-center justify-center relative z-10 transition-colors group-hover:bg-indigo-50">
                      <User size={36} className="text-slate-400 group-hover:text-indigo-400" strokeWidth={2.5} />
                    </div>
                    <div className="absolute -bottom-1 bg-slate-800 text-white text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2.5 py-0.5 rounded-full border-2 border-slate-900 z-20 shadow-md group-hover:bg-indigo-500">
                      PROFILE
                    </div>
                  </motion.button>
                )}

                <div className="flex flex-col items-center gap-2">
                  <motion.button
                    animate={{ boxShadow: [`0 0 6px ${C.yellow}`, `0 0 18px ${C.yellow}`, `0 0 6px ${C.yellow}`] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                    onClick={() => user ? setShowShop(true) : setShowGuestTeaser(true)}
                    className="w-14 h-14 flex items-center justify-center relative overflow-hidden"
                    style={{ background: C.yellow, border: `3px solid ${C.bg}`, boxShadow: `3px 3px 0 ${C.bg}`, borderRadius: '3px', cursor: 'pointer' }}>
                    <Coins size={26} color={C.bg} strokeWidth={2.5} />
                    <div className="absolute -bottom-0.5 px-2 py-0.5"
                      style={{ background: C.danger, border: `2px solid ${C.bg}`, borderRadius: '2px', ...PIXEL, fontSize: '7px', color: '#fff' }}>
                      SHOP
                    </div>
                  </motion.button>
                  <div className="px-2 py-1 flex items-center gap-1"
                    style={{ background: C.panel, border: `2px solid rgba(255,238,0,0.35)`, borderRadius: '3px' }}>
                    <Coins size={10} color={C.yellow} />
                    <span style={{ ...PIXEL, fontSize: '8px', color: C.yellow }}>{user ? (profile?.coins.toLocaleString() || 0) : '???'}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">

            {/* ── MAIN MENU — 3-Column Layout ── */}
            {gameState === 'menu' && !lobbyId && (
              <motion.div key="menu"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="pointer-events-auto w-full h-full"
                style={{ maxHeight: '92vh', overflowY: 'auto', scrollbarWidth: 'none' }}>

                {/* ── TOP BAR — Leaderboard, Language, Login/Account ── */}
                <motion.div
                  initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 24 }}
                  className="flex items-center justify-between px-4 sm:px-8 py-3"
                  style={{ position: 'relative', zIndex: 50 }}>
                  {/* Left: Leaderboard icon */}
                  <motion.button
                    whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setShowLeaderboard(true)}
                    className="flex items-center gap-2 px-3 py-2"
                    style={{
                      background: 'rgba(5,9,18,0.75)', backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,238,0,0.30)', borderRadius: '6px',
                      cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    }}>
                    <Trophy size={16} color="#ffee00" style={{ filter: 'drop-shadow(0 0 6px #ffee00)' }} />
                    <span style={{ ...PIXEL, fontSize: '7px', color: '#ffee00', textShadow: '0 0 8px #ffee00' }}>RANK</span>
                  </motion.button>
                  {/* Center: Language flags */}
                  <div className="flex gap-1">
                    {(['en', 'it', 'ru'] as const).map(lang => (
                      <button key={lang} onClick={() => setLanguage(lang)}
                        className="w-8 h-7 flex items-center justify-center transition-all text-sm"
                        style={{ background: language === lang ? C.yellow : 'rgba(255,255,255,0.04)', borderRadius: '3px', border: language === lang ? 'none' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                        {lang === 'en' ? '🇬🇧' : lang === 'it' ? '🇮🇹' : '🇷🇺'}
                      </button>
                    ))}
                  </div>
                  {/* Right: Login button OR Account badge */}
                  {user ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 px-3 py-1.5"
                        style={{ background: 'rgba(5,9,18,0.75)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,238,0,0.20)', borderRadius: '6px' }}>
                        <div className="w-6 h-6 flex items-center justify-center shrink-0"
                          style={{ ...PIXEL, background: C.yellow, color: C.bg, borderRadius: '2px', fontSize: '10px' }}>
                          {(user.email?.[0] || 'P').toUpperCase()}
                        </div>
                        <span className="truncate" style={{ ...PIXEL, fontSize: '7px', color: C.white, maxWidth: '90px' }}>{user.email?.split('@')[0]}</span>
                      </div>
                      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                        onClick={async () => { await signOut(); }}
                        className="p-1.5"
                        style={{ background: 'rgba(255,51,102,0.12)', border: '1px solid rgba(255,51,102,0.25)', borderRadius: '5px', cursor: 'pointer' }}>
                        <LogOut size={12} color="rgba(255,51,102,0.7)" />
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setShowLoginModal(true)}
                      className="flex items-center gap-2 px-3 py-2"
                      style={{
                        background: 'rgba(5,9,18,0.75)', backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,238,0,0.30)', borderRadius: '6px',
                        cursor: 'pointer', ...PIXEL, fontSize: '7px', color: '#ffee00',
                        textShadow: '0 0 8px #ffee00', boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                      }}>
                      <LogIn size={13} color="#ffee00" />
                      LOGIN
                    </motion.button>
                  )}
                </motion.div>

                {/* ── 3-COLUMN GRID ── */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(180px, 240px) 1fr minmax(200px, 280px)',
                  gap: 'clamp(12px, 2vw, 24px)',
                  padding: '0 clamp(12px, 2vw, 32px) clamp(8px, 2vh, 24px)',
                  alignItems: 'center',
                  minHeight: 'calc(80vh - 60px)',
                  maxWidth: '1200px',
                  margin: '0 auto',
                }}>

                  {/* ═══ LEFT COLUMN — Game Modes ═══ */}
                  <motion.div
                    initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 24 }}
                    className="flex flex-col gap-3 self-center">
                    <ModeCard
                      icon="🎮" title="COLOR BLOCK" desc={'SALTA SUL\nCOLORE GIUSTO'} color="#ffee00"
                      onClick={() => { setSelectedMode('classic'); if (gameMode === 'parkour') handleModeSwitch(); else handleStart(); }}
                      animDelay={0.55}
                    />
                    <ModeCard
                      icon="🏃" title="PARKOUR" desc={'15 LIVELLI\nDI PIATTAFORME'} color="#00ff88"
                      onClick={() => { setSelectedMode('parkour'); if (gameMode !== 'parkour') handleModeSwitch(); else handleStartParkour(); }}
                      animDelay={0.67}
                      badge={gameMode === 'parkour' ? 'ON' : undefined}
                    />
                    <ModeCard
                      icon="🔫" title="GHETTO" desc={'ONDATE DI\nNEMICI DA UCCIDERE'} color="#ff3366"
                      onClick={() => { setSelectedMode('ghetto'); handleStartGhetto(); }}
                      animDelay={0.79}
                    />
                  </motion.div>

                  {/* ═══ CENTER COLUMN — Hero Title + Reflection ═══ */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="flex flex-col items-center justify-center self-center"
                    style={{ paddingTop: 'clamp(0px, 2vh, 16px)', paddingBottom: 'clamp(0px, 2vh, 16px)' }}>
                    <HeroTitle />
                    {/* Subtitle */}
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}
                      style={{
                        ...PIXEL, fontSize: 'clamp(6px, 1vw, 9px)',
                        color: 'rgba(255,255,255,0.35)',
                        marginTop: 'clamp(8px, 1.5vw, 16px)',
                        letterSpacing: '0.18em',
                      }}>
                      THE ULTIMATE PIXEL BATTLE
                    </motion.p>
                    {/* Title reflection */}
                    <div style={{
                      marginTop: '8px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 'clamp(10px, 2.5vw, 28px)',
                      color: 'rgba(255,238,0,0.06)',
                      textShadow: '0 0 20px rgba(255,238,0,0.08)',
                      transform: 'scaleY(-1)',
                      maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 80%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 80%)',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      animation: 'reflectionPulse 4s ease-in-out infinite',
                      letterSpacing: '-0.01em',
                    }}>
                      PARTY
                    </div>
                  </motion.div>

                  {/* ═══ RIGHT COLUMN — Account & Controls ═══ */}
                  <motion.div
                    initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 24 }}
                    className="flex flex-col gap-3 self-center">

                    {/* Nickname input */}
                    <div className="relative">
                      <User size={14} color="rgba(255,238,0,0.35)" className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none" />
                      <input type="text" placeholder={t('choose_nickname')} value={inputName}
                        onChange={e => setInputName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleStart()}
                        style={{ ...PIXEL, background: 'transparent', color: C.yellow, border: '1px solid rgba(255,238,0,0.30)', borderRadius: '5px', outline: 'none', width: '100%', padding: '11px 14px 11px 40px', fontSize: '8px', boxShadow: '0 0 8px rgba(255,238,0,0.04) inset' }} />
                    </div>

                    {/* Multiplayer row */}
                    <div className="flex flex-col gap-2">
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={handleCreateMP} disabled={mpLoading}
                        className="w-full py-2.5 px-3 flex items-center justify-center gap-2"
                        style={{ ...PIXEL, fontSize: '8px', background: 'transparent', color: C.white, border: '1px solid rgba(255,255,255,0.20)', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', borderRadius: '5px', cursor: 'pointer' }}>
                        {mpLoading ? <Loader2 className="animate-spin" size={13} /> : <><Users size={13} /> {t('create_room')}</>}
                      </motion.button>
                      {showJoinInput ? (
                        <form onSubmit={handleJoinMP}>
                          <input autoFocus type="text" maxLength={5} value={joinCode}
                            onChange={e => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="CODICE"
                            style={{ ...PIXEL, background: 'transparent', color: C.yellow, border: '1px solid rgba(255,238,0,0.30)', borderRadius: '5px', outline: 'none', width: '100%', padding: '11px 10px', fontSize: '8px', textAlign: 'center', letterSpacing: '0.3em' }} />
                        </form>
                      ) : (
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                          onClick={() => setShowJoinInput(true)}
                          className="w-full py-2.5 px-3 flex items-center justify-center"
                          style={{ ...PIXEL, fontSize: '8px', background: 'transparent', color: C.white, border: '1px solid rgba(255,255,255,0.20)', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', borderRadius: '5px', cursor: 'pointer' }}>
                          {t('join_with_code')}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>

                </div>
              </motion.div>
            )}

            {/* ── LOBBY ── */}
            {gameState === 'menu' && lobbyId && (
              <motion.div key="lobby"
                initial={{ scale: 0.8 * uiScale, opacity: 0 }} animate={{ scale: 1 * uiScale, opacity: 1 }} exit={{ scale: 0.8 * uiScale, opacity: 0 }}
                className="p-6 sm:p-8 w-full max-w-2xl flex flex-col items-center pointer-events-auto relative z-10"
                style={PANEL}>
                <div className="flex justify-between w-full items-center mb-4 pb-4"
                  style={{ borderBottom: `2px solid rgba(255,238,0,0.2)` }}>
                  <button onClick={leaveLobby} className="flex items-center gap-2 px-3 py-2"
                    style={{ ...BTN_R, fontSize: '8px' }}>
                    <ArrowLeft size={12} /><span className="hidden sm:inline">{t('leave_room')}</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span style={{ ...PIXEL, fontSize: '7px', color: C.dim }}>{t('room_code')}</span>
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-4 py-2 cursor-pointer"
                      style={{ ...PIXEL, fontSize: '16px', letterSpacing: '0.3em', color: C.yellow, background: C.bg, border: `2px solid ${C.yellow}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.5)`, borderRadius: '3px' }}
                      onClick={() => navigator.clipboard.writeText(lobbyId)}>
                      {lobbyId}<Copy size={14} color={C.yellow} />
                    </motion.div>
                  </div>
                </div>

                <h2 style={{ ...PIXEL, fontSize: 'clamp(14px,2.5vw,24px)', ...GLOW_Y }} className="mb-5 text-center uppercase">{t('waiting_room')}</h2>

                <div className="w-full p-3 mb-5 min-h-[160px]"
                  style={{ background: C.bg, border: `2px solid rgba(255,238,0,0.2)`, borderRadius: '3px' }}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {players.map(p => (
                      <div key={p.id} className="p-2 flex items-center justify-between"
                        style={{ background: C.panel, border: `2px solid rgba(255,238,0,0.2)`, borderRadius: '3px' }}>
                        <span style={{ ...PIXEL, fontSize: '8px', color: C.white }} className="truncate">{p.name}</span>
                        {p.isHost && <Trophy size={11} color={C.yellow} />}
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 12 - players.length) }).map((_, i) => (
                      <div key={`e-${i}`} className="p-2 flex items-center justify-center"
                        style={{ border: `2px dashed rgba(255,238,0,0.1)`, borderRadius: '3px' }}>
                        <span style={{ ...PIXEL, fontSize: '7px', color: 'rgba(255,238,0,0.2)', textAlign: 'center' }}>{t('waiting_players')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {isHost ? (
                  <div className="w-full flex flex-col gap-2">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => useGameStore.getState().startGame()}
                      className="w-full py-4 px-4 flex items-center justify-center gap-3"
                      style={BTN_Y}>
                      <Play fill="currentColor" size={14} /> {t('start_game')} ({players.length}/12)
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={startTesting}
                      className="w-full py-2 px-4 flex items-center justify-center gap-2"
                      style={{ ...BTN_W, fontSize: '8px', letterSpacing: '0.1em' }}>
                      🧪 TESTING
                    </motion.button>
                  </div>
                ) : (
                  <div className="w-full flex flex-col gap-2">
                    <div className="w-full py-4 px-4 flex items-center justify-center gap-3"
                      style={{ ...PIXEL, fontSize: '9px', color: C.white, background: 'rgba(255,255,255,0.04)', border: `2px solid rgba(255,255,255,0.15)`, borderRadius: '3px' }}>
                      <Loader2 className="animate-spin shrink-0" size={14} /> {t('waiting_for_host')}
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={startTesting}
                      className="w-full py-2 px-4 flex items-center justify-center gap-2"
                      style={{ ...BTN_W, fontSize: '8px', letterSpacing: '0.1em' }}>
                      🧪 TESTING
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── GAME OVER ── */}
            {gameState === 'gameover' && (
              <motion.div key="gameover"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 flex items-center justify-center pointer-events-auto z-[200]"
                style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
                <motion.div
                  initial={{ scale: 0.75, opacity: 0, y: 40 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                  className="relative flex flex-col items-center gap-5 p-8 overflow-hidden text-center"
                  style={{
                    ...PANEL,
                    border: `3px solid ${C.danger}`,
                    boxShadow: `6px 6px 0 rgba(0,0,0,0.9), 0 0 40px rgba(255,51,102,0.12)`,
                    minWidth: '280px',
                    maxWidth: '380px',
                    width: '90vw',
                  }}>
                  {/* Result label */}
                  <div>
                    <p style={{ ...PIXEL, fontSize: '8px', color: C.dim, marginBottom: '8px' }}>
                      {gameMode === 'ghetto' ? 'SEI MORTO ALLA WAVE' : gameMode === 'parkour' ? 'SEI CADUTO AL LVL' : t('eliminated')}
                    </p>
                    <motion.p
                      initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.15 }}
                      style={{ ...PIXEL, fontSize: 'clamp(48px,10vw,72px)', ...GLOW_R, lineHeight: 1 }}>
                      {gameMode === 'ghetto' ? ghettoWave : gameMode === 'parkour' ? parkourLevel : roundsSurvived}
                    </motion.p>
                    <p style={{ ...PIXEL, fontSize: '8px', color: C.dim, marginTop: '8px' }}>
                      {gameMode === 'ghetto' ? `DI ${ghettoMaxWave}` : gameMode === 'parkour' ? 'DI 15' : t('rounds_survived')}
                    </p>
                  </div>

                  {gameMode === 'ghetto' && (
                    <div className="px-3 py-2 flex items-center justify-center gap-2"
                      style={{ background: C.bg, border: `2px solid rgba(255,51,102,0.3)`, borderRadius: '3px' }}>
                      <span style={{ ...PIXEL, fontSize: '7px', color: C.danger }}>👾 {ghettoScore} NEMICI ELIMINATI</span>
                    </div>
                  )}
                  {gameMode !== 'parkour' && gameMode !== 'ghetto' && (
                    <div className="px-3 py-2 flex items-center justify-center gap-2"
                      style={{ background: C.bg, border: `2px solid rgba(255,238,0,0.3)`, borderRadius: '3px' }}>
                      <Coins size={11} color={C.yellow} />
                      <span style={{ ...PIXEL, fontSize: '7px', color: C.yellow }}>{(roundsSurvived * 10) + 5 + sessionCoins} PB GUADAGNATI</span>
                    </div>
                  )}

                  <div style={{ width: '100%', height: 2, background: `linear-gradient(to right, transparent, ${C.danger}, transparent)` }} />

                  <div className="flex flex-col gap-3 w-full">
                    {gameMode === 'ghetto' ? (
                      <>
                        <motion.button whileHover={{ scale: 1.04, x: -1, y: -1 }} whileTap={{ scale: 0.95, x: 2, y: 2 }}
                          onClick={startGhettoWithLoading}
                          className="w-full py-4 px-6 flex items-center justify-center gap-3"
                          style={MBTN_P}>
                          <RotateCcw size={13} strokeWidth={2.5} /> RIPROVA
                          <span style={{ ...PIXEL, fontSize: '6px', opacity: 0.6, marginLeft: 'auto', background: 'rgba(0,0,0,0.35)', padding: '2px 5px', borderRadius: '2px' }}>↵ Enter</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                          onClick={() => resetGhettoGame()}
                          className="w-full py-3 px-6 flex items-center justify-center gap-3"
                          style={MBTN_S}>
                          <LogOut size={12} /> MENU
                          <span style={{ ...PIXEL, fontSize: '6px', opacity: 0.6, marginLeft: 'auto', background: 'rgba(0,0,0,0.35)', padding: '2px 5px', borderRadius: '2px' }}>Esc</span>
                        </motion.button>
                      </>
                    ) : gameMode === 'parkour' ? (
                      <>
                        <motion.button whileHover={{ scale: 1.04, x: -1, y: -1 }} whileTap={{ scale: 0.95, x: 2, y: 2 }}
                          onClick={() => restartParkourLevel()}
                          className="w-full py-4 px-6 flex items-center justify-center gap-3"
                          style={MBTN_P}>
                          <RotateCcw size={13} strokeWidth={2.5} /> RIPROVA LVL {parkourLevel}
                          <span style={{ ...PIXEL, fontSize: '6px', opacity: 0.6, marginLeft: 'auto', background: 'rgba(0,0,0,0.35)', padding: '2px 5px', borderRadius: '2px' }}>↵ Enter</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                          onClick={() => useGameStore.setState({ gameState: 'menu' })}
                          className="w-full py-3 px-6 flex items-center justify-center gap-3"
                          style={MBTN_S}>
                          <LogOut size={12} /> MENU
                          <span style={{ ...PIXEL, fontSize: '6px', opacity: 0.6, marginLeft: 'auto', background: 'rgba(0,0,0,0.35)', padding: '2px 5px', borderRadius: '2px' }}>Esc</span>
                        </motion.button>
                      </>
                    ) : (
                      <>
                        {/* ── DOUBLE PB HERO BUTTON ── */}
                        <div className="relative w-full" style={{ padding: '8px 0 4px' }}>
                          {/* Pulsing outer glow */}
                          <motion.div
                            animate={{ opacity: [0.45, 1, 0.45] }}
                            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute pointer-events-none"
                            style={{
                              inset: '-6px -4px',
                              background: `radial-gradient(ellipse at 50% 50%, #ffee0038 0%, transparent 68%)`,
                              zIndex: 0,
                            }}
                          />
                          {/* 2X badge */}
                          <motion.div
                            animate={{ scale: [1, 1.25, 1], rotate: [-12, 12, -12] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              position: 'absolute', top: '0px', right: '6px',
                              background: C.danger, color: '#fff',
                              ...MF, fontSize: '8px',
                              padding: '3px 6px', lineHeight: 1,
                              border: `2px solid ${C.bg}`,
                              boxShadow: `2px 2px 0 ${C.bg}`,
                              borderRadius: '2px', zIndex: 10,
                            }}
                          >2X</motion.div>
                          {/* Star sparkles */}
                          {([[-18, -6, 0.9], [104, -8, 1.2], [-12, 48, 1.4]] as [number, number, number][]).map(([x, y, delay], i) => (
                            <motion.span key={i}
                              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -6, 0] }}
                              transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }}
                              style={{ position: 'absolute', left: `${x}%`, top: `${y}px`, zIndex: 0, fontSize: '10px', pointerEvents: 'none' }}
                            >★</motion.span>
                          ))}
                          {/* Button */}
                          <motion.button
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            whileHover={{ scale: 1.06, y: -4 }}
                            whileTap={{ scale: 0.93, x: 5, y: 5 }}
                            onClick={() => {
                              audio.playCoinSound();
                              useProfileStore.getState().addReward(roundsSurvived, true, sessionCoins);
                              if (gameMode === 'classic') useProfileStore.getState().recordClassicWin();
                              confetti({ particleCount: 200, spread: 130, origin: { y: 0.6 } });
                            }}
                            className="w-full py-4 px-6 flex items-center justify-center gap-3 relative overflow-hidden"
                            style={{
                              ...MBTN_P, fontSize: '12px',
                              boxShadow: `5px 5px 0 rgba(0,0,0,0.95), 0 0 18px #ffee0099`,
                              position: 'relative', zIndex: 2,
                            }}
                          >
                            {/* Shimmer sweep */}
                            <motion.div
                              animate={{ x: ['-130%', '130%'] }}
                              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                              style={{
                                position: 'absolute', inset: 0, pointerEvents: 'none',
                                background: 'linear-gradient(105deg, transparent 28%, rgba(255,255,255,0.55) 50%, transparent 72%)',
                                zIndex: 1,
                              }}
                            />
                            <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Coins size={15} color={C.bg} />
                              {t('double_pb')}
                            </span>
                          </motion.button>
                        </div>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                          onClick={startGame}
                          className="w-full py-3 px-6 flex items-center justify-center gap-3"
                          style={MBTN_S}>
                          <RotateCcw size={12} strokeWidth={2.5} /> {t('try_again')}
                          <span style={{ ...PIXEL, fontSize: '6px', opacity: 0.6, marginLeft: 'auto', background: 'rgba(0,0,0,0.35)', padding: '2px 5px', borderRadius: '2px' }}>↵ Enter</span>
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                          onClick={() => useGameStore.setState({ gameState: 'menu' })}
                          className="w-full py-3 px-6 flex items-center justify-center gap-3"
                          style={MBTN_S}>
                          <LogOut size={12} /> MENU
                          <span style={{ ...PIXEL, fontSize: '6px', opacity: 0.6, marginLeft: 'auto', background: 'rgba(0,0,0,0.35)', padding: '2px 5px', borderRadius: '2px' }}>Esc</span>
                        </motion.button>
                      </>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── PAUSE ── */}
            {isPaused && ['playing', 'waiting', 'elimination'].includes(gameState) && (
              <motion.div key="pause"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 flex items-center justify-center pointer-events-auto z-[200]"
                style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
                <motion.div
                  initial={{ scale: 0.75, opacity: 0, y: 40 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0, y: 30 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className="relative flex flex-col items-center gap-6 p-8 overflow-hidden"
                  style={{
                    ...PANEL,
                    boxShadow: `6px 6px 0 rgba(0,0,0,0.9), 0 0 40px rgba(255,238,0,0.1)`,
                    minWidth: '280px',
                    maxWidth: '340px',
                    width: '90vw',
                  }}>
                  {/* Pause icon */}
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5], textShadow: [`0 0 8px ${C.yellow}`, `0 0 20px ${C.yellow}`, `0 0 8px ${C.yellow}`] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-3">
                    <div style={{ width: 8, height: 32, background: C.yellow, borderRadius: '2px' }} />
                    <div style={{ width: 8, height: 32, background: C.yellow, borderRadius: '2px' }} />
                  </motion.div>
                  {/* Title */}
                  <div className="text-center">
                    <h2 style={{ ...PIXEL, fontSize: 'clamp(18px,3.5vw,28px)', ...GLOW_Y }}>PAUSA</h2>
                    <p style={{ ...PIXEL, fontSize: '7px', color: C.dim, marginTop: '8px' }}>IL GIOCO E IN PAUSA</p>
                  </div>
                  {/* Divider */}
                  <div style={{ width: '100%', height: 2, background: `linear-gradient(to right, transparent, ${C.yellow}, transparent)` }} />
                  {/* Buttons */}
                  <div className="flex flex-col gap-3 w-full">
                    <motion.button
                      whileHover={{ scale: 1.04, x: -1, y: -1 }}
                      whileTap={{ scale: 0.95, x: 2, y: 2 }}
                      onClick={togglePause}
                      className="w-full py-4 px-6 flex items-center justify-center gap-3"
                      style={MBTN_P}>
                      <Play fill="currentColor" size={13} /> TORNA AL GIOCO
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        leaveLobby();
                        if (useGameStore.getState().gameMode === 'ghetto') {
                          resetGhettoGame();
                        } else {
                          useGameStore.setState({ gameState: 'menu', isPaused: false });
                        }
                      }}
                      className="w-full py-4 px-6 flex items-center justify-center gap-3"
                      style={MBTN_S}>
                      <LogOut size={13} /> ESCI AL MENU
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── LEVEL COMPLETE ── */}
            {gameState === 'levelcomplete' && (
              <motion.div key="levelcomplete"
                initial={{ scale: 0.3 * uiScale, opacity: 0, y: -30 }}
                animate={{ scale: 1 * uiScale, opacity: 1, y: 0 }}
                exit={{ scale: 1.4 * uiScale, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="p-8 text-center pointer-events-none max-w-sm w-full relative overflow-hidden z-10"
                style={PANEL}>
                <motion.div animate={{ opacity: [0.04, 0.14, 0.04] }} transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(255,238,0,0.18), transparent 70%)` }} />
                <motion.h1
                  animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 0.9 }}
                  style={{ ...PIXEL, fontSize: 'clamp(14px,3.5vw,26px)', ...GLOW_Y }} className="mb-3 relative z-10 uppercase">
                  LEVEL {parkourLevel} CLEAR!
                </motion.h1>
                <p style={{ ...PIXEL, fontSize: '9px', color: C.white, opacity: 0.7 }} className="relative z-10">
                  LOADING LEVEL {parkourLevel + 1}...
                </p>
              </motion.div>
            )}

            {/* ── VICTORY ── */}
            {gameState === 'victory' && (
              <motion.div key="victory"
                initial={{ scale: 0.5 * uiScale, opacity: 0, y: -50 }}
                animate={{ scale: 1 * uiScale, opacity: 1, y: 0 }}
                className="p-8 sm:p-10 text-center pointer-events-auto max-w-md w-full relative overflow-hidden z-10"
                style={PANEL}>
                <motion.div animate={{ opacity: [0.04, 0.1, 0.04] }} transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(255,238,0,0.15), transparent 70%)` }} />

                <motion.h1 animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  style={{ ...PIXEL, fontSize: 'clamp(18px,4vw,38px)', ...GLOW_Y }} className="mb-2 relative z-10 uppercase">
                  {gameMode === 'ghetto' ? 'GHETTO CLEARED!' : gameMode === 'parkour' ? 'HAI VINTO!' : t('victory')}
                </motion.h1>
                <p className="mb-5 relative z-10 inline-block px-4 py-2"
                  style={{ ...PIXEL, fontSize: '8px', color: C.white, background: 'rgba(255,255,255,0.05)', border: `2px solid rgba(255,255,255,0.15)`, borderRadius: '3px', lineHeight: '1.7' }}>
                  {gameMode === 'ghetto' ? `TUTTE ${ghettoMaxWave} LE WAVE COMPLETATE!` : gameMode === 'parkour' ? 'TUTTI I 15 LIVELLI COMPLETATI!' : t('winner_subtitle')}
                </p>

                <div className="my-4 relative z-10">
                  <Trophy size={48} className="mx-auto mb-3" style={{ color: C.yellow, filter: `drop-shadow(0 0 10px ${C.yellow})` }} />
                  {gameMode === 'ghetto' ? (
                    <>
                      <p style={{ ...PIXEL, fontSize: '8px', color: C.dim }} className="mb-2">NEMICI ELIMINATI</p>
                      <p style={{ ...PIXEL, fontSize: '48px', ...GLOW_Y }}>{ghettoScore}</p>
                    </>
                  ) : gameMode === 'parkour' ? (
                    <>
                      <p style={{ ...PIXEL, fontSize: '8px', color: C.dim }} className="mb-2">LIVELLI COMPLETATI</p>
                      <p style={{ ...PIXEL, fontSize: '48px', ...GLOW_Y }}>15</p>
                    </>
                  ) : (
                    <>
                      <p style={{ ...PIXEL, fontSize: '8px', color: C.dim }} className="mb-2">{t('rounds_survived')}</p>
                      <p style={{ ...PIXEL, fontSize: '48px', ...GLOW_Y }}>{roundsSurvived}</p>
                    </>
                  )}
                </div>

                {/* Coins earned */}
                {gameMode !== 'ghetto' && (
                  <div className="mb-4 flex items-center justify-center gap-2 relative z-10 px-3 py-2"
                    style={{ background: C.bg, border: `2px solid rgba(255,238,0,0.3)`, borderRadius: '3px' }}>
                    <Coins size={12} color={C.yellow} />
                    <span style={{ ...PIXEL, fontSize: '7px', color: C.yellow }}>
                      {gameMode === 'parkour'
                        ? `${sessionCoins} MONETE RACCOLTE`
                        : `${(roundsSurvived * 10) + 5 + sessionCoins} PB GUADAGNATI`}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-3 w-full relative z-10">
                  {/* Double PB hero button — classic only */}
                  {gameMode === 'classic' && (
                    <div className="relative w-full" style={{ padding: '8px 0 4px' }}>
                      <motion.div animate={{ opacity: [0.45, 1, 0.45] }} transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                        className="absolute pointer-events-none"
                        style={{ inset: '-6px -4px', background: `radial-gradient(ellipse at 50% 50%, #ffee0038 0%, transparent 68%)`, zIndex: 0 }} />
                      <motion.div animate={{ scale: [1, 1.25, 1], rotate: [-12, 12, -12] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ position: 'absolute', top: '0px', right: '6px', background: C.danger, color: '#fff', ...MF, fontSize: '8px', padding: '3px 6px', lineHeight: 1, border: `2px solid ${C.bg}`, boxShadow: `2px 2px 0 ${C.bg}`, borderRadius: '2px', zIndex: 10 }}>
                        2X
                      </motion.div>
                      {([[-18, -6, 0.9], [104, -8, 1.2], [-12, 48, 1.4]] as [number, number, number][]).map(([x, y, delay], i) => (
                        <motion.span key={i} animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], y: [0, -6, 0] }} transition={{ duration: 1.8, repeat: Infinity, delay, ease: 'easeInOut' }}
                          style={{ position: 'absolute', left: `${x}%`, top: `${y}px`, zIndex: 0, fontSize: '10px', pointerEvents: 'none' }}>★</motion.span>
                      ))}
                      <motion.button animate={{ y: [0, -3, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        whileHover={{ scale: 1.06, y: -4 }} whileTap={{ scale: 0.93, x: 5, y: 5 }}
                        onClick={() => { audio.playCoinSound(); useProfileStore.getState().addReward(roundsSurvived, true, sessionCoins); if (gameMode === 'classic') useProfileStore.getState().recordClassicWin(); confetti({ particleCount: 200, spread: 130, origin: { y: 0.6 } }); }}
                        className="w-full py-4 px-6 flex items-center justify-center gap-3 relative overflow-hidden"
                        style={{ ...MBTN_P, fontSize: '12px', boxShadow: `5px 5px 0 rgba(0,0,0,0.95), 0 0 18px #ffee0099`, position: 'relative', zIndex: 2 }}>
                        <motion.div animate={{ x: ['-130%', '130%'] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.2, ease: 'easeInOut' }}
                          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(105deg, transparent 28%, rgba(255,255,255,0.55) 50%, transparent 72%)', zIndex: 1 }} />
                        <span style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Coins size={15} color={C.bg} />{t('double_pb')}
                        </span>
                      </motion.button>
                    </div>
                  )}

                  <motion.button whileHover={{ scale: 1.04, x: -1, y: -1 }} whileTap={{ scale: 0.95, x: 2, y: 2 }}
                    onClick={() => gameMode === 'ghetto' ? startGhettoWithLoading() : gameMode === 'parkour' ? startParkourGame() : startGame()}
                    className="w-full py-4 px-5 flex items-center justify-center gap-3"
                    style={MBTN_P}>
                    <Play fill="currentColor" size={13} /> {gameMode === 'ghetto' ? 'RIGIOCA' : gameMode === 'parkour' ? 'RIGIOCA' : t('try_again')}
                  </motion.button>

                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                    onClick={() => useGameStore.setState({ gameState: 'menu', isPaused: false })}
                    className="w-full py-3 px-5 flex items-center justify-center gap-3"
                    style={MBTN_S}>
                    <LogOut size={12} /> MENU
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* ── ELIMINATION FLASH ── */}
            {gameState === 'elimination' && (
              <motion.div key="cleared"
                initial={{ scale: 0.5 * uiScale, opacity: 0, y: 50 }}
                animate={{ scale: 1 * uiScale, opacity: 1, y: 0 }}
                exit={{ scale: 1.5 * uiScale, opacity: 0 }}
                style={{ ...PIXEL, fontSize: 'clamp(26px,5.5vw,60px)', ...GLOW_Y }}>
                {t('safe')}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Notifications ── */}
        <div className="fixed bottom-6 left-6 z-[200] flex flex-col gap-2 pointer-events-none max-w-xs w-full">
          <AnimatePresence>
            {notifications.map(notif => (
              <motion.div key={notif.id}
                initial={{ x: -80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }}
                className="p-3 flex items-center gap-3 pointer-events-auto"
                style={{ background: C.panel, border: `2px solid ${C.yellow}`, boxShadow: `3px 3px 0 rgba(0,0,0,0.5)`, borderRadius: '3px' }}>
                <div className="p-2 shrink-0"
                  style={{ background: 'rgba(255,238,0,0.15)', border: `2px solid ${C.yellow}`, borderRadius: '2px' }}>
                  <Star size={13} fill={C.yellow} color={C.yellow} />
                </div>
                <p style={{ ...PIXEL, fontSize: '7px', color: C.white, lineHeight: '1.7' }} className="flex-1 uppercase">{notif.message}</p>
                <button onClick={() => useProfileStore.getState().dismissNotification(notif.id)}>
                  <X size={14} color={C.yellow} strokeWidth={3} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
