import React, { useEffect, useState, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { audio } from '../utils/audio';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Coins, TrendingUp, Trophy, Star, Edit2, Check, X, Loader2 } from 'lucide-react';
import { useProfileStore, SHOP_ITEMS } from '../store/profile';
import { useGameStore } from '../store';
import { useI18nStore } from '../store/i18n';
interface UserProfileProps {
  user: SupabaseUser;
}

export const UserProfile = ({ user }: UserProfileProps) => {
  const { profile, isLoading, fetchProfile, subscribeToRealtime, updateUsername, updateAvatar, purchaseItem, addReward, equipSkin } = useProfileStore();
  const { t } = useI18nStore();
  const gameState = useGameStore(state => state.gameState);
  
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState<'stats' | 'inventory'>('stats');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inizializza il fetch e il realtime
  useEffect(() => {
    if (user) {
      fetchProfile();
      const unsubscribe = subscribeToRealtime();
      return () => unsubscribe();
    }
  }, [user]);

  // Aggiorna il nome temporaneo quando si apre l'editor
  useEffect(() => {
    if (isEditing && profile?.username) {
      setEditName(profile.username);
    }
  }, [isEditing, profile]);

  const handleSaveName = async () => {
    if (profile && editName.trim() && editName !== profile.username) {
      const success = await updateUsername(editName.trim());
      if (success) {
        setIsEditing(false);
      } else {
        // Here you might want to show a toast or error message
        alert(t('error_updating_name') || "Errore durante l'aggiornamento del nome");
      }
    } else {
      setIsEditing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("L'immagine deve essere inferiore a 2MB");
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Puoi caricare solo immagini');
        return;
      }
      await updateAvatar(file);
      setImgError(false); // Reset error state on new upload
    }
  };

  // Calculate experience to next level (simplified demo formula: level * 100)
  const calcExperienceTarget = (level: number) => level * 100;
  
  // Safe calculations with defaults
  const currentExp = profile ? ((profile.total_games_played || 0) * 10) % calcExperienceTarget(profile.level || 1) : 0;
  const expTarget = profile ? calcExperienceTarget(profile.level || 1) : 100;
  const expProgress = profile ? Math.min((currentExp / expTarget) * 100, 100) : 0;

  // Responsive Scaling Logic - supports both scale up (2K/4K) and scale down (mobile)
  const getUiScale = () => {
    if (typeof window === 'undefined') return 1;
    // Scale DOWN for small screens
    if (window.innerWidth < 640) return 0.85;
    // Scale UP for large screens
    if (window.innerWidth > 1400 || window.innerHeight > 850) {
      const scaleW = (window.innerWidth * 0.98) / 1400;
      const scaleH = (window.innerHeight * 0.90) / 850;
      return Math.max(1, Math.min(scaleW, scaleH));
    }
    return 1;
  };

  const [uiScale, setUiScale] = useState(getUiScale());

  useEffect(() => {
    const handleResize = () => setUiScale(getUiScale());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {/* Profilo Icon - Top Right */}
      <AnimatePresence>
        {gameState === 'menu' && (
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute top-14 right-2 sm:top-16 sm:right-4 md:top-24 md:right-8 z-[100] pointer-events-auto"
          >
            <motion.button
              animate={{ 
                 scale: [1, 1.05, 1],
                 textShadow: ["0px 0px 0px rgba(0,0,0,0)", "0px 0px 10px rgba(99,102,241,0.5)", "0px 0px 0px rgba(0,0,0,0)"]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="relative group block"
            >
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-2 rounded-full bg-gradient-to-tr from-indigo-500 via-pink-500 to-amber-500 opacity-70 blur-md pointer-events-none group-hover:opacity-100 transition-opacity" 
              />
              
              {/* Avatar Container */}
              <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full border-[4px] sm:border-[6px] border-slate-900 bg-indigo-100 shadow-[2px_4px_0_#1e1b4b] sm:shadow-[2px_6px_0_#1e1b4b] overflow-hidden flex items-center justify-center relative z-10 bg-white">
                {isLoading ? (
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                ) : profile?.avatar_url && !imgError ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile Avatar" 
                    className="w-full h-full object-cover"
                    onError={() => setImgError(true)}
                    loading="lazy"
                  />
                ) : (
                  <User size={40} className="text-indigo-400" />
                )}
                
                {/* Hover overlay hint */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <TrendingUp size={24} className="text-white" />
                </div>
              </div>
              
              {/* "PROFILE" pulse tag */}
              <div className="absolute -bottom-1 bg-indigo-500 text-white text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2.5 py-0.5 rounded-full border-2 border-slate-900 z-20 shadow-md">
                PROFILE
              </div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Panel Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-sky-950/40 z-50 pointer-events-auto"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 * uiScale, y: 50, rotateX: 20 }}
              animate={{ opacity: 1, scale: uiScale, y: 0, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.8 * uiScale, y: 50, rotateX: 20 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              style={{ perspective: "1000px" }}
              className="fixed inset-0 flex items-center justify-center z-[110] p-1 sm:p-2 md:p-6 pointer-events-none"
            >
              {profile ? (
                <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[3rem] w-[99vw] sm:w-[98vw] max-w-[1400px] h-[95vh] sm:h-[92vh] md:h-[90vh] max-h-[850px] border-[4px] sm:border-[6px] md:border-[10px] border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3),_0_10px_0_#d97706] sm:shadow-[0_0_40px_rgba(251,191,36,0.5),_0_20px_0_#d97706] pointer-events-auto relative flex flex-col md:flex-row overflow-hidden ring-2 sm:ring-4 ring-white">
                
                {/* Decorative Inner Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-100/50 via-transparent to-rose-100/50 pointer-events-none" />

                {/* Close Button */}
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="absolute top-2 right-2 sm:top-4 sm:right-4 md:top-6 md:right-6 text-white bg-rose-500 hover:bg-rose-400 p-2 sm:p-3 rounded-full z-50 shadow-[0_4px_0_#9f1239] sm:shadow-[0_6px_0_#9f1239] border-2 sm:border-4 border-rose-300"
                >
                  <X size={20} className="stroke-[4px] sm:w-7 sm:h-7" />
                </motion.button>

                {/* Sidebar (Left) */}
                <div className="w-full md:w-72 lg:w-80 xl:w-96 bg-sky-50 border-b-4 sm:border-b-8 md:border-b-0 md:border-r-[4px] lg:border-r-[6px] border-sky-200 p-3 sm:p-4 md:p-6 flex flex-col items-center relative overflow-y-auto z-10" style={{ scrollbarWidth: 'none' }}>
                  <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-sky-300/20 to-transparent pointer-events-none" />
                  
                  <h2 className="font-display font-black tracking-widest text-sky-500 text-lg uppercase text-center mb-6 shrink-0 drop-shadow-[0_2px_0_rgba(255,255,255,1)]">
                    {t('player_profile') || 'Player Profile'}
                  </h2>                  {/* Avatar Section */}
                  <div className="flex flex-col items-center mb-8 shrink-0 w-full relative z-10">
                    <motion.div 
                      whileHover={{ scale: 1.05, rotate: -2 }}
                      className="relative mb-4 group shrink-0 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isLoading && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-[2rem] z-10 flex items-center justify-center">
                          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                        </div>
                      )}
                      
                      {/* Chunky Squircle Avatar */}
                      <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 lg:w-40 lg:h-40 rounded-[1.5rem] sm:rounded-[2rem] border-[4px] sm:border-[6px] border-amber-400 bg-amber-50 overflow-hidden flex items-center justify-center relative shadow-[0_4px_0_#d97706] sm:shadow-[0_8px_0_#d97706] transform transition-transform">
                        {profile?.avatar_url && !imgError ? (
                          <img 
                            src={profile.avatar_url} 
                            alt="Avatar" 
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                          />
                        ) : (
                          <User size={64} className="text-amber-300" />
                        )}
                        <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Edit2 size={32} className="text-amber-600 drop-shadow-md" />
                        </div>
                      </div>

                      {/* Over-the-top Level Badge */}
                      <div className="absolute -bottom-3 sm:-bottom-4 right-[-8px] sm:right-[-10px] bg-gradient-to-br from-yellow-300 to-amber-500 border-[3px] sm:border-[4px] border-white text-amber-900 font-black px-2 sm:px-4 py-1 sm:py-2 rounded-xl sm:rounded-2xl shadow-[0_3px_0_#b45309] sm:shadow-[0_4px_0_#b45309] transform rotate-6 hover:rotate-12 transition-transform">
                        <span className="text-xs uppercase block leading-none opacity-80">LEVEL</span>
                        <span className="text-xl leading-none">{profile.level}</span>
                      </div>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </motion.div>

                    <div className="flex items-center justify-center gap-2 w-full mt-4">
                      {isEditing ? (
                        <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 w-full border-4 border-amber-400 shadow-[0_4px_0_#d97706]">
                          <input
                            autoFocus
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            className="w-full bg-transparent font-black text-2xl text-center text-slate-800 outline-none px-2 min-w-0 placeholder-slate-400"
                             placeholder={t('your_name_placeholder') || 'Tuo Nome...'}
                          />
                          <button onClick={handleSaveName} className="text-white bg-emerald-500 p-2.5 rounded-xl border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 shrink-0"><Check size={24} strokeWidth={4} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 justify-center group cursor-pointer w-full px-2" onClick={() => setIsEditing(true)}>
                          <h3 className="font-black text-xl sm:text-2xl md:text-3xl lg:text-4xl text-slate-800 truncate text-center drop-shadow-[0_2px_0_rgba(255,255,255,1)] tracking-wide">{profile.username}</h3>
                          <div className="bg-white p-2 rounded-xl border-2 border-slate-200 group-hover:border-amber-400 group-hover:bg-amber-50 transition-all shrink-0 shadow-sm">
                            <Edit2 size={18} className="text-amber-500 stroke-[3px]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coins Balance in Sidebar - Huge and Shiny */}
                  <div className="w-full bg-gradient-to-br from-amber-400 to-orange-500 p-1 sm:p-1.5 rounded-2xl sm:rounded-3xl mb-4 sm:mb-6 md:mb-8 shrink-0 shadow-[0_4px_0_#9a3412] sm:shadow-[0_8px_0_#9a3412] transform hover:scale-105 transition-transform rotate-1">
                    <div className="bg-amber-100/20 w-full h-full rounded-[1.25rem] p-4 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-sm border-2 border-white/40">
                      {/* Shine effect */}
                      <div className="absolute top-0 right-0 w-32 h-64 bg-white/30 -rotate-45 translate-x-12 -translate-y-12 pointer-events-none" />
                      
                      <div className="flex items-center gap-2 mb-1 z-10">
                        <Coins size={24} className="text-amber-100 drop-shadow-md" />
                        <span className="font-black text-amber-900 text-sm uppercase tracking-widest drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">IL TUO SALDO PB</span>
                      </div>
                      <span className="font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white drop-shadow-[0_4px_4px_rgba(180,83,9,0.5)] z-10 tracking-tight">
                        {profile.coins.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Tabs - Big Squishy Buttons */}
                  <div className="flex flex-col w-full gap-4 mt-auto">
                    <button 
                      onClick={() => setActiveTab('stats')}
                      className={`w-full py-3 sm:py-4 md:py-5 rounded-2xl sm:rounded-3xl font-black text-sm sm:text-base md:text-lg uppercase transition-all flex items-center justify-center gap-2 sm:gap-3 border-[3px] sm:border-[4px] shadow-sm transform ${
                        activeTab === 'stats' 
                        ? 'bg-sky-400 text-white border-sky-300 shadow-[0_6px_0_#0284c7,inset_0_-4px_0_rgba(255,255,255,0.2)] translate-y-[2px]' 
                        : 'bg-white text-slate-500 border-slate-200 shadow-[0_6px_0_#cbd5e1] hover:bg-slate-50 hover:-translate-y-1'
                      }`}
                    >
                      <Trophy size={24} className={activeTab === 'stats' ? 'text-white' : 'text-slate-400'} /> {t('stats') || 'STATISTICHE'}
                    </button>
                    <button 
                      onClick={() => setActiveTab('inventory')}
                      className={`w-full py-3 sm:py-4 md:py-5 rounded-2xl sm:rounded-3xl font-black text-sm sm:text-base md:text-lg uppercase transition-all flex items-center justify-center gap-2 sm:gap-3 border-[3px] sm:border-[4px] shadow-sm transform ${
                        activeTab === 'inventory' 
                        ? 'bg-rose-400 text-white border-rose-300 shadow-[0_6px_0_#e11d48,inset_0_-4px_0_rgba(255,255,255,0.2)] translate-y-[2px]' 
                        : 'bg-white text-slate-500 border-slate-200 shadow-[0_6px_0_#cbd5e1] hover:bg-slate-50 hover:-translate-y-1'
                      }`}
                    >
                      <User size={24} className={activeTab === 'inventory' ? 'text-white' : 'text-slate-400'} /> {t('inventory') || 'INVENTARIO'}
                    </button>
                  </div>
                </div>

                {/* Main Content (Right) */}
                <div className="flex-1 p-3 sm:p-4 md:p-8 overflow-y-auto bg-slate-50 relative z-0" style={{ scrollbarWidth: 'none' }}>
                  <AnimatePresence mode="wait">
                    {activeTab === 'stats' && (
                      <motion.div
                        key="stats"
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -30 }}
                        transition={{ duration: 0.4, type: "spring", bounce: 0.4 }}
                        className="space-y-6"
                      >
                         {/* Header Hero */}
                         <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 sm:p-6 md:p-8 rounded-[1.5rem] sm:rounded-[2rem] text-white shadow-[0_4px_0_#4338ca] sm:shadow-[0_8px_0_#4338ca] relative overflow-hidden border-2 sm:border-4 border-indigo-400">
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                              className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 scale-[2]" 
                            />
                            <div className="relative z-10">
                              <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-wider sm:tracking-widest drop-shadow-[0_4px_0_#312e81]">RIEPILOGO PARTITE</h2>
                              <p className="text-indigo-100 font-bold uppercase tracking-widest text-sm mt-2">Le tue statistiche vitali su Color Block Party</p>
                            </div>
                            <Trophy size={160} className="absolute -right-10 -bottom-10 text-white opacity-20 transform -rotate-12" />
                         </div>

                         {/* 2x2 Grid stats */}
                         <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                            {/* LEVEL CARD */}
                            <motion.div 
                              whileHover={{ scale: 1.05, rotate: -1 }}
                              className="bg-white p-6 rounded-[2rem] border-[4px] border-slate-200 border-b-[8px] hover:border-amber-300 shadow-sm relative overflow-hidden group cursor-pointer transition-colors"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl -mr-10 -mt-10" />
                              <div className="flex justify-between text-base font-black text-slate-400 uppercase tracking-widest mb-4 relative z-10">
                                <span className="text-amber-500 drop-shadow-sm flex items-center gap-2"><Star size={20} className="fill-amber-400" /> {t('level')} {profile.level}</span>
                                <span className="text-slate-400">{t('next_level') || 'Prox'}: {profile.level + 1}</span>
                              </div>
                              <div className="h-8 bg-slate-100 rounded-full overflow-hidden border-4 border-slate-200 relative shadow-inner">
                                <motion.div 
                                  className="h-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 relative"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${expProgress}%` }}
                                  transition={{ duration: 1.5, ease: "easeOut", type: "spring", stiffness: 45 }}
                                >
                                  <div className="absolute top-0 left-0 right-0 h-1/3 bg-white/40 rounded-full" />
                                </motion.div>
                              </div>
                              <div className="text-right mt-3 text-sm text-slate-400 font-bold uppercase relative z-10">
                                {currentExp} / {expTarget} EXP
                              </div>
                            </motion.div>

                            {/* GAMES PLAYED CARD */}
                            <motion.div 
                               whileHover={{ scale: 1.05, rotate: 1 }} 
                               className="flex flex-col justify-center items-center p-6 rounded-[2rem] bg-indigo-50 border-[4px] border-indigo-200 border-b-[8px] border-b-indigo-300 shadow-sm relative overflow-hidden group cursor-pointer"
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-indigo-200/50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                              <TrendingUp size={36} className="text-indigo-400 mb-2 drop-shadow-sm group-hover:scale-125 transition-transform" />
                              <span className="font-bold text-indigo-400 text-xs uppercase tracking-widest text-center">{t('total_games')}</span>
                              <span className="font-black text-indigo-900 text-5xl mt-1 drop-shadow-sm">{profile.total_games_played}</span>
                            </motion.div>
                            
                            {/* HIGH SCORE CARD */}
                            <motion.div 
                               whileHover={{ scale: 1.05, rotate: -1 }} 
                               className="flex flex-col justify-center items-center p-6 rounded-[2rem] bg-rose-50 border-[4px] border-rose-200 border-b-[8px] border-b-rose-300 shadow-sm relative overflow-hidden group cursor-pointer"
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-rose-200/50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                              <Trophy size={36} className="text-rose-400 mb-2 drop-shadow-sm group-hover:scale-125 transition-transform" />
                              <span className="font-bold text-rose-400 text-xs uppercase tracking-widest text-center">{t('high_score')}</span>
                              <span className="font-black text-rose-900 text-5xl mt-1 relative flex items-center justify-center drop-shadow-sm">
                                {profile.high_score}
                                {profile.high_score > 0 && <Star size={28} className="text-yellow-400 absolute -top-4 -right-10 fill-yellow-400 drop-shadow-sm animate-[ping_2s_infinite]" />}
                              </span>
                            </motion.div>
                            
                            {/* COLLECTION CARD */}
                            <motion.div 
                               whileHover={{ scale: 1.05, rotate: 1 }} 
                               onClick={() => setActiveTab('inventory')}
                               className="flex flex-col justify-center items-center p-6 rounded-[2rem] bg-emerald-50 border-[4px] border-emerald-200 border-b-[8px] border-b-emerald-300 shadow-sm relative overflow-hidden group cursor-pointer"
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-emerald-200/50 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="flex gap-1 mb-2">
                                 <User size={30} className="text-emerald-400 drop-shadow-sm group-hover:-translate-y-2 transition-transform" />
                                 <Coins size={30} className="text-emerald-400 drop-shadow-sm group-hover:translate-y-2 transition-transform" />
                              </div>
                              <span className="font-bold text-emerald-500 text-xs uppercase tracking-widest text-center">Oggetti Sbloccati</span>
                              <span className="font-black text-emerald-900 text-5xl mt-1 drop-shadow-sm">
                                {(profile.unlocked_items?.length || 0) + (profile.inventory?.skins?.length || 0) + (profile.inventory?.trails?.length || 0) + (profile.inventory?.emotes?.length || 0)}
                              </span>
                            </motion.div>
                         </div>

                        {/* Missions List */}
                        <div className="pt-6 border-t-[4px] border-slate-200 mt-8">
                          <h4 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-3 drop-shadow-sm">
                            <Star size={32} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_2px_0_rgba(217,119,6,0.5)]" /> CAMPAGNA E MISSIONI
                          </h4>
                          <div className="space-y-4">
                            {profile.missions?.map((m, idx) => (
                              <motion.div 
                                key={m.id} 
                                initial={{ opacity: 0, x: -50 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.15, type: "spring", stiffness: 300, damping: 20 }}
                                whileHover={{ scale: 1.03 }}
                                className={`p-6 rounded-[2rem] border-[4px] border-b-[8px] transition-all relative overflow-hidden group ${
                                  m.isCompleted 
                                  ? 'bg-emerald-50 border-emerald-300 border-b-emerald-400 shadow-[0_4px_0_#6ee7b7]' 
                                  : 'bg-white border-slate-200 hover:border-sky-300 border-b-slate-300 shadow-sm'
                                }`}
                              >
                                {m.isCompleted && <div className="absolute inset-0 bg-gradient-to-r from-emerald-200/40 to-transparent pointer-events-none" />}
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                  <div>
                                    <p className={`font-black text-xl uppercase tracking-wider leading-none mb-2 ${m.isCompleted ? 'text-emerald-700' : 'text-slate-800'}`}>{m.title}</p>
                                    <p className="text-sm font-black text-amber-500 flex items-center gap-1 drop-shadow-sm uppercase tracking-widest">
                                      <Coins size={18} className="fill-amber-500" /> Ricompensa: {m.reward} PB
                                    </p>
                                  </div>
                                  {m.isCompleted && (
                                    <motion.div 
                                      initial={{ scale: 0, rotate: -180 }}
                                      animate={{ scale: 1, rotate: 12 }}
                                      transition={{ type: "spring", bounce: 0.6 }}
                                      className="bg-emerald-500 text-white p-3 rounded-2xl shadow-[0_4px_0_#059669]"
                                    >
                                      <Check size={28} strokeWidth={5} />
                                    </motion.div>
                                  )}
                                </div>
                                <div className="h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner border-[3px] border-slate-200 relative z-10 mt-2">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(m.progress / m.target) * 100}%` }}
                                    transition={{ duration: 1.5, ease: "easeOut", type: "spring", stiffness: 60 }}
                                    className={`h-full relative ${m.isCompleted ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-sky-400 to-indigo-500'}`}
                                  >
                                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/40 rounded-full" />
                                  </motion.div>
                                </div>
                                <p className="text-right text-xs font-bold text-slate-400 mt-3 uppercase tracking-widest relative z-10">{m.progress} / {m.target}</p>
                                {m.isCompleted && (
                                  <div className="absolute top-1/2 right-20 transform -translate-y-1/2 opacity-10 pointer-events-none group-hover:scale-125 transition-transform duration-500">
                                    <Star size={150} className="fill-emerald-500" />
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    
                    {/* Shop tab removed */}


                    {activeTab === 'inventory' && (
                      <motion.div
                        key="inventory"
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -30 }}
                        transition={{ duration: 0.4, type: 'spring', bounce: 0.4 }}
                        className="space-y-6"
                      >
                        {/* Inventory Header */}
                        <div className="bg-gradient-to-br from-rose-400 to-pink-600 p-8 rounded-[2rem] text-white shadow-[0_8px_0_#be123c] relative overflow-hidden border-4 border-rose-300">
                          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
                          <div className="absolute -right-10 -top-10 w-64 h-64 bg-pink-300/30 rounded-full blur-3xl" />

                          <div className="relative z-10 text-center">
                            <p className="font-display font-black text-5xl md:text-6xl text-white uppercase leading-none drop-shadow-[0_4px_0_#9f1239] mb-2">INVENTARIO</p>
                            <p className="text-sm font-bold opacity-100 uppercase tracking-[0.2em] text-rose-100 drop-shadow-sm">La tua collezione privata</p>
                          </div>

                          <div className="absolute top-1/2 left-4 transform -translate-y-1/2 opacity-20 -rotate-12">
                            <User size={150} />
                          </div>
                        </div>

                        {/* Owned Items Grid */}
                        <div className="space-y-8 pb-8">
                          {['skins', 'trails', 'emotes'].map(category => {
                            const ownedItems = SHOP_ITEMS.filter(item =>
                              item.category === category &&
                              (profile.inventory?.[category as keyof typeof profile.inventory]?.includes(item.id) || profile.unlocked_items?.includes(item.id))
                            );

                            if (ownedItems.length === 0) return null;

                            return (
                              <div key={`inv-${category}`}>
                                <h3 className="font-black text-slate-800 text-xl uppercase tracking-widest mb-4 flex items-center gap-2 border-b-[3px] border-slate-100 pb-2">
                                  {category === 'skins' ? 'Skins Personaggio' : category === 'trails' ? 'Scie di Movimento' : 'Emote & Danze'}
                                </h3>
                                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                                  {ownedItems.map((item, idx) => (
                                    <motion.div
                                      key={item.id}
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{ delay: idx * 0.05, type: 'spring' }}
                                      whileHover={{ scale: 1.05, rotate: category === 'skins' ? 2 : -2 }}
                                      className="bg-emerald-50 border-[4px] border-emerald-200 rounded-[2rem] p-4 flex flex-col items-center text-center shadow-sm relative overflow-hidden group cursor-pointer border-b-[6px] hover:border-emerald-400"
                                    >
                                      {/* Tier Label */}
                                      <div className={`absolute top-0 right-0 px-2 py-1 font-black text-[8px] uppercase tracking-widest rounded-bl-xl z-20 ${
                                          item.tier === 'Legendary' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
                                          item.tier === 'Epic' ? 'bg-indigo-500 text-white' :
                                          item.tier === 'Rare' ? 'bg-blue-500 text-white' :
                                          'bg-slate-200 text-slate-500'
                                        }`}
                                      >
                                        {item.tier}
                                      </div>

                                      <div className="text-4xl mb-2 mt-4 drop-shadow-md group-hover:scale-125 transition-transform duration-300">{item.icon}</div>
                                      <h4 className="font-black text-emerald-900 text-sm leading-tight mb-1">{item.name}</h4>
                                      {category === 'skins' && (
                                        <button
                                          onClick={() => equipSkin(item.id)}
                                          className="mt-2 text-[10px] font-black uppercase tracking-widest bg-emerald-500 text-white px-3 py-1.5 rounded-full z-10 group-hover:bg-emerald-400"
                                        >
                                          Equipaggia
                                        </button>
                                      )}
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}

                          {/* Empty State checks */}
                          {(!profile.unlocked_items?.length && !profile.inventory?.skins?.length && !profile.inventory?.trails?.length && !profile.inventory?.emotes?.length) && (
                            <div className="w-full py-16 flex flex-col items-center justify-center text-center">
                              <div className="bg-slate-100 p-8 rounded-full mb-6">
                                <Trophy size={64} className="text-slate-300" />
                              </div>
                              <h3 className="font-black text-2xl text-slate-800 uppercase tracking-widest mb-2">Inventario Vuoto</h3>
                              <p className="text-slate-500 font-bold uppercase tracking-widest max-w-sm">
                                Visita il Negozio per spendere i tuoi Party Blocks e sbloccare nuovi fantastici personalizzazioni!
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              ) : null}
            </motion.div>
          </>
        )}
        {!profile && (
          <motion.div
            key="loading-profile"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-4xl mx-auto p-4 flex justify-center items-center h-full"
          >
            <div className="bg-white p-12 rounded-[2.5rem] border-[6px] border-slate-900 shadow-[8px_12px_0_#1e1b4b] pointer-events-auto flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <p className="font-black text-slate-600 uppercase tracking-widest">{t('loading_profile') || 'Caricamento profilo...'}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
