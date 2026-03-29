import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useGameStore } from '../store';

export interface NetworkPlayer {
  id: string; // from lobby_players (UUID)
  name: string;
  isHost: boolean;
  position?: [number, number, number];
  rotation?: [number, number, number];
  isEliminated?: boolean;
  skinId?: string;
}

interface MultiplayerState {
  lobbyId: string | null;
  isHost: boolean;
  players: NetworkPlayer[];
  channel: RealtimeChannel | null;
  isLoading: boolean;
  error: string | null;
  myPlayerId: string | null; // Our ID in the lobby_players table

  createLobby: (hostName: string, hostAuthId?: string) => Promise<void>;
  joinLobby: (lobbyId: string, playerName: string, authId?: string) => Promise<void>;
  leaveLobby: () => Promise<void>;
  broadcastMovement: (position: [number, number, number], rotation: [number, number, number], skinId: string) => void;
  broadcastElimination: () => void;
}

const generateRoomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed confusing chars I,O,1,0
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Helper function to retry Supabase queries if the free-tier database is waking up
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      if (attempt >= retries) throw err;
      console.warn(`Supabase query failed (attempt ${attempt}/${retries}). Retrying in ${delay}ms...`, err);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Failed after retries");
}

export const useMultiplayerStore = create<MultiplayerState>((set, get) => ({
  lobbyId: null,
  isHost: false,
  players: [],
  channel: null,
  isLoading: false,
  error: null,
  myPlayerId: null,

  createLobby: async (hostName: string, hostAuthId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const roomCode = generateRoomCode();
      const actualHostId = hostAuthId || `guest-${Date.now()}`;

      // Insert lobby into DB with retry logic (handles cold starts)
      const { error: lobbyError } = await withRetry(async () => 
        await supabase.from('lobbies').insert({ 
          id: roomCode, 
          host_id: actualHostId,
          status: 'waiting' // Explicitly set status
        })
      );

      if (lobbyError) throw lobbyError;

      // Insert Host as first player
      const { data: playerData, error: playerError } = await withRetry(async () =>
        await supabase.from('lobby_players')
          .insert({
            lobby_id: roomCode,
            player_id: actualHostId,
            player_name: hostName,
            is_host: true
          })
          .select()
          .single()
      );

      if (playerError) throw playerError;

      // Connect to Realtime Channel
      const channel = supabase.channel(`room:${roomCode}`, {
        config: {
          presence: { key: playerData.id },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activePlayers: NetworkPlayer[] = [];
          for (const key in presenceState) {
            const presences = presenceState[key] as any[];
            // To handle multiple identical IDs (shouldn't happen but defensive)
            presences.forEach(p => {
               if (p.playerInfo) activePlayers.push(p.playerInfo);
            });
          }
          // Remove duplicates if any
          const uniquePlayers = Array.from(new Map(activePlayers.map(p => [p.id, p])).values());
          set({ players: uniquePlayers });
        })
        .on('broadcast', { event: 'movement' }, (payload) => {
           const { playerId, position, rotation, skinId } = payload.payload;
           // Optimized: Store in a global non-reactive buffer instead of React state
           if (typeof window !== 'undefined') {
             (window as any).remotePlayerBuffer = (window as any).remotePlayerBuffer || {};
             (window as any).remotePlayerBuffer[playerId] = { position, rotation, skinId, timestamp: Date.now() };
           }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              playerInfo: {
                id: playerData.id,
                name: hostName,
                isHost: true,
                isEliminated: false,
                skinId: (await import('./profile')).useProfileStore.getState().profile?.equipped_skin || 'default_skin'
              }
            });
            set({ 
              channel, 
              lobbyId: roomCode, 
              isHost: true, 
              isLoading: false,
              myPlayerId: playerData.id 
            });
          }
        });

    } catch (err: any) {
      console.error("Error creating lobby:", err);
      set({ error: err.message || "Failed to create lobby", isLoading: false });
    }
  },

  joinLobby: async (lobbyId: string, playerName: string, authId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const actualPlayerId = authId || `guest-${Date.now()}`;
      
      const { data: lobby, error: lobbyError } = await withRetry(async () =>
        await supabase.from('lobbies')
          .select('*')
          .eq('id', lobbyId.toUpperCase())
          .maybeSingle()
      );

      if (lobbyError) throw new Error(`Errore connessione: ${lobbyError.message}`);
      if (!lobby) throw new Error("Stanza non trovata! Controlla il codice.");
      if (lobby.status !== 'waiting') throw new Error("Partita già in corso!");

      const { data: playerData, error: playerError } = await withRetry(async () =>
        await supabase.from('lobby_players')
          .insert({
            lobby_id: lobby.id,
            player_id: actualPlayerId,
            player_name: playerName,
            is_host: false
          })
          .select()
          .single()
      );
        
      if (playerError) throw playerError;

      const channel = supabase.channel(`room:${lobby.id}`, {
        config: {
          presence: { key: playerData.id },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const activePlayers: NetworkPlayer[] = [];
          for (const key in presenceState) {
            const presences = presenceState[key] as any[];
            presences.forEach(p => {
               if (p.playerInfo) activePlayers.push(p.playerInfo);
            });
          }
          const uniquePlayers = Array.from(new Map(activePlayers.map(p => [p.id, p])).values());
          set({ players: uniquePlayers });
        })
        .on('broadcast', { event: 'start_game' }, (payload) => {
            useGameStore.getState().networkStartGame(payload.payload.seed);
        })
        .on('broadcast', { event: 'start_round' }, (payload) => {
            useGameStore.getState().networkStartRound(payload.payload);
        })
        .on('broadcast', { event: 'elimination' }, (payload) => {
           set(state => ({
             players: state.players.map(p => 
               p.id === payload.payload.playerId ? { ...p, isEliminated: true } : p
             )
           }));
           useGameStore.getState().networkEliminatePlayer(payload.payload.playerId);
        })
        .on('broadcast', { event: 'movement' }, (payload) => {
           const { playerId, position, rotation, skinId } = payload.payload;
           if (typeof window !== 'undefined') {
             (window as any).remotePlayerBuffer = (window as any).remotePlayerBuffer || {};
             (window as any).remotePlayerBuffer[playerId] = { position, rotation, skinId, timestamp: Date.now() };
           }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
               playerInfo: {
                id: playerData.id,
                name: playerName,
                isHost: false,
                isEliminated: false,
                skinId: (await import('./profile')).useProfileStore.getState().profile?.equipped_skin || 'default_skin'
              }
            });
            set({ 
              channel, 
              lobbyId: lobby.id, 
              isHost: false, 
              isLoading: false,
              myPlayerId: playerData.id
            });
          }
        });

    } catch (err: any) {
      console.error("Error joining lobby:", err);
      set({ error: err.message || "Failed to join lobby", isLoading: false });
    }
  },

  leaveLobby: async () => {
    const { channel, lobbyId, myPlayerId, isHost } = get();
    if (channel) {
      await channel.untrack();
      await channel.unsubscribe();
    }
    
    if (myPlayerId) {
       try {
         await supabase.from('lobby_players').delete().eq('id', myPlayerId);
         if (isHost && lobbyId) {
            await supabase.from('lobbies').delete().eq('id', lobbyId);
         }
       } catch (e) {
         console.error("Error during cleanup:", e);
       }
    }
    
    // Purge stale position data so it doesn't bleed into future sessions
    if (typeof window !== 'undefined') {
      (window as any).remotePlayerBuffer = {};
    }

    set({ channel: null, lobbyId: null, isHost: false, players: [], myPlayerId: null });
  },

  broadcastMovement: (position: [number, number, number], rotation: [number, number, number], skinId: string) => {
     const { channel, myPlayerId } = get();
     if (!channel || !myPlayerId) return;
     
     channel.send({
       type: 'broadcast',
       event: 'movement',
       payload: {
         playerId: myPlayerId,
         position,
         rotation,
         skinId
       }
     }).catch(e => console.error("Rate limit or send error:", e));
  },

  broadcastElimination: () => {
    const { channel, myPlayerId } = get();
     if (!channel || !myPlayerId) return;
     
     channel.send({
       type: 'broadcast',
       event: 'elimination',
       payload: { playerId: myPlayerId }
     });
  }
}));
