import { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
import { 
  Camera, Upload, AlertCircle, CheckCircle, Info, Loader2, 
  Moon, Sun, ShieldCheck, Zap, Heart, Smartphone, ChevronRight,
  History, Trash2, Volume2, VolumeX, BarChart3, Clock, X, Scan, Activity, ArrowLeft,
  BadgeCheck, PlusSquare, Droplet, Leaf, Sprout, Beaker, ImageIcon, AlertTriangle, ArrowRight, Mic
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import productImage from './assets/image_generation_content_1.png';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ScanHistory {
  id: string;
  date: string;
  productName: string;
  status: 'HIJAU' | 'KUNING' | 'MERAH' | 'ERROR';
  resultText: string;
  imagePreview?: string | null;
}

const PROFILES = [
  { id: 'halal', label: 'Muslim (Halal)', icon: BadgeCheck },
  { id: 'hipertensi', label: 'Hipertensi (Rendah Natrium)', icon: PlusSquare },
  { id: 'diabetes', label: 'Diabetes (Rendah Gula)', icon: Droplet },
  { id: 'alergiKacang', label: 'Alergi Kacang', icon: Leaf },
  { id: 'alergiGluten', label: 'Alergi Gluten', icon: Sprout },
  { id: 'laktosaIntoleran', label: 'Laktosa Intoleran', icon: Beaker },
] as const;

const SCAN_MODEL = 'gemini-2.5-flash';

function formatGeminiError(err: unknown) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Terjadi kesalahan saat menganalisis.';

  const isQuotaError =
    /RESOURCE_EXHAUSTED|quota|429|rate limit/i.test(message);

  if (!isQuotaError) {
    return message;
  }

  const retryMatch = message.match(/Please retry in ([\d.]+)s/i);
  const retrySeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : null;

  if (retrySeconds) {
    return `Kuota Gemini untuk proyek ini sedang habis. Coba lagi sekitar ${retrySeconds} detik lagi, atau gunakan API key/proyek dengan billing aktif.`;
  }

  return 'Kuota Gemini untuk proyek ini sedang habis. Tunggu beberapa saat, ganti ke API key/proyek lain, atau aktifkan billing lalu coba lagi.';
}

const ResultDisplay = ({ text }: { text: string }) => {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);
    
    return (
      <div className="space-y-6">
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${
           data.status === 'HIJAU' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800' :
           data.status === 'KUNING' ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800' :
           data.status === 'MERAH' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800' :
           'bg-stone-50 border-stone-200 text-stone-800 dark:bg-stone-900/20 dark:border-stone-800'
        }`}>
          <div className="mt-1 shrink-0">
             {data.status === 'HIJAU' ? <CheckCircle className="w-6 h-6" /> :
              data.status === 'KUNING' ? <AlertTriangle className="w-6 h-6" /> :
              data.status === 'MERAH' ? <AlertTriangle className="w-6 h-6 text-red-600" /> :
              <AlertCircle className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-lg mb-1">
              {data.status === 'ERROR' ? 'Perhatian' : `Status Keamanan: ${data.status}`}
            </h3>
            {data.errorMsg ? (
               <p className="text-sm font-medium opacity-90">{data.errorMsg}</p>
            ) : (
               <p className="text-sm opacity-90 leading-relaxed font-medium">{data.analysis?.ringkasan}</p>
            )}
          </div>
        </div>

        {!data.errorMsg && data.analysis && (
          <>
            {(data.analysis.bahanBahaya && (Array.isArray(data.analysis.bahanBahaya) ? data.analysis.bahanBahaya.length > 0 : true)) && (
              <div>
                <h4 className="font-bold flex items-center gap-2 mb-3 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" /> Bahan yang Perlu Diperhatikan
                </h4>
                <ul className="space-y-3">
                  {(Array.isArray(data.analysis.bahanBahaya) ? data.analysis.bahanBahaya : [data.analysis.bahanBahaya]).map((bahan: string, i: number) => (
                    <li key={i} className="flex gap-3 text-stone-700 dark:text-stone-300 bg-red-50/50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100/50 dark:border-red-900/20 text-sm">
                      <span className="text-red-500 mt-0.5 shrink-0"><AlertCircle className="w-4 h-4" /></span> 
                      <span>{bahan}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(data.analysis.alternatifSehat && (Array.isArray(data.analysis.alternatifSehat) ? data.analysis.alternatifSehat.length > 0 : true)) && (
               <div>
                <h4 className="font-bold flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-400 mt-6">
                  <ShieldCheck className="w-5 h-5" /> Saran Alternatif & Tips Sehat
                </h4>
                <ul className="space-y-3">
                  {(Array.isArray(data.analysis.alternatifSehat) ? data.analysis.alternatifSehat : [data.analysis.alternatifSehat]).map((tips: string, i: number) => (
                    <li key={i} className="flex gap-3 text-stone-700 dark:text-stone-300 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20 text-sm">
                      <span className="text-emerald-500 mt-0.5 shrink-0"><CheckCircle className="w-4 h-4" /></span> 
                      <span>{tips}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {(data.metrics?.kadarGula || data.metrics?.kadarGaram || data.metrics?.halalStatus) && (
              <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-stone-200 dark:border-stone-800">
                {data.metrics.kadarGula && (
                  <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl text-center">
                    <p className="text-xs text-stone-500 mb-1">Kadar Gula</p>
                    <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center justify-center gap-1">
                       {data.metrics.kadarGula}
                    </p>
                  </div>
                )}
                {data.metrics.kadarGaram && (
                  <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl text-center">
                    <p className="text-xs text-stone-500 mb-1">Kadar Garam</p>
                    <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center justify-center gap-1">
                       {data.metrics.kadarGaram}
                    </p>
                  </div>
                )}
                {data.metrics.halalStatus && (
                  <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl text-center">
                    <p className="text-xs text-stone-500 mb-1">Kehalalan</p>
                    <p className="font-bold text-sm text-stone-900 dark:text-white flex items-center justify-center gap-1">
                       {data.metrics.halalStatus}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  } catch(e) {
     return (
       <div className="prose prose-sm md:prose-base dark:prose-invert prose-stone max-w-none
          prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
          prose-ul:space-y-2 prose-li:marker:text-emerald-500"
       >
          <ReactMarkdown
            components={{
              h3: ({node, ...props}) => {
                const str = props.children?.toString() || '';
                const isStatus = str.includes('Status Keamanan:');
                if (isStatus) {
                  const includesMerah = str.includes('MERAH');
                  const includesKuning = str.includes('KUNING');
                  const includesError = str.includes('ERROR');
                  let colorClass = "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20";
                  if (includesError) colorClass = "text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800";
                  else if (includesMerah) colorClass = "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
                  else if (includesKuning) colorClass = "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20";
                  
                  return (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${colorClass} font-bold text-lg lg:text-xl border ${colorClass.split(' ')[0].replace('text-', 'border-').replace('600', '200').replace('400', '800')}`}>
                      {includesError ? <AlertCircle className="w-6 h-6" /> : includesMerah ? <AlertTriangle className="w-6 h-6" /> : includesKuning ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
                      {str}
                    </div>
                  );
                }
                return <h3 {...props} className="font-bold text-stone-800 dark:text-white">{props.children}</h3>;
              }
            }}
          >
            {text}
          </ReactMarkdown>
       </div>
     );
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'app'>('landing');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const goToApp = () => {
    setCurrentView('app');
    window.scrollTo(0, 0);
  };
  const goToLanding = () => {
    setCurrentView('landing');
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-50 font-sans transition-colors duration-300 selection:bg-emerald-200 selection:text-emerald-900 overflow-x-hidden">
      {currentView === 'landing' ? (
        <LandingPage onStart={goToApp} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      ) : (
        <MainApp onBack={goToLanding} isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
      )}
    </div>
  );
}

