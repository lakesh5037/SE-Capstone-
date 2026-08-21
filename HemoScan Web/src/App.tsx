import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Upload, Search, Settings, LogOut, User, AlertTriangle, CheckCircle,
  ChevronRight, ArrowLeft, Lock, Mail, Smartphone, Database, Shield,
  Building2, BadgeCheck, Wifi, Brain, Zap, TrendingUp, Eye,
  RefreshCw, Bell, Moon, Sun, Globe, Star,
  HeartPulse, ScanLine, Microscope, FileText, Info, X, Plus, Trash2, Download
} from 'lucide-react';
import { apiService, getApiBaseUrl } from './services/api';
import type { ScanItemDto, NotificationItem } from './services/api';
import { initializeModels, processBrainScan } from './services/classifier';
import type { ScanResult } from './services/classifier';
import { useFCM } from './hooks/useFCM';
import i18n, { getLanguageCode } from './i18n';

// ─── Route type ───────────────────────────────────────────────────────────────
type Route = 'splash' | 'login' | 'signup' | 'forgot-password' | 'dashboard' | 'new-scan' | 'history' | 'settings';

// ─── Animation Presets ────────────────────────────────────────────────────────
export const fadeUp   = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
export const fadeIn   = { hidden: { opacity: 0 },         show: { opacity: 1 } };
export const scaleIn  = { hidden: { opacity: 0, scale: 0.94 }, show: { opacity: 1, scale: 1 } };
export const slideRight = { hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } };

export const stagger = (delay = 0.06) => ({
  show: { transition: { staggerChildren: delay } }
});

