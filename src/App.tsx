import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, 
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
  ChevronRight
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
import { WORDS } from './constants';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type TestMode = 'time' | 'words';
type TestState = 'idle' | 'running' | 'finished';
type View = 'test' | 'leaderboard' | 'admin';

interface HistoryPoint {
  time: number;
  wpm: number;
  rawWpm: number;
  errors: number;
}

interface UserData {
  id: number;
  username: string;
  is_admin: boolean;
}

interface AdminUser {
  id: number;
  username: string;
  is_admin: boolean;
  is_banned: boolean;
  is_leaderboard_banned: boolean;
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

export default function App() {
  // Config
  const [mode, setMode] = useState<TestMode>('time');
  const [timeLimit, setTimeLimit] = useState(30);
  const [wordLimit, setWordLimit] = useState(25);
  const [view, setView] = useState<View>('test');
  
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
  
  // Admin State
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminSearch, setAdminSearch] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementInput, setAnnouncementInput] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHistoryTimeRef = useRef<number>(0);

  // Initialize words
  const initTest = () => {
    const shuffled = [...WORDS].sort(() => Math.random() - 0.5);
    setWords(shuffled.slice(0, 100)); // Load 100 words initially
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
  }, [mode, timeLimit, wordLimit]);

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

  const calculateStats = (elapsed: number) => {
    if (elapsed <= 0) return;
    
    const targetText = words.join(' ');
    let currentCorrectChars = 0;
    let currentErrors = 0;
    
    for (let i = 0; i < userInput.length; i++) {
      if (userInput[i] === targetText[i]) {
        currentCorrectChars++;
      } else {
        currentErrors++;
      }
    }

    const minutes = elapsed / 60;
    const currentWpm = Math.round((currentCorrectChars / 5) / minutes);
    const currentRawWpm = Math.round((keystrokes / 5) / minutes);
    const currentAccuracy = keystrokes > 0 ? Math.round((correctKeystrokes / keystrokes) * 100) : 0;

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

  const startTest = () => {
    setState('running');
    setStartTime(Date.now());
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
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          wpm,
          accuracy,
          mode: `${mode} ${mode === 'time' ? timeLimit : wordLimit}`
        })
      });
    } catch (err) {
      console.error("Failed to submit score", err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
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

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/announcements');
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
      const res = await fetch('/api/admin/users', {
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

  const handleUserAction = async (targetUserId: number, action: string) => {
    if (!user?.is_admin) return;
    try {
      const res = await fetch('/api/admin/user-action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-id': user.id.toString()
        },
        body: JSON.stringify({ targetUserId, action })
      });
      if (res.ok) {
        fetchAdminUsers();
      }
    } catch (err) {
      console.error("Failed to perform admin action", err);
    }
  };

  const handleAnnounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.is_admin || !announcementInput.trim()) return;
    try {
      const res = await fetch('/api/admin/announce', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-id': user.id.toString()
        },
        body: JSON.stringify({ content: announcementInput })
      });
      if (res.ok) {
        setAnnouncementInput('');
        fetchAnnouncements();
      }
    } catch (err) {
      console.error("Failed to post announcement", err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    // Refresh user data if logged in
    if (user?.id) {
      fetch('/api/auth/me', {
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
    if (state === 'idle') startTest();
    
    const val = e.target.value;
    const targetText = words.join(' ');
    
    if (val.length > userInput.length) {
      setKeystrokes(prev => prev + 1);
      if (val[val.length - 1] === targetText[val.length - 1]) {
        setCorrectKeystrokes(prev => prev + 1);
      }
    }
    
    setUserInput(val);

    if (mode === 'words') {
      const typedWords = val.trim().split(/\s+/).length;
      if (typedWords >= wordLimit && val.endsWith(' ')) {
        finishTest();
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      
      if (res.ok) {
        setUser(data);
        localStorage.setItem('swifttype_user', JSON.stringify(data));
        setShowAuthModal(false);
        setAuthForm({ username: '', password: '' });
      } else {
        setAuthError(data.error);
      }
    } catch (err) {
      setAuthError("Connection error");
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('swifttype_user');
  };

  // Rendering logic for words
  const renderWords = useMemo(() => {
    return (
      <div className="relative text-2xl leading-relaxed tracking-tight select-none h-[140px] overflow-hidden font-mono">
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
                          className="absolute -left-[1px] top-[10%] w-[2px] h-[80%] bg-main caret-blink shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      )}
                      {char}
                    </span>
                  );
                })}
                {wordIdx < words.length - 1 && (
                  <span className={cn(
                    "transition-all duration-150 relative",
                    userInput.length > wordEndIdx ? (userInput[wordEndIdx] === ' ' ? 'text-sub/40' : 'bg-error/20 text-error') : 'text-sub/40'
                  )}>
                    {userInput.length === wordEndIdx && (
                       <motion.div 
                        layoutId="caret"
                        className="absolute -left-[1px] top-[10%] w-[2px] h-[80%] bg-main caret-blink shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
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
  }, [words, userInput]);

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 max-w-6xl mx-auto">
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
          {user?.is_admin && (
            <button onClick={() => { setView('admin'); fetchAdminUsers(); }} className={cn("hover:text-main transition-colors flex items-center gap-2", view === 'admin' && "text-main")}><Settings size={16} /> Admin</button>
          )}
          
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-text">
                <div className="w-8 h-8 rounded-full bg-main/20 flex items-center justify-center text-main border border-main/20">
                  <User size={16} />
                </div>
                <div className="flex flex-col items-start -space-y-1">
                  <span className="font-bold">{user.username}</span>
                  <span className="text-[10px] text-sub font-mono">#{user.id.toString().padStart(4, '0')}</span>
                </div>
                {user.is_admin && (
                  <span className="px-2 py-0.5 bg-main/20 text-main text-[10px] font-black uppercase tracking-widest rounded-md border border-main/30">
                    Admin
                  </span>
                )}
              </div>
              <button onClick={logout} className="text-sub hover:text-error transition-colors"><LogOut size={18} /></button>
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
                    </div>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="flex items-end justify-between mb-8 px-4">
                  <div className="flex flex-col">
                    <span className="text-sub text-xs font-bold uppercase tracking-widest mb-1">Remaining</span>
                    <div className="text-main text-4xl font-black tracking-tighter">
                      {mode === 'time' ? timeLeft : `${userInput.trim().split(/\s+/).length}/${wordLimit}`}
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
                <div className="relative p-10 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-sm cursor-text group transition-all hover:border-white/10" onClick={() => inputRef.current?.focus()}>
                  <div className="absolute inset-0 bg-gradient-to-br from-main/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl" />
                  <input ref={inputRef} type="text" className="absolute opacity-0 pointer-events-none" value={userInput} onChange={handleInputChange} autoFocus />
                  {renderWords}
                </div>

                {/* Announcements */}
                {announcements.length > 0 && state === 'idle' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-12 w-full max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center gap-2 text-sub text-[10px] font-bold uppercase tracking-widest mb-2 px-4">
                      <Info size={12} className="text-main" /> Announcements
                    </div>
                    {announcements.map(ann => (
                      <div key={ann.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-sm text-sub leading-relaxed">
                        {ann.content}
                        <div className="text-[10px] opacity-40 mt-2">{new Date(ann.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Reset Button */}
                <div className="mt-16 flex justify-center">
                  <button onClick={initTest} className="group relative p-4 rounded-2xl bg-white/5 hover:bg-main/10 border border-white/10 hover:border-main/20 transition-all" title="Restart (Tab + Enter)">
                    <RefreshCw size={24} className="text-sub group-hover:text-main group-hover:rotate-180 transition-all duration-500" />
                  </button>
                </div>
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
                  <button onClick={initTest} className="mt-4 bg-main text-bg font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-main/20">
                    <RefreshCw size={20} /> Try Again
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
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-main/10 rounded-2xl border border-main/20">
                    <Trophy className="w-8 h-8 text-main" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-text">Global Leaderboard</h2>
                    <p className="text-sub text-sm">Top 10 fastest typists in the world</p>
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
          ) : (
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
                    <h3 className="text-lg font-bold text-text mb-6">Post Announcement</h3>
                    <form onSubmit={handleAnnounce} className="space-y-4">
                      <textarea
                        value={announcementInput}
                        onChange={(e) => setAnnouncementInput(e.target.value)}
                        placeholder="Type announcement here..."
                        className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-text focus:outline-none focus:border-main/50 transition-all resize-none"
                      />
                      <button type="submit" className="w-full bg-main text-bg font-black py-4 rounded-xl shadow-lg shadow-main/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                        Post Announcement
                      </button>
                    </form>
                  </div>
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
                                <div className="flex gap-2">
                                  {u.is_banned && <span className="px-1.5 py-0.5 bg-error/20 text-error text-[8px] font-black uppercase rounded border border-error/30">Banned</span>}
                                  {u.is_leaderboard_banned && <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-500 text-[8px] font-black uppercase rounded border border-orange-500/30">LB Banned</span>}
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {u.is_banned ? (
                                    <button onClick={() => handleUserAction(u.id, 'unban')} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">Unban</button>
                                  ) : (
                                    <button onClick={() => handleUserAction(u.id, 'ban')} className="px-3 py-1 bg-error/10 text-error text-[10px] font-bold uppercase rounded-lg border border-error/20 hover:bg-error/20 transition-all">Ban</button>
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
          )}
        </AnimatePresence>
      </main>

      {/* Auth Modal */}
      <AnimatePresence>
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
        </div>
        <div className="flex gap-6">
          <span>SwiftType v1.2.0</span>
          <span className="flex items-center gap-2"><Keyboard size={12} /> Keybinds</span>
        </div>
      </footer>
    </div>
  );
}
