import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './auth';

export interface Mission {
  id: string;
  title: string;
  type: 'coins' | 'rounds' | 'wins';
  target: number;
  progress: number;
  reward: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface GameNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'reward';
}

export type InventoryCategory = 'skins' | 'trails' | 'emotes' | 'hats';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string | React.ReactNode;
  category: InventoryCategory;
  tier: 'Basic' | 'Rare' | 'Epic' | 'Legendary';
}

export const SHOP_ITEMS: ShopItem[] = [
  // Skins
  { id: 'skin_solid', name: 'Colori Solidi', description: 'Skin di base morbida', price: 500, icon: '🎨', category: 'skins', tier: 'Basic' },
  { id: 'skin_pattern', name: 'Pattern Zebra', description: 'Stile zebrato raro', price: 1500, icon: '🦓', category: 'skins', tier: 'Rare' },
  { id: 'skin_epic', name: 'Oro Massiccio', description: 'Skin Epica brillante', price: 5000, icon: '🏆', category: 'skins', tier: 'Epic' },
  { id: 'skin_legendary', name: 'Arcobaleno', description: 'Skin leggendaria che cambia color', price: 15000, icon: '🌈', category: 'skins', tier: 'Legendary' },
  { id: 'skin_special_israel', name: 'Israel Hero', description: 'Special Hero Skin - United States of Israel', price: 0, icon: '🇮🇱', category: 'skins', tier: 'Legendary' },
  { id: 'skin_robsbagliato', name: 'Rob Sbagliato', description: 'La skin definitiva di Rob', price: 20000, icon: '🤴', category: 'skins', tier: 'Legendary' },
  { id: 'skin3', name: 'Skull Ghost', description: 'Skin bianca con cranio', price: 2000, icon: '💀', category: 'skins', tier: 'Rare' },
  { id: 'skin4', name: 'Military', description: 'Skin mimetica militare', price: 3500, icon: '🪖', category: 'skins', tier: 'Epic' },
  
  // Trails
  { id: 'trail_dust', name: 'Scia Polvere', description: 'Classica scia di polvere', price: 800, icon: '💨', category: 'trails', tier: 'Basic' },
  { id: 'trail_premium', name: 'Scia Scintille', description: 'Scintille brillanti', price: 3000, icon: '✨', category: 'trails', tier: 'Premium' as any },
  
  // Emotes
  { id: 'emote_wave', name: 'Saluto (Wave)', description: 'Saluta gli avversari', price: 1000, icon: '👋', category: 'emotes', tier: 'Basic' },
  { id: 'emote_dance', name: 'Danza Speciale', description: 'Balla sul blocco', price: 4000, icon: '🕺', category: 'emotes', tier: 'Rare' },

  // Hats
  { id: 'hat_paperhead', name: 'Paperhead', description: 'Un cappello di carta per il tuo personaggio', price: 0, icon: '🎩', category: 'hats', tier: 'Basic' },
  { id: 'hat_happy', name: 'Happy Hat', description: 'Un simpatico cappello a cono', price: 300, icon: '🎉', category: 'hats', tier: 'Rare' },
];

