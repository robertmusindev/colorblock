import React, { useEffect, useState, Suspense, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Stars, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { applySkinToModel, findLegNodes } from '../utils/skinUtils';

interface SkinAcquisitionHeroProps {
  isOpen: boolean;
  onClose: () => void;
  skinId: string;
}

export function SkinAcquisitionHero({ isOpen, onClose, skinId }: SkinAcquisitionHeroProps) {
  const [showShout, setShowShout] = useState(false);
  const [progress, setProgress] = useState(0);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (isOpen) {
      let startTime: number | null = null;
      const duration = 2000; // 2 seconds total

      // 60fps animation with requestAnimationFrame
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const prog = Math.min(elapsed / duration, 1);
        
        setProgress(prog);
        
        if (prog >= 1) {
          setShowShout(true);
          triggerConfetti();
          return;
        }
        
        animFrameRef.current = requestAnimationFrame(animate);
      };

      animFrameRef.current = requestAnimationFrame(animate);

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    } else {
      setProgress(0);
      setShowShout(false);
    }
  }, [isOpen]);

  const triggerConfetti = useCallback(() => {
    const end = Date.now() + (3 * 1000);
    const colors = ['#3498db', '#ffffff', '#2c3e50'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-white/95 backdrop-blur-3xl flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Animated Background Rays */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={`absolute -inset-[100%] opacity-40 ${skinId === 'skin_special_israel' ? 'bg-[conic-gradient(from_0deg,#3498db_0%,transparent_10%,#ffffff_20%,transparent_30%,#3498db_40%,transparent_50%,#ffffff_60%,transparent_70%,#3498db_80%,transparent_90%)]' : 'bg-[conic-gradient(from_0deg,#fbbf24_0%,transparent_10%,#ffffff_20%,transparent_30%,#fbbf24_40%,transparent_50%,#ffffff_60%,transparent_70%,#fbbf24_80%,transparent_90%)]'}`}
          />
        </div>

        {/* 3D Character Preview */}
        <div className="w-full h-[50vh] sm:h-[60vh] relative z-20">
          <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
            <PerspectiveCamera makeDefault position={[0, 1, 5]} />
            <ambientLight intensity={1} />
            <pointLight position={[10, 10, 10]} intensity={2} />
            <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={3} />
            <Environment preset="city" />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
              <group position={[0, -0.8, 0]}>
                <Suspense fallback={null}>
                  <HeroCharacter progress={progress} skinId={skinId} />
                </Suspense>
              </group>
            </Float>
            
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={4} />
          </Canvas>
        </div>

        {/* UI Overlay */}
        <motion.div 
          className="relative z-30 text-center mt-4 sm:mt-8 px-4 w-full"
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <AnimatePresence>
            {showShout && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 5, stiffness: 200 }}
                className="mb-4 sm:mb-8"
              >
                <h1 className="text-3xl sm:text-5xl md:text-8xl font-black italic tracking-tighter drop-shadow-2xl uppercase" style={{ WebkitTextStroke: skinId === 'skin_special_israel' ? '2px #3498db' : '2px #f59e0b', color: skinId === 'skin_special_israel' ? '#ffffff' : '#1e293b' }}>
                   {skinId === 'skin_special_israel' ? 'UNITED STATES OF ISRAEL' : 'ROB SBAGLIATO!!'}
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-6 sm:mb-12 text-xs sm:text-sm">
            {progress < 1 ? 'Sincronizzazione Skin...' : 'Nuova Skin Leggendaria Sbloccata'}
          </p>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="bg-amber-500 text-white px-8 sm:px-12 py-3 sm:py-5 rounded-2xl font-black text-base sm:text-xl uppercase tracking-widest shadow-xl hover:bg-amber-400 transition-colors border-b-8 border-amber-700 active:border-b-0"
          >
            Continua
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function HeroCharacter({ progress, skinId }: { progress: number, skinId: string }) {
  const { scene } = useGLTF(import.meta.env.BASE_URL + 'asset3d/charactert.glb');
  const textures = useTexture({
    default: import.meta.env.BASE_URL + 'texture/TEST_Material.002_BaseColor.png',
    israel: import.meta.env.BASE_URL + 'skins/israel_skin.png',
    robsbagliato: import.meta.env.BASE_URL + 'texture/robsbagliato.png',
  });

  const legLRef = useRef<THREE.Object3D | null>(null);
  const legRRef = useRef<THREE.Object3D | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  const clone = useMemo(() => {
    if (!scene) return new THREE.Group();
    const c = scene.clone();
    
    if (progress > 0.8) {
      // Apply final skin
      applySkinToModel(c, skinId, textures);
    } else {
      // Transition effect: color shifting
      c.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          const mat = new THREE.MeshStandardMaterial();
          const startColor = new THREE.Color(0x3498db);
          const endColor = new THREE.Color(0xffffff);
          mat.color.copy(startColor).lerp(endColor, progress);
          mat.needsUpdate = true;
          node.material = mat;
        }
      });
    }
    
    const { legL, legR } = findLegNodes(c);
    legLRef.current = legL;
    legRRef.current = legR;
    
    return c;
  }, [scene, textures, skinId, progress]);

  // Animated idle pose for hero character
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    
    // Gentle leg sway
    if (legLRef.current) {
      legLRef.current.rotation.x = Math.sin(t * 2) * 0.2;
    }
    if (legRRef.current) {
      legRRef.current.rotation.x = Math.sin(t * 2 + Math.PI) * 0.2;
    }
  });

  return <primitive object={clone} />;
}
