import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
  RotateCcw,
  Settings, 
  BarChart2, 
  Keyboard, 
  Clock, 
  Type,
  Info,
  Github,
  Twitter,
  User,
  LogIn,
  LogOut,
  Trophy,
  X,
  ChevronRight,
  Activity,
  Sliders
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { WORDS_EN, WORDS_ES, WORDS_FR, WORDS_DE } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TestMode = 'time' | 'words';
type TestState = 'idle' | 'running' | 'finished';
type View = 'test' | 'leaderboard' | 'admin' | 'profile' | 'settings' | 'about';

interface AppSettings {
  themeColor: string;
  secondaryColor: string;
  siteTheme: 'dark' | 'light' | 'midnight' | 'terminal';
  fontFamily: string;
  fontSize: number;
  language: 'en' | 'es' | 'fr' | 'de';
  smoothCaret: boolean;
  caretStyle: 'line' | 'block' | 'underline';
  caretSpeed: 'normal' | 'fast' | 'slow';
  paceCaret: 'none' | 'line' | 'block';
  paceCaretSpeed: number;
  keySounds: 'none' | 'click' | 'beep';
  showKeymap: boolean;
  restartKey: 'tab' | 'esc' | 'alt' | 'none';
}

const DEFAULT_SETTINGS: AppSettings = {
  themeColor: '#10b981', // Emerald
  secondaryColor: '#475569', // Slate
  siteTheme: 'dark',
  fontFamily: 'font-sans',
  fontSize: 1.5,
  language: 'en',
  smoothCaret: true,
  caretStyle: 'line',
  caretSpeed: 'normal',
  paceCaret: 'none',
  paceCaretSpeed: 60,
  keySounds: 'none',
  showKeymap: false,
  restartKey: 'tab',
};

interface HistoryPoint {
  time: number;
  wpm: number;
  rawWpm: number;
  errors: number;
}

interface ProfileStats {
  total_tests: number;
  highest_wpm: number;
  avg_wpm: number;
  avg_accuracy: number;
}

interface ProfileRecentTest {
  wpm: number;
  accuracy: number;
  mode: string;
  created_at: string;
}

interface UserData {
  id: number;
  username: string;
  is_admin: boolean;
  is_banned: boolean;
  ban_reason?: string;
  ban_expires_at?: string;
}

interface AdminUser {
  id: number;
  username: string;
  is_admin: boolean;
  is_banned: boolean;
  is_leaderboard_banned: boolean;
  ban_reason?: string;
  ban_expires_at?: string;
}

interface Announcement {
  id: number;
  content: string;
  created_at: string;
}

interface LeaderboardEntry {
  id: number;
  username: string;
  wpm: number;
  accuracy: number;
  mode: string;
  created_at: string;
}