function LandingPage({ onStart, isDarkMode, toggleTheme }: { onStart: () => void, isDarkMode: boolean, toggleTheme: () => void }) {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-all duration-300 border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollToSection('home')}>
            <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
              <Zap className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">NutriScan<span className="text-emerald-600 dark:text-emerald-400">AI</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600 dark:text-stone-300">
            <button onClick={() => scrollToSection('home')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Home</button>
            <button onClick={() => scrollToSection('impact')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">About</button>
            <button onClick={() => scrollToSection('tech')} className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Cara Kerja</button>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-50 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={onStart}
              className="bg-stone-900 dark:bg-emerald-600 hover:bg-stone-800 dark:hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors shadow-sm hidden md:block"
            >
              Coba Sekarang
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative pt-32 pb-20 overflow-hidden flex items-center justify-center min-h-[85vh]">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-400/20 dark:bg-emerald-600/20 blur-[100px] rounded-full pointer-events-none -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-400/10 dark:bg-blue-600/10 blur-[100px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-6xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
             className="max-w-2xl text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-semibold tracking-wide mb-6 border border-emerald-200 dark:border-emerald-800/50 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Cerdas, Aman & Tepercaya</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight text-stone-900 dark:text-white leading-tight mb-6">
              Deteksi Cerdas Kandungan Nutrisi & Kehalalan dalam{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">
                Sekali Jepret.
              </span>
            </h1>
            <p className="text-lg lg:text-xl text-stone-600 dark:text-stone-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Asisten pintar berbasis AI untuk mendeteksi nutrisi, alergen, dan kehalalan bahan makanan langsung dari label kemasan atau menu restoran.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <button 
                onClick={onStart}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-8 py-4 rounded-full transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 group"
              >
                <Scan className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Mulai Scan Sekarang
              </button>
            </div>
          </motion.div>

          <motion.div 
             initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, delay: 0.2 }}
             className="relative mx-auto w-full max-w-md lg:max-w-lg"
          >
            <div className="relative aspect-[3/4] sm:aspect-[4/5] bg-[#10B981]/10 dark:bg-stone-900 rounded-[2rem] shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden ring-4 ring-white/50 dark:ring-stone-800/10 group">
              {/* Product Background Image */}
              <img src={productImage} alt="Susu UHT Almond" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              
              {/* Radar/Scan Overlay */}
              <div className="absolute inset-x-0 inset-y-0 pointer-events-none overflow-hidden mix-blend-overlay opacity-30">
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 border-2 border-emerald-400 rounded-full animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 border border-emerald-300 rounded-full opacity-50 animate-[ping_4s_cubic-bezier(0,0,0.2,1)_infinite_1s]" />
              </div>
              
              {/* Moving scan bar (CSS Animation) */}
              <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,1)] z-10 opacity-70 animate-scan-line" />

              {/* Connecting line 1 */}
              <div className="absolute top-[35%] left-[25%] w-12 h-px bg-emerald-400/80 -rotate-12 transform origin-left z-10 hidden sm:block" />
              {/* AR Tag 1: Halal Certified */}
              <div className="absolute top-[35%] left-6 z-20 animate-float">
                 <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Sertifikasi Halal</span>
                 </div>
              </div>

              {/* Connecting line 2 */}
              <div className="absolute top-[50%] right-[30%] w-16 h-px bg-emerald-400/80 rotate-12 transform origin-right z-10 hidden sm:block" />
              {/* AR Tag 2: Sodium */}
              <div className="absolute top-[50%] right-6 z-20 animate-float-delayed">
                 <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Natrium: 150mg</span>
                 </div>
              </div>

              {/* Connecting line 3 */}
              <div className="absolute bottom-[35%] left-[30%] w-10 h-px bg-emerald-400/80 -rotate-45 transform origin-left z-10 hidden sm:block animate-float" />
              {/* AR Tag 3: Gelatin free */}
              <div className="absolute bottom-[35%] left-12 z-20 animate-float">
                 <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200">Bebas Gelatin</span>
                 </div>
              </div>

              {/* Gradient fade at bottom for status card */}
              <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-emerald-900/90 via-emerald-900/40 to-transparent pointer-events-none z-10" />

              {/* Bottom Status Card */}
              <div className="absolute bottom-4 sm:bottom-6 inset-x-4 sm:inset-x-6 z-30">
                <div className="bg-white/90 dark:bg-stone-900/90 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-emerald-200/50 dark:border-emerald-800/50 flex items-start gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/50 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-bold text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-1.5">
                        Status: Aman (HIJAU)
                      </h3>
                      <p className="text-stone-800 dark:text-stone-200 text-[13px] sm:text-sm font-medium leading-relaxed italic">
                        "Susu UHT almond ini 100% nabati dan rendah natrium. Sangat aman untuk kondisi hipertensimu, Rekan Sehat!"
                      </p>
                    </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Impact Section */}
      <section id="impact" className="py-24 bg-stone-100 dark:bg-stone-900/50 border-t border-stone-200 dark:border-stone-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Kenapa NutriScanAI?</h2>
            <p className="text-stone-600 dark:text-stone-400">
              Satu kesalahan mengonsumsi dapat berakibat fatal. NutriScanAI meredakan kecemasan Anda dengan kepastian nutrisi.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-stone-900 p-8 rounded-[2rem] border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                 <Activity className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Urgensi Medis</h3>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
                "1 dari 10 orang dewasa di Indonesia menderita Diabetes & Hipertensi."
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-500 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">Kandungan gula dan natrium tersembunyi memicu lonjakan tiba-tiba.</p>
            </div>
            
            <div className="bg-white dark:bg-stone-900 p-8 rounded-[2rem] border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-500 mb-6">
                 <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Urgensi Alergen</h3>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
                "Alergi makanan yang tidak terdeteksi bisa memicu reaksi fatal (Anafilaksis) dalam hitungan menit."
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-500 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">Nama bahan kimia yang membingungkan sering kali menyembunyikan alergen.</p>
            </div>

            <div className="bg-white dark:bg-stone-900 p-8 rounded-[2rem] border border-stone-200 dark:border-stone-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 mb-6">
                 <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-3">Urgensi Halal</h3>
              <p className="text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
                "Keraguan bahan kritis syubhah (seperti gelatin/emulsifier E-number) sering membingungkan."
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-500 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">Melindungi keyakinan dan syariat dengan verifikasi otomatis.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Section */}
      <section id="tech" className="py-24 bg-white dark:bg-stone-950 border-t border-stone-200 dark:border-stone-800 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <Zap className="w-16 h-16 mx-auto text-emerald-500 mb-6" />
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">Metode Teknologi Kami</h2>
          <p className="text-lg text-stone-600 dark:text-stone-400 mb-12">
            Di balik antarmuka yang sederhana, NutriScanAI mengoperasikan arsitektur deteksi ganda secara presisi dalam satu sentuhan.
          </p>
          
          <div className="grid sm:grid-cols-2 gap-6 text-left">
            <div className="bg-stone-50 dark:bg-stone-900 p-8 rounded-[2rem] border border-stone-200 dark:border-stone-800">
               <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                 <Scan className="w-5 h-5 text-emerald-500" /> Multimodal AI
               </h4>
               <p className="text-stone-600 dark:text-stone-400">
                 Didukung oleh <strong>Gemini 1.5 Flash</strong>, kami menganalisis gambar komposisi secara visual dan kontekstual secara real-time—bukan mesin pencocok kata kunci biasa.
               </p>
            </div>
            <div className="bg-stone-50 dark:bg-stone-900 p-8 rounded-[2rem] border border-stone-200 dark:border-stone-800">
               <h4 className="font-bold text-xl mb-3 flex items-center gap-2">
                 <ShieldCheck className="w-5 h-5 text-emerald-500" /> Dual-Guard System
               </h4>
               <p className="text-stone-600 dark:text-stone-400">
                 Memproses dua filter sekaligus: <strong>Filter Medis & Alergi</strong> bersamaan dengan <strong>Filter Syariat Kehalalan</strong> dalam satu siklus api call.
               </p>
            </div>
          </div>
          
          <div className="mt-12 flex justify-center">
            <button 
                onClick={onStart}
                className="bg-stone-900 dark:bg-emerald-600 hover:bg-stone-800 dark:hover:bg-emerald-500 text-white font-medium px-8 py-4 rounded-full transition-colors flex items-center gap-2"
              >
                Mulai Gunakan Pemindai Daring <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-950 py-12 text-stone-400 text-sm border-t border-stone-900">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-6 items-center">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <span className="font-bold tracking-tight text-white text-lg flex items-center justify-center md:justify-start gap-1">
              NutriScan<span className="text-emerald-500">AI</span>
            </span>
            <p>&copy; {new Date().getFullYear()} NutriScan AI. Inisiatif #JuaraVibeCoding.</p>
          </div>
          <div className="text-center md:text-right flex flex-col md:items-end gap-2">
            <p>Memberikan analitik bahan dengan presisi tinggi.</p>
            <div className="inline-flex items-center gap-2 bg-stone-900 px-3 py-1.5 rounded-full border border-stone-800 mt-2">
               <Zap className="w-4 h-4 text-emerald-500" /> Powered by Google Gemini 1.5 Flash
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}


