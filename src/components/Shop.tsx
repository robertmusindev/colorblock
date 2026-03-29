import React, { useState, useEffect, Suspense, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { X, Coins } from 'lucide-react';
import { useProfileStore, SHOP_ITEMS } from '../store/profile';
import { useI18nStore } from '../store/i18n';
import { audio } from '../utils/audio';
import { PurchaseCelebration } from './PurchaseCelebration';
import { SkinAcquisitionHero } from './SkinAcquisitionHero';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { SkinPreview } from './SkinPreview';
import { HatPreview } from './HatPreview';

// ─── Rarity config ────────────────────────────────────────────────────────────
type Tier = 'Basic' | 'Rare' | 'Epic' | 'Legendary';

const RC: Record<Tier, {
  grad: string; glow: string; shadow: string;
  iconBg: string; badge: string; stars: number;
}> = {
  Basic: {
    grad:   'linear-gradient(160deg,#64748b 0%,#334155 55%,#1e293b 100%)',
    glow:   '#94a3b8',
    shadow: '#0f172a',
    iconBg: 'linear-gradient(135deg,#475569,#1e293b)',
    badge:  'bg-slate-500',
    stars:  1,
  },
  Rare: {
    grad:   'linear-gradient(160deg,#38bdf8 0%,#2563eb 55%,#1e3a8a 100%)',
    glow:   '#60a5fa',
    shadow: '#1e3a8a',
    iconBg: 'linear-gradient(135deg,#38bdf8,#1d4ed8)',
    badge:  'bg-blue-500',
    stars:  2,
  },
  Epic: {
    grad:   'linear-gradient(160deg,#c084fc 0%,#7c3aed 55%,#3b0764 100%)',
    glow:   '#c084fc',
    shadow: '#3b0764',
    iconBg: 'linear-gradient(135deg,#a855f7,#4c1d95)',
    badge:  'bg-purple-500',
    stars:  3,
  },
  Legendary: {
    grad:   'linear-gradient(160deg,#fcd34d 0%,#f59e0b 45%,#b45309 100%)',
    glow:   '#fcd34d',
    shadow: '#78350f',
    iconBg: 'linear-gradient(135deg,#fbbf24,#d97706)',
    badge:  'bg-amber-500',
    stars:  4,
  },
};

// ─── PB Bundles data ──────────────────────────────────────────────────────────
const PB_BUNDLES = [
  { id: 'b1', name: 'Handful of Blocks', pbAmount: 1000,   priceUsd: 0.99,  valueProp: 'Perfect for a quick skin!', image: import.meta.env.BASE_URL + 'bundles/bundle_handful.png' },
  { id: 'b2', name: 'Block Pouch',        pbAmount: 3500,   priceUsd: 2.99,  valueProp: '+15% Extra Value',         image: import.meta.env.BASE_URL + 'bundles/bundle_pouch.png'   },
  { id: 'b3', name: 'Party Chest',        pbAmount: 8500,   priceUsd: 4.99,  valueProp: 'MOST POPULAR',             image: import.meta.env.BASE_URL + 'bundles/bundle_chest.png'   },
  { id: 'b4', name: 'Hoard of Blocks',    pbAmount: 20000,  priceUsd: 9.99,  valueProp: 'BEST VALUE',               image: import.meta.env.BASE_URL + 'bundles/bundle_hoard.png'   },
  { id: 'b5', name: "Founder's Vault",    pbAmount: 50000,  priceUsd: 19.99, valueProp: 'Ultimate Collection',      image: import.meta.env.BASE_URL + 'bundles/bundle_vault.png'   },
  { id: 'b6', name: 'Whale Stash',        pbAmount: 125000, priceUsd: 49.99, valueProp: 'MAXIMUM PRESTIGE',         image: import.meta.env.BASE_URL + 'bundles/bundle_vault.png'   },
];

// ─── Category meta ────────────────────────────────────────────────────────────
const CAT_META = {
  skins:  { label: 'Skins Personaggio',   icon: '👕' },
  hats:   { label: 'Cappelli & Accessori', icon: '🎩' },
  trails: { label: 'Scie di Movimento',   icon: '💨' },
  emotes: { label: 'Emote & Danze',       icon: '🕺' },
} as const;

// ─── Item Card ────────────────────────────────────────────────────────────────
interface ItemCardProps {
  item: typeof SHOP_ITEMS[0];
  isOwned: boolean;
  canAfford: boolean;
  isEquipped: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onBuy: () => Promise<void>;
  onEquip: () => Promise<void>;
}

// Legendary floating particles
const LEG_PARTICLES = [
  { l: '8%',  dur: 3.2, delay: 0 },
  { l: '22%', dur: 2.7, delay: 0.6 },
  { l: '40%', dur: 3.6, delay: 1.2 },
  { l: '58%', dur: 2.9, delay: 0.3 },
  { l: '74%', dur: 3.4, delay: 1.8 },
  { l: '88%', dur: 2.5, delay: 0.9 },
];

function ItemCard({ item, isOwned, canAfford, isEquipped, isSelected, onSelect, onBuy, onEquip }: ItemCardProps) {
  const tier = (item.tier ?? 'Basic') as Tier;
  const rc = RC[tier] ?? RC.Basic;
  const stars = '★'.repeat(rc.stars);
  const canEquipWithoutBuy = isOwned && !isEquipped && (item.category === 'skins' || item.category === 'hats');
  const isSkin = item.category === 'skins';
  const isHat  = item.category === 'hats';
  const isLeg = tier === 'Legendary';

  // ── Tilt on mouse ──
  const cardRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotX = useSpring(useTransform(my, [-70, 70], [7, -7]), { stiffness: 320, damping: 26 });
  const rotY = useSpring(useTransform(mx, [-70, 70], [-7, 7]),  { stiffness: 320, damping: 26 });

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    mx.set(e.clientX - (r.left + r.width / 2));
    my.set(e.clientY - (r.top  + r.height / 2));
  };
  const onMouseLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={cardRef}
      className="relative cursor-pointer group"
      style={{ paddingTop: (isSkin || isHat) ? 0 : '1.75rem', rotateX: rotX, rotateY: rotY, transformPerspective: 700 }}
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      onClick={onSelect}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Rarity glow halo — behind the card */}
      <motion.div
        className="absolute inset-[-3px] rounded-[1.6rem] pointer-events-none -z-10"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        style={{ boxShadow: `0 0 32px 6px ${rc.glow}60` }}
      />

      {/* Pop-out icon bubble — trails/emotes only */}
      {!isSkin && !isHat && (
        <div className="absolute top-0 inset-x-0 flex justify-center z-20 pointer-events-none">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center border-[3px] border-white/50"
            style={{ background: rc.iconBg, boxShadow: `0 0 16px ${rc.glow}aa, 0 4px 0 rgba(0,0,0,0.45)` }}
          >
            <span className="text-2xl leading-none select-none">{item.icon}</span>
          </div>
        </div>
      )}

      {/* ── Card body ── */}
      <div
        className="rounded-[1.4rem] overflow-hidden relative"
        style={{
          background: rc.grad,
          border: `4px solid ${isSelected ? '#ffffff' : rc.glow + '55'}`,
          boxShadow: `0 8px 0 ${rc.shadow}, inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.25)`,
        }}
      >
        {/* Top metallic highlight line */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none z-10" />

        {/* Legendary particles */}
        {isLeg && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {LEG_PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="absolute bottom-0 rounded-full"
                style={{ left: p.l, width: 2 + (i % 3), height: 2 + (i % 3), background: i % 2 ? '#fef08a' : '#fcd34d' }}
                animate={{ y: [0, -(100 + i * 8)], opacity: [0, 0.95, 0], scale: [0.4, 1.4, 0.4] }}
                transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeOut' }}
              />
            ))}
            {/* Rotating soft light */}
            <motion.div
              className="absolute -inset-4 pointer-events-none"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(252,211,77,0.18) 85%, transparent 100%)' }}
            />
          </div>
        )}

        {/* 3D skin/hat canvas */}
        {isSkin ? (
          <div className="relative h-32 w-full bg-black/30 z-10">
            <Canvas camera={{ position: [0, 1.2, 3.5], fov: 35 }} gl={{ antialias: false, powerPreference: 'low-power' }}>
              <ambientLight intensity={1.6} />
              <directionalLight position={[2, 4, 2]} intensity={1.8} />
              <Suspense fallback={null}><SkinPreview skinId={item.id} /></Suspense>
            </Canvas>
            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
          </div>
        ) : isHat ? (
          <div className="relative h-32 w-full bg-black/30 z-10">
            <Canvas camera={{ position: [0, 1.2, 3.5], fov: 35 }} gl={{ antialias: false, powerPreference: 'low-power' }}>
              <ambientLight intensity={1.6} />
              <directionalLight position={[2, 4, 2]} intensity={1.8} />
              <Suspense fallback={null}><HatPreview hatId={item.id} /></Suspense>
            </Canvas>
            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
          </div>
        ) : (
          <>
            <div className="h-9" />
            <div className="mx-2.5 mb-2 rounded-xl bg-black/25 h-[4.5rem] flex items-center justify-center relative overflow-hidden z-10">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/18 to-transparent"
                initial={{ x: '-120%' }}
                whileHover={{ x: '120%' }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
              <span className="text-[2.6rem] leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.6)] select-none group-hover:scale-110 transition-transform duration-200">
                {item.icon}
              </span>
            </div>
          </>
        )}

        {/* Tier badge */}
        <div className="px-2.5 mt-1 mb-0.5 flex items-center justify-between relative z-10">
          <span className="text-[9px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {stars} {item.tier}
          </span>
          {isOwned && <span className="text-[8px] font-black text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">✓</span>}
        </div>

        {/* Name + description */}
        <div className="px-2.5 pb-2.5 relative z-10">
          <h4 className="font-black text-white text-[11px] sm:text-xs uppercase leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] mb-0.5 truncate">
            {item.name}
          </h4>
          <p className="text-white/70 text-[8px] sm:text-[9px] font-bold leading-tight mb-2.5 line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
            {item.description}
          </p>

          {/* ── Action button ── */}
          {isOwned ? (
            <motion.button
              onClick={async (e) => { e.stopPropagation(); if (canEquipWithoutBuy) await onEquip(); }}
              disabled={isEquipped}
              className="w-full py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wide relative overflow-hidden"
              style={{
                background: isEquipped
                  ? 'linear-gradient(180deg,#4ade80 0%,#16a34a 100%)'
                  : 'linear-gradient(180deg,#ffffff 0%,#e2e8f0 100%)',
                color:     isEquipped ? '#fff'     : '#1e293b',
                boxShadow: isEquipped ? '0 5px 0 #14532d' : '0 5px 0 rgba(0,0,0,0.45)',
                cursor:    isEquipped ? 'default'  : 'pointer',
              }}
              whileTap={!isEquipped ? { y: 4, boxShadow: '0 1px 0 rgba(0,0,0,0.35)' } as any : {}}
              whileHover={!isEquipped ? { filter: 'brightness(1.09)' } : {}}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              {isEquipped ? (
                <>
                  {/* Periodic shimmer */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-transparent pointer-events-none"
                    animate={{ x: ['-150%', '150%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                  />
                  <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">✓ In uso</span>
                </>
              ) : (
                canEquipWithoutBuy ? 'Equipaggia' : 'Sbloccato'
              )}
            </motion.button>
          ) : (
            <motion.button
              disabled={!canAfford}
              onClick={async (e) => { e.stopPropagation(); await onBuy(); }}
              className="w-full py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wide flex items-center justify-center gap-1 relative overflow-hidden"
              style={{
                background: canAfford ? 'linear-gradient(180deg,#ffffff 0%,#e2e8f0 100%)' : 'rgba(255,255,255,0.15)',
                color:     canAfford ? '#1e293b' : 'rgba(255,255,255,0.3)',
                boxShadow: canAfford ? '0 5px 0 rgba(0,0,0,0.45)' : 'none',
                cursor:    canAfford ? 'pointer' : 'not-allowed',
              }}
              whileTap={canAfford ? { y: 4, boxShadow: '0 1px 0 rgba(0,0,0,0.35)' } as any : {}}
              whileHover={canAfford ? { filter: 'brightness(1.09)' } : {}}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              {item.price === 0
                ? <span>🎁 Gratis</span>
                : <><Coins size={10} className="shrink-0" />{item.price.toLocaleString()}</>
              }
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface ShopProps { isOpen: boolean; onClose: () => void; }

export const Shop = ({ isOpen, onClose }: ShopProps) => {
  const { profile, purchaseItem, addReward, equipSkin, equipHat } = useProfileStore();
  const { t } = useI18nStore();

  useEffect(() => {
    (window as any).SHOP_DEBUG = SHOP_ITEMS;
  }, []);

  const [celebration, setCelebration] = useState({ isOpen: false, bundleName: '', amount: 0, image: '' });
  const [heroSkin, setHeroSkin]       = useState({ isOpen: false, skinId: '' });
  const [selectedSkinId, setSelectedSkinId] = useState<string | null>(null);

  const getUiScale = () => {
    if (typeof window === 'undefined') return 1;
    if (window.innerWidth < 640) return 0.85;
    if (window.innerWidth > 1400 || window.innerHeight > 850) {
      return Math.max(1, Math.min((window.innerWidth * 0.98) / 1400, (window.innerHeight * 0.90) / 850));
    }
    return 1;
  };
  const [uiScale, setUiScale] = useState(getUiScale);
  useEffect(() => {
    const fn = () => setUiScale(getUiScale());
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  if (!profile) return null;

  const handleBuy = async (item: typeof SHOP_ITEMS[0]) => {
    const success = await purchaseItem(item.id, item.price);
    if (!success) return;
    audio.playCoinSound?.();
    if (item.id === 'skin_special_israel' || item.id === 'skin_robsbagliato') {
      setHeroSkin({ isOpen: true, skinId: item.id });
    }
    if (item.category === 'skins') await equipSkin(item.id);
    if (item.category === 'hats') await equipHat(item.id);
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ backdropFilter: 'blur(8px)' }}
              onClick={onClose}
              className="fixed inset-0 bg-sky-950/50 z-[120] pointer-events-auto"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 * uiScale, y: 50 }}
              animate={{ opacity: 1, scale: uiScale, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 * uiScale, y: 50 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="fixed inset-0 flex items-center justify-center z-[130] p-1 sm:p-2 md:p-6 pointer-events-none"
            >
              <div className="bg-[#0f172a] rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] w-[99vw] sm:w-[98vw] max-w-[1400px] h-[95vh] sm:h-[92vh] md:h-[90vh] max-h-[850px] border-[4px] sm:border-[6px] md:border-[10px] border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.4),0_20px_0_#78350f] pointer-events-auto relative flex flex-col overflow-hidden">

                {/* BG texture overlay */}
                <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle,#fff_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                {/* Close btn */}
                <motion.button
                  whileHover={{ scale: 1.15, rotate: 90 }} whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="absolute top-2 right-2 sm:top-4 sm:right-4 md:top-6 md:right-6 text-white bg-rose-500 hover:bg-rose-400 p-2 sm:p-3 rounded-full z-50 shadow-[0_4px_0_#9f1239] border-2 border-rose-300"
                >
                  <X size={20} className="stroke-[4px]" />
                </motion.button>

                <div className="flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto relative z-0" style={{ scrollbarWidth: 'none' }}>

                  {/* ── Header ── */}
                  <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-4 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2rem] text-white mb-5 sm:mb-7 shadow-[0_6px_0_#b45309] relative overflow-hidden border-2 border-amber-300">
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                    <div className="absolute -right-10 -top-10 w-64 h-64 bg-yellow-300/30 rounded-full blur-3xl" />
                    <div className="relative z-10 text-center">
                      <p className="font-display font-black text-3xl sm:text-4xl md:text-6xl text-white uppercase drop-shadow-[0_4px_0_#9a3412] mb-1">
                        {t('shop') || 'NEGOZIO PB'}
                      </p>
                      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-100">
                        Ottieni blocchi e personalizza il tuo stile!
                      </p>
                    </div>
                    <div className="absolute bottom-3 right-5 bg-black/25 backdrop-blur-sm px-4 py-2 rounded-2xl border border-white/30 flex items-center gap-2">
                      <Coins size={16} className="text-amber-200" />
                      <span className="font-black text-xl text-white">{profile.coins.toLocaleString()} PB</span>
                    </div>
                  </div>

                  {/* ── 3D preview overlay (skins only, xl screens) ── */}
                  <AnimatePresence>
                    {selectedSkinId && (
                      <motion.div
                        initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}
                        className="fixed right-10 top-1/2 -translate-y-1/2 w-80 h-96 bg-[#0f172a]/90 backdrop-blur-xl rounded-[3rem] border-[5px] border-amber-400 shadow-2xl z-50 overflow-hidden hidden xl:block"
                      >
                        <div className="absolute top-4 left-0 right-0 text-center z-10">
                          <h4 className="font-black text-white uppercase tracking-widest text-sm">Preview 3D</h4>
                          <p className="text-[10px] font-bold text-white/40">Trascina per ruotare</p>
                        </div>
                        <button onClick={() => setSelectedSkinId(null)} className="absolute top-4 right-4 text-white/40 hover:text-rose-400 z-20">
                          <X size={20} />
                        </button>
                        <div className="w-full h-full">
                          <Canvas shadows camera={{ position: [0, 1.5, 4], fov: 40 }}>
                            <ambientLight intensity={0.8} />
                            <pointLight position={[10, 10, 10]} intensity={1.5} />
                            <Environment preset="city" />
                            <Suspense fallback={null}><SkinPreview skinId={selectedSkinId} /></Suspense>
                            <OrbitControls enableZoom={false} enablePan={false} />
                          </Canvas>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── PB Bundles ── */}
                  <div className="mb-7">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xl">💎</span>
                      <h3 className="font-black text-white text-lg sm:text-xl uppercase tracking-wider">
                        Acquista Party Blocks
                      </h3>
                      <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                      {PB_BUNDLES.map((bundle, idx) => (
                        <motion.div
                          key={bundle.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04, type: 'spring', stiffness: 400, damping: 25 }}
                          className="bg-white/5 border-2 border-white/10 hover:border-amber-400/60 rounded-2xl p-3 sm:p-4 flex flex-col transition-all hover:-translate-y-1 relative overflow-hidden group"
                        >
                          {bundle.valueProp.includes('POPULAR') && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-rose-600 text-white px-3 py-1 font-black text-[8px] uppercase tracking-widest rounded-bl-2xl z-10">Più Popolare</div>
                          )}
                          {bundle.valueProp.includes('VALUE') && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-blue-600 text-white px-3 py-1 font-black text-[8px] uppercase tracking-widest rounded-bl-2xl z-10">Miglior Valore</div>
                          )}
                          {bundle.valueProp.includes('PRESTIGE') && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white px-3 py-1 font-black text-[8px] uppercase tracking-widest rounded-bl-2xl z-10">Ultra Prestige</div>
                          )}
                          <div className="h-24 sm:h-32 rounded-xl mb-2 overflow-hidden border border-white/10 flex items-center justify-center bg-white/5 relative">
                            <motion.img
                              whileHover={{ scale: 1.12 }} transition={{ duration: 0.4 }}
                              src={bundle.image} alt={bundle.name} className="w-full h-full object-cover"
                            />
                          </div>
                          <h4 className="font-black text-white text-sm sm:text-base leading-tight mb-1 text-center">{bundle.name}</h4>
                          <div className="text-center mb-3 mt-auto">
                            <span className="font-black text-amber-400 text-lg sm:text-2xl flex items-center justify-center gap-1">
                              <Coins size={18} className="fill-amber-400" /> {bundle.pbAmount.toLocaleString()}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              addReward(0, false, bundle.pbAmount);
                              setTimeout(() => setCelebration({ isOpen: true, bundleName: bundle.name, amount: bundle.pbAmount, image: bundle.image }), 800);
                            }}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 text-white py-2 rounded-xl font-black text-xs sm:text-sm uppercase shadow-[0_4px_0_#065f46] active:shadow-none active:translate-y-1 transition-all border-2 border-emerald-400"
                          >
                            {bundle.priceUsd} $
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* ── Shop Items ── */}
                  <div className="space-y-7 pb-6">
                    {(['skins', 'hats', 'trails', 'emotes'] as const).map(category => {
                      const filtered = SHOP_ITEMS.filter(item => item.category === category);
                      if (filtered.length === 0) return null;
                      const meta = CAT_META[category];

                      return (
                        <div key={category}>
                          {/* Section header */}
                          <div className="flex items-center gap-3 mb-4">
                            <span className="text-xl">{meta.icon}</span>
                            <h3 className="font-black text-white text-base sm:text-lg uppercase tracking-wider">
                              {meta.label}
                            </h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent" />
                          </div>

                          {/* Cards grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {filtered.map((item, idx) => {
                              const catArr = profile.inventory?.[category] as string[] | undefined;
                              const isOwned   = !!(catArr?.includes(item.id) || profile.unlocked_items?.includes(item.id));
                              const canAfford = profile.coins >= item.price;
                              const isEquipped =
                                (item.category === 'skins' && profile.equipped_skin === item.id) ||
                                (item.category === 'hats'  && profile.equipped_hat  === item.id);

                              return (
                                <motion.div
                                  key={item.id}
                                  initial={{ opacity: 0, y: 24 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05, type: 'spring', stiffness: 350, damping: 22 }}
                                >
                                  <ItemCard
                                    item={item}
                                    isOwned={isOwned}
                                    canAfford={canAfford}
                                    isEquipped={isEquipped}
                                    isSelected={selectedSkinId === item.id}
                                    onSelect={() => item.category === 'skins' ? setSelectedSkinId(prev => prev === item.id ? null : item.id) : undefined}
                                    onBuy={() => handleBuy(item)}
                                    onEquip={async () => {
                                      if (item.category === 'skins') await equipSkin(item.id);
                                      if (item.category === 'hats')  await equipHat(item.id);
                                    }}
                                  />
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-center text-[10px] text-white/20 font-black uppercase mt-6 tracking-widest">
                    ─── Altri oggetti in arrivo ───
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PurchaseCelebration
        isOpen={celebration.isOpen}
        onClose={() => setCelebration(p => ({ ...p, isOpen: false }))}
        bundleName={celebration.bundleName}
        amount={celebration.amount}
        image={celebration.image}
      />
      <SkinAcquisitionHero
        isOpen={heroSkin.isOpen}
        onClose={() => setHeroSkin(p => ({ ...p, isOpen: false }))}
        skinId={heroSkin.skinId}
      />
    </>
  );
};
