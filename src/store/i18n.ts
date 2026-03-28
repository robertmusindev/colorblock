import { create } from 'zustand';

type Language = 'en' | 'it' | 'ru';

interface Translations {
  [key: string]: {
    en: string;
    it: string;
    ru: string;
  };
}

export const translations: Translations = {
  // Title
  app_title: {
    en: "Color Block",
    it: "Color Block",
    ru: "Color Block"
  },
  app_subtitle: {
    en: "Party",
    it: "Party",
    ru: "Party"
  },
  
  // Tagline / Subtitle
  tagline: {
    en: "Survive the dropping floor!",
    it: "Sopravvivi al pavimento che cade!",
    ru: "Выживи на падающем полу!"
  },

  // Auth / Start 
  choose_nickname: {
    en: "Choose your nickname!",
    it: "Scegli il tuo nickname!",
    ru: "Выбери свой никнейм!"
  },
  play_as_guest: {
    en: "PLAY AS GUEST",
    it: "GIOCA COME OSPITE",
    ru: "ИГРАТЬ КАК ГОСТЬ"
  },
  online_multiplayer: {
    en: "ONLINE MULTIPLAYER",
    it: "MULTIPLAYER ONLINE",
    ru: "ОНЛАЙН МУЛЬТИПЛЕЕР"
  },
  create_room: {
    en: "CREATE ROOM",
    it: "CREA STANZA",
    ru: "СОЗДАТЬ КОМНАТУ"
  },
  join_with_code: {
    en: "ENTER CODE",
    it: "ENTRA CON CODICE",
    ru: "ВВЕСТИ КОД"
  },
  room_code_placeholder: {
    en: "CODE",
    it: "CODICE",
    ru: "КОД"
  },

  // Auth Box
  or_save_data: {
    en: "OR SAVE PROGRESS",
    it: "O SALVA I DATI",
    ru: "СОХРАНИТЬ ДАННЫЕ"
  },
  welcome_back: {
    en: "Welcome back! 👋",
    it: "Bentornato! 👋",
    ru: "С возвращением! 👋"
  },
  create_account: {
    en: "Create Account ✨",
    it: "Crea Account ✨",
    ru: "Создать аккаунт ✨"
  },
  register_btn_switch: {
    en: "SIGN UP",
    it: "REGISTRATI",
    ru: "РЕГИСТРАЦИЯ"
  },
  login_btn_switch: {
    en: "LOG IN",
    it: "ACCEDI",
    ru: "ВОЙТИ"
  },
  email_address: {
    en: "Email Address",
    it: "Indirizzo Email",
    ru: "Электронная почта"
  },
  password: {
    en: "Game Password",
    it: "Password di Gioco",
    ru: "Пароль к игре"
  },
  password_placeholder: {
    en: "Minimum 6 chars",
    it: "Minimo 6 caratteri",
    ru: "Мин. 6 символов"
  },
  enter_server: {
    en: "ENTER SERVER",
    it: "ENTRA NEL SERVER",
    ru: "ВОЙТИ НА СЕРВЕР"
  },
  register_now: {
    en: "REGISTER NOW",
    it: "REGISTRATI ORA",
    ru: "РЕГИСТРАЦИЯ"
  },

  // Lobby
  leave_room: {
    en: "LEAVE",
    it: "ESCI",
    ru: "ВЫЙТИ"
  },
  room_code: {
    en: "Room Code:",
    it: "Codice Stanza:",
    ru: "Код Комнаты:"
  },
  waiting_room: {
    en: "Waiting Room",
    it: "Sala d'Attesa",
    ru: "Комната Ожидания"
  },
  waiting_players: {
    en: "Waiting...",
    it: "In attesa...",
    ru: "Ожидание..."
  },
  start_game: { en: "START GAME", it: "INIZIA PARTITA", ru: "НАЧАТЬ ИГРУ" },
  singleplayer_bots: { en: "SINGLEPLAYER (VS BOTS)", it: "SINGLEPLAYER (VS BOTS)", ru: "ОДИНОЧНАЯ ИГРА (БОТЫ)" },
  waiting_for_host: {
    en: "WAITING FOR HOST...",
    it: "IN ATTESA DELL'HOST...",
    ru: "ОЖИДАНИЕ ХОСТА..."
  },

  // Pause & Game Over & Victory
  pause_title: {
    en: "PAUSED",
    it: "IN PAUSA",
    ru: "ПАУЗА"
  },
  resume: {
    en: "RESUME (ESC)",
    it: "RIPRENDI (ESC)",
    ru: "ПРОДОЛЖИТЬ (ESC)"
  },
  abandon: {
    en: "LEAVE GAME",
    it: "ABBANDONA",
    ru: "ПОКИНУТЬ ИГРУ"
  },
  eliminated: {
    en: "ELIMINATED!",
    it: "ELIMINATO!",
    ru: "ВЫБЫЛ!"
  },
  final_score: {
    en: "Final Score",
    it: "Punteggio Finale",
    ru: "Итоговый Счет"
  },
  rounds_survived: {
    en: "Rounds Survived",
    it: "Round Sopravvissuti",
    ru: "Пройдено Раундов"
  },
  try_again: {
    en: "PLAY AGAIN",
    it: "RIPROVA",
    ru: "ИГРАТЬ СНОВА"
  },
  victory: {
    en: "VICTORY ROYALE!",
    it: "VITTORIA REALE!",
    ru: "КОРОЛЕВСКАЯ ПОБЕДА!"
  },
  winner_subtitle: {
    en: "You are the last block standing!",
    it: "Sei l'ultimo blocco rimasto!",
    ru: "Ты последний выживший блок!"
  },

  // In Game HUD
  round: {
    en: "Round",
    it: "Round",
    ru: "Раунд"
  },
  alive: {
    en: "Alive",
    it: "Vivi",
    ru: "Живы"
  },
  go_to_color: {
    en: "GO TO",
    it: "VAI SUL",
    ru: "ИДИ НА"
  },
  red: { en: "RED", it: "ROSSO", ru: "КРАСНЫЙ" },
  blue: { en: "BLUE", it: "BLU", ru: "СИНИЙ" },
  green: { en: "GREEN", it: "VERDE", ru: "ЗЕЛЕНЫЙ" },
  yellow: { en: "YELLOW", it: "GIALLO", ru: "ЖЕЛТЫЙ" },
  purple: { en: "PURPLE", it: "VIOLA", ru: "ФИОЛЕТОВЫЙ" },
  orange: { en: "ORANGE", it: "ARANCIONE", ru: "ОРАНЖЕВЫЙ" },
  pink: { en: "PINK", it: "ROSA", ru: "РОЗОВЫЙ" },
  cyan: { en: "CYAN", it: "AZZURRO", ru: "ГОЛУБОЙ" },
  lime: { en: "LIME", it: "LIME", ru: "ЛАЙМ" },
  white: { en: "WHITE", it: "BIANCO", ru: "БЕЛЫЙ" },
  amber: { en: "AMBER", it: "AMBRA", ru: "ЯНТАРЬ" },
  teal: { en: "TEAL", it: "TEAL", ru: "БИРЮЗОВЫЙ" },
  magenta: { en: "MAGENTA", it: "MAGENTA", ru: "МАДЖЕНТА" },

  // User Profile & Stats
  stats: { en: "STATS", it: "STATISTICHE", ru: "СТАТИСТИКА" },
  shop: { en: "SHOP", it: "NEGOZIO", ru: "МАГАЗИН" },
  save_name: { en: "SAVE", it: "SALVA", ru: "СОХРАНИТЬ" },
  level: { en: "LEVEL", it: "LIVELLO", ru: "УРОВЕНЬ" },
  total_games: { en: "TOTAL GAMES", it: "PARTITE TOTALI", ru: "ВСЕГО ИГР" },
  high_score: { en: "HIGH SCORE", it: "RECORD", ru: "РЕКОРД" },
  active_missions: { en: "ACTIVE MISSIONS", it: "MISSIONI ATTIVE", ru: "АКТИВНЫЕ МИССИИ" },
  player_profile: { en: "PLAYER PROFILE", it: "PROFILO GIOCATORE", ru: "ПРОФИЛЬ ИГРОКА" },
  sign_out: { en: "SIGN OUT", it: "DISCONNETTI", ru: "ВЫЙТИ" },
  inventory: { en: "INVENTORY", it: "INVENTARIO", ru: "ИНВЕНТАРЬ" },
  next_level: { en: "NEXT", it: "PROX", ru: "СЛЕД" },
  collection: { en: "COLLECTION", it: "COLLEZIONE", ru: "КОЛЛЕКЦИЯ" },
  your_name_placeholder: { en: "Your Name...", it: "Tuo Nome...", ru: "Твое имя..." },
  error_updating_name: { en: "Error updating name", it: "Errore durante l'aggiornamento del nome", ru: "Ошибка обновления имени" },
  loading_profile: { en: "Loading Profile...", it: "Caricamento profilo...", ru: "Загрузка профиля..." },
  guest: { en: "Guest", it: "Ospite", ru: "Гость" },
  player: { en: "Player", it: "Giocatore", ru: "Игрок" },
  
  // Shop specific
  shop_pb: { en: "PB SHOP", it: "NEGOZIO PB", ru: "МАГАЗИН PB" },
  buy_pb_desc: { en: "Get Party Blocks to unlock Epic Skins and more!", it: "Ottieni Party Blocks per sbloccare Skin Epiche e molto altro!", ru: "Получите Party Blocks, чтобы разблокировать эпические скины и многое другое!" },
  buy: { en: "BUY", it: "ACQUISTA", ru: "КУПИТЬ" },
  most_popular: { en: "MOST POPULAR", it: "I PIÙ VENDUTI", ru: "САМЫЕ ПОПУЛЯРНЫЕ" },
  best_value: { en: "BEST VALUE", it: "MIGLIOR VALORE", ru: "ЛУЧШАЯ ЦЕНА" },
  
  // Game Over Extra
  account_connected: { en: "Account Connected", it: "Account Connesso", ru: "Аккаунт Подключен" },
  earned: { en: "Earned:", it: "Guadagnati:", ru: "Заработано:" },
  double_pb: { en: "DOUBLE PB (Ad)", it: "RADDOPPIA I PB (Ad)", ru: "УДВОИТЬ PB (Реклама)" },
  safe: { en: "SAFE!", it: "SALVO!", ru: "БЕЗОПАСНАЯ ЗОНА!" },
};

interface I18nStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

export const useI18nStore = create<I18nStore>((set, get) => ({
  // Default to English
  language: 'en',
  
  setLanguage: (lang: Language) => {
    set({ language: lang });
    // Save preference to localStorage purely visual
    if (typeof window !== 'undefined') {
      localStorage.setItem('blockparty_lang', lang);
    }
  },

  // Translation hook that falls back to English if missing, then to raw key
  t: (key: string) => {
    const { language } = get();
    const entry = translations[key];
    if (!entry) {
        console.warn(`Translation key missing: ${key}`);
        return key;
    }
    return entry[language] || entry['en'] || key;
  }
}));

// Initialize language from localStorage logic if exists
if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('blockparty_lang') as Language;
    if (saved && (saved === 'en' || saved === 'it' || saved === 'ru')) {
        useI18nStore.getState().setLanguage(saved);
    }
}