function MainApp({ onBack, isDarkMode, toggleTheme }: { onBack: () => void, isDarkMode: boolean, toggleTheme: () => void }) {
  // Application State
  const [conditions, setConditions] = useState<Record<string, boolean>>({
    halal: false,
    hipertensi: false,
    diabetes: false,
    alergiKacang: false,
    alergiGluten: false,
    laktosaIntoleran: false,
  });

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<ScanHistory | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const deleteHistoryItem = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistory(prev => {
      const newHistory = prev.filter(item => item.id !== id);
      localStorage.setItem('nutriscan_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('nutriscan_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {}
    }
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const saveToHistory = (text: string) => {
    let name = 'Produk Tidak Dikenal';
    let status: 'HIJAU' | 'KUNING' | 'MERAH' | 'ERROR' = 'HIJAU';
    
    try {
      // Clean up the text just in case the model adds markdown block wrappers
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonData = JSON.parse(cleanText);
      name = jsonData.productName || name;
      status = jsonData.status || status;
    } catch (e) {
      console.error("Failed to parse AI response as JSON", e);
      // Fallback logic for old markdown format (if ever needed again or for robust error handling)
      if (text.includes('ERROR')) status = 'ERROR';
      else if (text.includes('MERAH')) status = 'MERAH';
      else if (text.includes('KUNING')) status = 'KUNING';
    }

    const newHistory: ScanHistory = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      productName: name,
      status,
      resultText: text,
      imagePreview: imagePreview // Save a small preview if available
    };

    const updated = [newHistory, ...history];
    setHistory(updated);
    localStorage.setItem('nutriscan_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('nutriscan_history');
  };

  const toggleCondition = (id: string) => {
    setConditions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleSpeak = (textToRead?: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Browser Anda tidak mendukung Text-to-Speech.");
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = textToRead || result;
    if (!text) return;

    let textToSpeak = text;
    try {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(cleanText);
      if (data.summaryForSpeech) {
        textToSpeak = data.summaryForSpeech;
      }
    } catch(e) {
      // Not JSON, use markdown fallback
      textToSpeak = text.replace(/[#*_-]/g, '').replace(/[\n\r]+/g, '. ');
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'id-ID';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const analyzeFood = async () => {
    if (!image) {
      setError('Mohon unggah foto/gambar komposisi makanan.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiKey = __GEMINI_API_KEY__?.trim();
      if (!apiKey) {
        throw new Error('API key Gemini belum dikonfigurasi. Isi `GEMINI_API_KEY` atau `VITE_GEMINI_API_KEY` di file `.env.local`.');
      }

      const ai = new GoogleGenAI({ apiKey });
      const base64Image = imagePreview?.split(',')[1];
      if (!base64Image) throw new Error("Gagal membaca gambar.");

      const activeConditions = [];
      if (conditions.halal) activeConditions.push("Hanya makan makanan Halal (Wajib)");
      if (conditions.hipertensi) activeConditions.push("Menderita Hipertensi (Pantau Natrium)");
      if (conditions.diabetes) activeConditions.push("Menderita Diabetes Melitus (Pantau Gula)");
      if (conditions.alergiKacang) activeConditions.push("Alergi berat terhadap Kacang Tanah");
      if (conditions.alergiGluten) activeConditions.push("Alergi Gluten (Hindari Gandum/Terigu)");
      if (conditions.laktosaIntoleran) activeConditions.push("Laktosa Intoleran (Hindari Susu Sapi)");

      const userProfileText = activeConditions.length > 0 
        ? activeConditions.join(", ") 
        : "Analisis kesehatan umum.";

      const prompt = `You are "NutriScanAI", a highly accurate, empathetic, and smart personal food assistant. Your job is to analyze food ingredient labels (via text or images) and match them against the user's active health profile, allergies, and dietary restrictions (including strict Halal/Haram verification).

Profil Saat Ini:
${userProfileText}

DIETARY & HEALTH RULES TO ENFORCE:
1. HALAL/HARAM FILTER:
   - Identify non-halal ingredients (pork, lard, gelatin from non-halal animals, carmine/cochineal, rum, beer, alcohol, mirin, sake, angciu, lard-based emulsifiers, etc.).
   - Pay close attention to "E-numbers" (food additives). If an E-number is commonly derived from animal fat (such as E471, E472, etc.) and its halal status is doubtful without certification, flag it as "Syubhah" (Doubtful) and treat it as KUNING. If pork-derived, flag as MERAH.
   - If a product is an imported brand without an official Halal logo but all its ingredients are 100% plant-based/vegan/safe, state that the ingredients are naturally halal but suggest checking for official local certification.

2. HEALTH CONDITIONS:
   - Hypertension: Flag high sodium (> 400mg per serving or if sodium is in the top 3 ingredients).
   - Diabetes: Flag high sugar (> 10g per serving, HFCS, sucrose, glucose).
   - Allergies: Strictly flag allergens specified by the user (peanuts, gluten, milk, soy, seafood, eggs).

3. HANDLING EDGE CASES & EXTREME SCENARIOS (ANTI-ERROR):
   - If the uploaded image is blurry, upside down, dark, or does not contain any readable food ingredients/nutrition facts at all, do NOT force an analysis. Instead, return the JSON with "status": "ERROR" and a polite message asking the user to retake the photo.

OUTPUT FORMAT:
You must ALWAYS return the response in a STRICT JSON format. Do not include any markdown formatting (like \`\`\`json ... \`\`\`) or extra text outside the JSON block.

The JSON structure must be:
{
  "status": "HIJAU" | "KUNING" | "MERAH" | "ERROR",
  "productName": "Nama Produk (or 'Produk Tidak Dikenal' if unreadable)",
  "errorMsg": "Tulis pesan ramah di sini jika status ERROR (contoh: 'Ups, gambarnya agak buram nih. Bisa tolong jepret ulang dengan cahaya yang lebih jelas, Rekan Sehat?'). Kosongkan jika sukses.",
  "summaryForSpeech": "Satu kalimat ringkas dalam Bahasa Indonesia yang sangat natural untuk dibacakan oleh fitur Text-to-Speech (maksimal 20 kata). Contoh: 'Produk ini mengandung gelatin babi, sangat tidak disarankan untuk profil Muslim Anda.'",
  "analysis": {
    "ringkasan": "Penjelasan singkat, padat, dan ramah tentang status produk ini berdasarkan profil pengguna.",
    "bahanBahaya": [
      "Daftar bahan yang memicu peringatan beserta penjelasannya (kosongkan jika tidak ada)"
    ],
    "alternatifSehat": [
      "2-3 rekomendasi produk alternatif generik yang aman/halal atau tips konsumsi yang cerdas."
    ]
  },
  "metrics": {
    "kadarGula": "Rendah" | "Sedang" | "Tinggi",
    "kadarGaram": "Rendah" | "Sedang" | "Tinggi",
    "halalStatus": "Halal" | "Syubhah" | "Non-Halal"
  }
}

Ensure the JSON is perfectly formatted, easy to parse by React, and always in Indonesian language.`;

      const response = await ai.models.generateContent({
        model: SCAN_MODEL,
        contents: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType: image.type } }
        ]
      });

      const responseText = response.text;
      setResult(responseText);
      saveToHistory(responseText);

      setTimeout(() => {
        document.getElementById('result-dashboard')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);

    } catch (err: any) {
      setError(formatGeminiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Dashboard Data Prep
  const pieData = useMemo(() => {
    let green = 0, yellow = 0, red = 0;
    history.forEach(item => {
      if (item.status === 'HIJAU') green++;
      else if (item.status === 'KUNING') yellow++;
      else if (item.status === 'MERAH') red++;
    });
    const total = history.length;
    if (total === 0) return [];
    return [
      { name: 'Aman (Hijau)', value: (green / total) * 100, color: '#10b981' }, 
      { name: 'Waspada (Kuning)', value: (yellow / total) * 100, color: '#f59e0b' }, 
      { name: 'Bahaya (Merah)', value: (red / total) * 100, color: '#ef4444' }, 
    ].filter(d => d.value > 0);
  }, [history]);

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] dark:bg-stone-950">
      {/* App Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-[100] bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-all duration-300 border-b border-stone-200 dark:border-stone-800">
        <div className="w-full px-6 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-50 transition-colors rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
              aria-label="Kembali"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                <Zap className="w-4 h-4" />
              </div>
              <span className="font-bold text-lg sm:text-xl tracking-tight text-stone-900 dark:text-white">NutriScan<span className="text-emerald-600">AI</span></span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={toggleTheme}
              className="p-2 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-50 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8 py-6 lg:py-8 pt-24 lg:pt-28 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        
        {/* Left Side: Profile Selection & Scanner */}
        <div className="lg:col-span-8 flex flex-col space-y-6 lg:space-y-8">
          
          {/* Header Text */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-stone-900 dark:text-white tracking-tight">Halo Rekan Sehat!</h1>
            <p className="text-stone-600 dark:text-stone-400 text-base md:text-lg">
              Pilih profil kesehatanmu di bawah ini, lalu jepret label makanannya. Mari kita pastikan piring makanmu hari ini aman, sehat, dan 100% halal!
            </p>
          </div>

          {/* Profile Selection */}
          <section>
            <h2 className="text-xl font-bold mb-4 text-stone-900 dark:text-white">
               Profil Rekan Sehat
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
              {PROFILES.map(prof => {
                const Icon = prof.icon;
                return (
                  <button
                    key={prof.id}
                    onClick={() => toggleCondition(prof.id)}
                    className={cn(
                      "flex flex-row sm:flex-col items-center sm:items-center sm:justify-center px-4 py-3 sm:px-3 sm:py-4 lg:p-4 rounded-2xl lg:rounded-[2rem] border-2 transition-all duration-200 gap-3 text-left sm:text-center h-full sm:aspect-square",
                      conditions[prof.id] 
                        ? "border-emerald-500 bg-white dark:bg-stone-900 shadow-md sm:-translate-y-1" 
                        : "border-transparent bg-white dark:bg-stone-900 hover:border-emerald-200 dark:hover:border-emerald-800/50 shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center transition-colors shrink-0",
                      conditions[prof.id] ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400" : "bg-emerald-50 text-emerald-600 dark:bg-stone-800 dark:text-stone-400"
                    )}>
                      <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <span className={cn(
                      "font-semibold text-xs lg:text-sm leading-tight flex-1 sm:max-w-[90px]",
                      conditions[prof.id] ? "text-stone-900 dark:text-white" : "text-stone-800 dark:text-stone-300"
                    )}>
                      {prof.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Scanner Ala QRIS */}
          <section className="bg-white dark:bg-stone-900 p-5 sm:p-6 lg:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-3 sm:gap-0">
               <h3 className="font-bold text-xl sm:text-2xl flex items-center gap-2 sm:gap-3 text-stone-900 dark:text-white">
                 <Scan className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 shrink-0" /> <span className="truncate">Pemindai Produk</span>
               </h3>
               <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold px-3 py-1 lg:px-4 lg:py-1.5 text-[10px] sm:text-xs rounded-full shadow-sm tracking-wide self-start sm:self-auto w-max">
                 AI ENHANCED
               </span>
            </div>
            
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => { if(!imagePreview) fileInputRef.current?.click() }}
              className={cn(
                "relative w-full rounded-2xl lg:rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center py-8 sm:py-16 px-4 sm:px-6 overflow-hidden min-h-[280px] lg:min-h-[320px]",
                imagePreview 
                  ? "border-emerald-300 dark:border-emerald-700 bg-white" 
                  : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-stone-900/50 cursor-pointer hover:bg-emerald-50/80 dark:hover:bg-stone-800"
              )}
            >
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" ref={fileInputRef} />

              <AnimatePresence mode="wait">
                 {imagePreview ? (
                    <motion.div 
                      key="preview"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 w-full h-full p-4 flex items-center justify-center group"
                    >
                      <img 
                        src={imagePreview} 
                        className="max-h-full object-contain rounded-2xl shadow-lg border border-stone-200 dark:border-stone-700 z-10"
                        alt="Scanned item"
                      />
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col items-center justify-center gap-4 rounded-3xl m-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                          className="bg-white text-stone-900 font-bold px-5 py-2.5 sm:px-6 sm:py-3 rounded-full flex items-center gap-2 hover:bg-emerald-50 transition text-sm sm:text-base shadow-lg"
                        >
                          <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" /> Ubah Gambar
                        </button>
                      </div>
                    </motion.div>
                 ) : (
                    <motion.div 
                      key="upload"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center text-center z-10"
                    >
                       <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-4 sm:mb-6 shadow-md shadow-emerald-500/20">
                         <Upload className="w-6 h-6 sm:w-8 sm:h-8" />
                       </div>
                       <h4 className="font-extrabold text-lg sm:text-xl lg:text-2xl mb-2 sm:mb-3 text-stone-900 dark:text-white">Unggah Foto Label</h4>
                       <p className="text-stone-500 dark:text-stone-400 mb-6 sm:mb-8 max-w-sm text-xs sm:text-sm lg:text-base">
                         Tarik dan lepas gambar di sini, atau klik untuk memilih file dari perangkat Anda.
                       </p>
                       <button className="bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold transition-all shadow-md text-sm sm:text-base">
                         <ImageIcon className="w-5 h-5" /> Pilih Gambar
                       </button>
                    </motion.div>
                 )}
              </AnimatePresence>
            </div>

            <div className="mt-6 bg-[#f4f6fb] dark:bg-stone-800/50 text-stone-600 dark:text-stone-400 flex items-center gap-4 p-5 rounded-2xl text-sm border border-stone-100 dark:border-stone-800">
               <Info className="w-6 h-6 text-emerald-600 shrink-0" />
               <span className="font-medium text-base">Pastikan teks pada label terbaca dengan jelas untuk hasil analisis AI yang akurat.</span>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl flex items-center gap-2 border border-red-200 dark:border-red-900/50 text-sm font-medium">
                 <AlertCircle className="w-5 h-5 shrink-0" /> {error}
              </div>
            )}

            <button
               onClick={analyzeFood}
               disabled={loading || !image}
               className="w-full mt-6 lg:mt-8 bg-emerald-500 hover:bg-emerald-600 disabled:bg-stone-300 dark:disabled:bg-stone-800 disabled:text-stone-500 text-white shadow-[0_8px_30px_rgb(16,185,129,0.3)] py-4 lg:py-5 rounded-2xl font-bold text-lg lg:text-xl flex items-center justify-center gap-3 transition-all shrink-0 active:scale-[0.99]"
            >
               {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
               {loading ? 'Sedang Memproses AI...' : 'Mulai Analisis AI'}
            </button>
          </section>

          {/* Current Result */}
          {result && (
              <motion.div 
               initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
               className="bg-white dark:bg-stone-900 p-5 sm:p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border border-stone-200 dark:border-stone-800 shadow-sm relative overflow-hidden"
              >
                 <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-4 mb-6">
                    <h3 className="font-bold text-xl flex items-center gap-2">
                      <Info className="w-5 h-5 text-emerald-500" /> Analisis Terbaru
                    </h3>
                    <button
                      onClick={() => toggleSpeak(result)}
                      className="bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 p-2.5 rounded-full transition-colors text-stone-600 dark:text-stone-300"
                      title={isSpeaking ? "Hentikan Suara" : "Baca Hasil"}
                    >
                      {isSpeaking ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                 </div>
                 
                 <div className="mt-4">
                    <ResultDisplay text={result} />
                 </div>
              </motion.div>
           )}
        </div>

        {/* Right Side: History & Tips */}
        <div className="lg:col-span-4 flex flex-col space-y-6 lg:space-y-8" id="result-dashboard">
           {/* History Dashboard */}
           <div className="bg-white dark:bg-stone-900 p-5 sm:p-6 lg:p-8 rounded-2xl lg:rounded-[2rem] border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4 lg:mb-6 px-1">
                 <h3 className="font-bold text-lg lg:text-xl text-stone-900 dark:text-white">Riwayat Scan</h3>
                 {history.length > 0 && (
                   <button 
                     onClick={() => setShowAllHistory(true)} 
                     className="text-emerald-600 dark:text-emerald-400 text-sm font-bold hover:underline shrink-0"
                   >
                     Lihat Semua
                   </button>
                 )}
              </div>

              <div className="space-y-3 lg:space-y-4 mb-6">
                 {history.slice(0, 3).map((item) => (
                    <div 
                      key={item.id}
                       onClick={() => setShowHistoryModal(item)}
                      className="group flex items-center justify-between gap-4 bg-[#f8fafc] dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700/80 p-3 rounded-2xl cursor-pointer transition-colors border border-transparent hover:border-emerald-100 dark:hover:border-stone-600"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-16 h-16 shrink-0 bg-stone-200 dark:bg-stone-700 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
                          {item.imagePreview ? (
                             <img src={item.imagePreview} alt="Product" className="w-full h-full object-cover" />
                          ) : (
                             <Camera className="w-6 h-6 text-stone-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                           <h4 className="font-bold text-stone-900 dark:text-white truncate text-sm mb-1">{item.productName}</h4>
                           <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
                             {new Date(item.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}
                           </p>
                           <span className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                              item.status === 'ERROR' ? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400" :
                              item.status === 'HIJAU' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
                              item.status === 'KUNING' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" :
                              "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                           )}>
                              {item.status === 'HIJAU' ? <CheckCircle className="w-3 h-3" /> : item.status === 'ERROR' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {item.status === 'KUNING' ? 'Beresiko' : item.status === 'MERAH' ? 'Berbahaya' : item.status === 'ERROR' ? 'Error' : 'Aman'}
                           </span>
                        </div>
                      </div>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all shrink-0 focus:opacity-100"
                        title="Hapus riwayat"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                 ))}
                 {history.length === 0 && (
                    <div className="text-center py-8 text-stone-400 dark:text-stone-500">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Belum ada riwayat</p>
                    </div>
                 )}
              </div>

              {/* Stats Box */}
              <div className="bg-[#eff6ff] dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-800/50">
                 <div className="flex justify-between items-end mb-3">
                   <span className="font-bold text-blue-900 dark:text-blue-200">Scan Minggu Ini</span>
                   <span className="text-3xl font-extrabold text-[#1e40af] dark:text-blue-300 leading-none">{history.length}</span>
                 </div>
                 <div className="h-2.5 w-full bg-blue-200/60 dark:bg-blue-900/40 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-[#1e40af] dark:bg-blue-500 rounded-full" style={{ width: `${Math.min((history.length / 20) * 100, 100)}%` }}></div>
                 </div>
                 <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    {Math.round(Math.min((history.length / 20) * 100, 100))}% dari target scan harianmu
                 </p>
              </div>
           </div>

           {/* Tips Hari Ini Card */}
           <div className="bg-[#0f7652] dark:bg-emerald-900 text-white p-6 sm:p-8 rounded-2xl lg:rounded-[2rem] relative overflow-hidden shadow-xl border border-emerald-700">
              {/* Decorative shapes */}
              <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-emerald-600/30 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute top-6 right-6 w-10 h-10 border-4 border-emerald-500/30 rounded-full pointer-events-none"></div>
              
              <h3 className="font-bold text-xl sm:text-2xl mb-2 sm:mb-4 relative z-10 flex items-center gap-2">
                 Tips Hari Ini
              </h3>
              <p className="text-emerald-50 mb-6 sm:mb-8 relative z-10 leading-relaxed font-medium text-sm sm:text-base lg:text-lg">
                Kurangi asupan natrium dengan menghindari makanan olahan kaleng.
              </p>
              <button 
                onClick={() => setShowTipsModal(true)}
                className="bg-white text-[#0f7652] font-black px-5 py-2.5 sm:px-6 sm:py-3 rounded-full text-xs sm:text-sm hover:bg-emerald-50 transition-colors relative z-10 shadow-lg w-max mt-1 inline-block"
              >
                Baca Lebih Lanjut
              </button>
           </div>
        </div>

      </main>

      {/* Tips Modal */}
      <AnimatePresence>
        {showTipsModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowTipsModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[85vh] rounded-2xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 dark:border-stone-800 bg-emerald-50 dark:bg-emerald-900/10">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Heart className="w-5 h-5" />
                   </div>
                   <h3 className="font-bold text-lg sm:text-xl text-stone-900 dark:text-white">Edu-Sehat</h3>
                </div>
                <button 
                  onClick={() => setShowTipsModal(false)}
                  className="p-2 hover:bg-stone-200 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-stone-50 dark:bg-stone-950/50">
                 <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-white mb-6">Waspada Jebakan Garam Tersembunyi di Dalam Kaleng!</h2>
                 
                 <div className="mb-6 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-2xl p-5">
                   <h4 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2 mb-3">
                     <AlertTriangle className="w-5 h-5" /> Mengapa Ini Berbahaya?
                   </h4>
                   <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-sm sm:text-base">
                     Makanan olahan kaleng umumnya menggunakan natrium (garam) dalam jumlah tinggi sebagai pengawet agar tahan lama. Konsumsi natrium berlebih akan menarik banyak cairan ke dalam pembuluh darah, sehingga meningkatkan volume darah dan memaksa jantung bekerja lebih keras. Kinerja ekstra ini akan menekan dinding pembuluh darah secara terus-menerus dan memicu tekanan darah tinggi (hipertensi).
                   </p>
                 </div>

                 <div className="mb-8">
                   <h4 className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-4">
                     <ShieldCheck className="w-5 h-5" /> Solusi Cerdas & Lezat
                   </h4>
                   <ul className="space-y-3">
                      <li className="flex gap-3">
                         <div className="mt-0.5"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
                         <p className="text-stone-700 dark:text-stone-300 text-sm sm:text-base"><strong className="text-stone-900 dark:text-white">Bilas Dulu Sebelum Dimasak:</strong> Jika terpaksa menggunakan bahan kalengan (seperti kacang matang atau jagung kaleng), buang air rendamannya dan bilas bersih dengan air mengalir untuk membuang sodium.</p>
                      </li>
                      <li className="flex gap-3">
                         <div className="mt-0.5"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
                         <p className="text-stone-700 dark:text-stone-300 text-sm sm:text-base"><strong className="text-stone-900 dark:text-white">Andalkan Bumbu Alami:</strong> Ganti penyedap instan dengan rempah aromatik segar seperti bawang putih, jahe, perasan jeruk lemon, ketumbar, atau lada hitam untuk memperkuat rasa.</p>
                      </li>
                      <li className="flex gap-3">
                         <div className="mt-0.5"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
                         <p className="text-stone-700 dark:text-stone-300 text-sm sm:text-base"><strong className="text-stone-900 dark:text-white">Pilih 'Low Sodium':</strong> Biasakan membaca label dan beli versi kaleng yang mencantumkan 'Rendah Natrium' (Low Sodium) atau 'Tanpa Garam Tambahan'.</p>
                      </li>
                      <li className="flex gap-3">
                         <div className="mt-0.5"><CheckCircle className="w-5 h-5 text-emerald-500" /></div>
                         <p className="text-stone-700 dark:text-stone-300 text-sm sm:text-base"><strong className="text-stone-900 dark:text-white">Perbanyak Bahan Segar:</strong> Usahakan menggunakan sayuran segar atau beku murni ketimbang versi kalengan yang rentan tambahan pengawet.</p>
                      </li>
                   </ul>
                 </div>

                 <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5">
                   <h4 className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2 mb-4">
                     <Zap className="w-5 h-5" /> Tanya NutriScanAI (Segera Hadir)
                   </h4>
                   <div className="flex flex-col gap-2">
                     <button className="bg-white dark:bg-stone-800 border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 text-left px-4 py-3 rounded-xl text-sm text-stone-700 dark:text-stone-300 transition-colors">
                       "Berapa batas aman natrium harian saya?"
                     </button>
                     <button className="bg-white dark:bg-stone-800 border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 text-left px-4 py-3 rounded-xl text-sm text-stone-700 dark:text-stone-300 transition-colors">
                       "Apa tanda tubuh kelebihan garam?"
                     </button>
                     <button className="bg-white dark:bg-stone-800 border border-blue-100 dark:border-blue-900/50 hover:border-blue-300 text-left px-4 py-3 rounded-xl text-sm text-stone-700 dark:text-stone-300 transition-colors">
                       "Apakah garam himalaya lebih aman dari garam meja biasa?"
                     </button>
                   </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* All History Modal */}
      <AnimatePresence>
        {showAllHistory && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAllHistory(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-stone-900 w-full max-w-3xl max-h-[85vh] rounded-2xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 dark:border-stone-800">
                <div className="min-w-0 pr-4">
                   <h3 className="font-bold text-lg sm:text-xl text-stone-900 dark:text-white mb-0.5 sm:mb-1">Semua Riwayat Scan</h3>
                   <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                     Total {history.length} riwayat ditemukan
                   </p>
                </div>
                <button 
                  onClick={() => setShowAllHistory(false)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-stone-50 dark:bg-stone-950/50">
                 {history.length > 0 ? (
                   <div className="space-y-3">
                     {history.map((item) => (
                        <div 
                          key={item.id}
                          onClick={() => { setShowAllHistory(false); setShowHistoryModal(item); }}
                          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-2xl cursor-pointer transition-all border border-stone-200 hover:border-emerald-300 dark:border-stone-800 dark:hover:border-stone-600 shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-16 h-16 shrink-0 bg-stone-100 dark:bg-stone-800 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                              {item.imagePreview ? (
                                 <img src={item.imagePreview} alt="Product" className="w-full h-full object-cover" />
                              ) : (
                                 <Camera className="w-6 h-6 text-stone-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                               <h4 className="font-bold text-stone-900 dark:text-white truncate text-base mb-1">{item.productName}</h4>
                               <p className="text-sm text-stone-500 dark:text-stone-400 mb-2">
                                 {new Date(item.date).toLocaleString('id-ID', {day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'})}
                               </p>
                               <span className={cn(
                                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide",
                                  item.status === 'ERROR' ? "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400" :
                                  item.status === 'HIJAU' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" :
                                  item.status === 'KUNING' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" :
                                  "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                               )}>
                                  {item.status === 'HIJAU' ? <CheckCircle className="w-4 h-4" /> : item.status === 'ERROR' ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                  {item.status === 'KUNING' ? 'Beresiko' : item.status === 'MERAH' ? 'Berbahaya' : item.status === 'ERROR' ? 'Error' : 'Aman'}
                               </span>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => deleteHistoryItem(item.id, e)}
                            className="self-end sm:self-center bg-stone-100 dark:bg-stone-800 hover:bg-red-100 dark:hover:bg-red-900/30 text-stone-500 hover:text-red-600 dark:hover:text-red-400 p-2.5 rounded-xl transition-colors shrink-0"
                            title="Hapus riwayat"
                          >
                             <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                     ))}
                   </div>
                 ) : (
                    <div className="text-center py-16 text-stone-400 dark:text-stone-500 flex flex-col items-center">
                      <History className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-stone-600 dark:text-stone-300">Belum ada riwayat scan</p>
                      <p className="text-sm mt-2">Mulai scan label makanan pertamamu sekarang!</p>
                    </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Detail Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowHistoryModal(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white dark:bg-stone-900 w-full max-w-2xl max-h-[85vh] rounded-2xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border border-stone-200 dark:border-stone-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 dark:border-stone-800">
                <div className="min-w-0 pr-4">
                   <h3 className="font-bold text-lg sm:text-xl text-stone-900 dark:text-white mb-0.5 sm:mb-1 truncate">{showHistoryModal.productName}</h3>
                   <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 truncate">
                     {new Date(showHistoryModal.date).toLocaleString('id-ID')}
                   </p>
                </div>
                <button 
                  onClick={() => setShowHistoryModal(null)}
                  className="p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-stone-50 dark:bg-stone-950/50">
                 <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-6">
                    <button
                      onClick={() => toggleSpeak(showHistoryModal.resultText)}
                      className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-800/50 px-4 py-2 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors border border-emerald-200 dark:border-emerald-800/50"
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      {isSpeaking ? "Hentikan" : "Bacakan"}
                    </button>
                 </div>
                 
                 <div className="mt-4">
                   <ResultDisplay text={showHistoryModal.resultText} />
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
