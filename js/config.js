/* =====================================================================
   GURUKUL ONLINE APP — CORE CONFIG, FIREBASE, EMAIL ENGINE & UTILITIES
   File: js/config.js
   ===================================================================== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBBdiz2-H7Dr4CmtVwfrng-7l39VA5qx2M",
  authDomain: "gurukul-online-app.firebaseapp.com",
  databaseURL: "https://gurukul-online-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gurukul-online-app",
  storageBucket: "gurukul-online-app.firebasestorage.app",
  messagingSenderId: "309899461267",
  appId: "1:309899461267:web:4ffdbd867f6703b7b90366",
  measurementId: "G-L7S03ZYXY6"
};

// Firebase Init (Compat SDK 10.12.2)
if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}
const db = firebase.database();
const auth = firebase.auth();
let messaging = null;
try {
  if (firebase.messaging && firebase.messaging.isSupported && firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.warn("FCM Messaging not supported in this browser:", e.message);
}

// =========================================================
// 1. MASTER APPLICATION CONSTANTS & LIVE SETTINGS
// =========================================================
const APP_CONFIG = {
  appName: "GURUKUL ONLINE APP",
  schoolName: "GURUKUL SENIOR SECONDARY SCHOOL DHANKOLI",
  address: "Bhadasar Road, Dhankoli (Didwana-Kuchaman) Rajasthan",
  logoUrl: "https://gsssdhankoli.github.io/Logo.png/logo.png",
  helplines: ["9772564359", "9887071127"],
  whatsappPrimary: "919772564359",
  adminUid: "YRTrZhXoNNTv4LgzzWw2dEIWh8o2",
  vapidKey: "BGu2k-v63mtPPweBVnfItgTXxXHKGeKhwr03wfFt-xBieargouhXsCTnm5O3ONas1KgtVaSS13BXNl04Rz1Ttuo",

  // 2-Server Email Pool (Server 0 = OTP Primary, Server 1 = Receipt Primary, Auto-Failover)
  emailServers: [
    {
      name: "OTP Server (noreply.gurukulonline)",
      url: "https://script.google.com/macros/s/AKfycbw8Dy2Z1agtj1-sR8s_fw0frEFwNf1yxb8Yc3ylEYTlDKvaZ93m56PJbIcqMzR7PbCdvQ/exec"
    },
    {
      name: "Receipt Server (gurukul.recipt.noreply)",
      url: "https://script.google.com/macros/s/AKfycbxfM4ykLaYl_CU1qREEJ0CoeMk1boEZTkITyQeeR9msOvVFSRAxz8_nR2_sMIgPdHx4/exec"
    }
  ],

  // Default Payment Details (Live Override from Firebase publicSettings/payment via Admin Panel)
  defaultPayment: {
    upiId: "8739840038@ybl",
    accountHolder: "Piyush Royal",
    merchantNote: "Gurukul Online Course & Books"
  },

  // Course Categories
  categories: [
    "All",
    "Class 6-8",
    "Class 9-10",
    "Class 11-12 Science",
    "Class 11-12 Arts",
    "Class 11-12 Commerce",
    "Class 11-12 Agriculture",
    "Rajasthan CET",
    "RRB / SSC / Govt Exams",
    "Scholarship & Foundation"
  ]
};

// Shared Global State (Accessed across all JS modules)
const APP_STATE = {
  currentUser: null,        // Firebase Auth User
  userProfile: null,        // Realtime DB users/{uid}
  isAdmin: false,
  publicSettings: {
    payment: { ...APP_CONFIG.defaultPayment },
    appOnlyLock: false,     // Admin APK बन जाने के बाद इसे ON कर सकते हैं
    apkDownloadUrl: "",
    fcmPushServerUrl: "",
    announcement: "GURUKUL ONLINE APP में आपका स्वागत है! लाइव क्लासेस, नोट्स, CBT टेस्ट और बुक्स एक ही जगह।",
    banners: []
  },
  batches: {},
  enrollments: {},          // Current user's active enrollments
  books: {},
  orders: {},               // Current user's orders
  tests: {},
  testAttempts: {},
  doubts: {},
  bookmarks: {},
  notifications: {},
  cart: JSON.parse(localStorage.getItem("GURUKUL_BOOK_CART") || "[]"),
  activeTab: "home",
  theme: localStorage.getItem("GURUKUL_THEME") || "light"
};

// =========================================================
// 2. LIVE PUBLIC SETTINGS SYNC (UPI, BANNERS, APP-ONLY LOCK)
// =========================================================
function initPublicSettingsListener() {
  db.ref("publicSettings").on("value", (snap) => {
    const val = snap.val() || {};
    APP_STATE.publicSettings = {
      payment: {
        upiId: (val.payment && val.payment.upiId) ? val.payment.upiId : APP_CONFIG.defaultPayment.upiId,
        accountHolder: (val.payment && val.payment.accountHolder) ? val.payment.accountHolder : APP_CONFIG.defaultPayment.accountHolder,
        merchantNote: (val.payment && val.payment.merchantNote) ? val.payment.merchantNote : APP_CONFIG.defaultPayment.merchantNote
      },
      appOnlyLock: Boolean(val.appOnlyLock),
      apkDownloadUrl: val.apkDownloadUrl || "",
      fcmPushServerUrl: val.fcmPushServerUrl || "",
      announcement: val.announcement || APP_STATE.publicSettings.announcement,
      banners: val.banners ? (Array.isArray(val.banners) ? val.banners : Object.values(val.banners)) : []
    };

    // Update announcement ticker & banners if UI is mounted
    const tickerEl = document.getElementById("homeAnnouncementText");
    if (tickerEl) tickerEl.textContent = APP_STATE.publicSettings.announcement;
    if (typeof window.renderHomeBanners === "function") window.renderHomeBanners();
    if (typeof window.checkAppOnlySecurityGate === "function") window.checkAppOnlySecurityGate();
  });
}

function getLivePaymentConfig() {
  return (APP_STATE.publicSettings && APP_STATE.publicSettings.payment) || APP_CONFIG.defaultPayment;
}

// =========================================================
// 3. APP-ONLY SECURITY GATE (APK / CAPACITOR / WEBVIEW CHECK)
// =========================================================
function isRunningInOfficialApp() {
  const ua = navigator.userAgent || "";
  const isNativeBridge = Boolean(window.Capacitor || window.GurukulNativeApp || ua.includes("GurukulOnlineAPK"));
  const isAndroidWebView = /; wv\)/i.test(ua);
  const isLocalDev = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  return isNativeBridge || isAndroidWebView || isLocalDev;
}

function checkAppOnlySecurityGate() {
  const gateEl = document.getElementById("appOnlySecurityGate");
  if (!gateEl) return;

  // Admin को हमेशा ब्राउज़र से भी एक्सेस मिलता है
  if (APP_STATE.isAdmin) {
    gateEl.classList.add("hidden");
    return;
  }

  const shouldBlockBrowser = APP_STATE.publicSettings.appOnlyLock && !isRunningInOfficialApp();
  if (shouldBlockBrowser) {
    const dlBtn = document.getElementById("appOnlyDownloadLink");
    if (dlBtn) {
      dlBtn.href = APP_STATE.publicSettings.apkDownloadUrl || "#";
      dlBtn.classList.toggle("hidden", !APP_STATE.publicSettings.apkDownloadUrl);
    }
    gateEl.classList.remove("hidden");
  } else {
    gateEl.classList.add("hidden");
  }
}

// =========================================================
// 4. SMART 2-SERVER EMAIL ENGINE (AUTO FAILOVER + QUOTA)
// =========================================================
async function sendAppEmail({ to, subject, htmlBody, type = "OTP", pdfBase64 = null, pdfFileName = null }) {
  if (!to || !to.includes("@")) return { success: false, error: "Invalid email" };

  // OTP के लिए Server 0 पहले, Receipt के लिए Server 1 पहले (फेल होने पर ऑटो बैकअप)
  const order = type === "RECEIPT" ? [1, 0] : [0, 1];
  const payload = { to, subject, htmlBody, pdfBase64, pdfFileName };

  for (const idx of order) {
    const srv = APP_CONFIG.emailServers[idx];
    if (!srv || !srv.url) continue;
    try {
      const res = await fetch(srv.url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        redirect: "follow"
      });
      const data = await res.json();
      if (data && data.status === "SUCCESS") {
        return { success: true, server: srv.name, quotaLeft: data.quotaLeft };
      }
    } catch (err) {
      console.warn(`Email server failed (${srv.name}), trying backup...`, err);
    }
  }
  return { success: false, error: "All email servers busy or quota exhausted" };
}

async function checkAllEmailServersQuota() {
  const results = [];
  let totalQuota = 0;
  for (const srv of APP_CONFIG.emailServers) {
    try {
      const r = await fetch(srv.url);
      const d = await r.json();
      const q = Number(d && d.quotaLeft) || 0;
      totalQuota += q;
      results.push({ name: srv.name, quotaLeft: q, status: "ACTIVE" });
    } catch (e) {
      results.push({ name: srv.name, quotaLeft: 0, status: "OFFLINE" });
    }
  }
  return { totalQuota, servers: results };
}

function buildOfficialEmailHTML({ heading, userName, bodyHtml }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;background:#ffffff;">
      <div style="background:linear-gradient(135deg,#0f172a,#312e81,#4f46e5);color:#ffffff;padding:22px;text-align:center;">
        <img src="${APP_CONFIG.logoUrl}" alt="Logo" style="width:62px;height:62px;border-radius:50%;background:#ffffff;padding:3px;border:2px solid #fbbf24;" />
        <h2 style="margin:10px 0 3px 0;font-size:19px;letter-spacing:0.4px;">${APP_CONFIG.appName}</h2>
        <p style="margin:0;font-size:11px;color:#c7d2fe;">${APP_CONFIG.schoolName}</p>
        <p style="margin:2px 0 0 0;font-size:11px;color:#fde68a;">Helpline: ${APP_CONFIG.helplines.join(", ")}</p>
      </div>
      <div style="padding:22px;color:#1e293b;font-size:14px;line-height:1.65;">
        <h3 style="margin-top:0;color:#312e81;font-size:16px;">${heading}</h3>
        <p>नमस्ते <strong>${escapeHtml(userName || "Student")}</strong>,</p>
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
        <p style="margin:0;font-size:12px;color:#475569;">
          सादर,<br/>
          <strong>${APP_CONFIG.appName} Team</strong><br/>
          ${APP_CONFIG.address}<br/>
          24x7 Support Helpline: ${APP_CONFIG.helplines.join(" / ")}
        </p>
      </div>
    </div>
  `;
}

// =========================================================
// 5. SECURITY, HASHING, DEVICE ID & PAYMENT LINK HELPERS
// =========================================================
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sha256Hash(text) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) {}
  let h = 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return "FALLBACK_" + Math.abs(h);
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem("GURUKUL_UNIQUE_DEVICE_ID");
  if (!id) {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    id = `DEV_${Date.now().toString(36).toUpperCase()}_${rand}`;
    localStorage.setItem("GURUKUL_UNIQUE_DEVICE_ID", id);
  }
  return id;
}

function generateUniqueOrderId(prefix = "ORD") {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ts}-${rand}`;
}

function buildUpiDeepLink(amount, orderId, noteText = "") {
  const pay = getLivePaymentConfig();
  const cleanAmt = Number(amount || 0).toFixed(2);
  const tn = noteText || `${pay.merchantNote} (${orderId})`;
  const params = new URLSearchParams({
    pa: pay.upiId,
    pn: pay.accountHolder,
    tr: orderId,
    tn: tn,
    am: cleanAmt,
    cu: "INR"
  });
  return `upi://pay?${params.toString()}`;
}

function buildQrImageUrl(dataStr, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(dataStr)}`;
}

function buildWhatsAppHelpLink(messageText) {
  return `https://wa.me/${APP_CONFIG.whatsappPrimary}?text=${encodeURIComponent(messageText)}`;
}

function formatCurrency(val) {
  return "₹" + Number(val || 0).toLocaleString("en-IN");
}

function formatDateTime(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch (e) {
    return String(ts);
  }
}

function formatDateOnly(ts) {
  if (!ts) return "-";
  try {
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
  } catch (e) {
    return String(ts);
  }
}

// Image Compression (Keeps Firebase RTDB fast & light for Payment Proofs, Doubts & Thumbnails)
function compressImageToBase64(file, maxWidth = 720, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file selected"));
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = img.width > maxWidth ? (maxWidth / img.width) : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Invalid image file"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsDataURL(file);
  });
}

// Security Audit Logger
function logSecurityEvent(eventType, details = "") {
  try {
    const uid = (APP_STATE.currentUser && APP_STATE.currentUser.uid) || "GUEST";
    const name = (APP_STATE.userProfile && APP_STATE.userProfile.name) || "Unknown";
    const logId = `LOG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    db.ref(`securityLogs/${logId}`).set({
      logId,
      uid,
      name,
      eventType,
      details,
      deviceId: getOrCreateDeviceId(),
      userAgent: (navigator.userAgent || "").slice(0, 140),
      timestamp: Date.now()
    }).catch(() => {});
  } catch (e) {}
}

// Mobile-Safe PDF Generation Config
function getSafePdfOptions(filename, heightPx = 1122) {
  window.scrollTo(0, 0);
  return {
    margin: 0,
    filename: filename,
    image: { type: "jpeg", quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0, windowWidth: 794 },
    jsPDF: { unit: "px", format: [794, heightPx], orientation: "portrait" }
  };
}

// =========================================================
// 6. CUSTOM IN-APP MODALS, TOASTS & VIBRATION FEEDBACK
// =========================================================
function triggerAlertFeedback() {
  try {
    if ("vibrate" in navigator) navigator.vibrate([220, 90, 220]);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(840, ctx.currentTime);
      osc.frequency.setValueAtTime(1120, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {}
}

function showToast(message, type = "INFO") {
  const container = document.getElementById("appToastContainer");
  if (!container) return;
  const colors = {
    SUCCESS: "bg-emerald-600 text-white border-emerald-400",
    DANGER: "bg-rose-600 text-white border-rose-400",
    WARNING: "bg-amber-500 text-slate-950 border-amber-300",
    INFO: "bg-slate-900 text-white border-indigo-400"
  };
  const icons = {
    SUCCESS: "fa-circle-check",
    DANGER: "fa-circle-exclamation",
    WARNING: "fa-triangle-exclamation",
    INFO: "fa-bell"
  };
  const el = document.createElement("div");
  el.className = `px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 animate-slide-up ${colors[type] || colors.INFO}`;
  el.innerHTML = `<i class="fa-solid ${icons[type] || icons.INFO} text-sm"></i><span>${escapeHtml(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.25s ease";
    setTimeout(() => el.remove(), 260);
  }, 3200);
}

function showAppAlert(message, title = "GURUKUL ONLINE APP", type = "INFO") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("customDialogOverlay");
    if (!overlay) { alert(message); return resolve(true); }

    const header = document.getElementById("customDialogHeader");
    header.className = type === "DANGER"
      ? "bg-gradient-to-r from-rose-700 to-red-600 text-white p-4 flex items-center gap-3"
      : type === "SUCCESS"
        ? "bg-gradient-to-r from-emerald-700 to-teal-600 text-white p-4 flex items-center gap-3"
        : "brand-gradient text-white p-4 flex items-center gap-3";

    document.getElementById("customDialogTitle").textContent = title;
    document.getElementById("customDialogMessage").textContent = message;
    document.getElementById("customDialogInputWrap").classList.add("hidden");
    document.getElementById("customDialogCancelBtn").classList.add("hidden");
    const okBtn = document.getElementById("customDialogOkBtn");
    okBtn.textContent = "ठीक है (OK)";

    overlay.classList.remove("hidden");
    okBtn.onclick = () => {
      overlay.classList.add("hidden");
      resolve(true);
    };
  });
}

function showAppConfirm(message, title = "पुष्टि करें (Confirm)") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("customDialogOverlay");
    if (!overlay) return resolve(confirm(message));

    document.getElementById("customDialogHeader").className = "brand-gradient text-white p-4 flex items-center gap-3";
    document.getElementById("customDialogTitle").textContent = title;
    document.getElementById("customDialogMessage").textContent = message;
    document.getElementById("customDialogInputWrap").classList.add("hidden");

    const cancelBtn = document.getElementById("customDialogCancelBtn");
    const okBtn = document.getElementById("customDialogOkBtn");
    cancelBtn.classList.remove("hidden");
    okBtn.textContent = "कन्फर्म करें";

    overlay.classList.remove("hidden");
    cancelBtn.onclick = () => { overlay.classList.add("hidden"); resolve(false); };
    okBtn.onclick = () => { overlay.classList.add("hidden"); resolve(true); };
  });
}

function showAppPrompt(message, defaultVal = "", title = "जानकारी दर्ज करें") {
  return new Promise((resolve) => {
    const overlay = document.getElementById("customDialogOverlay");
    if (!overlay) return resolve(prompt(message, defaultVal));

    document.getElementById("customDialogHeader").className = "brand-gradient text-white p-4 flex items-center gap-3";
    document.getElementById("customDialogTitle").textContent = title;
    document.getElementById("customDialogMessage").textContent = message;

    const wrap = document.getElementById("customDialogInputWrap");
    const inp = document.getElementById("customDialogInput");
    wrap.classList.remove("hidden");
    inp.value = defaultVal;

    const cancelBtn = document.getElementById("customDialogCancelBtn");
    const okBtn = document.getElementById("customDialogOkBtn");
    cancelBtn.classList.remove("hidden");
    okBtn.textContent = "सबमिट करें";

    overlay.classList.remove("hidden");
    setTimeout(() => inp.focus(), 60);
    cancelBtn.onclick = () => { overlay.classList.add("hidden"); resolve(null); };
    okBtn.onclick = () => { overlay.classList.add("hidden"); resolve(inp.value.trim()); };
  });
}

// Dark / Light Theme Switcher
function applyAppTheme(mode) {
  const isDark = mode === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  APP_STATE.theme = isDark ? "dark" : "light";
  localStorage.setItem("GURUKUL_THEME", APP_STATE.theme);
  const icon = document.getElementById("themeToggleIcon");
  if (icon) icon.className = isDark ? "fa-solid fa-sun text-amber-300" : "fa-solid fa-moon text-indigo-200";
}

function toggleAppTheme() {
  applyAppTheme(APP_STATE.theme === "dark" ? "light" : "dark");
}