const Countdown = ({ expiresAt }: { expiresAt: string }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const target = new Date(expiresAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (h > 0) parts.push(`${h}h`);
      if (m > 0 || h > 0) parts.push(`${m}m`);
      parts.push(`${s}s`);
      setTimeLeft(parts.join(" "));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return <span>{timeLeft}</span>;
};

export default function App() {
  // Config
  const [mode, setMode] = useState<TestMode>('time');
  const [timeLimit, setTimeLimit] = useState(30);
  const [wordLimit, setWordLimit] = useState(25);
  const [view, setView] = useState<View>('test');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('swifttype_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('swifttype_settings', JSON.stringify(settings));
    const root = document.documentElement;
    root.style.setProperty('--color-main', settings.themeColor);
    root.style.setProperty('--color-secondary', settings.secondaryColor);
    root.style.setProperty('--color-caret', settings.themeColor);
    root.style.setProperty('--color-correct', settings.themeColor);

    if (settings.siteTheme === 'dark') {
      root.style.setProperty('--color-bg', '#0f172a');
      root.style.setProperty('--color-text', '#f8fafc');
      root.style.setProperty('--color-sub', settings.secondaryColor);
    } else if (settings.siteTheme === 'light') {
      root.style.setProperty('--color-bg', '#f8fafc');
      root.style.setProperty('--color-text', '#0f172a');
      root.style.setProperty('--color-sub', settings.secondaryColor);
    } else if (settings.siteTheme === 'midnight') {
      root.style.setProperty('--color-bg', '#000000');
      root.style.setProperty('--color-text', '#e5e5e5');
      root.style.setProperty('--color-sub', settings.secondaryColor);
    } else if (settings.siteTheme === 'terminal') {
      root.style.setProperty('--color-bg', '#0c0c0c');
      root.style.setProperty('--color-text', settings.themeColor);
      root.style.setProperty('--color-sub', settings.secondaryColor);
    }
    if (settings.caretSpeed === 'fast') root.style.setProperty('--caret-speed', '0.5s');
    else if (settings.caretSpeed === 'slow') root.style.setProperty('--caret-speed', '1.5s');
    else root.style.setProperty('--caret-speed', '1s');
  }, [settings]);
  
  // Auth State
  const [user, setUser] = useState<UserData | null>(() => {
    const saved = localStorage.getItem('swifttype_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Game State
  const [state, setState] = useState<TestState>('idle');
  const [words, setWords] = useState<string[]>([]);
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  
  // Stats
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [rawWpm, setRawWpm] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [keystrokes, setKeystrokes] = useState(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0);
  
  // Leaderboard State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardCategory, setLeaderboardCategory] = useState({ mode: 'time', limit: 30 });
  
  // Admin State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [banModalUser, setBanModalUser] = useState<AdminUser | null>(null);
  const [banReason, setBanReason] = useState("");
  const [banDuration, setBanDuration] = useState("permanent");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<number | null>(null);
  const [showPastAnnouncements, setShowPastAnnouncements] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  
  // Profile State
  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [profileRecentTests, setProfileRecentTests] = useState<ProfileRecentTest[]>([]);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playKeystrokeSound = () => {
    if (settings.keySounds === 'none') return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (settings.keySounds === 'click') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      } else if (settings.keySounds === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      }
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  };
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHistoryTimeRef = useRef<number>(0);
  const userInputRef = useRef(userInput);
  const keystrokesRef = useRef(keystrokes);
  const correctKeystrokesRef = useRef(correctKeystrokes);

  useEffect(() => {
    userInputRef.current = userInput;
    keystrokesRef.current = keystrokes;
    correctKeystrokesRef.current = correctKeystrokes;
  }, [userInput, keystrokes, correctKeystrokes]);

  // Initialize words
  const initTest = () => {
    let wordList = WORDS_EN;
    if (settings.language === 'es') wordList = WORDS_ES;
    if (settings.language === 'fr') wordList = WORDS_FR;
    if (settings.language === 'de') wordList = WORDS_DE;
    
    const shuffled = [...wordList].sort(() => Math.random() - 0.5);
    const count = mode === 'words' ? wordLimit : 100;
    setWords(shuffled.slice(0, count)); 
    setUserInput('');
    setState('idle');
    setTimeLeft(timeLimit);
    setStartTime(null);
    setHistory([]);
    setWpm(0);
    setAccuracy(0);
    setRawWpm(0);
    setErrorCount(0);
    setKeystrokes(0);
    setCorrectKeystrokes(0);
    lastHistoryTimeRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const repeatTest = () => {
    setUserInput('');
    setState('idle');
    setTimeLeft(timeLimit);
    setStartTime(null);
    setHistory([]);
    setWpm(0);
    setAccuracy(0);
    setRawWpm(0);
    setErrorCount(0);
    setKeystrokes(0);
    setCorrectKeystrokes(0);
    lastHistoryTimeRef.current = 0;
    if (timerRef.current) clearInterval(timerRef.current);
  };

  useEffect(() => {
    initTest();
  }, [mode, timeLimit, wordLimit, settings.language]);

  // Restart Key Logic
  useEffect(() => {
    const handleRestartKey = (e: KeyboardEvent) => {
      if (settings.restartKey === 'none') return;
      if (
        (settings.restartKey === 'tab' && e.key === 'Tab') ||
        (settings.restartKey === 'esc' && e.key === 'Escape') ||
        (settings.restartKey === 'alt' && e.key === 'Alt')
      ) {
        e.preventDefault();
        initTest();
        if (view === 'test' && !showAuthModal) {
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleRestartKey);
    return () => window.removeEventListener('keydown', handleRestartKey);
  }); // Re-bind on every render to ensure initTest is fresh

  // Focus input on any keypress or click
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (showAuthModal || view !== 'test') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab') return;
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showAuthModal, view]);

  // Timer Logic
  useEffect(() => {
    if (state === 'running') {
      timerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - (startTime || now)) / 1000;
        
        if (mode === 'time') {
          const remaining = Math.max(0, timeLimit - Math.floor(elapsed));
          setTimeLeft(remaining);
          if (remaining === 0) finishTest();
        }

        // Calculate real-time stats
        calculateStats(elapsed);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state, startTime, mode, timeLimit]);

  const calculateStats = (elapsed: number, currentInput?: string, currentKs?: number, currentCks?: number) => {
    if (elapsed <= 0.5) return;
    
    const input = currentInput !== undefined ? currentInput : userInputRef.current;
    const ks = currentKs !== undefined ? currentKs : keystrokesRef.current;
    const cks = currentCks !== undefined ? currentCks : correctKeystrokesRef.current;

    const targetText = words.join(' ');
    let currentCorrectChars = 0;
    let currentErrors = 0;
    
    // Calculate what's currently correct in the input field
    for (let i = 0; i < input.length; i++) {
      if (input[i] === targetText[i]) {
        currentCorrectChars++;
      } else {
        currentErrors++;
      }
    }

    const minutes = elapsed / 60;
    
    // Net WPM: Standard WPM based on correct characters currently in the input
    // This rewards accuracy and penalizes uncorrected errors
    const currentWpm = Math.round((currentCorrectChars / 5) / minutes);
    
    // Raw WPM: Based on total keystrokes (effort/speed)
    const currentRawWpm = Math.round((ks / 5) / minutes);
    
    // Accuracy: Based on total keystrokes vs correct ones typed
    const currentAccuracy = ks > 0 ? Math.round((cks / ks) * 100) : 0;

    setWpm(currentWpm);
    setRawWpm(currentRawWpm);
    setAccuracy(currentAccuracy);
    setErrorCount(currentErrors);

    const floorTime = Math.floor(elapsed);
    if (floorTime > lastHistoryTimeRef.current) {
      setHistory(prev => [
        ...prev,
        { 
          time: floorTime, 
          wpm: currentWpm, 
          rawWpm: currentRawWpm,
          errors: currentErrors
        }
      ]);
      lastHistoryTimeRef.current = floorTime;
    }
  };

  const finishTest = () => {
    setState('finished');
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Submit score if logged in
    if (user) {
      submitScore();
    }
  };

  const submitScore = async () => {
    if (!user?.id) return;
    
    // Don't submit if it's a custom word count (not 10, 25, 50, 100) or custom time (not 15, 30, 60, 120)
    const standardTimes = [15, 30, 60, 120];
    const standardWords = [10, 25, 50, 100];
    if (mode === 'time' && !standardTimes.includes(timeLimit)) return;
    if (mode === 'words' && !standardWords.includes(wordLimit)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          wpm,
          accuracy,
          mode: `${mode} ${mode === 'time' ? timeLimit : wordLimit}`
        })
      });
      
      if (res.status === 403) {
        // User might be banned, refresh status
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/me`, {
          headers: { 'x-user-id': user.id.toString() }
        })
        .then(r => r.json())
        .then(data => {
          if (data.id) {
            setUser(data);
            localStorage.setItem('swifttype_user', JSON.stringify(data));
          }
        });
      }
    } catch (err) {
      console.error("Failed to submit score", err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/leaderboard?mode=${leaderboardCategory.mode}&limit=${leaderboardCategory.limit}`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch leaderboard");
        setLeaderboard(data);
      } else {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    }
  };

  useEffect(() => {
    if (view === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [view, leaderboardCategory]);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/announcements`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setAnnouncements(data);
      } else {
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
    } catch (err) {
      console.error("Failed to fetch announcements", err);
    }
  };

  const fetchAdminUsers = async () => {
    if (!user?.is_admin || !user?.id) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/users`, {
        headers: { 'x-admin-id': user.id.toString() }
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP error! status: ${res.status}`);
        setAdminUsers(data);
      } else {
        const text = await res.text();
        console.error("Non-JSON response received:", text.substring(0, 100));
        throw new Error(`Server returned non-JSON response (${res.status})`);
      }
    } catch (err: any) {
      console.error("Failed to fetch admin users", err);
      setAuthError(err.message || "Failed to fetch admin users");
    } finally {
      setAdminLoading(false);
    }
  };

  const handleUserAction = async (targetUserId: number, action: string, reason?: string, duration?: string) => {
    if (!user?.is_admin) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/user-action`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-id': user.id.toString()
        },
        body: JSON.stringify({ targetUserId, action, reason, duration })
      });
      if (res.ok) {
        fetchAdminUsers();
        setBanModalUser(null);
        setBanReason("");
        setBanDuration("permanent");
      }
    } catch (err) {
      console.error("Failed to perform admin action", err);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}/stats`);
      const data = await res.json();
      setProfileStats(data.stats);
      setProfileRecentTests(data.recent_tests);
    } catch (err) {
      console.error("Failed to fetch profile stats", err);
    }
  };

  const handleUpdateUsername = async () => {
    if (!user) return;
    setProfileError('');
    setProfileSuccess('');
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}/username`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername })
      });
      const data = await res.json();
      
      if (res.ok) {
        const updatedUser = { ...user, username: data.username };
        setUser(updatedUser);
        localStorage.setItem('swifttype_user', JSON.stringify(updatedUser));
        setProfileSuccess('Username updated successfully');
        setEditingUsername(false);
      } else {
        setProfileError(data.error || 'Failed to update username');
      }
    } catch (err) {
      setProfileError('Network error');
    }
  };

  const handleAnnounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.is_admin || !announcementInput.trim()) return;
    try {
      const url = editingAnnouncementId 
        ? `${import.meta.env.VITE_API_URL || ''}/api/admin/announce/${editingAnnouncementId}`
        : `${import.meta.env.VITE_API_URL || ''}/api/admin/announce`;
        
      const res = await fetch(url, {
        method: editingAnnouncementId ? 'PUT' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-id': user.id.toString()
        },
        body: JSON.stringify({ content: announcementInput })
      });
      if (res.ok) {
        setAnnouncementInput('');
        setEditingAnnouncementId(null);
        fetchAnnouncements();
      }
    } catch (err) {
      console.error("Failed to save announcement", err);
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!user?.is_admin || !confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/announce/${id}`, {
        method: 'DELETE',
        headers: { 
          'x-admin-id': user.id.toString()
        }
      });
      if (res.ok) {
        if (editingAnnouncementId === id) {
          setEditingAnnouncementId(null);
          setAnnouncementInput('');
        }
        fetchAnnouncements();
      }
    } catch (err) {
      console.error("Failed to delete announcement", err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    // Refresh user data if logged in
    if (user?.id) {
      fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/me`, {
        headers: { 'x-user-id': user.id.toString() }
      })
      .then(res => res.json())
      .then(data => {
        if (data.id) {
          setUser(data);
          localStorage.setItem('swifttype_user', JSON.stringify(data));
        }
      })
      .catch(err => console.error("Failed to refresh user", err));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (state === 'finished') return;
    
    let currentStartTime = startTime;
    if (state === 'idle') {
      currentStartTime = Date.now();
      setStartTime(currentStartTime);
      setState('running');
    }
    
    const val = e.target.value;
    const targetText = words.join(' ');
    
    let newKeystrokes = keystrokes;
    let newCorrectKeystrokes = correctKeystrokes;

    if (val.length > userInput.length) {
      playKeystrokeSound();
      newKeystrokes++;
      setKeystrokes(newKeystrokes);
      if (val[val.length - 1] === targetText[val.length - 1]) {
        newCorrectKeystrokes++;
        setCorrectKeystrokes(newCorrectKeystrokes);
      }
    }
    
    setUserInput(val);

    // Calculate real-time stats immediately for smoother UI
    if (currentStartTime) {
      const elapsed = (Date.now() - currentStartTime) / 1000;
      calculateStats(elapsed, val, newKeystrokes, newCorrectKeystrokes);
    }

    if (mode === 'words') {
      if (val.length >= targetText.length) {
        finishTest();
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? `${import.meta.env.VITE_API_URL || ''}/api/auth/login` : `${import.meta.env.VITE_API_URL || ''}/api/auth/signup`;
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (res.ok) {
          setUser(data);
          localStorage.setItem('swifttype_user', JSON.stringify(data));
          setShowAuthModal(false);
          setAuthForm({ username: '', password: '' });
        } else {
          setAuthError(data.error);
        }
      } else {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        setAuthError(`Server error: ${res.status}`);
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      setAuthError(`Connection error: ${err.message || 'Unknown error'}`);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('swifttype_user');
  };

  const [paceIndex, setPaceIndex] = useState(0);

  useEffect(() => {
    if (state === 'running' && settings.paceCaret !== 'none') {
      const charsPerSecond = (settings.paceCaretSpeed * 5) / 60;
      const interval = setInterval(() => {
        const elapsed = (Date.now() - (startTime || Date.now())) / 1000;
        setPaceIndex(Math.floor(elapsed * charsPerSecond));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setPaceIndex(0);
    }
  }, [state, startTime, settings.paceCaret, settings.paceCaretSpeed]);

  // Rendering logic for words
  const renderWords = useMemo(() => {
    const getCaretClass = (style: string) => {
      if (style === 'block') return "absolute left-0 top-0 w-full h-[100%] bg-main/50";
      if (style === 'underline') return "absolute left-0 bottom-0 w-full h-[2px] bg-main";
      return "absolute -left-[1px] top-[10%] w-[2px] h-[80%] bg-main shadow-[0_0_8px_var(--color-main)]";
    };

    return (
      <div 
        className="relative leading-relaxed tracking-tight select-none h-[140px] overflow-hidden font-mono"
        style={{ fontSize: `${settings.fontSize}rem` }}
      >
        <div className="flex flex-wrap gap-x-[0.3em] gap-y-2">
          {words.map((word, wordIdx) => {
            const wordStartIdx = words.slice(0, wordIdx).join(' ').length + (wordIdx > 0 ? 1 : 0);
            const wordEndIdx = wordStartIdx + word.length;
            
            return (
              <span key={wordIdx} className="relative">
                {word.split('').map((char, charIdx) => {
                  const absoluteIdx = wordStartIdx + charIdx;
                  const isTyped = absoluteIdx < userInput.length;
                  const isCorrect = isTyped && userInput[absoluteIdx] === char;
                  const isWrong = isTyped && userInput[absoluteIdx] !== char;
                  const isCurrent = absoluteIdx === userInput.length;
                  
                  return (
                    <span 
                      key={charIdx}
                      className={cn(
                        "transition-all duration-150 relative",
                        !isTyped && "text-sub/60",
                        isCorrect && "text-correct",
                        isWrong && "text-error border-b-2 border-error",
                      )}
                    >
                      {isCurrent && (
                        <motion.div 
                          layoutId="caret"
                          className={cn(getCaretClass(settings.caretStyle), "caret-blink")}
                          transition={settings.smoothCaret ? { type: 'spring', stiffness: 500, damping: 30 } : { duration: 0 }}
                        />
                      )}
                      {settings.paceCaret !== 'none' && absoluteIdx === paceIndex && (
                        <motion.div 
                          layoutId="paceCaret"
                          className={cn(getCaretClass(settings.paceCaret), "opacity-50")}
                          transition={{ type: 'tween', duration: 0.1 }}
                        />
                      )}
                      {char}
                    </span>
                  );
                })}
                {wordIdx < words.length - 1 && (
                  <span className={cn(
                    "transition-all duration-150 relative",
                    userInput.length > wordEndIdx ? (userInput[wordEndIdx] === ' ' ? 'text-sub/40' : 'bg-error/20 text-error') : 'text-sub/40',
                  )}>
                    {userInput.length === wordEndIdx && (
                       <motion.div 
                        layoutId="caret"
                        className={cn(getCaretClass(settings.caretStyle), "caret-blink")}
                        transition={settings.smoothCaret ? { type: 'spring', stiffness: 500, damping: 30 } : { duration: 0 }}
                      />
                    )}
                    {settings.paceCaret !== 'none' && wordEndIdx === paceIndex && (
                      <motion.div 
                        layoutId="paceCaret"
                        className={cn(getCaretClass(settings.paceCaret), "opacity-50")}
                        transition={{ type: 'tween', duration: 0.1 }}
                      />
                    )}
                    &nbsp;
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    );
  }, [words, userInput, settings, paceIndex]);

  const renderKeymap = useCallback(() => {
    const rows = [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm']
    ];

    const nextChar = words.join(' ')[userInput.length]?.toLowerCase();

    return (
      <div className="flex flex-col gap-2 items-center opacity-50 pointer-events-none select-none">
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-2">
            {row.map(key => {
              const isNext = key === nextChar;
              return (
                <div
                  key={key}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold uppercase transition-all duration-200",
                    isNext 
                      ? "bg-main text-bg shadow-[0_0_15px_var(--color-main)] scale-110" 
                      : "bg-white/5 text-sub border border-white/10"
                  )}
                >
                  {key}
                </div>
              );
            })}
          </div>
        ))}
        <div 
          className={cn(
            "h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200",
            nextChar === ' ' 
              ? "bg-main text-bg shadow-[0_0_15px_var(--color-main)] scale-105 w-64" 
              : "bg-white/5 text-sub border border-white/10 w-48"
          )}
        >
          SPACE
        </div>
      </div>
    );
  }, [words, userInput]);

  const isBanned = user?.is_banned && !user?.is_admin;

  if (isBanned) {
    return (
      <div className="min-h-screen bg-[#111111] text-[#eeeeee] flex items-center justify-center p-4 font-mono">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#1a1a1a] border border-red-900/30 rounded-2xl p-8 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold mb-4 text-red-500 tracking-tight uppercase">Access Denied</h1>
          <p className="text-gray-400 mb-8 leading-relaxed">
            Your account (<span className="text-white">{user?.username}</span>) has been {user?.ban_expires_at ? 'temporarily' : 'permanently'} banned from Swifttype.
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-sm text-left">
              <div className="text-gray-500 uppercase text-[10px] font-bold tracking-widest mb-1 text-center">Reason</div>
              <div className="text-gray-300 italic text-center">"{user?.ban_reason || "Suspicious activity or community violation"}"</div>
            </div>
            {user?.ban_expires_at && (
              <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-sm text-left">
                <div className="text-gray-500 uppercase text-[10px] font-bold tracking-widest mb-1 text-center">Unbans In</div>
                <div className="text-gray-300 text-center font-mono text-lg">
                  <Countdown expiresAt={user.ban_expires_at} />
                </div>
              </div>
            )}
            <button 
              onClick={() => {
                setUser(null);
                localStorage.removeItem('swifttype_user');
              }}
              className="w-full py-3 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-[10px] text-gray-600 uppercase tracking-[0.2em]">
            Swifttype Security Protocol v2.4.0
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex flex-col items-center px-4 py-12 max-w-6xl mx-auto", settings.fontFamily)}>
      {/* Header */}
      <header className="w-full flex justify-between items-center mb-20 bg-bg/80 backdrop-blur-md sticky top-0 z-50 py-4 border-b border-white/5">
        <div className="flex items-center gap-4 group cursor-pointer" onClick={() => { setView('test'); initTest(); }}>
          <div className="p-2 bg-main/10 rounded-xl border border-main/20 group-hover:bg-main/20 transition-all">
            <Keyboard className="w-6 h-6 text-main" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text">SwiftType</h1>
        </div>
        
        <nav className="flex gap-8 text-sub text-sm font-medium items-center">
          <button onClick={() => setView('test')} className={cn("hover:text-main transition-colors flex items-center gap-2", view === 'test' && "text-main")}><Keyboard size={16} /> Test</button>
          <button onClick={() => { setView('leaderboard'); fetchLeaderboard(); }} className={cn("hover:text-main transition-colors flex items-center gap-2", view === 'leaderboard' && "text-main")}><Trophy size={16} /> Leaderboard</button>
          <button onClick={() => setView('about')} className={cn("hover:text-main transition-colors flex items-center gap-2", view === 'about' && "text-main")}><Info size={16} /> About</button>
          <button onClick={() => setView('settings')} className={cn("hover:text-main transition-colors flex items-center gap-2", view === 'settings' && "text-main")}><Sliders size={16} /> Settings</button>
          {user?.is_admin && (
            <button onClick={() => { setView('admin'); fetchAdminUsers(); }} className={cn("hover:text-main transition-colors flex items-center gap-2", view === 'admin' && "text-main")}><Settings size={16} /> Admin</button>
          )}
          
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          
          {user ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={() => { setView('profile'); fetchProfile(); setNewUsername(user.username); setProfileError(''); setProfileSuccess(''); setEditingUsername(false); }}
                className={cn(
                  "flex items-center gap-2 text-text hover:bg-white/5 px-3 py-1.5 rounded-xl transition-all border border-transparent",
                  view === 'profile' && "bg-white/5 border-white/10"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-main/20 flex items-center justify-center text-main border border-main/20">
                  <User size={16} />
                </div>
                <div className="flex flex-col items-start -space-y-1">
                  <span className="font-bold">{user.username}</span>
                  <span className="text-[10px] text-sub font-mono">#{user.id.toString().padStart(4, '0')}</span>
                </div>
                {user.is_admin && (
                  <span className="px-2 py-0.5 bg-main/20 text-main text-[10px] font-black uppercase tracking-widest rounded-md border border-main/30 ml-2">
                    Admin
                  </span>
                )}
              </button>
              <button onClick={logout} className="text-sub hover:text-error transition-colors p-2 rounded-xl hover:bg-error/10"><LogOut size={18} /></button>
            </div>
          ) : (
            <button 
              onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
              className="flex items-center gap-2 bg-main/10 text-main px-4 py-2 rounded-xl border border-main/20 hover:bg-main/20 transition-all"
            >
              <LogIn size={16} /> Sign In
            </button>
          )}
        </nav>
      </header>

      <main className="w-full flex-1 flex flex-col items-center">
        <AnimatePresence mode="wait">
          {view === 'test' ? (
            state !== 'finished' ? (
              <motion.div 
                key="typing"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="w-full max-w-4xl"
              >
                {/* Announcements */}
                {announcements.length > 0 && state === 'idle' && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-12 w-full max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center gap-2 text-sub text-[10px] font-bold uppercase tracking-widest mb-2 px-4">
                      <Info size={12} className="text-main" /> Latest Announcement
                    </div>
                    <div className="p-4 rounded-2xl bg-main/10 border border-main/20 text-sm text-text leading-relaxed shadow-lg shadow-main/5">
                      {announcements[0].content}
                      <div className="text-[10px] opacity-60 mt-2 font-mono">{new Date(announcements[0].created_at).toLocaleString()}</div>
                    </div>
                  </motion.div>
                )}

                {/* Controls */}
                <div className="flex justify-center mb-12">
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-1.5 flex gap-2 border border-white/10 shadow-xl">
                    <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl">
                      <button onClick={() => setMode('time')} className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all", mode === 'time' ? 'bg-main text-bg shadow-lg shadow-main/20' : 'text-sub hover:text-text')}>Time</button>
                      <button onClick={() => setMode('words')} className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all", mode === 'words' ? 'bg-main text-bg shadow-lg shadow-main/20' : 'text-sub hover:text-text')}>Words</button>
                    </div>
                    <div className="flex items-center gap-2 px-4">
                      {mode === 'time' ? [15, 30, 60, 120].map(t => (
                        <button key={t} onClick={() => setTimeLimit(t)} className={cn("w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center", timeLimit === t ? 'text-main bg-main/10 border border-main/20' : 'text-sub hover:text-text hover:bg-white/5')}>{t}</button>
                      )) : [10, 25, 50, 100].map(w => (
                        <button key={w} onClick={() => setWordLimit(w)} className={cn("w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center", wordLimit === w ? 'text-main bg-main/10 border border-main/20' : 'text-sub hover:text-text hover:bg-white/5')}>{w}</button>
                      ))}
                      <button 
                        onClick={() => {
                          const val = prompt("Enter custom count:");
                          if (val) {
                            const n = parseInt(val);
                            if (!isNaN(n) && n > 0) {
                              if (mode === 'time') setTimeLimit(n);
                              else setWordLimit(n);
                            }
                          }
                        }} 
                        className="text-sub hover:text-text text-[10px] font-bold uppercase tracking-widest px-2 transition-colors"
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-end justify-between mb-8 px-4">
                  <div className="flex flex-col">
                    <span className="text-sub text-xs font-bold uppercase tracking-widest mb-1">Remaining</span>
                    <div className="text-main text-4xl font-black tracking-tighter">
                      {mode === 'time' ? timeLeft : `${userInput.trim() === '' ? 0 : userInput.trim().split(/\s+/).length}/${wordLimit}`}
                    </div>
                  </div>
                  {state === 'running' && (
                    <div className="flex gap-12">
                      <div className="flex flex-col items-end">
                        <span className="text-sub text-xs font-bold uppercase tracking-widest mb-1">WPM</span>
                        <span className="text-text text-3xl font-black">{wpm}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-sub text-xs font-bold uppercase tracking-widest mb-1">ACC</span>
                        <span className="text-text text-3xl font-black">{accuracy}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Typing Area */}
                <div className={cn("relative p-10 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-sm cursor-text group transition-all hover:border-white/10", settings.fontFamily)} onClick={() => inputRef.current?.focus()}>
                  <div className="absolute inset-0 bg-gradient-to-br from-main/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                  <input ref={inputRef} type="text" className="absolute opacity-0 pointer-events-none" value={userInput} onChange={handleInputChange} autoFocus />
                  {renderWords}
                </div>

                {/* Keymap */}
                {settings.showKeymap && (
                  <div className="mt-12 w-full max-w-3xl mx-auto">
                    {renderKeymap()}
                  </div>
                )}

                {/* Reset Button */}
                <div className="mt-16 flex justify-center">
                  <button onClick={initTest} className="group relative p-4 rounded-2xl bg-white/5 hover:bg-main/10 border border-white/10 hover:border-main/20 transition-all" title={`Restart (${settings.restartKey && settings.restartKey !== 'none' ? settings.restartKey.toUpperCase() : 'Click'})`}>
                    <RefreshCw size={24} className="text-sub group-hover:text-main group-hover:rotate-180 transition-all duration-500" />
                  </button>
                </div>

                {/* Past Announcements Button */}
                {announcements.length > 1 && state === 'idle' && (
                  <div className="mt-8 flex justify-center">
                    <button 
                      onClick={() => setShowPastAnnouncements(true)}
                      className="text-sub hover:text-text text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                    >
                      <Info size={14} /> View Past Announcements
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="results" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="w-full grid grid-cols-1 lg:grid-cols-4 gap-10">
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <div className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-20 font-mono text-xs">
                      #{user?.id.toString().padStart(4, '0')}
                    </div>
                    <div className="text-sub text-xs font-bold uppercase tracking-widest mb-2">Speed</div>
                    <div className="text-main text-7xl font-black tracking-tighter">{wpm}</div>
                    <div className="text-sub text-sm mt-1">Words Per Minute</div>
                  </div>
                  <div className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl">
                    <div className="text-sub text-xs font-bold uppercase tracking-widest mb-2">Accuracy</div>
                    <div className="text-main text-7xl font-black tracking-tighter">{accuracy}%</div>
                    <div className="text-sub text-sm mt-1">Correct Characters</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="text-sub text-[10px] font-bold uppercase tracking-widest mb-1">Raw</div>
                      <div className="text-text text-xl font-bold">{rawWpm}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="text-sub text-[10px] font-bold uppercase tracking-widest mb-1">Errors</div>
                      <div className="text-error text-xl font-bold">{errorCount}</div>
                    </div>
                  </div>
                  <button onClick={initTest} className="mt-4 bg-main text-bg font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-main/20" title={`Restart (${settings.restartKey && settings.restartKey !== 'none' ? settings.restartKey.toUpperCase() : 'Click'})`}>
                    <RefreshCw size={20} /> Try Again
                  </button>
                  <button onClick={repeatTest} className="mt-2 bg-white/5 text-text font-bold py-4 rounded-2xl flex items-center justify-center gap-3 border border-white/10 transition-all hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]" title="Repeat with same words">
                    <RotateCcw size={18} /> Repeat Test
                  </button>
                </div>

                <div className="lg:col-span-3 flex flex-col gap-6">
                  <div className="h-[450px] bg-white/5 rounded-3xl p-8 border border-white/10 shadow-xl">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-lg font-bold text-text">Performance History</h3>
                      <div className="flex gap-4 text-xs font-bold uppercase tracking-widest">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-main" /> WPM</div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-sub" /> Raw</div>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height="80%">
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" vertical={false} opacity={0.1} />
                        <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#10b981', fontWeight: 'bold' }} cursor={{ stroke: '#10b981', strokeWidth: 2, strokeDasharray: '5 5' }} />
                        <Line type="monotone" dataKey="wpm" stroke="#10b981" strokeWidth={4} dot={{ fill: '#10b981', r: 4, strokeWidth: 0 }} activeDot={{ r: 8, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="rawWpm" stroke="#475569" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </motion.div>
            )
          ) : view === 'leaderboard' ? (
            <motion.div key="leaderboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-main/10 rounded-2xl border border-main/20">
                    <Trophy className="w-8 h-8 text-main" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-text">Global Leaderboard</h2>
                    <p className="text-sub text-sm">Top 10 fastest typists in the world</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
                  <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
                    <button 
                      onClick={() => setLeaderboardCategory(prev => ({ ...prev, mode: 'time' }))}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                        leaderboardCategory.mode === 'time' ? "bg-main text-black" : "text-sub hover:text-text"
                      )}
                    >
                      Time
                    </button>
                    <button 
                      onClick={() => setLeaderboardCategory(prev => ({ ...prev, mode: 'words' }))}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                        leaderboardCategory.mode === 'words' ? "bg-main text-black" : "text-sub hover:text-text"
                      )}
                    >
                      Words
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {leaderboardCategory.mode === 'time' ? (
                      [15, 30, 60, 120].map(limit => (
                        <button
                          key={limit}
                          onClick={() => setLeaderboardCategory(prev => ({ ...prev, limit }))}
                          className={cn(
                            "w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center",
                            leaderboardCategory.limit === limit ? "text-main bg-main/10 border border-main/20" : "text-sub hover:text-text"
                          )}
                        >
                          {limit}
                        </button>
                      ))
                    ) : (
                      [10, 25, 50, 100].map(limit => (
                        <button
                          key={limit}
                          onClick={() => setLeaderboardCategory(prev => ({ ...prev, limit }))}
                          className={cn(
                            "w-10 h-10 rounded-xl text-sm font-bold transition-all flex items-center justify-center",
                            leaderboardCategory.limit === limit ? "text-main bg-main/10 border border-main/20" : "text-sub hover:text-text"
                          )}
                        >
                          {limit}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <button onClick={() => setView('test')} className="text-sub hover:text-text transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                  Back to test <ChevronRight size={16} />
                </button>
              </div>

              <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5 text-sub text-[10px] font-bold uppercase tracking-[0.2em]">
                      <th className="px-8 py-6">Rank</th>
                      <th className="px-8 py-6">ID</th>
                      <th className="px-8 py-6">User</th>
                      <th className="px-8 py-6">WPM</th>
                      <th className="px-8 py-6">Accuracy</th>
                      <th className="px-8 py-6">Mode</th>
                      <th className="px-8 py-6">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {leaderboard.map((entry, idx) => (
                      <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-6">
                          <span className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm",
                            idx === 0 ? "bg-main text-bg" : "bg-white/5 text-sub"
                          )}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-mono text-xs text-sub">
                          #{entry.id.toString().padStart(4, '0')}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sub group-hover:text-main transition-colors">
                              <User size={14} />
                            </div>
                            <span className="font-bold text-text">{entry.username}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6 font-black text-main text-xl">{entry.wpm}</td>
                        <td className="px-8 py-6 text-text font-medium">{entry.accuracy}%</td>
                        <td className="px-8 py-6 text-sub text-xs font-bold uppercase tracking-widest">{entry.mode}</td>
                        <td className="px-8 py-6 text-sub text-xs">{new Date(entry.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : view === 'admin' && user?.is_admin ? (
            <motion.div key="admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-5xl">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-main/10 rounded-2xl border border-main/20">
                    <Settings className="w-8 h-8 text-main" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-text">Admin Dashboard</h2>
                    <p className="text-sub text-sm">Manage users and system announcements</p>
                  </div>
                </div>
                <button onClick={() => setView('test')} className="text-sub hover:text-text transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                  Back to test <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Announcement Section */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl">
                    <h3 className="text-lg font-bold text-text mb-6">{editingAnnouncementId ? 'Edit Announcement' : 'Post Announcement'}</h3>
                    <form onSubmit={handleAnnounce} className="space-y-4">
                      <textarea
                        value={announcementInput}
                        onChange={(e) => setAnnouncementInput(e.target.value)}
                        placeholder="Type announcement here..."
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-text focus:outline-none focus:border-main/50 transition-all resize-none"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-main text-bg font-black py-4 rounded-xl shadow-lg shadow-main/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                          {editingAnnouncementId ? 'Save Changes' : 'Post Announcement'}
                        </button>
                        {editingAnnouncementId && (
                          <button 
                            type="button" 
                            onClick={() => {
                              setEditingAnnouncementId(null);
                              setAnnouncementInput('');
                            }}
                            className="px-4 bg-white/10 text-text font-bold rounded-xl hover:bg-white/20 transition-all"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {announcements.length > 0 && (
                    <div className="p-8 rounded-3xl bg-white/5 border border-white/10 shadow-xl">
                      <h3 className="text-lg font-bold text-text mb-6">Manage Announcements</h3>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {announcements.map(ann => (
                          <div key={ann.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-sub relative group">
                            <div className="pr-16 leading-relaxed">
                              {ann.content}
                            </div>
                            <div className="text-[10px] opacity-40 mt-2">{new Date(ann.created_at).toLocaleString()}</div>
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => {
                                  setEditingAnnouncementId(ann.id);
                                  setAnnouncementInput(ann.content);
                                }}
                                className="p-2 bg-white/10 rounded-lg hover:bg-white/20 text-text transition-colors"
                                title="Edit"
                              >
                                <Settings size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                className="p-2 bg-error/10 rounded-lg hover:bg-error/20 text-error transition-colors"
                                title="Delete"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Management Section */}
                <div className="lg:col-span-2">
                  <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                    <div className="px-8 py-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-text">User Management</h3>
                        <p className="text-sub text-xs">Total users: {adminUsers.length}</p>
                      </div>
                      <div className="relative w-full md:w-64">
                        <input 
                          type="text" 
                          placeholder="Search name or ID..." 
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-text focus:outline-none focus:border-main/50 transition-all"
                        />
                      </div>
                      {adminLoading && <RefreshCw size={16} className="animate-spin text-main" />}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white/5 text-sub text-[10px] font-bold uppercase tracking-[0.2em]">
                            <th className="px-8 py-4">ID</th>
                            <th className="px-8 py-4">User</th>
                            <th className="px-8 py-4">Status</th>
                            <th className="px-8 py-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {adminUsers
                            .filter(u => 
                              u.username.toLowerCase().includes(adminSearch.toLowerCase()) || 
                              u.id.toString() === adminSearch ||
                              u.id.toString().padStart(4, '0') === adminSearch
                            )
                            .map((u) => (
                              <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-8 py-4 font-mono text-xs text-sub">
                                  #{u.id.toString().padStart(4, '0')}
                                </td>
                                <td className="px-8 py-4">
                                  <div className="flex items-center gap-3">
                                    <span className="font-bold text-text">{u.username}</span>
                                    {u.is_admin && <span className="px-1.5 py-0.5 bg-main/20 text-main text-[8px] font-black uppercase rounded border border-main/30">Admin</span>}
                                  </div>
                                </td>
                              <td className="px-8 py-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex gap-2">
                                    {u.is_banned && <span className="px-1.5 py-0.5 bg-error/20 text-error text-[8px] font-black uppercase rounded border border-error/30">Banned</span>}
                                    {u.is_leaderboard_banned && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-500 text-[8px] font-black uppercase rounded border border-orange-500/30">LB Banned</span>}
                                  </div>
                                  {u.is_banned && u.ban_expires_at && (
                                    <div className="text-[9px] text-error/60 font-mono">
                                      Ends in: <Countdown expiresAt={u.ban_expires_at} />
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {u.is_banned ? (
                                    <button onClick={() => handleUserAction(u.id, 'unban')} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">Unban</button>
                                  ) : (
                                    <button onClick={() => setBanModalUser(u)} className="px-3 py-1 bg-error/10 text-error text-[10px] font-bold uppercase rounded-lg border border-error/20 hover:bg-error/20 transition-all">Ban</button>
                                  )}
                                  
                                  {u.is_leaderboard_banned ? (
                                    <button onClick={() => handleUserAction(u.id, 'leaderboard_unban')} className="px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase rounded-lg border border-orange-500/20 hover:bg-orange-500/20 transition-all">LB Unban</button>
                                  ) : (
                                    <button onClick={() => handleUserAction(u.id, 'leaderboard_ban')} className="px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase rounded-lg border border-orange-500/20 hover:bg-orange-500/20 transition-all">LB Ban</button>
                                  )}

                                  {u.is_admin ? (
                                    <button onClick={() => handleUserAction(u.id, 'demote')} className="px-3 py-1 bg-sub/10 text-sub text-[10px] font-bold uppercase rounded-lg border border-sub/20 hover:bg-sub/20 transition-all">Demote</button>
                                  ) : (
                                    <button onClick={() => handleUserAction(u.id, 'mod')} className="px-3 py-1 bg-main/10 text-main text-[10px] font-bold uppercase rounded-lg border border-main/20 hover:bg-main/20 transition-all">Mod</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'about' ? (
            <motion.div key="about" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-main/10 rounded-2xl border border-main/20">
                    <Info className="w-8 h-8 text-main" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-text">About SwiftType</h2>
                    <p className="text-sub text-sm">Learn more about the project and the team</p>
                  </div>
                </div>
                <button onClick={() => setView('test')} className="text-sub hover:text-text transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                  Back to test <ChevronRight size={16} />
                </button>
              </div>

              <div className="bg-white/5 rounded-3xl border border-white/10 p-12 shadow-2xl space-y-8 text-lg leading-relaxed text-sub">
                <p>
                  SwiftType is a modern, high-performance typing test application designed for speed, accuracy, and style. 
                  Our mission is to provide the most fluid and customizable typing experience on the web. 
                  Whether you're a professional developer, a competitive typist, or just someone looking to improve their skills, 
                  SwiftType offers the tools and feedback you need to reach your full potential.
                </p>
                <p>
                  Built with cutting-edge technologies like React, Tailwind CSS, and Framer Motion, 
                  SwiftType is not just a tool; it's a platform for growth. 
                  We believe that typing is a fundamental skill in the digital age, 
                  and we're committed to making the process of mastering it as engaging and rewarding as possible.
                </p>
                <p>
                  Our community is at the heart of everything we do. 
                  From our global leaderboards to our active social channels, 
                  we're constantly inspired by the dedication and talent of our users. 
                  We're always listening to your feedback and working hard to bring you new features, 
                  themes, and improvements that make SwiftType even better.
                </p>
                <p>
                  At Krush Studios, we're passionate about creating beautiful, functional, and user-centric software. 
                  SwiftType is the result of countless hours of design, development, and testing, 
                  and we're incredibly proud to share it with the world. 
                  We hope you enjoy using SwiftType as much as we enjoyed building it.
                </p>
                <p>
                  Thank you for being a part of our journey. 
                  Keep typing, keep improving, and keep pushing the boundaries of what's possible.
                </p>
                <div className="pt-8 border-t border-white/5 text-main font-black italic text-2xl">
                  - Krush Studios ♥
                </div>
              </div>
            </motion.div>
          ) : view === 'profile' && user ? (
            <motion.div key="profile" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl">
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-main/10 rounded-2xl border border-main/20">
                    <User className="w-8 h-8 text-main" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-text">Your Profile</h2>
                    <p className="text-sub text-sm">Manage your account and view statistics</p>
                  </div>
                </div>
                <button onClick={() => setView('test')} className="text-sub hover:text-text transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                  Back to test <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Account Settings */}
                <div className="md:col-span-1 space-y-8">
                  <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-2xl">
                    <h3 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                      <Settings size={18} className="text-main" /> Account
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-2">Username</label>
                        {editingUsername ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newUsername}
                              onChange={(e) => setNewUsername(e.target.value)}
                              className="flex-1 bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-main/50 transition-colors"
                              placeholder="New username"
                            />
                            <button 
                              onClick={handleUpdateUsername}
                              className="bg-main text-bg px-3 py-2 rounded-lg text-sm font-bold hover:bg-main/90 transition-colors"
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => { setEditingUsername(false); setNewUsername(user.username); setProfileError(''); }}
                              className="bg-white/5 text-sub px-3 py-2 rounded-lg text-sm font-bold hover:bg-white/10 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-bg border border-white/5 rounded-lg px-4 py-3">
                            <span className="text-text font-medium">{user.username}</span>
                            <button 
                              onClick={() => setEditingUsername(true)}
                              className="text-main text-xs font-bold uppercase tracking-wider hover:text-main/80 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                        {profileError && <p className="text-error text-xs mt-2">{profileError}</p>}
                        {profileSuccess && <p className="text-main text-xs mt-2">{profileSuccess}</p>}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-2">Account ID</label>
                        <div className="bg-bg border border-white/5 rounded-lg px-4 py-3 text-sub font-mono text-sm">
                          #{user.id.toString().padStart(4, '0')}
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-white/5">
                        <button 
                          onClick={logout}
                          className="w-full flex items-center justify-center gap-2 bg-error/10 text-error px-4 py-3 rounded-xl border border-error/20 hover:bg-error/20 transition-all font-bold text-sm"
                        >
                          <LogOut size={16} /> Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="md:col-span-2 space-y-8">
                  {profileStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sub text-[10px] font-bold uppercase tracking-widest mb-1">Tests Taken</span>
                        <span className="text-2xl font-black text-text">{profileStats.total_tests}</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sub text-[10px] font-bold uppercase tracking-widest mb-1">Highest WPM</span>
                        <span className="text-2xl font-black text-main">{profileStats.highest_wpm}</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sub text-[10px] font-bold uppercase tracking-widest mb-1">Average WPM</span>
                        <span className="text-2xl font-black text-text">{profileStats.avg_wpm}</span>
                      </div>
                      <div className="bg-white/5 rounded-2xl border border-white/10 p-4 flex flex-col items-center justify-center text-center">
                        <span className="text-sub text-[10px] font-bold uppercase tracking-widest mb-1">Avg Accuracy</span>
                        <span className="text-2xl font-black text-text">{profileStats.avg_accuracy}%</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5">
                      <h3 className="text-lg font-bold text-text flex items-center gap-2">
                        <Activity size={18} className="text-main" /> Recent Tests
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-white/5 text-sub text-[10px] font-bold uppercase tracking-[0.2em]">
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">WPM</th>
                            <th className="px-6 py-4">Accuracy</th>
                            <th className="px-6 py-4">Mode</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {profileRecentTests.length > 0 ? (
                            profileRecentTests.map((test, idx) => (
                              <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4 text-sm text-sub">
                                  {new Date(test.created_at).toLocaleDateString()} {new Date(test.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </td>
                                <td className="px-6 py-4 font-black text-main">{test.wpm}</td>
                                <td className="px-6 py-4 text-text">{test.accuracy}%</td>
                                <td className="px-6 py-4 text-sub text-xs uppercase tracking-wider">{test.mode}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-sub text-sm">
                                No tests completed yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'settings' ? (
            <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl">
              <div className="flex items-center gap-4 mb-12">
                <div className="p-3 bg-main/10 rounded-2xl border border-main/20">
                  <Sliders className="w-8 h-8 text-main" />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-text">Settings</h2>
                  <p className="text-sub text-sm">Customize your typing experience</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* Theme Colors */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-text mb-4">Primary Color</h3>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { name: 'Emerald', value: '#10b981' },
                        { name: 'Cyberpunk', value: '#f43f5e' },
                        { name: 'Ocean', value: '#0ea5e9' },
                        { name: 'Amethyst', value: '#a855f7' },
                        { name: 'Amber', value: '#f59e0b' },
                        { name: 'Crimson', value: '#e11d48' },
                        { name: 'Indigo', value: '#6366f1' },
                        { name: 'Lime', value: '#84cc16' },
                      ].map(color => (
                        <button
                          key={color.value}
                          onClick={() => setSettings(s => ({ ...s, themeColor: color.value }))}
                          className={cn(
                            "w-12 h-12 rounded-full border-2 transition-transform hover:scale-110",
                            settings.themeColor === color.value ? "border-white scale-110" : "border-transparent"
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-text mb-4">Secondary Color</h3>
                    <div className="flex flex-wrap gap-4">
                      {[
                        { name: 'Slate', value: '#475569' },
                        { name: 'Gray', value: '#6b7280' },
                        { name: 'Zinc', value: '#71717a' },
                        { name: 'Neutral', value: '#737373' },
                        { name: 'Stone', value: '#78716c' },
                        { name: 'Blue', value: '#3b82f6' },
                        { name: 'Purple', value: '#8b5cf6' },
                        { name: 'Pink', value: '#ec4899' },
                      ].map(color => (
                        <button
                          key={color.value}
                          onClick={() => setSettings(s => ({ ...s, secondaryColor: color.value }))}
                          className={cn(
                            "w-12 h-12 rounded-full border-2 transition-transform hover:scale-110",
                            settings.secondaryColor === color.value ? "border-white scale-110" : "border-transparent"
                          )}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Site Theme */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-text mb-4">Site Theme</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: 'Dark', value: 'dark' },
                      { name: 'Light', value: 'light' },
                      { name: 'Midnight', value: 'midnight' },
                      { name: 'Terminal', value: 'terminal' },
                    ].map(theme => (
                      <button
                        key={theme.value}
                        onClick={() => setSettings(s => ({ ...s, siteTheme: theme.value as any }))}
                        className={cn(
                          "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                          settings.siteTheme === theme.value 
                            ? "bg-main/20 border-main/50 text-main" 
                            : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                        )}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-text mb-4">Language</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: 'English', value: 'en' },
                      { name: 'Spanish', value: 'es' },
                      { name: 'French', value: 'fr' },
                      { name: 'German', value: 'de' },
                    ].map(lang => (
                      <button
                        key={lang.value}
                        onClick={() => setSettings(s => ({ ...s, language: lang.value as any }))}
                        className={cn(
                          "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                          settings.language === lang.value 
                            ? "bg-main/20 border-main/50 text-main" 
                            : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                        )}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-text">Font Size</h3>
                    <span className="text-main font-mono">{settings.fontSize}rem</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    step="0.1" 
                    value={settings.fontSize}
                    onChange={(e) => setSettings(s => ({ ...s, fontSize: parseFloat(e.target.value) }))}
                    className="w-full accent-main"
                  />
                </div>

                {/* Caret Settings */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-text mb-4">Caret Style</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { name: 'Line', value: 'line' },
                        { name: 'Block', value: 'block' },
                        { name: 'Underline', value: 'underline' },
                      ].map(style => (
                        <button
                          key={style.value}
                          onClick={() => setSettings(s => ({ ...s, caretStyle: style.value as any }))}
                          className={cn(
                            "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                            settings.caretStyle === style.value 
                              ? "bg-main/20 border-main/50 text-main" 
                              : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                          )}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-bold text-text mb-4">Caret Speed</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { name: 'Slow', value: 'slow' },
                        { name: 'Normal', value: 'normal' },
                        { name: 'Fast', value: 'fast' },
                      ].map(speed => (
                        <button
                          key={speed.value}
                          onClick={() => setSettings(s => ({ ...s, caretSpeed: speed.value as any }))}
                          className={cn(
                            "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                            settings.caretSpeed === speed.value 
                              ? "bg-main/20 border-main/50 text-main" 
                              : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                          )}
                        >
                          {speed.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pace Caret */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-text mb-4">Pace Caret</h3>
                    <p className="text-sub text-sm mb-4">A ghost caret that types at a set speed to help you pace yourself.</p>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { name: 'Off', value: 'none' },
                        { name: 'Line', value: 'line' },
                        { name: 'Block', value: 'block' },
                      ].map(style => (
                        <button
                          key={style.value}
                          onClick={() => setSettings(s => ({ ...s, paceCaret: style.value as any }))}
                          className={cn(
                            "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                            settings.paceCaret === style.value 
                              ? "bg-main/20 border-main/50 text-main" 
                              : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                          )}
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {settings.paceCaret !== 'none' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-text">Pace Speed</h3>
                        <span className="text-main font-mono">{settings.paceCaretSpeed} WPM</span>
                      </div>
                      <input 
                        type="range" 
                        min="10" 
                        max="200" 
                        step="5" 
                        value={settings.paceCaretSpeed}
                        onChange={(e) => setSettings(s => ({ ...s, paceCaretSpeed: parseInt(e.target.value) }))}
                        className="w-full accent-main"
                      />
                    </div>
                  )}
                </div>

                {/* Key Sounds */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-text mb-4">Key Sounds</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { name: 'Off', value: 'none' },
                      { name: 'Click', value: 'click' },
                      { name: 'Beep', value: 'beep' },
                    ].map(sound => (
                      <button
                        key={sound.value}
                        onClick={() => setSettings(s => ({ ...s, keySounds: sound.value as any }))}
                        className={cn(
                          "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                          settings.keySounds === sound.value 
                            ? "bg-main/20 border-main/50 text-main" 
                            : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                        )}
                      >
                        {sound.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Restart Key */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-text mb-4">Restart Test Key</h3>
                  <p className="text-sub text-sm mb-4">Quickly restart the test using a keyboard shortcut.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { name: 'Tab', value: 'tab' },
                      { name: 'Escape', value: 'esc' },
                      { name: 'Alt', value: 'alt' },
                      { name: 'Off', value: 'none' },
                    ].map(key => (
                      <button
                        key={key.value}
                        onClick={() => setSettings(s => ({ ...s, restartKey: key.value as any }))}
                        className={cn(
                          "py-3 px-4 rounded-xl border transition-all text-center font-bold",
                          settings.restartKey === key.value 
                            ? "bg-main/20 border-main/50 text-main" 
                            : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text"
                        )}
                      >
                        {key.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Family */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-text mb-4">Font Family</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { name: 'Sans', value: 'font-sans', class: 'font-sans' },
                      { name: 'Mono', value: 'font-mono', class: 'font-mono' },
                      { name: 'Serif', value: 'font-serif', class: 'font-serif' },
                    ].map(font => (
                      <button
                        key={font.value}
                        onClick={() => setSettings(s => ({ ...s, fontFamily: font.value }))}
                        className={cn(
                          "py-4 px-6 rounded-xl border transition-all text-center",
                          settings.fontFamily === font.value 
                            ? "bg-main/20 border-main/50 text-main" 
                            : "bg-white/5 border-white/10 text-sub hover:bg-white/10 hover:text-text",
                          font.class
                        )}
                      >
                        <span className="text-xl">{font.name}</span>
                        <p className="text-xs mt-2 opacity-70">The quick brown fox</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-text">Smooth Caret</h3>
                      <p className="text-sub text-sm">Animate the caret moving between letters</p>
                    </div>
                    <button 
                      onClick={() => setSettings(s => ({ ...s, smoothCaret: !s.smoothCaret }))}
                      className={cn(
                        "w-14 h-8 rounded-full transition-colors relative",
                        settings.smoothCaret ? "bg-main" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 bg-white rounded-full absolute top-1 transition-transform",
                        settings.smoothCaret ? "translate-x-7" : "translate-x-1"
                      )} />
                    </button>
                  </div>

                  <div className="h-px bg-white/10 w-full" />

                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-text">Show Keymap</h3>
                      <p className="text-sub text-sm">Display a visual keyboard layout</p>
                    </div>
                    <button 
                      onClick={() => setSettings(s => ({ ...s, showKeymap: !s.showKeymap }))}
                      className={cn(
                        "w-14 h-8 rounded-full transition-colors relative",
                        settings.showKeymap ? "bg-main" : "bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 bg-white rounded-full absolute top-1 transition-transform",
                        settings.showKeymap ? "translate-x-7" : "translate-x-1"
                      )} />
                    </button>
                  </div>
                </div>

                {/* Dangerzone */}
                {user && (
                  <div className="border border-error/30 rounded-3xl p-8 space-y-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-error/5 pointer-events-none" />
                    <h3 className="text-lg font-bold text-error">Danger Zone</h3>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-text">Reset Stats</h4>
                        <p className="text-sub text-sm">Permanently delete all your typing history.</p>
                      </div>
                      <button 
                        onClick={async () => {
                          if (confirm("Are you sure you want to reset your stats? This cannot be undone.")) {
                            try {
                              await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/${user.id}/stats`, {
                                method: 'DELETE',
                                headers: { 'x-user-id': user.id.toString() }
                              });
                              alert("Stats reset successfully.");
                            } catch (e) {
                              alert("Failed to reset stats.");
                            }
                          }
                        }}
                        className="px-4 py-2 bg-error/10 text-error hover:bg-error/20 rounded-xl font-bold transition-colors"
                      >
                        Reset Stats
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="not-found" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20 w-full">
              <div className="p-4 bg-error/10 rounded-2xl border border-error/20 mb-6">
                <X className="w-12 h-12 text-error" />
              </div>
              <h2 className="text-3xl font-black text-text mb-2">Not Found</h2>
              <p className="text-sub text-sm mb-8 text-center max-w-md">
                The page you are looking for does not exist or you do not have permission to view it.
              </p>
              <button onClick={() => setView('test')} className="bg-white/5 text-text px-6 py-3 rounded-xl font-bold hover:bg-white/10 transition-colors">
                Return to Test
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Ban Modal */}
      <AnimatePresence>
        {banModalUser && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBanModalUser(null)} className="absolute inset-0 bg-bg/90 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-8 shadow-2xl">
              <h3 className="text-xl font-black text-text mb-2">Ban User: {banModalUser.username}</h3>
              <p className="text-sub text-sm mb-6 text-error font-medium">This will restrict their access to the platform.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-2">Ban Reason</label>
                  <textarea 
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="e.g. Cheating, Inappropriate behavior..."
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-text focus:outline-none focus:border-error/50 transition-all resize-none"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-2">Duration</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: '1 Hour', value: '1h' },
                      { label: '1 Day', value: '1d' },
                      { label: '7 Days', value: '7d' },
                      { label: 'Permanent', value: 'permanent' }
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setBanDuration(opt.value)}
                        className={cn(
                          "py-2 rounded-lg text-xs font-bold border transition-all",
                          banDuration === opt.value 
                            ? "bg-error text-bg border-error shadow-lg shadow-error/20" 
                            : "bg-white/5 text-sub border-white/10 hover:border-white/20"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setBanModalUser(null)}
                    className="flex-1 py-3 bg-white/5 text-sub font-bold rounded-xl border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleUserAction(banModalUser.id, 'ban', banReason, banDuration)}
                    className="flex-1 py-3 bg-error text-bg font-black rounded-xl shadow-lg shadow-error/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Confirm Ban
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showPastAnnouncements && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPastAnnouncements(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl bg-white/5 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="absolute top-0 left-0 w-full h-2 bg-main" />
              <button onClick={() => setShowPastAnnouncements(false)} className="absolute top-6 right-6 text-sub hover:text-text transition-colors"><X size={24} /></button>
              
              <div className="mb-10">
                <h2 className="text-3xl font-black tracking-tight text-text mb-2 flex items-center gap-3">
                  <Info className="text-main" /> Past Announcements
                </h2>
                <p className="text-sub text-sm">Catch up on previous updates and news.</p>
              </div>

              <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {announcements.slice(1).map(ann => (
                  <div key={ann.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 text-sm text-text leading-relaxed shadow-lg">
                    {ann.content}
                    <div className="text-[10px] opacity-60 mt-4 font-mono text-sub">{new Date(ann.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAuthModal(false)} className="absolute inset-0 bg-bg/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] p-10 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-main" />
              <button onClick={() => setShowAuthModal(false)} className="absolute top-6 right-6 text-sub hover:text-text transition-colors"><X size={24} /></button>
              
              <div className="mb-10">
                <h2 className="text-3xl font-black tracking-tight text-text mb-2">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                <p className="text-sub text-sm">{authMode === 'login' ? 'Sign in to save your progress and compete on the leaderboard.' : 'Join the community of fast typists.'}</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div>
                  <label className="block text-sub text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Username</label>
                  <input required type="text" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-text focus:outline-none focus:border-main/50 transition-all" placeholder="Enter username" />
                </div>
                <div>
                  <label className="block text-sub text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Password</label>
                  <input required type="password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-text focus:outline-none focus:border-main/50 transition-all" placeholder="Enter password" />
                </div>
                
                {authError && <p className="text-error text-xs font-bold bg-error/10 p-4 rounded-xl border border-error/20">{authError}</p>}

                <button type="submit" className="w-full bg-main text-bg font-black py-5 rounded-2xl shadow-lg shadow-main/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              <p className="mt-8 text-center text-sub text-sm">
                {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-main font-bold hover:underline">
                  {authMode === 'login' ? 'Sign Up' : 'Log In'}
                </button>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="w-full flex justify-between items-center mt-20 text-sub/50 text-[10px] font-bold uppercase tracking-[0.2em] border-t border-white/5 pt-8">
        <div className="flex gap-8">
          <a href="#" className="hover:text-main transition-colors">Github</a>
          <a href="#" className="hover:text-main transition-colors">Twitter</a>
          <a href="#" className="hover:text-main transition-colors">Discord</a>
          <button onClick={() => setView('about')} className="hover:text-main transition-colors">About</button>
        </div>
        <div className="flex gap-6">
          <span>SwiftType v1.2.0</span>
          <span className="flex items-center gap-2"><Keyboard size={12} /> Keybinds</span>
        </div>
      </footer>
    </div>
  );
}
