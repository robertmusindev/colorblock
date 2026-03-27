import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Coins, Sparkles, Star, CheckCircle2 } from 'lucide-react';
import { audio } from '../utils/audio';

interface PurchaseCelebrationProps {
  isOpen: boolean;
  onClose: () => void;
  bundleName: string;
  amount: number;
  image: string;
}

export const PurchaseCelebration = ({ isOpen, onClose, bundleName, amount, image }: PurchaseCelebrationProps) => {
  useEffect(() => {
    if (isOpen) {
      console.log('PurchaseCelebration EFFECT TRIGGERED for:', bundleName);
      audio.playLargeCoinShower();
      
      // Initial burst
      const end = Date.now() + 3000;
      const colors = ['#fbbf24', '#f59e0b', '#d97706', '#fef3c7', '#ffffff'];

      (function frame() {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: colors
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      // Big center burst
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: colors,
        shapes: ['circle'],
        scalar: 1.2
      });
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl"
        >
          {/* Animated Background Rays */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ rotate: i * 30, scale: 0 }}
                animate={{ scale: 3 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute top-1/2 left-1/2 w-full h-32 bg-gradient-to-r from-amber-400/20 to-transparent -translate-x-1/2 -translate-y-1/2 origin-left"
                style={{ rotate: `${i * 30}deg` }}
              />
            ))}
          </div>

          <motion.div
            initial={{ scale: 0.5, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative bg-white border-[10px] border-amber-400 rounded-[4rem] p-8 md:p-12 w-full max-w-2xl shadow-[0_20px_50px_rgba(245,158,11,0.5)] text-center"
          >
            {/* Success Badge */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-500 text-white p-4 rounded-full shadow-lg border-8 border-white"
            >
              <CheckCircle2 size={48} className="stroke-[3px]" />
            </motion.div>

            {/* Floating Icons */}
            <motion.div
              animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute top-20 right-10 text-amber-400 opacity-20"
            >
              <Sparkles size={60} />
            </motion.div>
            <motion.div
              animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute bottom-20 left-10 text-amber-400 opacity-20"
            >
              <Star size={50} />
            </motion.div>

            <div className="relative z-10 flex flex-col items-center">
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl text-slate-900 uppercase tracking-tighter mb-2 leading-none">
                ACQUISTO <span className="text-amber-500">COMPLETATO!</span>
              </h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.3em] mb-10 text-xs md:text-sm">Il tuo tesoro è arrivato</p>

              {/* Hero Bundle Animation */}
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                className="relative w-48 h-48 md:w-64 md:h-64 mb-8"
              >
                <div className="absolute inset-0 bg-amber-100 rounded-[3rem] rotate-6 shadow-inner" />
                <motion.img
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  src={image}
                  alt={bundleName}
                  className="relative z-10 w-full h-full object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.3)]"
                />
                
                {/* Glow Effect behind image */}
                <div className="absolute inset-0 bg-yellow-400/20 blur-3xl rounded-full scale-150" />
              </motion.div>

              <div className="flex flex-col items-center bg-slate-50 border-4 border-slate-100 rounded-[2.5rem] px-8 py-6 mb-10 shadow-inner">
                <span className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-1">{bundleName}</span>
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-3 text-5xl md:text-7xl font-black text-amber-500 tabular-nums drop-shadow-sm"
                >
                  <Coins size={56} className="fill-amber-400 stroke-amber-200" />
                  {amount.toLocaleString()}
                </motion.div>
                <span className="text-amber-600/60 font-black text-xl md:text-2xl mt-1 uppercase tracking-tighter">Party Blocks</span>
              </div>

              <motion.button
                whileHover={{ scale: 1.05, y: -4 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-widest shadow-2xl shadow-slate-900/40 border-b-[8px] border-slate-700 active:border-b-0 active:translate-y-2 transition-all"
              >
                OK, GRAZIE!
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