// ─── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) { setDisplayed(0); return; }
    const duration = 900;
    const step = Math.ceil(end / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplayed(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{displayed}</>;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`toggle-switch ${checked ? 'checked' : ''}`}
    />
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [currentRoute, setCurrentRoute] = useState<Route>('splash');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [_dashboardLoading, setDashboardLoading] = useState(true);
  const [_historyLoading, setHistoryLoading] = useState(true);

  // Auth
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [signupGender, setSignupGender] = useState('Male');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpAction, setOtpAction] = useState<'signup' | 'forgot_pwd'>('signup');
  const [resetEmail, setResetEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');

  // Session
  const [doctor, setDoctor] = useState<{
    name: string; email: string; mobile?: string; gender?: string;
    specialty?: string; profile_image?: string; bio?: string; hospital?: string;
    license?: string; years_exp?: number; dark_mode?: number; language?: string;
    daily_summary?: number; sound?: number; vibration?: number; theme_mode?: number;
  } | null>(null);

  // Scans
  const [scans, setScans] = useState<ScanItemDto[]>([]);
  const [recentScans, setRecentScans] = useState<ScanItemDto[]>([]);
  const [stats, setStats] = useState({ total: 0, normal: 0, abnormal: 0 });
  const [selectedScan, setSelectedScan] = useState<ScanItemDto | null>(null);

  // Notifications (synced from backend — shared with Android)
  const [_notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [_notifLoading, setNotifLoading] = useState(false);

  // Delta-sync baseline: stores server_time from last successful scan fetch
  const lastSyncTimeRef = useRef<number>(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'total' | 'normal' | 'abnormal'>('total');
  const [filterGender, setFilterGender] = useState('All');
  const [filterAge, setFilterAge] = useState('All');

  // New Scan
  const [patientId, setPatientId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('Male');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState('');
  const [scanStage, setScanStage] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [aiResult, setAiResult] = useState<ScanResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Settings
  const [editName, setEditName] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editHospital, setEditHospital] = useState('');
  const [editLicense, setEditLicense] = useState('');
  const [editYearsExp, setEditYearsExp] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [mlStatus, setMlStatus] = useState('Initializing AI models...');
  const [_mlReady, setMlReady] = useState(false);

  // Settings sub-pages
  type SettingsSubPage = null | 'privacy' | 'terms' | 'faq' | 'contact' | 'app-info' | 'about-us' | 'change-password';
  const [settingsSubPage, setSettingsSubPage] = useState<SettingsSubPage>(null);
  const [faqOpenIndex, setFaqOpenIndex] = useState<number | null>(null);
  // Contact Support form
  const [contactCategory, setContactCategory] = useState('Technical Issue');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactTicketNumber, setContactTicketNumber] = useState('');
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const fetchUserTickets = async () => {
    if (!doctor?.email) return;
    setLoadingTickets(true);
    try {
      const res = await apiService.getTickets(doctor.email);
      if (res.status === 'success' && (res as any).data) {
        setUserTickets((res as any).data);
      }
    } catch (e) {
      /* ignore */
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (settingsSubPage === 'contact' && doctor?.email) {
      fetchUserTickets();
    }
  }, [settingsSubPage, doctor?.email]);
  // Change Password form
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [cpLoading, setCpLoading] = useState(false);

  // Auto-clear messages
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  // Dark Mode sync
  useEffect(() => {
    if (doctor?.dark_mode === 1) {
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
    }
  }, [doctor?.dark_mode]);

  // FCM Push Notifications — registers device token after login
  // No-op if Firebase is not configured (google-services.json / firebaseConfig.ts not filled)
  useFCM(doctor?.email || null);

  // Splash + ML init
  useEffect(() => {
    const initApp = async () => {
      const modelTimeout = new Promise<void>(resolve => setTimeout(resolve, 5000));
      const modelLoad = initializeModels((status) => setMlStatus(status));
      await Promise.race([modelLoad, modelTimeout]);
      setMlReady(true);

      const savedEmail = localStorage.getItem('hemoscan_email');
      if (savedEmail) {
        try {
          const res = await apiService.checkUser(savedEmail);
          if (res.status === 'success') {
            setDoctor({
              name: res.name || 'Doctor', email: savedEmail,
              mobile: res.mobile, gender: res.gender,
              specialty: res.specialty || 'Radiologist',
              profile_image: res.profile_image, bio: res.bio || '',
              hospital: res.hospital || '', license: res.license || '',
              years_exp: res.years_exp || 0, dark_mode: res.dark_mode || 0,
              language: res.language || 'English', daily_summary: res.daily_summary || 1,
              sound: res.sound || 1, vibration: res.vibration || 1,
              theme_mode: res.theme_mode || 0
            });
            // Persist for offline fallback
            Object.entries({
              hemoscan_name: res.name || 'Doctor',
              hemoscan_specialty: res.specialty || 'Radiologist',
              hemoscan_photo: res.profile_image || '',
              hemoscan_bio: res.bio || '',
              hemoscan_hospital: res.hospital || '',
              hemoscan_license: res.license || '',
              hemoscan_years_exp: String(res.years_exp || 0),
              hemoscan_dark_mode: String(res.dark_mode || 0),
              hemoscan_language: res.language || 'English',
              hemoscan_daily_summary: String(res.daily_summary || 1),
              hemoscan_sound: String(res.sound || 1),
              hemoscan_vibration: String(res.vibration || 1),
              hemoscan_theme_mode: String(res.theme_mode || 0)
            }).forEach(([k, v]) => v && localStorage.setItem(k, v));
            setCurrentRoute('dashboard');
            i18n.changeLanguage(getLanguageCode(res.language || 'English'));
            fetchDashboardData(savedEmail);
            fetchNotifications(savedEmail);
          } else {
            localStorage.clear();
            setCurrentRoute('login');
          }
        } catch (e) {
          const cachedName = localStorage.getItem('hemoscan_name') || 'Doctor';
          setDoctor({
            name: cachedName, email: savedEmail,
            specialty: localStorage.getItem('hemoscan_specialty') || 'Radiologist',
            profile_image: localStorage.getItem('hemoscan_photo') || undefined,
            bio: localStorage.getItem('hemoscan_bio') || '',
            hospital: localStorage.getItem('hemoscan_hospital') || '',
            license: localStorage.getItem('hemoscan_license') || '',
            years_exp: parseInt(localStorage.getItem('hemoscan_years_exp') || '0'),
            dark_mode: parseInt(localStorage.getItem('hemoscan_dark_mode') || '0'),
            language: localStorage.getItem('hemoscan_language') || 'English',
            daily_summary: parseInt(localStorage.getItem('hemoscan_daily_summary') || '1'),
            sound: parseInt(localStorage.getItem('hemoscan_sound') || '1'),
            vibration: parseInt(localStorage.getItem('hemoscan_vibration') || '1'),
            theme_mode: parseInt(localStorage.getItem('hemoscan_theme_mode') || '0')
          });
          setCurrentRoute('dashboard');
        }
      } else {
        setCurrentRoute('login');
      }
    };
    initApp();
  }, []);

  // ── Dashboard Data ──────────────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async (email: string, ignoreCache = false) => {
    setDashboardLoading(true);
    setHistoryLoading(true);
    try {
      const res = await apiService.getPatientScans(email, null, null, null, null, ignoreCache);
      if (res.status === 'success' && res.data) {
        setScans(res.data);
        let normal = 0, abnormal = 0;
        res.data.forEach(item => {
          if (item.result?.toLowerCase().includes('abnormal')) abnormal++;
          else normal++;
        });
        setStats({ total: res.data.length, normal, abnormal });
        setRecentScans(res.data.slice(0, 5));
        // Store server_time as baseline for next delta sync
        if (res.server_time) lastSyncTimeRef.current = res.server_time;
      }
    } catch (e) { console.error('Failed to load scans', e); }
    finally {
      setDashboardLoading(false);
      setHistoryLoading(false);
    }
  }, []);

  // ── Load Notifications from backend ────────────────────────────────────────
  const fetchNotifications = useCallback(async (email: string) => {
    setNotifLoading(true);
    try {
      const res = await apiService.getNotifications(email);
      if (res.status === 'success') {
        setNotifications(res.data);
        setUnreadCount(res.unread_count);
      }
    } catch (e) { console.error('Failed to load notifications', e); }
    finally { setNotifLoading(false); }
  }, []);

  // ── Delete Scan (cross-platform) ────────────────────────────────────────────
  const handleDeleteScan = useCallback(async (scanId: string) => {
    if (!doctor?.email) return;
    if (!window.confirm('Delete this scan record? This cannot be undone.')) return;
    try {
      const res = await apiService.deleteScan(scanId, doctor.email);
      if (res.status === 'success') {
        setScans(prev => prev.filter(s => s.id !== scanId));
        setRecentScans(prev => prev.filter(s => s.id !== scanId));
        setStats(prev => {
          const deleted = scans.find(s => s.id === scanId);
          const wasAbnormal = deleted?.result?.toLowerCase().includes('abnormal') ?? false;
          return {
            total: prev.total - 1,
            normal: wasAbnormal ? prev.normal : prev.normal - 1,
            abnormal: wasAbnormal ? prev.abnormal - 1 : prev.abnormal,
          };
        });
        setMessage({ type: 'success', text: 'Scan deleted successfully.' });
        if (selectedScan?.id === scanId) setSelectedScan(null);
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to delete scan.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error while deleting scan.' });
    }
  }, [doctor?.email, scans, selectedScan]);

  // ── 30-second polling for new/updated scans (delta sync) ───────────────────
  useEffect(() => {
    if (!doctor?.email) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const email = doctor.email;

    const doPoll = async () => {
      try {
        // Use delta sync: only fetch scans newer than last known server_time
        const since = lastSyncTimeRef.current;
        const url = `${getApiBaseUrl()}get_scans.php?doctor_email=${encodeURIComponent(email)}&since=${since}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'success' && data.data && data.data.length > 0) {
          // Merge new/updated scans into the list (newest first, no duplicates)
          setScans(prev => {
            const existingIds = new Set(prev.map((s: ScanItemDto) => s.id));
            const newItems = data.data.filter((s: ScanItemDto) => !existingIds.has(s.id));
            if (newItems.length === 0) return prev;
            const merged = [...newItems, ...prev];
            let normal = 0, abnormal = 0;
            merged.forEach((s: ScanItemDto) => {
              if (s.result?.toLowerCase().includes('abnormal')) abnormal++; else normal++;
            });
            setStats({ total: merged.length, normal, abnormal });
            setRecentScans(merged.slice(0, 5));
            return merged;
          });
        }
        if (data.server_time) lastSyncTimeRef.current = data.server_time;

        // Also refresh notification badge
        const notifRes = await apiService.getNotifications(email);
        if (notifRes.status === 'success') {
          setUnreadCount(notifRes.unread_count);
        }
      } catch (_) { /* silent — offline */ }
    };

    pollIntervalRef.current = setInterval(doPoll, 30_000); // 30-second interval
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [doctor?.email]);


  // ── Auth ────────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { setMessage({ type: 'error', text: 'Please fill in all fields' }); return; }
    setLoading(true);
    try {
      const res = await apiService.login(loginEmail, loginPassword);
      if (res.status === 'success') {
        const fields: Record<string, string> = {
          hemoscan_email: loginEmail, hemoscan_name: res.name || 'Doctor',
          hemoscan_specialty: res.specialty || 'Radiologist',
          hemoscan_photo: res.profile_image || '', hemoscan_bio: res.bio || '',
          hemoscan_hospital: res.hospital || '', hemoscan_license: res.license || '',
          hemoscan_years_exp: String(res.years_exp || 0),
          hemoscan_dark_mode: String(res.dark_mode || 0),
          hemoscan_language: res.language || 'English',
          hemoscan_daily_summary: String(res.daily_summary || 1),
          hemoscan_sound: String(res.sound || 1), hemoscan_vibration: String(res.vibration || 1),
          hemoscan_theme_mode: String(res.theme_mode || 0)
        };
        Object.entries(fields).forEach(([k, v]) => localStorage.setItem(k, v));
        setDoctor({
          name: res.name || 'Doctor', email: loginEmail, mobile: res.mobile, gender: res.gender,
          specialty: res.specialty || 'Radiologist', profile_image: res.profile_image,
          bio: res.bio || '', hospital: res.hospital || '', license: res.license || '',
          years_exp: res.years_exp || 0, dark_mode: res.dark_mode || 0,
          language: res.language || 'English', daily_summary: res.daily_summary || 1,
          sound: res.sound || 1, vibration: res.vibration || 1, theme_mode: res.theme_mode || 0
        });
        setMessage({ type: 'success', text: `Welcome back, Dr. ${res.name}!` });
        setLoginPassword('');
        setCurrentRoute('dashboard');
        fetchDashboardData(loginEmail, true);
        fetchNotifications(loginEmail);
      } else { setMessage({ type: 'error', text: res.message }); }
    } catch { setMessage({ type: 'error', text: 'Connection failed. Is the server running?' }); }
    finally { setLoading(false); }
  };

  const handleSendOtp = async (email: string, action: 'signup' | 'forgot_pwd') => {
    setLoading(true);
    try {
      const res = await apiService.sendOtp(email, action);
      if (res.status === 'success') {
        setOtpAction(action); setShowOtpModal(true);
        setMessage({ type: 'success', text: 'Verification code sent to your email.' });
      } else { setMessage({ type: 'error', text: res.message }); }
    } catch { setMessage({ type: 'error', text: 'Failed to send OTP.' }); }
    finally { setLoading(false); }
  };

  const handleVerifyOtpAndCompleteSignup = async () => {
    if (!otpCode) { setMessage({ type: 'error', text: 'Please enter the verification code' }); return; }
    setLoading(true);
    try {
      const verifyRes = await apiService.verifyOtp(signupEmail, otpCode, 'signup');
      if (verifyRes.status !== 'success') {
        setMessage({ type: 'error', text: verifyRes.message || 'Invalid or expired code.' });
        setLoading(false); return;
      }
      const res = await apiService.signup(signupName, signupEmail, signupMobile, signupGender, signupPassword, otpCode);
      if (res.status === 'success') {
        setMessage({ type: 'success', text: 'Account created! Please sign in.' });
        setShowOtpModal(false);
        setSignupName(''); setSignupEmail(''); setSignupMobile('');
        setSignupPassword(''); setSignupConfirmPassword(''); setOtpCode('');
        setCurrentRoute('login');
      } else { setMessage({ type: 'error', text: res.message }); }
    } catch { setMessage({ type: 'error', text: 'Registration failed.' }); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetPassword) { setMessage({ type: 'error', text: 'All fields required.' }); return; }
    setLoading(true);
    try {
      const verifyRes = await apiService.verifyOtp(resetEmail, otpCode, 'forgot_pwd');
      if (verifyRes.status !== 'success') {
        setMessage({ type: 'error', text: verifyRes.message || 'Invalid OTP.' });
        setLoading(false); return;
      }
      const res = await apiService.resetPassword(resetEmail, otpCode, resetPassword);
      if (res.status === 'success') {
        setMessage({ type: 'success', text: 'Password reset! Please sign in.' });
        setResetEmail(''); setResetPassword(''); setOtpCode('');
        setShowOtpModal(false); setCurrentRoute('login');
      } else { setMessage({ type: 'error', text: res.message }); }
    } catch { setMessage({ type: 'error', text: 'Reset failed.' }); }
    finally { setLoading(false); }
  };

  // ── Scan Pipeline ───────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      setAiResult(null);
    }
  };

  const triggerDetection = async () => {
    if (!patientId || !patientName || !patientAge || !selectedFile || !imagePreview) {
      setMessage({ type: 'error', text: 'Please fill all patient details and upload a scan image.' }); return;
    }
    setIsScanning(true); setScanStage(1);
    setScanProgress('Stage 1: Validating brain CT scan image...');
    try {
      const result = await processBrainScan(imagePreview, selectedFile);
      if (result.validationFailed) {
        setScanProgress(''); setIsScanning(false); setScanStage(0);
        setAiResult(result);
        setMessage({ type: 'error', text: result.validationError || 'Invalid scan image' }); return;
      }
      setScanStage(2); setScanProgress('Stage 2: Detecting hemorrhage boundaries...');
      await new Promise(r => setTimeout(r, 600));
      setScanStage(3); setScanProgress('Stage 3: Classifying hemorrhage subtypes...');
      await new Promise(r => setTimeout(r, 600));
      setScanStage(4); setScanProgress('Stage 4: Syncing results to database...');

      const scanResultStr = result.hasHemorrhage
        ? `Abnormal (Hemorrhage detected: ${result.topSubtype})`
        : 'Normal (No Hemorrhage)';
      const riskLevel = result.hasHemorrhage
        ? (result.highestConfidence > 0.82 ? 'High Risk' : 'Medium Risk')
        : 'Low Risk';
      const fileToUpload = result.processedImageBlob
        ? new File([result.processedImageBlob], selectedFile.name, { type: 'image/jpeg' })
        : selectedFile;

      const uploadRes = await apiService.uploadScan(
        doctor?.email || '', patientId, patientName, patientAge, patientGender,
        scanResultStr, riskLevel, fileToUpload
      );
      if (uploadRes.status === 'success') {
        setMessage({ type: 'success', text: 'Analysis complete. Results saved.' });
        setAiResult(result);
        fetchDashboardData(doctor?.email || '', true);
      } else {
        setMessage({ type: 'error', text: `AI done, but save failed: ${uploadRes.message}` });
        setAiResult(result);
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Analysis pipeline error.' });
    } finally {
      setIsScanning(false); setScanStage(0); setScanProgress('');
    }
  };

  // ── Settings Actions ─────────────────────────────────────────────────────────
  const handleShareApp = async () => {
    const shareData = {
      title: 'HemoScan AI',
      text: 'HemoScan AI — Clinical Brain Hemorrhage Diagnostics powered by AI. Try it now!',
      url: window.location.origin,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        setMessage({ type: 'success', text: '✅ Link copied to clipboard!' });
      } catch {
        setMessage({ type: 'error', text: 'Could not copy link. Please copy: ' + shareData.url });
      }
    }
  };

  const handleRateApp = () => {
    window.open('https://play.google.com/store/apps/details?id=com.example.brainhemorrhage', '_blank', 'noopener,noreferrer');
  };

  // ── Download PDF Report Helper ─────────────────────────────────────────────
  const handleDownloadResultPDF = (scan: any) => {
    if (!scan) return;
    const pName = scan.patient_name || scan.patientName || 'Patient #' + (scan.id || '1');
    const resultStr = scan.result || 'Normal';
    const isAbnormal = resultStr.toLowerCase().includes('abnormal') || (resultStr.toLowerCase().includes('hemorrhage') && !resultStr.toLowerCase().includes('no hemorrhage'));
    const status = isAbnormal ? 'ABNORMAL' : 'NORMAL';
    const dateStr = scan.created_at || scan.date || scan.date_added || new Date().toLocaleDateString();
    
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      setMessage({ type: 'error', text: 'Popup blocked. Please allow popups to download PDF.' });
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>HemoScan_Report_${scan.id || '1'}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 40px; }
          .report-card { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
          .header { background: #1e1b4b; color: #ffffff; padding: 24px 32px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: 800; color: #818cf8; margin: 0; }
          .subtitle { font-size: 13px; color: #cbd5e1; margin-top: 4px; }
          .meta-box { background: #f1f5f9; padding: 16px 20px; border-radius: 10px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
          .status-pill { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 800; font-size: 13px; letter-spacing: 0.5px; background: ${isAbnormal ? '#ffe4e6' : '#dcfce7'}; color: ${isAbnormal ? '#e11d48' : '#16a34a'}; border: 1px solid ${isAbnormal ? '#fecdd3' : '#bbf7d0'}; }
          .image-preview { text-align: center; margin: 24px 0; background: #0f172a; padding: 16px; border-radius: 12px; }
          .image-preview img { max-width: 100%; max-height: 320px; border-radius: 8px; border: 1px solid #334155; }
          .disclaimer { font-size: 11px; color: #64748b; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; }
          @media print { body { background: #fff; padding: 0; } .report-card { border: none; box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="report-card">
          <div class="header">
            <div>
              <div class="title">HemoScan AI</div>
              <div class="subtitle">Diagnostic Neuroimaging Report</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #a5b4fc;">
              <div>Date: ${dateStr}</div>
              <div>Report ID: HST-${scan.id || '1'}</div>
            </div>
          </div>
          <div class="meta-box">
            <div><strong>Patient Name:</strong> ${pName}</div>
            <div><strong>Age / Gender:</strong> ${scan.patient_age || scan.age || 'N/A'} / ${scan.patient_gender || scan.gender || 'N/A'}</div>
            <div><strong>Diagnosis Status:</strong> <span class="status-pill">${status}</span></div>
            <div><strong>Findings:</strong> ${resultStr}</div>
          </div>
          ${(scan.image_path || scan.imageUri || scan.imagePath) ? `
            <div class="image-preview">
              <img src="${(scan.image_path || scan.imageUri || scan.imagePath).startsWith('http') ? (scan.image_path || scan.imageUri || scan.imagePath) : ('http://localhost/brainscan_api/' + (scan.image_path || scan.imageUri || scan.imagePath))}" alt="CT Scan" />
            </div>
          ` : ''}
          <div class="disclaimer">
            CONFIDENTIAL MEDICAL REPORT — Generated by HemoScan AI Decision Support.<br/>
            Must be reviewed by a certified physician before clinical intervention.
          </div>
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
      </html>
    `;
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage || contactMessage.trim().length < 20) {
      setMessage({ type: 'error', text: 'Please describe your issue in at least 20 characters.' });
      return;
    }
    if (!doctor?.email) {
      setMessage({ type: 'error', text: 'Session error. Please log in again.' });
      return;
    }
    setContactLoading(true);
    try {
      const res = await apiService.submitTicket(
        doctor.email,
        contactCategory,
        contactMessage.trim()
      );
      if (res.status === 'success') {
        setContactTicketNumber((res as any).ticket_number || '');
        setContactSuccess(true);
        setContactMessage('');
        fetchUserTickets();
        setMessage({ type: 'success', text: 'Support ticket submitted! Check your email for confirmation.' });
      } else {
        setMessage({ type: 'error', text: res.message || 'Failed to submit ticket. Please try again.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error. Please check your connection and try again.' });
    } finally {
      setContactLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpCurrent) { setMessage({ type: 'error', text: 'Please enter your current password.' }); return; }
    if (cpNew.length < 6) { setMessage({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    if (cpNew !== cpConfirm) { setMessage({ type: 'error', text: 'New passwords do not match.' }); return; }
    const hasUpper = /[A-Z]/.test(cpNew);
    const hasNum   = /[0-9]/.test(cpNew);
    const hasSpec  = /[!@#$%^&*()_+\-=\[\]{}|,.<>?]/.test(cpNew);
    if (!hasUpper || !hasNum || !hasSpec) {
      setMessage({ type: 'error', text: 'Password must include uppercase, a number, and a special character.' });
      return;
    }
    setCpLoading(true);
    try {
      const res = await apiService.changePassword(doctor?.email || '', cpCurrent, cpNew);
      if (res.status === 'success') {
        setMessage({ type: 'success', text: '✅ Password changed successfully!' });
        setCpCurrent(''); setCpNew(''); setCpConfirm('');
        setSettingsSubPage(null);
      } else {
        setMessage({ type: 'error', text: res.message || 'Password change failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally { setCpLoading(false); }
  };

  // ── Settings ────────────────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName) { setMessage({ type: 'error', text: 'Name cannot be empty.' }); return; }
    setLoading(true);
    try {
      const res = await apiService.updateProfile(doctor?.email || '', editName, editSpecialty, editPhoto, {
        bio: editBio, hospital: editHospital, license: editLicense,
        years_exp: editYearsExp ? parseInt(editYearsExp) : 0
      });
      if (res.status === 'success') {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setDoctor(prev => prev ? {
          ...prev, name: editName, specialty: editSpecialty, bio: editBio,
          hospital: editHospital, license: editLicense,
          years_exp: editYearsExp ? parseInt(editYearsExp) : 0,
          profile_image: res.profile_image || prev.profile_image
        } : null);
        if (res.profile_image) localStorage.setItem('hemoscan_photo', res.profile_image);
        localStorage.setItem('hemoscan_name', editName);
        localStorage.setItem('hemoscan_specialty', editSpecialty);
        setEditPhoto(null); setEditPhotoPreview(null); setShowEditProfileModal(false);
      } else { setMessage({ type: 'error', text: res.message }); }
    } catch { setMessage({ type: 'error', text: 'Settings update failed.' }); }
    finally { setLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('WARNING: Permanently delete your account? This cannot be undone.')) return;
    const pwd = window.prompt('Enter your current password to confirm deletion:');
    if (!pwd) { setMessage({ type: 'error', text: 'Password required.' }); return; }
    setLoading(true);
    try {
      const res = await apiService.deleteAccount(doctor?.email || '', pwd);
      if (res.status === 'success') { setMessage({ type: 'success', text: 'Account deleted.' }); handleLogout(); }
      else { setMessage({ type: 'error', text: res.message }); }
    } catch { setMessage({ type: 'error', text: 'Delete request failed.' }); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    localStorage.clear(); setDoctor(null); setLoginEmail(''); setCurrentRoute('login');
    document.documentElement.classList.remove('dark-theme');
  };

  const updatePref = async (key: string, value: number | string) => {
    setDoctor(prev => prev ? { ...prev, [key]: value } : null);
    if (key === 'language') {
      i18n.changeLanguage(getLanguageCode(String(value)));
    }
    try { await apiService.updateProfile(doctor?.email || '', undefined, undefined, null, { [key]: value }); }
    catch {}
  };

  const getProfilePhotoUrl = (path: string | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${getApiBaseUrl()}${path}`;
  };

  const isPortal = ['dashboard', 'new-scan', 'history', 'settings'].includes(currentRoute);
  const isAuth = ['login', 'signup', 'forgot-password', 'splash'].includes(currentRoute);

  // ── Filtered Scans ──────────────────────────────────────────────────────────
  const filteredScans = scans.filter(scan => {
    const matchSearch = scan.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scan.patient_id.toLowerCase().includes(searchTerm.toLowerCase());
    const isAbnormal = scan.result?.toLowerCase().includes('abnormal');
    const matchResult = filterType === 'total' || (filterType === 'normal' && !isAbnormal) || (filterType === 'abnormal' && isAbnormal);
    const matchGender = filterGender === 'All' || scan.patient_gender === filterGender;
    const age = parseInt(scan.patient_age) || 0;
    const matchAge = filterAge === 'All' ||
      (filterAge === 'young' && age < 30) ||
      (filterAge === 'middle' && age >= 30 && age <= 60) ||
      (filterAge === 'elderly' && age > 60);
    return matchSearch && matchResult && matchGender && matchAge;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>

      {/* Auth background */}
      {isAuth && <div className="auth-bg" style={{ position: 'fixed', inset: 0, zIndex: 0 }} />}

      {/* ── Global Toast ── */}
      <AnimatePresence>
        {message && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -60, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
              zIndex: 9999, padding: '14px 20px', borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: '12px',
              background: message.type === 'success' ? 'rgba(6,78,59,0.97)' : 'rgba(127,29,29,0.97)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              border: `1px solid ${message.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(251,113,133,0.3)'}`,
              backdropFilter: 'blur(16px)', minWidth: '280px', maxWidth: '480px'
            }}
          >
            {message.type === 'success'
              ? <CheckCircle size={18} color="#34D399" />
              : <AlertTriangle size={18} color="#FB7185" />}
            <span style={{ color: '#fff', fontWeight: 500, fontSize: '14px', flex: 1 }}>{message.text}</span>
            <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '2px' }}>
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* ═══════════════════════════════════════════════════════════════════
            SPLASH
           ═══════════════════════════════════════════════════════════════════ */}
        {currentRoute === 'splash' && (
          <div className="container-center" style={{ flexDirection: 'column', gap: '40px' }}>
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.7, ease: [0.175, 0.885, 0.32, 1.275] }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}
            >
              {/* Pulsing logo */}
              <div style={{ position: 'relative' }}>
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: -24,
                    borderRadius: '50%', background: 'rgba(129,140,248,0.2)',
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', delay: 0.3 }}
                  style={{
                    position: 'absolute', inset: -12,
                    borderRadius: '50%', background: 'rgba(129,140,248,0.25)',
                  }}
                />
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  style={{
                    width: 100, height: 100, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                  }}
                >
                  <img src="/logo.png" alt="HemoScan" style={{ width: 64, height: 64, objectFit: 'contain' }} />
                </motion.div>
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center' }}>
                <motion.h1
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                  style={{ fontSize: '40px', fontWeight: 900, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1 }}
                >
                  HemoScan<span style={{ color: '#818CF8' }}> AI</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 0.7 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                  style={{ color: '#fff', fontSize: '15px', marginTop: '8px', fontWeight: 400 }}
                >
                  Clinical Brain Hemorrhage Diagnostics
                </motion.p>
              </div>

              {/* Feature pills */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}
              >
                {['AI-Powered', 'HIPAA Ready', 'Real-time Sync'].map((label, i) => (
                  <span key={label} style={{
                    background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '100px', padding: '5px 14px',
                    fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                    animationDelay: `${0.7 + i * 0.1}s`
                  }}>{label}</span>
                ))}
              </motion.div>
            </motion.div>

            {/* Loading pill */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              style={{
                background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '16px', padding: '20px 32px',
                maxWidth: '340px', width: '100%', textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#818CF8', borderRadius: '50%' }} />
                {mlStatus}
              </div>
              <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                  style={{ width: '50%', height: '100%', background: 'linear-gradient(90deg, transparent, #818CF8, #34D399, transparent)', borderRadius: '2px' }}
                />
              </div>
            </motion.div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LOGIN
           ═══════════════════════════════════════════════════════════════════ */}
        {currentRoute === 'login' && (
          <div className="container-center" style={{ position: 'relative', zIndex: 1 }}>
            <motion.div
              variants={scaleIn} initial="hidden" animate="show"
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="auth-card"
              style={{ padding: '44px 40px', width: '100%', maxWidth: '420px' }}
            >
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: '16px', background: 'rgba(255,255,255,0.1)', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <img src="/logo.png" alt="HemoScan" style={{ width: 38, height: 38, objectFit: 'contain' }} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Sign in to HemoScan</h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '6px' }}>
                  AI-Powered Neuroimaging Platform
                </p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input
                    type="email" placeholder="Doctor email address"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    className="auth-input" style={{ paddingLeft: '42px' }} required
                    id="login-email"
                  />
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input
                    type={showLoginPwd ? 'text' : 'password'} placeholder="Password"
                    value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                    className="auth-input" style={{ paddingLeft: '42px', paddingRight: '42px' }} required
                    id="login-password"
                  />
                  <button type="button" onClick={() => setShowLoginPwd(!showLoginPwd)}
                    style={{ position: 'absolute', right: '14px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 0 }}>
                    {showLoginPwd ? <Eye size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <button type="button" onClick={() => setCurrentRoute('forgot-password')}
                    style={{ background: 'none', border: 'none', color: '#818CF8', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                    Forgot password?
                  </button>
                </div>

                <button type="submit" disabled={loading} className="btn-auth" id="login-submit" style={{ marginTop: '4px' }}>
                  {loading ? (
                    <>
                      <div className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                      Signing in...
                    </>
                  ) : (
                    <><Shield size={16} /> Sign In</>
                  )}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
                New to HemoScan?{' '}
                <button onClick={() => setCurrentRoute('signup')}
                  style={{ background: 'none', border: 'none', color: '#818CF8', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                  Create account
                </button>
              </div>

              {/* Feature bullets */}
              <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: Brain, label: 'TFLite local inference — fully private' },
                  { icon: Zap, label: 'Real-time cross-platform sync' },
                  { icon: BadgeCheck, label: 'Validated hemorrhage detection AI' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Icon size={14} color="rgba(129,140,248,0.8)" />
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            SIGNUP
           ═══════════════════════════════════════════════════════════════════ */}
        {currentRoute === 'signup' && (
          <div className="container-center" style={{ position: 'relative', zIndex: 1, paddingTop: '48px', paddingBottom: '48px', alignItems: 'flex-start' }}>
            <motion.div
              variants={scaleIn} initial="hidden" animate="show"
              transition={{ duration: 0.4 }}
              className="auth-card"
              style={{ padding: '40px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
              <div>
                <button onClick={() => setCurrentRoute('login')}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '20px', fontSize: '13px', fontWeight: 500 }}>
                  <ArrowLeft size={14} /> Back to sign in
                </button>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Create your account</h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '5px' }}>Join the HemoScan diagnostic network</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <User size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input type="text" placeholder="Full name (e.g. Dr. John Doe)" value={signupName} onChange={e => setSignupName(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} id="signup-name" />
                </div>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input type="email" placeholder="Email address" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} id="signup-email" />
                </div>
                <div style={{ position: 'relative' }}>
                  <Smartphone size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input type="text" placeholder="Mobile number" value={signupMobile} onChange={e => setSignupMobile(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} id="signup-mobile" />
                </div>

                {/* Gender selector */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['Male', 'Female', 'Other'].map(g => (
                    <button key={g} type="button" onClick={() => setSignupGender(g)}
                      style={{
                        flex: 1, padding: '11px 8px', borderRadius: '8px', border: '1.5px solid',
                        borderColor: signupGender === g ? 'rgba(129,140,248,0.6)' : 'rgba(255,255,255,0.12)',
                        background: signupGender === g ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                        color: signupGender === g ? '#818CF8' : 'rgba(255,255,255,0.45)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}>
                      {g}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input type="password" placeholder="Password (min. 6 chars, 1 uppercase, 1 number, 1 symbol)" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} id="signup-password" />
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                  <input type="password" placeholder="Confirm password" value={signupConfirmPassword} onChange={e => setSignupConfirmPassword(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} id="signup-confirm" />
                </div>

                <button
                  onClick={() => {
                    if (!signupName || !signupEmail || !signupMobile || !signupPassword) {
                      setMessage({ type: 'error', text: 'Please fill in all fields' }); return;
                    }
                    if (signupPassword !== signupConfirmPassword) {
                      setMessage({ type: 'error', text: 'Passwords do not match' }); return;
                    }
                    handleSendOtp(signupEmail, 'signup');
                  }}
                  disabled={loading}
                  className="btn-auth"
                  style={{ marginTop: '8px' }}
                  id="signup-submit"
                >
                  {loading ? 'Sending OTP...' : 'Continue with Email Verification'}
                  <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            FORGOT PASSWORD
           ═══════════════════════════════════════════════════════════════════ */}
        {currentRoute === 'forgot-password' && (
          <div className="container-center" style={{ position: 'relative', zIndex: 1 }}>
            <motion.div
              variants={scaleIn} initial="hidden" animate="show"
              transition={{ duration: 0.4 }}
              className="auth-card"
              style={{ padding: '40px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '24px' }}
            >
              <div>
                <button onClick={() => setCurrentRoute('login')}
                  style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '20px', fontSize: '13px', fontWeight: 500 }}>
                  <ArrowLeft size={14} /> Back to sign in
                </button>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff' }}>Reset your password</h1>
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '6px' }}>We'll send a verification code to your email</p>
              </div>

              {!showOtpModal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                    <input type="email" placeholder="Your registered email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} id="reset-email" />
                  </div>
                  <button onClick={() => { if (!resetEmail) { setMessage({ type: 'error', text: 'Enter your email' }); return; } handleSendOtp(resetEmail, 'forgot_pwd'); }} disabled={loading} className="btn-auth" id="reset-send-otp">
                    {loading ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                    Code sent to <strong style={{ color: '#fff' }}>{resetEmail}</strong>
                  </div>
                  <input type="text" placeholder="6-digit verification code" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="auth-input" style={{ textAlign: 'center', letterSpacing: '6px', fontSize: '20px', fontWeight: 700 }} maxLength={6} id="reset-otp" />
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px', pointerEvents: 'none' }} />
                    <input type="password" placeholder="New password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className="auth-input" style={{ paddingLeft: '42px' }} required id="reset-new-pwd" />
                  </div>
                  <button type="submit" disabled={loading} className="btn-auth" id="reset-submit">
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            OTP MODAL (Signup)
           ═══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {showOtpModal && otpAction === 'signup' && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', padding: '24px' }}
            >
              <motion.div
                variants={scaleIn} initial="hidden" animate="show" exit="hidden"
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  background: 'linear-gradient(145deg, #0F172A 0%, #1E1B4B 100%)',
                  border: '1px solid rgba(129,140,248,0.2)',
                  borderRadius: '20px', padding: '36px', width: '100%', maxWidth: '400px',
                  boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
                  display: 'flex', flexDirection: 'column', gap: '24px'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Mail size={24} color="#818CF8" />
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>Email Verification</h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '6px' }}>
                    Enter the 6-digit code sent to<br />
                    <strong style={{ color: '#818CF8' }}>{signupEmail}</strong>
                  </p>
                </div>
                <input
                  type="text"
                  placeholder="• • • • • •"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  className="auth-input"
                  style={{ textAlign: 'center', letterSpacing: '10px', fontSize: '24px', fontWeight: 800, padding: '16px' }}
                  maxLength={6}
                  id="signup-otp-input"
                />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => setShowOtpModal(false)} className="btn-secondary" style={{ flex: 1, borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>Cancel</button>
                  <button onClick={handleVerifyOtpAndCompleteSignup} disabled={loading} className="btn-auth" style={{ flex: 1 }} id="otp-verify-btn">
                    {loading ? 'Verifying...' : 'Verify & Register'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════════
            PORTAL SHELL (Dashboard, New Scan, History, Settings)
           ═══════════════════════════════════════════════════════════════════ */}
        {isPortal && (
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--surface-base)' }}>

            {/* ── Top Header ── */}
            <header className="portal-header" style={{ height: '60px', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentRoute('dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: '10px' }}
              >
                <img src="/logo.png" alt="HemoScan" style={{ width: 30, height: 30, objectFit: 'contain' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--brand-600)', letterSpacing: '-0.3px' }}>HemoScan</span>
                  <span style={{ fontSize: '11px', background: 'var(--brand-50)', color: 'var(--brand-600)', padding: '2px 8px', borderRadius: '100px', fontWeight: 700, border: '1px solid var(--brand-200)' }}>AI Portal</span>
                </div>
              </motion.button>

              {/* Desktop Nav (center) */}
              <nav className="hide-mobile" style={{ display: 'flex', gap: '4px' }}>
                {([
                  { route: 'dashboard', label: 'Dashboard', icon: Activity },
                  { route: 'new-scan',  label: 'New Scan',  icon: ScanLine },
                  { route: 'history',   label: 'History',   icon: Database },
                  { route: 'settings',  label: 'Settings',  icon: Settings },
                ] as const).map(({ route, label, icon: Icon }) => (
                  <motion.button
                    key={route}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (route === 'settings') { setEditName(doctor?.name || ''); setEditSpecialty(doctor?.specialty || ''); }
                      setCurrentRoute(route);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontSize: '13.5px', fontWeight: 600,
                      background: currentRoute === route ? 'var(--brand-50)' : 'transparent',
                      color: currentRoute === route ? 'var(--brand-600)' : 'var(--text-tertiary)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <Icon size={15} />
                    {label}
                  </motion.button>
                ))}
              </nav>

              {/* Right side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* AI status */}
                <div className="hide-tablet" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '100px' }}>
                  <div className="ai-dot" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-600)' }}>AI Ready</span>
                </div>

                {/* Doctor chip */}
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setEditName(doctor?.name || ''); setEditSpecialty(doctor?.specialty || ''); setCurrentRoute('settings'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 12px 5px 6px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '100px', cursor: 'pointer' }}
                >
                  {doctor?.profile_image ? (
                    <img src={getProfilePhotoUrl(doctor.profile_image)} alt="Profile"
                      style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--brand-200)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={14} color="#fff" />
                    </div>
                  )}
                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{doctor?.name?.split(' ')[0]}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-quaternary)', lineHeight: 1.2 }}>{doctor?.specialty || 'Radiologist'}</span>
                  </div>
                </motion.button>

                <div style={{ position: 'relative' }}>
                  <motion.button
                    whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      fetchNotifications(doctor?.email || '');
                      setShowNotifDropdown(!showNotifDropdown);
                    }}
                    style={{ position: 'relative', width: 36, height: 36, borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                    title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  >
                    <Bell size={15} />
                    {unreadCount > 0 && (
                      <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        minWidth: '16px', height: '16px', borderRadius: '8px',
                        background: 'var(--danger)', color: '#fff',
                        fontSize: '10px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 4px', lineHeight: 1
                      }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </motion.button>

                  {showNotifDropdown && (
                    <div style={{
                      position: 'absolute', top: '44px', right: 0, width: '320px',
                      background: 'var(--surface-0)', border: '1px solid var(--border-subtle)',
                      borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                      zIndex: 1000, padding: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
                        {unreadCount > 0 && doctor?.email && (
                          <button
                            onClick={async () => {
                              await apiService.markNotificationRead(doctor.email, 'all');
                              fetchNotifications(doctor.email);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      {_notifications.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '13px', color: 'var(--text-quaternary)' }}>
                          No notifications yet
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                          {_notifications.map((n) => (
                            <div key={n.id} style={{
                              padding: '10px 12px', borderRadius: '8px',
                              background: n.is_read ? 'var(--surface-1)' : 'var(--brand-50)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px'
                            }}>
                              <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                                <div style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.3 }}>{n.body}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-quaternary)', marginTop: '4px' }}>{n.created_at}</div>
                              </div>
                              {n.is_read === 0 && doctor?.email && (
                                <button
                                  onClick={async () => {
                                    await apiService.markNotificationRead(doctor.email, n.id);
                                    fetchNotifications(doctor.email);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: '11px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={handleLogout}
                  style={{ width: 36, height: 36, borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--surface-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}
                  title="Sign out"
                >
                  <LogOut size={15} />
                </motion.button>
              </div>
            </header>

            {/* ── Main Content ── */}
            <main className="portal-main" style={{ flex: 1, padding: '32px 28px', overflowY: 'auto', background: 'var(--surface-base)' }}>
              <AnimatePresence mode="wait">

                {/* ══════════════════════════════════════════════════════════
                    DASHBOARD
                   ══════════════════════════════════════════════════════════ */}
                {currentRoute === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}
                  >
                    {/* Welcome Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', color: 'var(--text-quaternary)', fontWeight: 500 }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </span>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--border-default)', display: 'inline-block' }} />
                          <span style={{ fontSize: '13px', color: 'var(--accent-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <div className="ai-dot" style={{ width: 6, height: 6 }} />
                            All systems operational
                          </span>
                        </div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, Dr.{' '}
                          <span className="text-gradient">{doctor?.name?.split(' ').slice(-1)[0] || 'Doctor'}</span>
                        </h1>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', marginTop: '4px' }}>
                          Here's your clinical hemorrhage detection overview
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <motion.button
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => fetchDashboardData(doctor?.email || '', true)}
                          className="btn-secondary"
                          style={{ padding: '10px 16px', fontSize: '13px' }}
                        >
                          <RefreshCw size={14} /> Refresh
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setPatientId(''); setPatientName(''); setPatientAge('');
                            setSelectedFile(null); setImagePreview(null); setAiResult(null);
                            setCurrentRoute('new-scan');
                          }}
                          className="btn-primary"
                          id="new-scan-btn"
                        >
                          <Plus size={16} /> New Scan Analysis
                        </motion.button>
                      </div>
                    </div>

                    {/* ── Stat Cards ── */}
                    <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
                      {[
                        { label: 'Total Analyses', value: stats.total, icon: Database, colorClass: 'stat-card-blue', filter: 'total', gradient: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(67,56,202,0.04) 100%)', accent: 'var(--brand-600)', trend: '+12%' },
                        { label: 'Normal Results', value: stats.normal, icon: CheckCircle, colorClass: 'stat-card-green', filter: 'normal', gradient: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.04) 100%)', accent: 'var(--accent-600)', trend: 'Safe' },
                        { label: 'Hemorrhages Detected', value: stats.abnormal, icon: AlertTriangle, colorClass: 'stat-card-red', filter: 'abnormal', gradient: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.04) 100%)', accent: 'var(--danger)', trend: 'Critical' },
                      ].map(({ label, value, icon: Icon, colorClass, filter, gradient, accent, trend }, i) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          className={`stat-card ${colorClass}`}
                          onClick={() => { setFilterType(filter as 'total' | 'normal' | 'abnormal'); setCurrentRoute('history'); }}
                          style={{ background: gradient, cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{label}</div>
                            <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon size={18} color={accent} />
                            </div>
                          </div>
                          <div style={{ fontSize: '40px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
                            <AnimatedNumber value={value} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>All time records</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: accent, background: `${accent}12`, padding: '2px 8px', borderRadius: '100px' }}>{trend}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* ── Bottom Grid ── */}
                    <div className="dashboard-split" style={{ display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: '20px', alignItems: 'start' }}>

                      {/* Recent Scans */}
                      <div className="card" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '22px 24px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                          <div>
                            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Recent Case Scans</h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '2px' }}>Latest 5 diagnostic results</p>
                          </div>
                          <button
                            onClick={() => { setFilterType('total'); setCurrentRoute('history'); }}
                            style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: '13px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            View all <ChevronRight size={14} />
                          </button>
                        </div>

                        {recentScans.length === 0 ? (
                          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-quaternary)' }}>
                            <Database size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
                            <div style={{ fontSize: '14px', fontWeight: 500 }}>No scans yet</div>
                            <div style={{ fontSize: '12px', marginTop: '4px' }}>Run your first diagnostic scan to get started</div>
                          </div>
                        ) : (
                          <div>
                            {recentScans.map((scan, i) => {
                              const isAbnormal = scan.result?.toLowerCase().includes('abnormal');
                              return (
                                <motion.div
                                  key={scan.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.05 }}
                                  onClick={() => setSelectedScan(scan)}
                                  style={{
                                    padding: '14px 24px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    borderBottom: i < recentScans.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                    cursor: 'pointer', transition: 'background 0.15s'
                                  }}
                                  whileHover={{ backgroundColor: 'var(--surface-1)' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                                    <div style={{
                                      width: 44, height: 44, borderRadius: '10px',
                                      overflow: 'hidden', flexShrink: 0,
                                      background: 'var(--surface-2)',
                                      border: `1px solid ${isAbnormal ? 'rgba(239,68,68,0.2)' : 'var(--border-subtle)'}`,
                                    }}>
                                      {scan.image_path ? (
                                        <img src={getProfilePhotoUrl(scan.image_path)} alt="Scan" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Brain size={18} color="var(--text-quaternary)" />
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.patient_name}</div>
                                      <div style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '2px' }}>
                                        ID: {scan.patient_id} &nbsp;·&nbsp; Age {scan.patient_age} &nbsp;·&nbsp; {scan.patient_gender}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                    <span className={isAbnormal ? 'badge badge-abnormal' : 'badge badge-normal'}>
                                      {isAbnormal ? '⚠ Abnormal' : '✓ Normal'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>{scan.date_added}</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleDownloadResultPDF(scan); }}
                                      title="Download PDF Diagnostic Report"
                                      style={{
                                        background: 'var(--surface-1)', border: '1px solid var(--border-subtle)',
                                        borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', gap: '5px', color: 'var(--brand-600)', fontSize: '12px', fontWeight: 600
                                      }}
                                    >
                                      <Download size={13} /> PDF
                                    </button>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* AI Info sidebar */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Quick action card */}
                        <motion.div
                          whileHover={{ y: -2 }}
                          className="card"
                          style={{ padding: '22px', background: 'linear-gradient(145deg, var(--brand-600) 0%, var(--brand-800) 100%)', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            setPatientId(''); setPatientName(''); setPatientAge('');
                            setSelectedFile(null); setImagePreview(null); setAiResult(null);
                            setCurrentRoute('new-scan');
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <ScanLine size={22} color="#fff" className="animate-heartbeat" />
                            </div>
                            <div>
                              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>New Scan Analysis</div>
                              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>Run AI inference in seconds</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 500 }}>
                            <Zap size={13} /> Click to upload a CT scan
                          </div>
                        </motion.div>

                        {/* AI Model Status */}
                        <div className="card" style={{ padding: '20px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Brain size={15} color="var(--brand-500)" />
                            AI Engine Status
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {[
                              { name: 'Gatekeeper Classifier', status: 'Active' },
                              { name: 'YOLO Hemorrhage Detector', status: 'Active' },
                              { name: 'Subtype Classifier (6-class)', status: 'Active' },
                            ].map(({ name, status }) => (
                              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface-1)', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{name}</span>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-600)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <div className="ai-dot" style={{ width: 6, height: 6 }} /> {status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Score summary */}
                        {stats.total > 0 && (
                          <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <TrendingUp size={15} color="var(--brand-500)" />
                              Detection Rate
                            </div>
                            <div style={{ marginBottom: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>Normal</span>
                                <span style={{ fontWeight: 700, color: 'var(--accent-600)' }}>{Math.round((stats.normal / stats.total) * 100)}%</span>
                              </div>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${(stats.normal / stats.total) * 100}%`, background: 'var(--gradient-success)' }} />
                              </div>
                            </div>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>Hemorrhage detected</span>
                                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{Math.round((stats.abnormal / stats.total) * 100)}%</span>
                              </div>
                              <div className="progress-track">
                                <div className="progress-fill" style={{ width: `${(stats.abnormal / stats.total) * 100}%`, background: 'var(--gradient-danger)' }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    NEW SCAN
                   ══════════════════════════════════════════════════════════ */}
                {currentRoute === 'new-scan' && (
                  <motion.div
                    key="new-scan"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}
                  >
                    {/* Header */}
                    <div>
                      <button onClick={() => setCurrentRoute('dashboard')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-quaternary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 500 }}>
                        <ArrowLeft size={14} /> Back to dashboard
                      </button>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>New Diagnostic Scan</h1>
                          <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', marginTop: '4px' }}>Upload a CT scan and run local AI inference for hemorrhage detection</p>
                        </div>
                        {/* Stage indicators */}
                        {isScanning && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[1, 2, 3, 4].map(s => (
                              <div key={s} style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: s <= scanStage ? 'var(--brand-500)' : 'var(--border-default)',
                                transition: 'background 0.3s'
                              }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="scan-layout" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '20px', alignItems: 'start' }}>

                      {/* Left: Patient form */}
                      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
                          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <User size={15} color="var(--brand-500)" /> Patient Details
                          </h2>
                          <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '3px' }}>Enter patient information before scanning</p>
                        </div>

                        {[
                          { label: 'Patient ID', placeholder: 'e.g. PAT-9018', value: patientId, onChange: (v: string) => setPatientId(v), type: 'text', id: 'patient-id' },
                          { label: 'Full Name', placeholder: 'e.g. Emily Watson', value: patientName, onChange: (v: string) => setPatientName(v), type: 'text', id: 'patient-name' },
                        ].map(({ label, placeholder, value, onChange, type, id }) => (
                          <div key={id} className="form-group">
                            <label className="form-label">{label}</label>
                            <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="glass-input" id={id} />
                          </div>
                        ))}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label className="form-label">Age (years)</label>
                            <input type="number" placeholder="e.g. 45" value={patientAge} onChange={e => setPatientAge(e.target.value)} className="glass-input" id="patient-age" />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Gender</label>
                            <select value={patientGender} onChange={e => setPatientGender(e.target.value)} className="glass-input" style={{ height: '44px', cursor: 'pointer' }} id="patient-gender">
                              <option>Male</option><option>Female</option><option>Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Upload Zone */}
                        <div className="form-group">
                          <label className="form-label">CT Scan Image</label>
                          <div
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => {
                              e.preventDefault(); setDragOver(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                setSelectedFile(file);
                                const reader = new FileReader();
                                reader.onloadend = () => setImagePreview(reader.result as string);
                                reader.readAsDataURL(file);
                                setAiResult(null);
                              }
                            }}
                            style={{
                              border: `2px dashed ${dragOver ? 'var(--brand-500)' : imagePreview ? 'var(--accent-500)' : 'var(--border-default)'}`,
                              borderRadius: '12px', padding: '24px', textAlign: 'center',
                              background: dragOver ? 'var(--brand-50)' : imagePreview ? 'rgba(16,185,129,0.04)' : 'var(--surface-1)',
                              transition: 'all 0.2s', cursor: 'pointer'
                            }}
                          >
                            <input type="file" accept="image/*" onChange={handleFileChange} id="ct-image-file" style={{ display: 'none' }} />
                            <label htmlFor="ct-image-file" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: 44, height: 44, borderRadius: '12px', background: imagePreview ? 'rgba(16,185,129,0.1)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-subtle)' }}>
                                <Upload size={20} color={imagePreview ? 'var(--accent-500)' : 'var(--text-quaternary)'} />
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: imagePreview ? 'var(--accent-600)' : 'var(--text-secondary)' }}>
                                  {selectedFile ? selectedFile.name : 'Drop CT scan image here'}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-quaternary)', marginTop: '3px' }}>
                                  {selectedFile ? 'Click to change file' : 'or click to browse — JPEG, PNG up to 10MB'}
                                </div>
                              </div>
                            </label>
                          </div>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                          onClick={triggerDetection}
                          disabled={isScanning || !selectedFile}
                          className="btn-primary"
                          style={{ width: '100%', padding: '13px', marginTop: '4px' }}
                          id="run-diagnostics-btn"
                        >
                          {isScanning ? (
                            <>
                              <div className="animate-spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                              {scanProgress || 'Running analysis...'}
                            </>
                          ) : (
                            <><Zap size={16} /> Run AI Diagnostics</>
                          )}
                        </motion.button>
                      </div>

                      {/* Right: AI Monitor */}
                      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '500px' }}>
                        <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Microscope size={15} color="var(--brand-500)" /> AI Scan Monitor
                            </h2>
                            <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '3px' }}>Real-time inference output</p>
                          </div>
                          {aiResult && !aiResult.validationFailed && (
                            <span className={aiResult.hasHemorrhage ? 'badge badge-abnormal' : 'badge badge-normal'} style={{ fontSize: '12px' }}>
                              {aiResult.hasHemorrhage ? '⚠ Hemorrhage Detected' : '✓ No Hemorrhage'}
                            </span>
                          )}
                        </div>

                        {/* Image Frame */}
                        <div style={{
                          flex: 1, minHeight: '300px', background: '#0A0A14',
                          borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          position: 'relative', overflow: 'hidden'
                        }}>
                          {/* Grid overlay */}
                          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)', backgroundSize: '30px 30px', pointerEvents: 'none' }} />

                          {/* Corner brackets */}
                          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => {
                            const [v, h] = corner.split('-');
                            return (
                              <div key={corner} style={{
                                position: 'absolute', width: 20, height: 20,
                                [v]: 12, [h]: 12,
                                borderTop: v === 'top' ? '2px solid rgba(99,102,241,0.5)' : 'none',
                                borderBottom: v === 'bottom' ? '2px solid rgba(99,102,241,0.5)' : 'none',
                                borderLeft: h === 'left' ? '2px solid rgba(99,102,241,0.5)' : 'none',
                                borderRight: h === 'right' ? '2px solid rgba(99,102,241,0.5)' : 'none',
                                pointerEvents: 'none'
                              }} />
                            );
                          })}

                          {isScanning && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: 'rgba(10,10,20,0.7)' }}>
                              <div className="scanner-line" />
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <Brain size={28} color="#818CF8" className="animate-heartbeat" />
                                <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: '240px' }}>
                                  {scanProgress}
                                </span>
                              </div>
                            </div>
                          )}

                          {aiResult ? (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                              <img src={aiResult.processedImageUrl || imagePreview || ''} alt="Processed" style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain', borderRadius: '8px' }} />
                            </div>
                          ) : imagePreview ? (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                              <img src={imagePreview} alt="Original" style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain', borderRadius: '8px' }} />
                            </div>
                          ) : (
                            <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                              <Brain size={44} />
                              <div style={{ fontSize: '13px', maxWidth: '200px', lineHeight: 1.6 }}>
                                Upload a CT scan to initialize the AI diagnostic monitor
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Results breakdown */}
                        <AnimatePresence>
                          {aiResult && !aiResult.validationFailed && (
                            <motion.div
                              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 8 }}
                              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                            >
                              {/* Status banner */}
                              <div style={{
                                padding: '14px 18px', borderRadius: '10px',
                                background: aiResult.hasHemorrhage ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)',
                                border: `1px solid ${aiResult.hasHemorrhage ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {aiResult.hasHemorrhage
                                    ? <AlertTriangle size={18} color="var(--danger)" />
                                    : <CheckCircle size={18} color="var(--success)" />}
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: aiResult.hasHemorrhage ? 'var(--danger)' : 'var(--success)' }}>
                                      {aiResult.hasHemorrhage ? 'Hemorrhage Detected' : 'No Hemorrhage Found'}
                                    </div>
                                    {aiResult.hasHemorrhage && (
                                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                        Primary: {aiResult.topSubtype}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>Confidence</div>
                                  <div style={{ fontSize: '18px', fontWeight: 800, color: aiResult.hasHemorrhage ? 'var(--danger)' : 'var(--success)' }}>
                                    {(aiResult.highestConfidence * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>

                              {/* Subtype bars */}
                              {aiResult.hasHemorrhage && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                    Subtype Probability Breakdown
                                  </div>
                                  {[
                                    { name: 'Intraventricular', val: aiResult.intraventricular },
                                    { name: 'Intraparenchymal', val: aiResult.intraparenchymal },
                                    { name: 'Subarachnoid', val: aiResult.subarachnoid },
                                    { name: 'Epidural', val: aiResult.epidural },
                                    { name: 'Subdural', val: aiResult.subdural },
                                  ].sort((a, b) => b.val - a.val).map(({ name, val }) => (
                                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{name}</span>
                                        <span style={{ fontWeight: 700, color: val >= 0.5 ? 'var(--danger)' : 'var(--text-secondary)' }}>{(val * 100).toFixed(1)}%</span>
                                      </div>
                                      <div className="progress-track">
                                        <motion.div
                                          className="progress-fill"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${val * 100}%` }}
                                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                                          style={{ background: val >= 0.5 ? 'var(--gradient-danger)' : 'var(--gradient-brand)' }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    HISTORY
                   ══════════════════════════════════════════════════════════ */}
                {currentRoute === 'history' && (
                  <motion.div
                    key="history"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '22px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Scan Archive</h1>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', marginTop: '4px' }}>
                          {filteredScans.length} of {scans.length} records
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className={`badge ${filterType === 'total' ? 'badge-brand' : filterType === 'normal' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '12px', padding: '5px 12px' }}>
                          {filterType === 'total' ? 'All Records' : filterType === 'normal' ? 'Normal Only' : 'Abnormal Only'}
                        </span>
                      </div>
                    </div>

                    {/* Filter bar */}
                    <div className="card" style={{ padding: '16px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '320px' }}>
                        <Search size={15} color="var(--text-quaternary)" style={{ position: 'absolute', left: '13px', top: '13px', pointerEvents: 'none' }} />
                        <input
                          type="text" placeholder="Search patient name or ID..."
                          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                          className="glass-input" style={{ paddingLeft: '40px' }}
                          id="history-search"
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Result type tabs */}
                        <div style={{ display: 'flex', padding: '3px', background: 'var(--surface-1)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                          {(['total', 'normal', 'abnormal'] as const).map(type => (
                            <button key={type} onClick={() => setFilterType(type)}
                              style={{
                                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                fontSize: '12.5px', fontWeight: 600, textTransform: 'capitalize',
                                background: filterType === type ? 'var(--surface-0)' : 'transparent',
                                color: filterType === type ? 'var(--brand-600)' : 'var(--text-quaternary)',
                                boxShadow: filterType === type ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.15s'
                              }}>
                              {type === 'total' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                          ))}
                        </div>

                        <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="glass-input" style={{ width: '130px' }}>
                          <option value="All">All Genders</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>

                        <select value={filterAge} onChange={e => setFilterAge(e.target.value)} className="glass-input" style={{ width: '120px' }}>
                          <option value="All">All Ages</option>
                          <option value="young">Under 30</option>
                          <option value="middle">30 – 60</option>
                          <option value="elderly">Above 60</option>
                        </select>
                      </div>
                    </div>

                    {/* Data table */}
                    <div className="card" style={{ overflow: 'hidden' }}>
                      {filteredScans.length === 0 ? (
                        <div style={{ padding: '80px 24px', textAlign: 'center', color: 'var(--text-quaternary)' }}>
                          <Search size={40} style={{ opacity: 0.3, marginBottom: '14px' }} />
                          <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-tertiary)' }}>No records found</div>
                          <div style={{ fontSize: '13px', marginTop: '6px' }}>Try adjusting your search or filter criteria</div>
                        </div>
                      ) : (
                        <table className="data-table">
                          <thead>
                            <tr>
                              {['Patient ID', 'Name', 'Gender', 'Age', 'Diagnosis', 'Risk Level', 'Date', ''].map((h, hi) => (
                                <th key={hi}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredScans.map((scan, i) => {
                              const isAbnormal = scan.result?.toLowerCase().includes('abnormal');
                              return (
                                <motion.tr
                                  key={scan.id}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                                  onClick={() => setSelectedScan(scan)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '3px 8px', borderRadius: '6px' }}>
                                      {scan.patient_id}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{scan.patient_name}</td>
                                  <td>{scan.patient_gender}</td>
                                  <td>{scan.patient_age} yrs</td>
                                  <td><span className={isAbnormal ? 'badge badge-abnormal' : 'badge badge-normal'}>{isAbnormal ? '⚠ Abnormal' : '✓ Normal'}</span></td>
                                  <td>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: isAbnormal ? 'var(--danger)' : 'var(--success)' }}>
                                      {scan.risk_level || (isAbnormal ? 'High Risk' : 'Low Risk')}
                                    </span>
                                  </td>
                                  <td style={{ color: 'var(--text-quaternary)', fontSize: '12.5px' }}>{scan.date_added}</td>
                                  <td onClick={e => e.stopPropagation()}>
                                    <button
                                      id={`delete-scan-${scan.id}`}
                                      onClick={() => handleDeleteScan(scan.id)}
                                      title="Delete scan"
                                      style={{
                                        background: 'none', border: '1px solid var(--border-subtle)',
                                        borderRadius: '7px', padding: '5px 8px', cursor: 'pointer',
                                        color: 'var(--danger)', display: 'flex', alignItems: 'center',
                                        opacity: 0.7, transition: 'opacity 0.15s, background 0.15s'
                                      }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    SETTINGS
                   ══════════════════════════════════════════════════════════ */}
                {currentRoute === 'settings' && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '660px', margin: '0 auto', width: '100%' }}
                  >
                    <div>
                      <button onClick={() => setCurrentRoute('dashboard')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-quaternary)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 500 }}>
                        <ArrowLeft size={14} /> Back to dashboard
                      </button>
                      <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Settings</h1>
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', marginTop: '4px' }}>Manage your account and preferences</p>
                    </div>

                    {/* Profile card */}
                    <div className="card" style={{ padding: '24px', background: 'linear-gradient(145deg, var(--surface-0) 0%, var(--brand-50) 100%)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
                        <div style={{ position: 'relative' }}>
                          <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--brand-200)', background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {doctor?.profile_image ? (
                              <img src={getProfilePhotoUrl(doctor.profile_image)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={32} color="var(--brand-400)" />
                            )}
                          </div>
                          <div className="ai-dot" style={{ position: 'absolute', bottom: 3, right: 3, width: 12, height: 12, border: '2px solid white' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>{doctor?.name}</h2>
                          <p style={{ fontSize: '13px', color: 'var(--brand-600)', fontWeight: 600, marginTop: '2px' }}>{doctor?.specialty || 'Radiologist'}</p>
                          <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '3px' }}>{doctor?.email}</p>
                          {doctor?.hospital && <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}><Building2 size={12} /> {doctor.hospital}</p>}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          className="btn-secondary" style={{ fontSize: '13px', padding: '9px 16px' }}
                          onClick={() => {
                            setEditName(doctor?.name || '');
                            setEditSpecialty(doctor?.specialty || '');
                            setEditBio(doctor?.bio || '');
                            setEditHospital(doctor?.hospital || '');
                            setEditLicense(doctor?.license || '');
                            setEditYearsExp(doctor?.years_exp ? String(doctor.years_exp) : '');
                            setEditPhoto(null);
                            setEditPhotoPreview(doctor?.profile_image ? getProfilePhotoUrl(doctor.profile_image) : null);
                            setShowEditProfileModal(true);
                          }}
                          id="edit-profile-btn"
                        >
                          <User size={13} /> Edit Profile
                        </motion.button>
                      </div>

                      {/* Stats row */}
                      {stats.total > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
                          {[
                            { label: 'Total Scans', value: stats.total, color: 'var(--brand-600)' },
                            { label: 'Normal', value: stats.normal, color: 'var(--accent-600)' },
                            { label: 'Abnormal', value: stats.abnormal, color: 'var(--danger)' },
                          ].map(({ label, value, color }) => (
                            <div key={label} style={{ textAlign: 'center', padding: '12px', background: 'var(--surface-0)', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '22px', fontWeight: 800, color }}>{value}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-quaternary)', marginTop: '2px', fontWeight: 600 }}>{label}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>


                    {/* App Preferences */}
                    <div>
                      <p className="section-label" style={{ marginBottom: '10px' }}>App Preferences</p>
                      <div className="card" style={{ overflow: 'hidden' }}>
                        {/* Dark Mode */}
                        <div className="settings-row" style={{ cursor: 'default' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {doctor?.dark_mode === 1 ? <Moon size={17} color="var(--brand-500)" /> : <Sun size={17} color="var(--amber-500)" />}
                            <div className="settings-row-label">
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Dark Mode</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>{doctor?.dark_mode === 1 ? 'Dark theme enabled' : 'Light theme active'}</span>
                            </div>
                          </div>
                          <Toggle checked={doctor?.dark_mode === 1} onChange={(v) => updatePref('dark_mode', v ? 1 : 0)} />
                        </div>

                        {/* Notifications */}
                        {/* Notifications */}
                        <div>
                          <div className="settings-row" onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Bell size={17} color="var(--brand-500)" />
                              <div className="settings-row-label">
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>Alerts and summaries</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`badge ${doctor?.daily_summary === 1 ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '11px' }}>
                                {doctor?.daily_summary === 1 ? 'Enabled' : 'Disabled'}
                              </span>
                              <ChevronRight size={15} color="var(--text-quaternary)" style={{ transform: showNotificationsPanel ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                            </div>
                          </div>
                          <AnimatePresence>
                            {showNotificationsPanel && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: 'hidden', background: 'var(--surface-1)', borderTop: '1px solid var(--border-subtle)' }}
                              >
                                {[
                                  { key: 'daily_summary', label: 'Daily Summary Report', desc: 'Receive daily diagnostic summaries' },
                                  { key: 'sound', label: 'Sound Effects', desc: 'Audio feedback for actions' },
                                  { key: 'vibration', label: 'Haptic Feedback', desc: 'Vibration on interactions' },
                                ].map(({ key, label, desc }) => (
                                  <div key={key} style={{ padding: '13px 20px 13px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                                    <div>
                                      <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                                      <div style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>{desc}</div>
                                    </div>
                                    <Toggle checked={(doctor as any)?.[key] === 1} onChange={(v) => updatePref(key, v ? 1 : 0)} />
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Language */}
                        <div className="settings-row" style={{ cursor: 'default' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Globe size={17} color="var(--brand-500)" />
                            <div className="settings-row-label">
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Language</span>
                              <span style={{ fontSize: '12px', color: 'var(--text-quaternary)' }}>Interface display language</span>
                            </div>
                          </div>
                          <select
                            value={doctor?.language || 'English'}
                            onChange={async (e) => updatePref('language', e.target.value)}
                            className="glass-input"
                            style={{ width: '160px', height: '36px', padding: '0 10px', fontSize: '13px' }}
                          >
                            {['English', 'Hindi (हिन्दी)', 'Bengali (বাংলা)', 'Tamil (தமிழ்)', 'Telugu (తెలుగు)', 'Marathi (मराठी)', 'Kannada (ಕನ್ನಡ)', 'Gujarati (ગુજરાતી)'].map(lang => (
                              <option key={lang} value={lang}>{lang}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Account Security */}

                    {!settingsSubPage && (
                    <div>
                      <p className="section-label" style={{ marginBottom: '10px' }}>Account Security</p>
                      <div className="card" style={{ overflow: 'hidden' }}>
                        <div className="settings-row" id="change-password-row" onClick={() => { setCpCurrent(''); setCpNew(''); setCpConfirm(''); setSettingsSubPage('change-password'); }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Lock size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Change Password</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="sign-out-row" onClick={handleLogout}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <LogOut size={17} color="var(--danger)" />
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--danger)' }}>Sign Out</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* More Information */}
                    {!settingsSubPage && (
                    <div>
                      <p className="section-label" style={{ marginBottom: '10px' }}>Information</p>
                      <div className="card" style={{ overflow: 'hidden' }}>
                        <div className="settings-row" id="share-app-row" onClick={handleShareApp}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Wifi size={17} color="var(--brand-500)" />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Share App</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>Share HemoScan with colleagues</span>
                            </div>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="rate-app-row" onClick={handleRateApp}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Star size={17} color="var(--amber-500, #F59E0B)" />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Rate App</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>Rate us on Google Play</span>
                            </div>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="privacy-row" onClick={() => setSettingsSubPage('privacy')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Shield size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Privacy Policy</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="terms-row" onClick={() => setSettingsSubPage('terms')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FileText size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Terms &amp; Conditions</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="faq-row" onClick={() => { setFaqOpenIndex(null); setSettingsSubPage('faq'); }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Info size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>FAQs</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="contact-row" onClick={() => { setContactSuccess(false); setContactMessage(''); setSettingsSubPage('contact'); }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <HeartPulse size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Contact Support</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="about-us-row" onClick={() => setSettingsSubPage('about-us')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <HeartPulse size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>About Us</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                        <div className="settings-row" id="app-info-row" onClick={() => setSettingsSubPage('app-info')}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Info size={17} color="var(--brand-500)" />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>App Information</span>
                          </div>
                          <ChevronRight size={15} color="var(--text-quaternary)" />
                        </div>
                      </div>
                    </div>
                    )}

                    {/* ── Settings Sub-Pages ───────────────────────────────── */}
                    <AnimatePresence mode="wait">

                    {/* Privacy Policy */}
                    {settingsSubPage === 'privacy' && (
                      <motion.div key="privacy" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                        <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Back to Settings
                        </button>
                        <div className="card" style={{ padding: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <Shield size={22} color="var(--brand-500)" />
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Privacy Policy</h2>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginBottom: '20px' }}>Last updated: June 2025</p>
                          {[{
                            title: '1. Information We Collect',
                            body: 'We collect information you provide directly, including name, email address, medical credentials, and patient scan data you upload. We also collect usage data to improve performance.'
                          },{
                            title: '2. How We Use Your Information',
                            body: 'Your data is used to provide AI-powered diagnostic analysis, maintain your account, sync data across devices, and improve our models. We do not sell personal data to third parties.'
                          },{
                            title: '3. Data Security',
                            body: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Patient scan images are stored securely on our servers. Access is restricted to authenticated users only.'
                          },{
                            title: '4. Data Retention',
                            body: 'Account data is retained while your account is active. You may request deletion at any time via the Danger Zone in Settings. Deleted data is permanently removed within 30 days.'
                          },{
                            title: '5. HIPAA Compliance',
                            body: 'HemoScan is designed with medical data compliance in mind. We follow standards for Protected Health Information (PHI) handling and are committed to maintaining patient confidentiality.'
                          },{
                            title: '6. Cookies & Analytics',
                            body: 'We use minimal cookies required for authentication. We do not use third-party advertising trackers. Anonymous analytics help us improve the platform.'
                          },{
                            title: '7. Contact',
                            body: 'For privacy-related concerns, contact us at privacy@hemoscan.ai. We respond to all inquiries within 72 hours.'
                          }].map(({ title, body }) => (
                            <div key={title} style={{ marginBottom: '18px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</div>
                              <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>{body}</div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Terms & Conditions */}
                    {settingsSubPage === 'terms' && (
                      <motion.div key="terms" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                        <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Back to Settings
                        </button>
                        <div className="card" style={{ padding: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <FileText size={22} color="var(--brand-500)" />
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Terms &amp; Conditions</h2>
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginBottom: '20px' }}>Effective: June 2025 · Version 1.0</p>
                          {[{
                            title: '1. Acceptance of Terms',
                            body: 'By creating an account and using HemoScan, you agree to these Terms. If you do not agree, do not use the service.'
                          },{
                            title: '2. Medical Disclaimer',
                            body: 'HemoScan AI is a clinical decision-support tool. It is NOT a replacement for professional medical diagnosis. All AI results must be reviewed by a qualified radiologist or physician before clinical action.'
                          },{
                            title: '3. User Accounts',
                            body: 'You are responsible for maintaining the security of your credentials. Do not share your account. You must be a licensed medical professional or authorized user to access diagnostic features.'
                          },{
                            title: '4. Permitted Use',
                            body: 'HemoScan may only be used for clinical and educational purposes. Unauthorized reproduction, resale, or reverse-engineering of AI models is strictly prohibited.'
                          },{
                            title: '5. Data Ownership',
                            body: 'Patient data you upload remains your property. You grant HemoScan a limited license to process the data for analysis purposes. We do not share identified patient data with third parties.'
                          },{
                            title: '6. Service Availability',
                            body: 'We aim for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be announced in advance. We are not liable for losses due to service outages.'
                          },{
                            title: '7. Termination',
                            body: 'We reserve the right to suspend accounts that violate these terms. You may terminate your account at any time from the Settings page.'
                          },{
                            title: '8. Governing Law',
                            body: 'These terms are governed by applicable Indian law. Any disputes shall be subject to jurisdiction of courts in the relevant jurisdiction.'
                          }].map(({ title, body }) => (
                            <div key={title} style={{ marginBottom: '18px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>{title}</div>
                              <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>{body}</div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* FAQs */}
                    {settingsSubPage === 'faq' && (() => {
                      const faqs = [
                        { q: 'How accurate is the AI analysis?', a: 'Our 3-stage TFLite pipeline achieves high accuracy in detecting intracranial hemorrhage. The system uses a gatekeeper classifier, a YOLO detector, and a subtype classifier. All results should be reviewed by a qualified radiologist before clinical action.' },
                        { q: 'What image formats are supported?', a: 'HemoScan accepts JPEG, PNG, and WebP brain CT scan images. DICOM files should be exported to one of these formats first. The system validates that the uploaded image is a genuine brain CT before processing.' },
                        { q: 'Why was my image rejected?', a: 'The AI gatekeeper classifier checks that the uploaded image is a real brain CT scan. Non-CT images (selfies, X-rays, MRIs, photos) will be rejected with an "Invalid Image" message. Please upload a standard axial brain CT image.' },
                        { q: 'How do I share a diagnostic report?', a: 'After analysis is complete, use the Share Report button on the Result screen. On the web, you can export results. On Android, the native share sheet lets you send results via email, WhatsApp, or other apps.' },
                        { q: 'Is my patient data secure?', a: 'Yes. All data is encrypted in transit (TLS) and at rest. We follow medical data security standards. Patient identifiers are stored securely and never shared with third parties without consent.' },
                        { q: 'Does the app work offline?', a: 'The Android app stores recent scan history locally in SQLite. The AI inference requires a server connection on web. On Android, the TFLite models run fully on-device — no internet needed for analysis.' },
                        { q: 'How do I sync data between the app and website?', a: 'Both platforms use the same MySQL backend. Profile changes, scan history, and settings sync automatically. Log in with the same credentials on both platforms to access all your data.' },
                        { q: 'How do I contact support?', a: 'Go to Settings → Contact Support to submit a ticket. You can also email support@hemoscan.ai directly. Our team responds within 24–48 hours on business days.' },
                        { q: 'Can I delete my account?', a: 'Yes. Go to Settings → Danger Zone → Delete Account. This permanently removes your account, profile, and all associated scan history. This action cannot be undone.' },
                        { q: 'What are the hemorrhage subtypes detected?', a: 'HemoScan detects 5 subtypes: Intraventricular, Intraparenchymal, Subarachnoid, Epidural, and Subdural hemorrhage. Each is given a probability score and the highest-confidence subtype is highlighted.' },
                      ];
                      return (
                        <motion.div key="faq" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                          <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                            <ArrowLeft size={14} /> Back to Settings
                          </button>
                          <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Info size={22} color="var(--brand-500)" />
                                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Frequently Asked Questions</h2>
                              </div>
                              <p style={{ fontSize: '13px', color: 'var(--text-quaternary)', marginTop: '6px' }}>Find answers to common questions about HemoScan AI.</p>
                            </div>
                            {faqs.map(({ q, a }, i) => (
                              <div key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                <button
                                  onClick={() => setFaqOpenIndex(faqOpenIndex === i ? null : i)}
                                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}
                                  id={`faq-item-${i}`}
                                >
                                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>{q}</span>
                                  <motion.div animate={{ rotate: faqOpenIndex === i ? 90 : 0 }} transition={{ duration: 0.2 }} style={{ flexShrink: 0 }}>
                                    <ChevronRight size={16} color="var(--brand-500)" />
                                  </motion.div>
                                </button>
                                <AnimatePresence>
                                  {faqOpenIndex === i && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                                      style={{ overflow: 'hidden' }}
                                    >
                                      <div style={{ padding: '0 20px 18px 20px', fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.7, background: 'var(--surface-1)' }}>
                                        {a}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    })()}

                    {/* Contact Support */}
                    {settingsSubPage === 'contact' && (
                      <motion.div key="contact" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                        <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Back to Settings
                        </button>
                        <div className="card" style={{ padding: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <HeartPulse size={22} color="var(--brand-500)" />
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Contact Support</h2>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-quaternary)', marginBottom: '24px' }}>Our team responds within 24–48 hours on business days.</p>
                          {contactSuccess ? (
                            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '32px 20px' }}>
                              <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Ticket Submitted!</div>
                              {contactTicketNumber && (
                                <div style={{ background: 'var(--surface-1)', border: '1.5px solid var(--brand-500)', borderRadius: '12px', padding: '16px', margin: '16px 0', display: 'inline-block', minWidth: '260px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-quaternary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Your Ticket Number</div>
                                  <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--brand-500)', fontFamily: 'monospace' }}>{contactTicketNumber}</div>
                                </div>
                              )}
                              <div style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.6, marginTop: '12px' }}>A confirmation email has been sent to <strong>{doctor?.email}</strong>. Our team will respond within 24–48 business hours.</div>
                              <button onClick={() => { setContactSuccess(false); setContactTicketNumber(''); setSettingsSubPage(null); }} className="btn-primary" style={{ marginTop: '24px', width: '100%' }}>Back to Settings</button>
                            </motion.div>
                          ) : (
                            <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              <div className="form-group">
                                <label className="form-label">Issue Category *</label>
                                <select value={contactCategory} onChange={e => setContactCategory(e.target.value)} className="glass-input" style={{ width: '100%', height: '44px', padding: '0 12px', fontSize: '14px' }} id="contact-category">
                                  {['Technical Issue', 'Account Issue', 'Scan Processing Issue', 'AI Model Concern', 'Privacy / Data Request', 'Feature Request', 'Billing', 'Bug Report', 'Other'].map(c => <option key={c}>{c}</option>)}
                                </select>
                              </div>
                              <div className="form-group">
                                <label className="form-label">Describe your issue * <span style={{ color: 'var(--text-quaternary)', fontWeight: 400 }}>(min. 20 characters)</span></label>
                                <textarea
                                  value={contactMessage}
                                  onChange={e => setContactMessage(e.target.value)}
                                  rows={6}
                                  placeholder="Please describe the issue in detail, including what you were doing when it occurred..."
                                  style={{ background: 'var(--surface-0)', border: '1.5px solid var(--border-subtle)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-sans)', width: '100%', transition: 'border-color 0.2s' }}
                                  id="contact-message"
                                />
                                <div style={{ fontSize: '11px', color: contactMessage.length >= 20 ? 'var(--success)' : 'var(--text-quaternary)', marginTop: '4px', textAlign: 'right' }}>{contactMessage.length} / 20+ characters</div>
                              </div>
                              <div style={{ background: 'var(--surface-1)', borderRadius: '10px', padding: '14px', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your email</div>
                                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>{doctor?.email}</div>
                              </div>
                              <button type="submit" disabled={contactLoading || contactMessage.length < 20} className="btn-primary" style={{ width: '100%' }} id="contact-submit-btn">
                                {contactLoading ? <><div className="animate-spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', marginRight: '8px' }} />Submitting...</> : <><Mail size={15} style={{ marginRight: '6px', display: 'inline' }} />Submit Support Request</>}
                              </button>
                              <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', textAlign: 'center' }}>Your ticket will be submitted instantly. You'll receive a confirmation email with your ticket number at <strong>{doctor?.email}</strong>.</p>
                            </form>
                          )}
                        </div>

                        {/* Submitted Tickets History */}
                        <div className="card" style={{ padding: '24px', marginTop: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>My Support Tickets</div>
                            <button onClick={fetchUserTickets} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                              {loadingTickets ? 'Refreshing...' : '↻ Refresh'}
                            </button>
                          </div>
                          {loadingTickets ? (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-quaternary)', fontSize: '13px' }}>Loading support tickets...</div>
                          ) : userTickets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-quaternary)', fontSize: '13px' }}>No support tickets submitted yet.</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {userTickets.map((t: any) => (
                                <div key={t.ticket_number || t.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-600)', fontFamily: 'var(--font-mono)' }}>#{t.ticket_number}</span>
                                    <span style={{
                                      fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '100px',
                                      background: t.status === 'resolved' || t.status === 'closed' ? 'var(--accent-50)' : 'var(--brand-50)',
                                      color: t.status === 'resolved' || t.status === 'closed' ? 'var(--accent-600)' : 'var(--brand-600)',
                                      border: '1px solid ' + (t.status === 'resolved' || t.status === 'closed' ? 'var(--accent-400)' : 'var(--brand-200)')
                                    }}>
                                      {t.status ? t.status.toUpperCase() : 'OPEN'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginBottom: '6px' }}>Category: <strong style={{ color: 'var(--text-tertiary)' }}>{t.category}</strong> · {t.created_at}</div>
                                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: t.admin_reply ? '10px' : '0' }}>{t.message}</div>
                                  {t.admin_reply && (
                                    <div style={{ background: 'var(--surface-0)', borderLeft: '3px solid var(--brand-500)', padding: '10px 14px', borderRadius: '4px 8px 8px 4px', marginTop: '8px' }}>
                                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--brand-600)', marginBottom: '3px' }}>Support Team Reply:</div>
                                      <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{t.admin_reply}</div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* About Us */}
                    {settingsSubPage === 'about-us' && (
                      <motion.div key="about-us" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                        <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Back to Settings
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* Hero */}
                          <div className="card" style={{ padding: '36px 28px', textAlign: 'center', background: 'linear-gradient(145deg, var(--brand-50) 0%, var(--surface-0) 60%, var(--brand-50) 100%)' }}>
                            <div style={{ width: 88, height: 88, borderRadius: '28px', background: 'linear-gradient(135deg, var(--brand-500) 0%, var(--brand-700) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 10px 32px rgba(99,102,241,0.35)' }}>
                              <Brain size={44} color="#fff" />
                            </div>
                            <h2 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '8px' }}>HemoScan AI</h2>
                            <p style={{ fontSize: '14px', color: 'var(--brand-600)', fontWeight: 600, marginBottom: '12px' }}>Intelligent Brain Hemorrhage Diagnostics</p>
                            <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.7, maxWidth: '460px', margin: '0 auto' }}>We help doctors detect and classify brain hemorrhages in seconds using advanced AI — putting cutting-edge diagnostic technology directly in the hands of clinicians.</p>
                          </div>

                          {/* Our Mission */}
                          <div className="card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                              <Zap size={20} color="var(--brand-500)" />
                              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>Our Mission</span>
                            </div>
                            <p style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', lineHeight: 1.75, margin: 0 }}>Every second counts in neuro-diagnostics. HemoScan exists to bridge the gap between AI technology and clinical practice — giving radiologists and physicians a reliable second opinion at the speed of thought. We believe that faster, more accurate diagnosis saves lives.</p>
                          </div>

                          {/* Key Features */}
                          <div className="card" style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                              <CheckCircle size={20} color="var(--brand-500)" />
                              <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>What HemoScan Does</span>
                            </div>
                            {[
                              { icon: '🧠', title: 'AI-Powered Analysis', desc: 'Analyses brain CT scans in seconds using a multi-stage deep learning pipeline.' },
                              { icon: '🩸', title: 'Hemorrhage Detection', desc: 'Detects 5 types of intracranial hemorrhage: Epidural, Subdural, Subarachnoid, Intraparenchymal, and Intraventricular.' },
                              { icon: '📱', title: 'Works on All Devices', desc: 'Available as a web portal and Android app — sync your data across both platforms seamlessly.' },
                              { icon: '🔒', title: 'Secure & Private', desc: 'Your patient data is encrypted and never shared. We follow medical data security standards.' },
                              { icon: '📋', title: 'Shareable Reports', desc: 'Generate and share detailed diagnostic reports with your medical team instantly.' },
                            ].map(({ icon, title, desc }) => (
                              <div key={title} style={{ display: 'flex', gap: '12px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <span style={{ fontSize: '22px', lineHeight: 1.3 }}>{icon}</span>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>{title}</div>
                                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{desc}</div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Contact / Links */}
                          <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Get in Touch</span>
                            </div>
                            {[
                              { label: 'Support Email', value: 'support@hemoscan.ai', action: () => { window.open('mailto:support@hemoscan.ai', '_blank'); } },
                              { label: 'Submit a Ticket', value: 'Settings → Contact Support', action: () => { setSettingsSubPage('contact'); } },
                            ].map(({ label, value, action }) => (
                              <button key={label} onClick={action} style={{ width: '100%', padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 0 }}>
                                <span style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
                                <span style={{ fontSize: '13px', color: 'var(--brand-600)', fontWeight: 600 }}>{value} →</span>
                              </button>
                            ))}
                          </div>

                          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-quaternary)', paddingBottom: '4px' }}>
                            © {new Date().getFullYear()} HemoScan AI · All rights reserved
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* App Info */}
                    {settingsSubPage === 'app-info' && (
                      <motion.div key="app-info" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                        <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Back to Settings
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {/* App identity card */}
                          <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'linear-gradient(145deg, var(--surface-0) 0%, var(--brand-50) 100%)' }}>
                            <div style={{ width: 80, height: 80, borderRadius: '24px', background: 'linear-gradient(135deg, var(--brand-500) 0%, var(--brand-700) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(99,102,241,0.35)' }}>
                              <Brain size={40} color="#fff" />
                            </div>
                            <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>HemoScan AI</h2>
                            <p style={{ fontSize: '13px', color: 'var(--brand-600)', fontWeight: 600, marginTop: '4px' }}>Brain Hemorrhage Diagnostic Assistant</p>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '14px', background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '100px', padding: '6px 16px' }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Version 1.0.0</span>
                            </div>
                          </div>

                          {/* User-friendly app details */}
                          <div className="card" style={{ overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>App Details</span>
                            </div>
                            {[
                              { label: 'App Name', value: 'HemoScan AI' },
                              { label: 'Version', value: '1.0.0' },
                              { label: 'Platform', value: 'Web Application' },
                              { label: 'AI Capability', value: 'Hemorrhage Detection & Classification' },
                              { label: 'Developer', value: 'HemoScan Development Team' },
                              { label: 'Support', value: 'support@hemoscan.ai' },
                              { label: 'Last Updated', value: 'June 2026' },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ padding: '13px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
                                <span style={{ fontSize: '13.5px', color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
                                <span style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
                              </div>
                            ))}
                          </div>

                          {/* What's New */}
                          <div className="card" style={{ padding: '20px 24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>What's New in v1.0.0</div>
                            {[
                              '✅ AI-powered brain CT scan analysis — results in under 30 seconds',
                              '✅ Detects 5 hemorrhage subtypes with confidence scores',
                              '✅ Sync data between Android app and Web Portal',
                              '✅ Dark mode and customisable settings',
                              '✅ Secure OTP-verified sign-up and password reset',
                              '✅ Shareable diagnostic reports',
                            ].map((note, i) => (
                              <div key={i} style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.7, paddingBottom: '4px' }}>{note}</div>
                            ))}
                          </div>

                          <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-quaternary)', paddingBottom: '4px' }}>
                            © {new Date().getFullYear()} HemoScan AI. All rights reserved.
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Change Password */}
                    {settingsSubPage === 'change-password' && (
                      <motion.div key="change-password" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }}>
                        <button onClick={() => setSettingsSubPage(null)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
                          <ArrowLeft size={14} /> Back to Settings
                        </button>
                        <div className="card" style={{ padding: '28px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <Lock size={22} color="var(--brand-500)" />
                            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)' }}>Change Password</h2>
                          </div>
                          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div className="form-group">
                              <label className="form-label">Current Password *</label>
                              <input type="password" value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} required className="glass-input" placeholder="Enter current password" id="cp-current" />
                            </div>
                            <div className="form-group">
                              <label className="form-label">New Password *</label>
                              <input type="password" value={cpNew} onChange={e => setCpNew(e.target.value)} required className="glass-input" placeholder="Min 6 chars, 1 uppercase, 1 number, 1 special" id="cp-new" />
                              {cpNew.length > 0 && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                  {[{ label: '6+ chars', ok: cpNew.length >= 6 }, { label: 'Uppercase', ok: /[A-Z]/.test(cpNew) }, { label: 'Number', ok: /[0-9]/.test(cpNew) }, { label: 'Special char', ok: /[!@#$%^&*]/.test(cpNew) }].map(({ label, ok }) => (
                                    <span key={label} style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '100px', background: ok ? 'rgba(16,185,129,0.12)' : 'var(--surface-1)', color: ok ? 'var(--success)' : 'var(--text-quaternary)', border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : 'var(--border-subtle)'}`, fontWeight: 600 }}>{ok ? '✓' : '·'} {label}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="form-group">
                              <label className="form-label">Confirm New Password *</label>
                              <input type="password" value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} required className="glass-input" placeholder="Repeat new password" id="cp-confirm" />
                              {cpConfirm.length > 0 && cpNew !== cpConfirm && <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>⚠ Passwords do not match</div>}
                            </div>
                            <button type="submit" disabled={cpLoading} className="btn-primary" style={{ width: '100%', marginTop: '4px' }} id="cp-submit-btn">
                              {cpLoading ? <><div className="animate-spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', marginRight: '8px' }} />Changing...</> : <><Lock size={15} style={{ marginRight: '6px', display: 'inline' }} />Update Password</>}
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    )}

                    </AnimatePresence>

                    {/* Danger zone */}
                    {!settingsSubPage && (
                    <div className="card" style={{ padding: '20px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Danger Zone</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '14px', lineHeight: 1.6 }}>
                        Permanently delete your account and all associated patient data. This action cannot be undone.
                      </div>
                      <button onClick={handleDeleteAccount} className="btn-danger" style={{ width: '100%', fontSize: '13px' }} id="delete-account-btn">
                        Delete Account Permanently
                      </button>
                    </div>
                    )}

                    {!settingsSubPage && (
                    <div style={{ textAlign: 'center', color: 'var(--text-quaternary)', fontSize: '12px', paddingBottom: '8px' }}>
                      HemoScan Web Portal &nbsp;·&nbsp; v1.0.0 &nbsp;·&nbsp; Built with ❤️ for clinical diagnostics
                    </div>
                    )}
                  </motion.div>
                )}

              </AnimatePresence>
            </main>

            {/* ── Bottom Navigation ── */}
            <footer className="show-mobile-only" style={{
              background: 'var(--surface-0)', borderTop: '1px solid var(--border-subtle)',
              position: 'sticky', bottom: 0, zIndex: 50,
              boxShadow: '0 -4px 20px rgba(0,0,0,0.06)'
            }}>
              <div style={{ display: 'flex', maxWidth: '480px', margin: '0 auto', padding: '4px 8px 2px' }}>
                {([
                  { route: 'dashboard', label: 'Dashboard', icon: Activity },
                  { route: 'new-scan',  label: 'New Scan',  icon: ScanLine },
                  { route: 'history',   label: 'History',   icon: Database },
                  { route: 'settings',  label: 'Settings',  icon: Settings },
                ] as const).map(({ route, label, icon: Icon }) => {
                  const isActive = currentRoute === route;
                  return (
                    <motion.button
                      key={route}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        if (route === 'settings') { setEditName(doctor?.name || ''); setEditSpecialty(doctor?.specialty || ''); }
                        setCurrentRoute(route);
                      }}
                      style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                        padding: '10px 0 8px', border: 'none', background: 'none', cursor: 'pointer',
                        color: isActive ? 'var(--brand-600)' : 'var(--text-quaternary)',
                        position: 'relative', transition: 'color 0.15s'
                      }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-active"
                          style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2.5, background: 'var(--brand-500)', borderRadius: '0 0 3px 3px' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                      <span style={{ fontSize: '10px', fontWeight: isActive ? 700 : 500, letterSpacing: '0.02em' }}>{label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </footer>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          EDIT PROFILE MODAL
         ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showEditProfileModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', padding: '24px' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowEditProfileModal(false); }}
          >
            <motion.div
              variants={scaleIn} initial="hidden" animate="show" exit="hidden"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="card"
              style={{ width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}
            >
              {/* Modal header */}
              <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface-0)', zIndex: 1 }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Edit Doctor Profile</h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '2px' }}>Changes sync across app and web instantly</p>
                </div>
                <button onClick={() => setShowEditProfileModal(false)}
                  style={{ width: 32, height: 32, borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Photo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--surface-1)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ width: 68, height: 68, borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--brand-200)', background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {editPhotoPreview ? (
                      <img src={editPhotoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={28} color="var(--brand-400)" />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--brand-600)', cursor: 'pointer' }}>
                      {editPhotoPreview ? 'Change photo' : 'Upload profile photo'}
                      <input type="file" accept="image/*" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) { setEditPhoto(file); setEditPhotoPreview(URL.createObjectURL(file)); }
                      }} style={{ display: 'none' }} id="profile-photo-upload" />
                    </label>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-quaternary)', marginTop: '4px' }}>JPEG, PNG or WebP · max 2MB</div>
                  </div>
                </div>

                {/* Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Full Name *</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className="glass-input" id="edit-name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Specialty / Title</label>
                    <input type="text" value={editSpecialty} onChange={e => setEditSpecialty(e.target.value)} placeholder="e.g. Neurologist" className="glass-input" id="edit-specialty" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Years of Experience</label>
                    <input type="number" value={editYearsExp} onChange={e => setEditYearsExp(e.target.value)} placeholder="e.g. 8" className="glass-input" min="0" id="edit-years-exp" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hospital / Institution</label>
                    <input type="text" value={editHospital} onChange={e => setEditHospital(e.target.value)} placeholder="e.g. AIIMS New Delhi" className="glass-input" id="edit-hospital" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">License Number</label>
                    <input type="text" value={editLicense} onChange={e => setEditLicense(e.target.value)} placeholder="e.g. MCI-2024-001" className="glass-input" id="edit-license" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Bio / Professional Summary</label>
                    <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
                      placeholder="Brief description of your expertise..."
                      style={{ background: 'var(--surface-0)', border: '1.5px solid var(--border-subtle)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-sans)', width: '100%', transition: 'border-color 0.2s' }}
                      id="edit-bio"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                  <button type="button" onClick={() => setShowEditProfileModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 2 }} id="save-profile-btn">
                    {loading ? (
                      <><div className="animate-spin" style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} /> Saving...</>
                    ) : (
                      <><CheckCircle size={15} /> Save Changes</>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          SCAN DETAIL MODAL
         ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedScan && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', padding: '24px' }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedScan(null); }}
          >
            <motion.div
              variants={scaleIn} initial="hidden" animate="show" exit="hidden"
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="card"
              style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
            >
              {/* Header */}
              <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedScan.patient_name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-quaternary)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>ID: {selectedScan.patient_id}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={selectedScan.result?.toLowerCase().includes('abnormal') ? 'badge badge-abnormal' : 'badge badge-normal'}>
                    {selectedScan.result?.toLowerCase().includes('abnormal') ? '⚠ Abnormal' : '✓ Normal'}
                  </span>
                  <button onClick={() => setSelectedScan(null)}
                    style={{ width: 30, height: 30, borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Scan image */}
              {selectedScan.image_path && (
                <div style={{ background: '#0A0A14', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '240px', maxHeight: '340px' }}>
                  <img src={getProfilePhotoUrl(selectedScan.image_path)} alt="Scan" style={{ maxWidth: '100%', maxHeight: '340px', objectFit: 'contain' }} />
                </div>
              )}

              {/* Details */}
              <div style={{ padding: '22px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {[
                  { label: 'Patient Name', value: selectedScan.patient_name },
                  { label: 'Patient ID', value: selectedScan.patient_id, mono: true },
                  { label: 'Age', value: `${selectedScan.patient_age} years` },
                  { label: 'Gender', value: selectedScan.patient_gender },
                  { label: 'Date Added', value: selectedScan.date_added },
                  { label: 'Risk Level', value: selectedScan.risk_level || 'N/A' },
                  { label: 'Full Result', value: selectedScan.result || 'N/A', full: true },
                ].map(({ label, value, mono, full }) => (
                  <div key={label} style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '0 24px 22px' }}>
                <button onClick={() => setSelectedScan(null)} className="btn-secondary" style={{ width: '100%' }}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