export interface UserProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  level: number;
  coins: number;
  total_games_played: number;
  high_score: number;
  unlocked_items: string[];
  inventory?: {
    skins: string[];
    trails: string[];
    emotes: string[];
    hats?: string[];
  };
  equipped_skin?: string;
  equipped_hat?: string;
  missions: Mission[];
  parkour_records?: Record<string, number>; // level (as string key) → best elapsed seconds
  total_wins?: number;        // Block Party wins
  ghetto_best_waves?: number; // best waves reached in Ghetto before dying/clearing
}

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<boolean>;
  subscribeToRealtime: () => () => void;
  addReward: (rounds: number, isVictory: boolean, sessionCoins: number) => Promise<void>;
  purchaseItem: (itemId: string, price: number) => Promise<boolean>;
  updateMissionProgress: (type: Mission['type'], amount: number) => void;
  notifications: GameNotification[];
  dismissNotification: (id: string) => void;
  equipSkin: (skinId: string) => Promise<void>;
  equipHat: (hatId: string) => Promise<void>;
  saveParkourRecord: (level: number, elapsed: number) => Promise<void>;
  recordClassicWin: () => Promise<void>;
  recordGhettoWaves: (waves: number) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  error: null,

  fetchProfile: async () => {
    const user = useAuthStore.getState().user;
    if (!user) {
      set({ profile: null, isLoading: false, error: null });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Profilo non trovato, creazione in corso...');
          const defaultProfile = {
            id: user.id,
            username: user.email?.split('@')[0] || 'Player',
            avatar_url: null,
            level: 1,
            coins: 0,
            total_games_played: 0,
            high_score: 0,
            unlocked_items: ['default_skin'],
            inventory: { skins: ['default_skin'], trails: [], emotes: [], hats: [] },
            equipped_skin: 'default_skin',
            equipped_hat: undefined,
            missions: DEFAULT_MISSIONS
          };

          // Prova a inserirlo nel DB
          const { error: insertError } = await supabase
            .from('profiles')
            .insert([defaultProfile]);

          if (insertError) {
            console.warn('Errore inserimento profilo DB, uso fallback locale:', insertError);
          }
          
          set({ profile: defaultProfile, isLoading: false });
          return;
        }
        throw error;
      }

      if (data) {
        const inv = data.inventory || { skins: ['default_skin'], trails: [], emotes: [], hats: [] };
        set({
          profile: {
            ...data,
            missions: data.missions || DEFAULT_MISSIONS,
            unlocked_items: data.unlocked_items || [],
            inventory: inv,
            equipped_skin: data.equipped_skin || 'default_skin',
            equipped_hat: (inv as any).equipped_hat || undefined,
            parkour_records: data.parkour_records || {},
            total_wins: data.total_wins ?? 0,
            ghetto_best_waves: data.ghetto_best_waves ?? 0,
          },
          isLoading: false
        });
      } else {
        // This case should ideally not happen with .single() if no error,
        // but if data is null for some reason, we can set profile to null.
        set({ profile: null, isLoading: false, error: 'Profile data not found.' });
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err);
      set({ error: err.message, isLoading: false });
    }
  },

  updateUsername: async (newUsername: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', user.id);

      if (error) throw error;
      
      // Update local state immediately
      const currentProfile = get().profile;
      if (currentProfile) {
        set({ profile: { ...currentProfile, username: newUsername } });
        // Also update gameStore username if needed to keep in sync
        const { useGameStore } = await import('../store');
        useGameStore.getState().setUsername(newUsername);
      }
      return true;
    } catch (err: any) {
      console.error('Error updating username:', err);
      return false;
    }
  },

  updateAvatar: async (file: File) => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    try {
      set({ isLoading: true });
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update local state immediately
      const currentProfile = get().profile;
      if (currentProfile) {
        set({ profile: { ...currentProfile, avatar_url: publicUrl } });
      }
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      console.error('Error updating avatar:', err);
      set({ isLoading: false, error: err.message });
      return false;
    }
  },

  subscribeToRealtime: () => {
    const user = useAuthStore.getState().user;
    if (!user) return () => {};

    // Sottoscrizione ai cambiamenti della tabella profiles SOLO per l'utente corrente
    const subscription = supabase
      .channel(`public:profiles:id=eq.${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          console.log('Profilo aggiornato in real-time!', payload.new);
          // Aggiorna lo stato locale unendo i nuovi dati
          const currentProfile = get().profile;
          if (currentProfile) {
            set({ profile: { ...currentProfile, ...payload.new } });
          } else {
             set({ profile: payload.new as UserProfile });
          }
        }
      )
      .subscribe();

    // Ritorna la funzione di disiscrizione
    return () => {
      supabase.removeChannel(subscription);
    };
  },

  addReward: async (rounds: number, isVictory: boolean, sessionCoins: number) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const currentProfile = get().profile;
    if (!currentProfile) return;

    // Party Blocks (PB) Logic:
    // +5 base participation
    // +10 per round survived
    // +100 bonus for 1st place
    // + session coins collected = 1 PB each
    const participationBonus = 5;
    const roundsBonus = rounds * 10;
    const victoryBonus = isVictory ? 100 : 0;
    const coinReward = participationBonus + roundsBonus + victoryBonus + sessionCoins;
    
    const newCoins = currentProfile.coins + coinReward;

    // Update Missions in-memory before saving
    // Daily 1: Play 3 games (mapped to 'games_played')
    // Daily 2: Survive 20 rounds (mapped to 'rounds')
    // Daily 3: Win 1 game (mapped to 'wins')
    // Weekly: Play 30 games (mapped to 'weekly_games')
    get().updateMissionProgress('games_played' as any, 1);
    get().updateMissionProgress('weekly_games' as any, 1);
    get().updateMissionProgress('rounds', rounds);
    if (isVictory) get().updateMissionProgress('wins', 1);

    const updatedProfile = get().profile!; // Progress might have changed
    const newTotalGames = updatedProfile.total_games_played + 1;
    const newHighScore = Math.max(updatedProfile.high_score, rounds);
    
    // Simple level progression: level up every 500 total XP
    // XP = (total_games * 50) + (high_score * 10)
    const totalXp = (newTotalGames * 50) + (newHighScore * 10);
    const newLevel = Math.floor(totalXp / 500) + 1;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          coins: updatedProfile.coins + coinReward,
          total_games_played: newTotalGames, 
          high_score: newHighScore,
          level: newLevel,
          missions: updatedProfile.missions
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // Local update will be handled by realtime subscription if active, 
      // but let's do it manually for immediate feedback
      set({ profile: { 
        ...currentProfile, 
        coins: newCoins, 
        total_games_played: newTotalGames, 
        high_score: newHighScore,
        level: newLevel
      } });
    } catch (err) {
      console.error('Error adding reward:', err);
    }
  },

  purchaseItem: async (itemId: string, price: number) => {
    const user = useAuthStore.getState().user;
    if (!user) return false;

    const currentProfile = get().profile;
    if (!currentProfile || currentProfile.coins < price) return false;
    
    const itemDefinition = SHOP_ITEMS.find(i => i.id === itemId);
    if (!itemDefinition) return false;

    // Check if already owned in unlocked_items or the new inventory json structure
    let isOwned = false;
    if (currentProfile.unlocked_items?.includes(itemId)) isOwned = true;
    if (currentProfile.inventory && currentProfile.inventory[itemDefinition.category]?.includes(itemId)) isOwned = true;

    if (isOwned) return true; // Already owned

    const newCoins = currentProfile.coins - price;
    const newUnlockedItems = [...(currentProfile.unlocked_items || []), itemId];
    
    // Update category-specific inventory block
    const newInventory: any = {
      ...(currentProfile.inventory || { skins: ['default_skin'], trails: [], emotes: [], hats: [] })
    };
    const catArr: string[] = newInventory[itemDefinition.category] || [];
    newInventory[itemDefinition.category] = [...catArr, itemId];

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          coins: newCoins, 
          unlocked_items: newUnlockedItems,
          inventory: newInventory
        })
        .eq('id', user.id);

      if (error) throw error;

      set({ profile: { 
        ...currentProfile, 
        coins: newCoins, 
        unlocked_items: newUnlockedItems,
        inventory: newInventory
      } });
      return true;
    } catch (err) {
      console.error('Error purchasing item:', err);
      return false;
    }
  },

  equipSkin: async (skinId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const currentProfile = get().profile;
    if (!currentProfile) return;

    // Ensure the player actually owns this skin
    const ownsSkin =
      currentProfile.inventory?.skins?.includes(skinId) ||
      currentProfile.unlocked_items?.includes(skinId);
    if (!ownsSkin) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ equipped_skin: skinId })
        .eq('id', user.id);

      if (error) throw error;

      set({
        profile: {
          ...currentProfile,
          equipped_skin: skinId,
        },
      });
    } catch (err) {
      console.error('Error equipping skin:', err);
    }
  },

  equipHat: async (hatId: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const currentProfile = get().profile;
    if (!currentProfile) return;

    const ownsHat =
      currentProfile.inventory?.hats?.includes(hatId) ||
      currentProfile.unlocked_items?.includes(hatId);
    if (!ownsHat) return;

    // Store equipped_hat inside inventory JSONB (no separate DB column needed)
    const newInventory: any = { ...(currentProfile.inventory || {}), equipped_hat: hatId };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ inventory: newInventory })
        .eq('id', user.id);

      if (error) throw error;

      set({
        profile: {
          ...currentProfile,
          inventory: newInventory,
          equipped_hat: hatId,
        },
      });
    } catch (err) {
      console.error('Error equipping hat:', err);
    }
  },

  notifications: [],
  dismissNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(n => n.id !== id)
    }));
  },

  saveParkourRecord: async (level: number, elapsed: number) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { profile } = get();
    if (!profile) return;
    const key = String(level);
    const current = profile.parkour_records?.[key];
    // Only update if it's a new best
    if (current !== undefined && elapsed >= current) return;
    const newRecords = { ...(profile.parkour_records || {}), [key]: elapsed };
    // Optimistic local update
    set({ profile: { ...profile, parkour_records: newRecords } });
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ parkour_records: newRecords })
        .eq('id', user.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error saving parkour record:', err);
      // Revert on failure
      set({ profile: { ...get().profile!, parkour_records: profile.parkour_records } });
    }
  },

  recordClassicWin: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { profile } = get();
    if (!profile) return;
    const newWins = (profile.total_wins ?? 0) + 1;
    set({ profile: { ...profile, total_wins: newWins } });
    try {
      await supabase.from('profiles').update({ total_wins: newWins }).eq('id', user.id);
    } catch (err) {
      console.error('Error recording classic win:', err);
    }
  },

  recordGhettoWaves: async (waves: number) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const { profile } = get();
    if (!profile) return;
    const current = profile.ghetto_best_waves ?? 0;
    if (waves <= current) return; // only update if new best
    set({ profile: { ...profile, ghetto_best_waves: waves } });
    try {
      await supabase.from('profiles').update({ ghetto_best_waves: waves }).eq('id', user.id);
    } catch (err) {
      console.error('Error recording ghetto waves:', err);
    }
  },

  updateMissionProgress: (type: Mission['type'], amount: number) => {
    const { profile } = get();
    if (!profile) return;

    let rewardAccumulator = 0;
    const currentMissions = profile.missions || DEFAULT_MISSIONS;
    const newMissions = currentMissions.map(m => {
      if (m.type === type && !m.isCompleted) {
        const newProgress = Math.min(m.progress + amount, m.target);
        const newlyCompleted = newProgress >= m.target;
        
        if (newlyCompleted) {
          rewardAccumulator += m.reward;
          // Add notification
          set(state => ({
            notifications: [
              ...state.notifications, 
              { 
                id: Math.random().toString(36).substr(2, 9), 
                message: `Missione Compiuta: ${m.title}! +${m.reward} monete`,
                type: 'reward'
              }
            ]
          }));
        }
        
        return { ...m, progress: newProgress, isCompleted: newlyCompleted };
      }
      return m;
    });

    if (rewardAccumulator > 0 || JSON.stringify(newMissions) !== JSON.stringify(profile.missions)) {
      set({ 
        profile: { 
          ...profile, 
          missions: newMissions,
          coins: profile.coins + rewardAccumulator
        } 
      });

      // Update in DB (simple sync)
      supabase.from('profiles').update({ 
        missions: newMissions,
        coins: profile.coins + rewardAccumulator 
      }).eq('id', profile.id).then();
    }
  }
}));

const DEFAULT_MISSIONS: Mission[] = [
  { id: 'daily1', title: 'Daily 1: Gioca 3 partite', type: 'games_played' as any, target: 3, progress: 0, reward: 50, isCompleted: false, isClaimed: false },
  { id: 'daily2', title: 'Daily 2: Sopravvivi 20 round totali', type: 'rounds', target: 20, progress: 0, reward: 150, isCompleted: false, isClaimed: false },
  { id: 'daily3', title: 'Daily 3: Vinci 1 partita', type: 'wins', target: 1, progress: 0, reward: 300, isCompleted: false, isClaimed: false },
  { id: 'weekly1', title: 'Weekly: Gioca 30 partite', type: 'weekly_games' as any, target: 30, progress: 0, reward: 1000, isCompleted: false, isClaimed: false }
];
