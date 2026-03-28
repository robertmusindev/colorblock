import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Crown } from 'lucide-react';

const PIXEL = { fontFamily: "'Press Start 2P', monospace" } as const;
const C = { yellow: '#ffee00', white: '#ffffff', bg: '#070b14', danger: '#ff3366' };
const PANEL = {
  background: 'rgba(5,9,18,0.96)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,238,0,0.25)',
  borderRadius: '14px',
  boxShadow: '0 0 0 1px rgba(255,238,0,0.06), 0 24px 64px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
} as const;

type Tab = 'blockparty' | 'parkour' | 'ghetto';

interface Row {
  username: string | null;
  value: number;
  suffix: string;
  extra?: string;
}

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];
const MEDAL_LABELS = ['🥇', '🥈', '🥉'];

function LeaderboardList({ rows, loading }: { rows: Row[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ width: 28, height: 28, border: `3px solid rgba(255,238,0,0.2)`, borderTopColor: C.yellow, borderRadius: '50%' }}
        />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="py-10 text-center">
        <span style={{ ...PIXEL, fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>NESSUN DATO ANCORA</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const isTop3 = i < 3;
        const medal = MEDAL_LABELS[i];
        const medalColor = MEDAL_COLORS[i] ?? 'transparent';
        return (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px',
              background: isTop3
                ? `linear-gradient(90deg, ${medalColor}14, rgba(5,9,18,0.6))`
                : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isTop3 ? medalColor + '30' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: '8px',
              boxShadow: isTop3 ? `inset 0 1px 0 ${medalColor}20` : 'none',
            }}
          >
            {/* Rank */}
            <div style={{ minWidth: '28px', textAlign: 'center' }}>
              {isTop3
                ? <span style={{ fontSize: '16px' }}>{medal}</span>
                : <span style={{ ...PIXEL, fontSize: '8px', color: 'rgba(255,255,255,0.28)' }}>#{i + 1}</span>
              }
            </div>
            {/* Username */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <span style={{
                ...PIXEL, fontSize: '9px',
                color: isTop3 ? medalColor : 'rgba(255,255,255,0.75)',
                textShadow: isTop3 ? `0 0 8px ${medalColor}66` : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                display: 'block',
              }}>
                {row.username ?? 'Anonimo'}
              </span>
              {row.extra && (
                <span style={{ ...PIXEL, fontSize: '6px', color: 'rgba(255,255,255,0.30)', marginTop: '3px', display: 'block' }}>
                  {row.extra}
                </span>
              )}
            </div>
            {/* Value */}
            <div style={{
              ...PIXEL, fontSize: '11px',
              color: isTop3 ? medalColor : C.yellow,
              textShadow: isTop3 ? `0 0 10px ${medalColor}88` : `0 0 8px ${C.yellow}66`,
              whiteSpace: 'nowrap',
            }}>
              {row.value}{row.suffix}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: string; color: string; desc: string }[] = [
  { id: 'blockparty', label: 'BLOCK PARTY', icon: '🎮', color: '#ffee00', desc: 'Partite vinte' },
  { id: 'parkour',    label: 'PARKOUR',     icon: '🏃', color: '#00ff88', desc: 'Tutti i 15 livelli — tempo totale minore' },
  { id: 'ghetto',     label: 'GET TO MODE', icon: '🔫', color: '#ff3366', desc: 'Onde superate prima di morire' },
];

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${s.toFixed(0).padStart(2, '0')}` : `${s.toFixed(1)}s`;
}

export function Leaderboard({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('blockparty');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRows([]);
    setLoading(true);

    const load = async () => {
      try {
        if (tab === 'blockparty') {
          const { data } = await supabase
            .from('profiles')
            .select('username, total_wins')
            .order('total_wins', { ascending: false })
            .gt('total_wins', 0)
            .limit(20);
          setRows((data ?? []).map(r => ({
            username: r.username,
            value: r.total_wins ?? 0,
            suffix: r.total_wins === 1 ? ' WIN' : ' WINS',
          })));

        } else if (tab === 'parkour') {
          // Fetch all profiles with parkour_records, compute total on client
          const { data } = await supabase
            .from('profiles')
            .select('username, parkour_records')
            .not('parkour_records', 'eq', '{}')
            .not('parkour_records', 'is', null)
            .limit(300);

          const complete = (data ?? [])
            .map(r => {
              const rec = r.parkour_records as Record<string, number> | null;
              if (!rec) return null;
              // Must have all 15 levels
              let total = 0;
              for (let i = 1; i <= 15; i++) {
                const v = rec[String(i)];
                if (v === undefined) return null;
                total += v;
              }
              return { username: r.username, total };
            })
            .filter(Boolean) as { username: string | null; total: number }[];

          complete.sort((a, b) => a.total - b.total);

          setRows(complete.slice(0, 20).map(r => ({
            username: r.username,
            value: r.total,
            suffix: '',
            extra: fmtTime(r.total) + ' totali · tutti 15 livelli',
          })));

        } else {
          const { data } = await supabase
            .from('profiles')
            .select('username, ghetto_best_waves')
            .order('ghetto_best_waves', { ascending: false })
            .gt('ghetto_best_waves', 0)
            .limit(20);
          setRows((data ?? []).map(r => ({
            username: r.username,
            value: r.ghetto_best_waves ?? 0,
            suffix: r.ghetto_best_waves === 1 ? ' WAVE' : ' WAVES',
          })));
        }
      } catch (e) {
        console.error('Leaderboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [tab]);

  const activeTab = TABS.find(t => t.id === tab)!;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99990] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{ ...PANEL, width: '100%', maxWidth: '520px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,238,0,0.12)',
        }}>
          <Crown size={18} color={C.yellow} />
          <span style={{ ...PIXEL, fontSize: '13px', color: C.yellow, textShadow: `0 0 14px ${C.yellow}`, flex: 1 }}>
            LEADERBOARD
          </span>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px', cursor: 'pointer', display: 'flex' }}
          >
            <X size={16} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 16px 0' }}>
          {TABS.map(t => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '8px 4px',
                  ...PIXEL, fontSize: '6px',
                  background: active ? `${t.color}18` : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? t.color + '55' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: '6px', cursor: 'pointer',
                  color: active ? t.color : 'rgba(255,255,255,0.45)',
                  textShadow: active ? `0 0 8px ${t.color}88` : 'none',
                  boxShadow: active ? `0 0 12px ${t.color}22, inset 0 1px 0 ${t.color}22` : 'none',
                  transition: 'all 0.18s',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontSize: '14px', marginBottom: '3px' }}>{t.icon}</div>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab description */}
        <div style={{ padding: '8px 18px 2px' }}>
          <span style={{ ...PIXEL, fontSize: '6px', color: 'rgba(255,255,255,0.30)' }}>{activeTab.desc}</span>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px 18px' }}>
          <LeaderboardList rows={rows} loading={loading} />
        </div>
      </motion.div>
    </motion.div>
  );
}
