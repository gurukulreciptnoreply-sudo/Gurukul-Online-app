/* =====================================================================
   GURUKUL ONLINE APP — AUTHENTICATION, EMAIL OTP, DEVICE LOCK & PUSH
   File: js/auth.js (With Native Android APK Closed-App FCM Push Support)
   ===================================================================== */

let signupOtpHash = null;
let signupOtpEmail = "";
let signupOtpExpiry = 0;
let isSignupEmailVerified = false;
let activeRealtimeRefs = [];
let studentKnownNotifTs = Number(localStorage.getItem("GURUKUL_LAST_SEEN_NOTIF_TS") || 0);
let currentSessionToken = localStorage.getItem("GURUKUL_SESSION_TOKEN") || "";
let nativePushListenersBound = false;
let isNativePushGranted = false;

// =========================================================
// 1. MODAL & NAVIGATION HELPERS
// =========================================================
function openModalById(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModalById(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

function togglePasswordVisibility(inputId, btnEl) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isPass = inp.type === "password";
  inp.type = isPass ? "text" : "password";
  if (btnEl) {
    btnEl.innerHTML = isPass
      ? '<i class="fa-solid fa-eye-slash text-xs text-indigo-600"></i>'
      : '<i class="fa-solid fa-eye text-xs"></i>';
  }
}

function switchAuthMode(mode) {
  const isLogin = mode === "LOGIN";
  document.getElementById("loginFormBox").classList.toggle("hidden", !isLogin);
  document.getElementById("signupFormBox").classList.toggle("hidden", isLogin);

  document.getElementById("authTabLoginBtn").className = isLogin
    ? "py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow"
    : "py-2.5 rounded-xl text-xs font-extrabold text-slate-600";
  document.getElementById("authTabSignupBtn").className = !isLogin
    ? "py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow"
    : "py-2.5 rounded-xl text-xs font-extrabold text-slate-600";
}

function switchStudentTab(tabName, extraParam = null) {
  APP_STATE.activeTab = tabName;
  document.querySelectorAll(".student-tab-pane").forEach((p) => p.classList.add("hidden"));
  const targetPane = document.getElementById(`tabView_${tabName}`);
  if (targetPane) targetPane.classList.remove("hidden");

  document.querySelectorAll(".bottom-nav-btn").forEach((b) => b.classList.remove("active"));
  const activeNav = document.getElementById(`bnav_${tabName}`);
  if (activeNav) activeNav.classList.add("active");

  if (tabName === "batches") {
    if (extraParam === "FREE" || extraParam === "PAID" || extraParam === "ALL") {
      const sel = document.getElementById("batchPriceFilter");
      if (sel) sel.value = extraParam;
    }
    if (typeof window.renderAllBatchesGrid === "function") window.renderAllBatchesGrid();
  } else if (tabName === "mystudy") {
    switchMyStudySubTab(extraParam || "batches");
  } else if (tabName === "bookstore") {
    if (typeof window.renderBookStoreGrid === "function") window.renderBookStoreGrid();
  } else if (tabName === "profile") {
    renderStudentProfileSection();
  } else if (tabName === "home") {
    if (typeof window.renderHomeDashboard === "function") window.renderHomeDashboard();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchMyStudySubTab(subName) {
  document.querySelectorAll(".mystudy-subpane").forEach((p) => p.classList.add("hidden"));
  const pane = document.getElementById(`myStudyPane_${subName}`);
  if (pane) pane.classList.remove("hidden");

  ["batches", "tests", "doubts", "bookmarks", "orders"].forEach((k) => {
    const btn = document.getElementById(`subTabBtn_${k}`);
    if (btn) btn.classList.toggle("active", k === subName);
  });

  if (subName === "batches" && typeof window.renderMyEnrolledBatches === "function") window.renderMyEnrolledBatches();
  if (subName === "tests" && typeof window.renderStudentTestsList === "function") window.renderStudentTestsList();
  if (subName === "doubts" && typeof window.renderStudentDoubtsList === "function") window.renderStudentDoubtsList();
  if (subName === "bookmarks" && typeof window.renderStudentBookmarksList === "function") window.renderStudentBookmarksList();
  if (subName === "orders" && typeof window.renderStudentOrdersTracker === "function") window.renderStudentOrdersTracker();
}

// =========================================================
// 2. EMAIL OTP VERIFICATION (2-SERVER AUTO FAILOVER)
// =========================================================
async function sendSignupEmailOTP() {
  const email = document.getElementById("regEmailInput").value.trim().toLowerCase();
  const name = document.getElementById("regNameInput").value.trim() || "Student";
  if (!email || !email.includes("@")) {
    return showAppAlert("कृपया सही ईमेल आईडी दर्ज करें।", "ईमेल आवश्यक है", "DANGER");
  }

  const btn = document.getElementById("btnSendSignupOtp");
  btn.disabled = true;
  btn.textContent = "भेजा जा रहा है...";

  const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
  signupOtpHash = await sha256Hash(`${rawOtp}::${email}::GURUKUL_OTP`);
  signupOtpEmail = email;
  signupOtpExpiry = Date.now() + 10 * 60 * 1000;
  isSignupEmailVerified = false;

  const htmlBody = buildOfficialEmailHTML({
    heading: "अकाउंट वेरिफिकेशन OTP (Sign-Up Verification)",
    userName: name,
    bodyHtml: `
      <p><strong>${APP_CONFIG.appName}</strong> पर आपका नया अकाउंट वेरीफाई करने के लिए 6-अंकों का OTP नीचे दिया गया है:</p>
      <div style="background:#eef2ff;border:2px dashed #4f46e5;padding:16px;border-radius:12px;text-align:center;margin:14px 0;">
        <span style="font-size:28px;font-weight:900;letter-spacing:8px;color:#312e81;">${rawOtp}</span>
      </div>
      <p style="font-size:12px;color:#64748b;">यह OTP अगले 10 मिनट तक मान्य है। कृपया इसे किसी के साथ साझा न करें।</p>
    `
  });

  const res = await sendAppEmail({
    to: email,
    subject: `${rawOtp} आपका GURUKUL ONLINE APP वेरिफिकेशन OTP है`,
    htmlBody,
    type: "OTP"
  });

  btn.disabled = false;
  btn.textContent = "दोबारा भेजें";

  if (res.success) {
    document.getElementById("regOtpVerifyWrap").classList.remove("hidden");
    const statusEl = document.getElementById("regOtpStatusText");
    statusEl.className = "text-[10px] font-bold text-indigo-800";
    statusEl.textContent = `✅ OTP सफलतापूर्वक ${email} पर भेजा गया (Inbox या Spam चेक करें)।`;
    showToast("OTP आपकी ईमेल पर भेज दिया गया है!", "SUCCESS");
  } else {
    await showAppAlert(
      "OTP भेजने में समस्या आई। कृपया ईमेल सही से जांचें या 1 मिनट बाद प्रयास करें।",
      "Email Server Busy",
      "DANGER"
    );
  }
}

async function verifySignupEmailOTP() {
  const email = document.getElementById("regEmailInput").value.trim().toLowerCase();
  const entered = document.getElementById("regOtpInput").value.trim();

  if (!signupOtpHash || email !== signupOtpEmail) {
    return showAppAlert("कृपया इस ईमेल पर पहले नया OTP भेजें।", "OTP आवश्यक", "DANGER");
  }
  if (Date.now() > signupOtpExpiry) {
    return showAppAlert("यह OTP एक्सपायर हो गया है। कृपया 'दोबारा भेजें' पर क्लिक करें।", "OTP Expired", "DANGER");
  }
  if (!/^\d{6}$/.test(entered)) {
    return showAppAlert("कृपया 6-अंकों का सही OTP दर्ज करें।", "अमान्य OTP", "DANGER");
  }

  const enteredHash = await sha256Hash(`${entered}::${email}::GURUKUL_OTP`);
  if (enteredHash === signupOtpHash) {
    isSignupEmailVerified = true;
    const statusEl = document.getElementById("regOtpStatusText");
    statusEl.className = "text-[11px] font-extrabold text-emerald-700";
    statusEl.textContent = "✅ ईमेल सफलतापूर्वक वेरीफाई हो गया है! अब 'अकाउंट बनाएं' दबाएं।";
    document.getElementById("regEmailInput").readOnly = true;
    document.getElementById("regOtpInput").readOnly = true;
    document.getElementById("btnVerifySignupOtp").disabled = true;
    document.getElementById("btnSendSignupOtp").disabled = true;
    showToast("ईमेल वेरीफाई हो गया!", "SUCCESS");
  } else {
    await showAppAlert("गलत OTP! कृपया अपनी ईमेल में आया सही 6-अंकों का कोड डालें।", "गलत OTP", "DANGER");
  }
}

// =========================================================
// 3. STUDENT SIGN-UP, LOGIN, FORGOT PASSWORD & LOGOUT
// =========================================================
async function handleStudentSignup() {
  const name = document.getElementById("regNameInput").value.trim();
  const phone = document.getElementById("regPhoneInput").value.trim();
  const target = document.getElementById("regTargetSelect").value;
  const email = document.getElementById("regEmailInput").value.trim().toLowerCase();
  const pass = document.getElementById("regPassInput").value.trim();

  if (!name || !/^\d{10}$/.test(phone)) {
    return showAppAlert("कृपया सही नाम और 10-अंकों का मोबाइल नंबर दर्ज करें।", "अधूरी जानकारी", "DANGER");
  }
  if (!isSignupEmailVerified || email !== signupOtpEmail) {
    return showAppAlert("कृपया पहले अपनी ईमेल पर OTP मंगाकर वेरीफाई करें।", "Email OTP अनिवार्य", "DANGER");
  }
  if (pass.length < 6) {
    return showAppAlert("पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।", "कमजोर पासवर्ड", "DANGER");
  }

  const btn = document.getElementById("btnSubmitSignup");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> अकाउंट बन रहा है...';

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    const myDeviceId = getOrCreateDeviceId();
    const studentCode = `GUR-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 89)}`;
    currentSessionToken = `SES_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem("GURUKUL_SESSION_TOKEN", currentSessionToken);

    const profileData = {
      uid,
      studentCode,
      name,
      phone,
      email,
      target,
      role: "STUDENT",
      blocked: false,
      boundDeviceId: myDeviceId,
      deviceResetCount: 0,
      activeSessionToken: currentSessionToken,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    await db.ref(`users/${uid}`).set(profileData);
    showToast("स्वागत है! आपका अकाउंट सफलतापूर्वक बन गया।", "SUCCESS");

    sendAppEmail({
      to: email,
      subject: `स्वागत है ${name}! आपका GURUKUL ONLINE APP अकाउंट तैयार है`,
      type: "RECEIPT",
      htmlBody: buildOfficialEmailHTML({
        heading: "GURUKUL ONLINE APP में आपका हार्दिक स्वागत है!",
        userName: name,
        bodyHtml: `
          <p>आपका स्टूडेंट अकाउंट सफलतापूर्वक बन गया है। आपकी लॉगिन जानकारी:</p>
          <ul>
            <li><strong>Student ID:</strong> ${studentCode}</li>
            <li><strong>Registered Email:</strong> ${email}</li>
            <li><strong>Target Course:</strong> ${target}</li>
          </ul>
          <p>अब आप फ्री क्लासेस, पेड बैचेस, CBT टेस्ट सीरीज, नोट्स और बुक स्टोर का लाभ उठा सकते हैं।</p>
        `
      })
    }).catch(() => {});
  } catch (err) {
    let msg = err.message || "अकाउंट बनाने में त्रुटि आई।";
    if (err.code === "auth/email-already-in-use") {
      msg = "यह ईमेल आईडी पहले से रजिस्टर्ड है। कृपया Login टैब से लॉगिन करें।";
    }
    await showAppAlert(msg, "Sign-Up विफल", "DANGER");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> अकाउंट बनाएं और शुरू करें';
  }
}

async function handleUserLogin() {
  const email = document.getElementById("loginEmailInput").value.trim().toLowerCase();
  const pass = document.getElementById("loginPassInput").value.trim();
  if (!email || !pass) {
    return showAppAlert("कृपया ईमेल और पासवर्ड दोनों दर्ज करें।", "जानकारी अधूरी", "DANGER");
  }

  const btn = document.getElementById("btnSubmitLogin");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> लॉगिन हो रहा है...';

  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (err) {
    let msg = "गलत ईमेल या पासवर्ड! कृपया दोबारा जांचें।";
    if (err.code === "auth/too-many-requests") {
      msg = "बार-बार गलत प्रयास के कारण अस्थायी रोक लगी है। कृपया कुछ मिनट बाद प्रयास करें।";
    }
    await showAppAlert(msg, "लॉगिन विफल", "DANGER");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> सुरक्षित लॉगिन करें';
  }
}

async function handleForgotPassword(isFromProfile = false) {
  let email = isFromProfile && APP_STATE.currentUser
    ? APP_STATE.currentUser.email
    : document.getElementById("loginEmailInput").value.trim();

  if (!email) {
    email = await showAppPrompt(
      "पासवर्ड रीसेट लिंक पाने के लिए अपनी रजिस्टर्ड ईमेल आईडी दर्ज करें:",
      "",
      "पासवर्ड रीसेट (Reset Password)"
    );
  }
  if (!email || !email.includes("@")) return;

  try {
    await auth.sendPasswordResetEmail(email.trim());
    await showAppAlert(
      `पासवर्ड रीसेट लिंक आपकी ईमेल (${email.trim()}) पर भेज दिया गया है। ईमेल खोलकर नया पासवर्ड सेट करें।`,
      "रीसेट लिंक भेजा गया",
      "SUCCESS"
    );
  } catch (err) {
    await showAppAlert("इस ईमेल पर रीसेट लिंक नहीं भेजा जा सका। कृपया सही रजिस्टर्ड ईमेल जांचें।", "त्रुटि", "DANGER");
  }
}

async function handleUserLogout(silent = false) {
  if (!silent) {
    const ok = await showAppConfirm("क्या आप वाकई GURUKUL ONLINE APP से लॉगआउट करना चाहते हैं?", "लॉगआउट पुष्टि");
    if (!ok) return;
  }
  detachAllAppListeners();
  try {
    await auth.signOut();
  } catch (e) {}
}

// =========================================================
// 4. REALTIME LISTENERS MANAGER & AUTH STATE BOOTSTRAP
// =========================================================
function trackRealtimeRef(ref, eventType, callback) {
  ref.on(eventType, callback);
  activeRealtimeRefs.push({ ref, eventType, callback });
}

function detachAllAppListeners() {
  activeRealtimeRefs.forEach((item) => {
    try { item.ref.off(item.eventType, item.callback); } catch (e) {}
  });
  activeRealtimeRefs = [];
}

function hideAppSplashLoader() {
  const splash = document.getElementById("appSplashLoader");
  if (splash) splash.classList.add("splash-hidden");
}

async function verifyAndBindStudentDevice(uid, profile) {
  const myDeviceId = getOrCreateDeviceId();

  if (!profile.boundDeviceId) {
    currentSessionToken = `SES_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem("GURUKUL_SESSION_TOKEN", currentSessionToken);
    await db.ref(`users/${uid}`).update({
      boundDeviceId: myDeviceId,
      activeSessionToken: currentSessionToken,
      lastLoginAt: Date.now()
    });
    profile.boundDeviceId = myDeviceId;
    profile.activeSessionToken = currentSessionToken;
    return true;
  }

  if (profile.boundDeviceId === myDeviceId) {
    currentSessionToken = currentSessionToken || `SES_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem("GURUKUL_SESSION_TOKEN", currentSessionToken);
    await db.ref(`users/${uid}`).update({
      activeSessionToken: currentSessionToken,
      lastLoginAt: Date.now()
    });
    profile.activeSessionToken = currentSessionToken;
    return true;
  }

  logSecurityEvent("DEVICE_MISMATCH_BLOCKED", `Registered: ${profile.boundDeviceId}, Attempted: ${myDeviceId}`);

  if ((Number(profile.deviceResetCount) || 0) < 1) {
    const confirmShift = await showAppConfirm(
      `⚠️ सिंगल-डिवाइस सुरक्षा अलर्ट!\n\nयह अकाउंट किसी दूसरे मोबाइल/ब्राउज़र से जुड़ा हुआ है। यदि आपने नया फोन लिया है, तो आप केवल 1 बार अपना अकाउंट इस डिवाइस पर शिफ्ट कर सकते हैं (पुराना डिवाइस तुरंत लॉगआउट हो जाएगा)।\n\nक्या आप इस फोन को अपना प्राइमरी डिवाइस बनाना चाहते हैं?`,
      "1-टाइम डिवाइस शिफ्ट"
    );
    if (!confirmShift) {
      await handleUserLogout(true);
      return false;
    }

    currentSessionToken = `SES_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem("GURUKUL_SESSION_TOKEN", currentSessionToken);
    await db.ref(`users/${uid}`).update({
      boundDeviceId: myDeviceId,
      deviceResetCount: 1,
      activeSessionToken: currentSessionToken,
      lastLoginAt: Date.now()
    });
    profile.boundDeviceId = myDeviceId;
    profile.deviceResetCount = 1;
    profile.activeSessionToken = currentSessionToken;
    showToast("यह फोन आपका प्राइमरी डिवाइस सेट हो गया है।", "SUCCESS");
    return true;
  }

  await showAppAlert(
    `🚫 एक्सेस ब्लॉक (Single-Device Lock)\n\nअकाउंट शेयरिंग रोकने के लिए यह आईडी पहले से ही किसी अन्य फोन पर लॉक है और 1-टाइम डिवाइस शिफ्ट लिमिट पूरी हो चुकी है।\n\nडिवाइस रीसेट करवाने के लिए हेल्पलाइन (${APP_CONFIG.helplines.join(" / ")}) पर संपर्क करें।`,
    "डिवाइस लॉक अलर्ट",
    "DANGER"
  );
  await handleUserLogout(true);
  return false;
}

function startStudentAppSession(user, profile) {
  APP_STATE.currentUser = user;
  APP_STATE.userProfile = profile;
  APP_STATE.isAdmin = false;

  document.getElementById("authScreenView").classList.add("hidden");
  document.getElementById("adminAppShell").classList.add("hidden");
  document.getElementById("studentAppShell").classList.remove("hidden");

  renderStudentProfileSection();
  checkAppOnlySecurityGate();
  updateHeaderCartBadges();

  const uid = user.uid;

  trackRealtimeRef(db.ref(`users/${uid}`), "value", async (snap) => {
    const updated = snap.val();
    if (!updated) return;
    APP_STATE.userProfile = updated;

    if (updated.blocked === true) {
      triggerAlertFeedback();
      await showAppAlert(
        "आपका अकाउंट एडमिन द्वारा सस्पेंड/ब्लॉक कर दिया गया है। अधिक जानकारी के लिए हेल्पलाइन पर संपर्क करें।",
        "Account Suspended",
        "DANGER"
      );
      return handleUserLogout(true);
    }

    if (updated.boundDeviceId && updated.boundDeviceId !== getOrCreateDeviceId()) {
      triggerAlertFeedback();
      await showAppAlert(
        "यह अकाउंट किसी नए डिवाइस पर शिफ्ट कर दिया गया है, इसलिए इस फोन से लॉगआउट किया जा रहा है।",
        "Session Ended",
        "DANGER"
      );
      return handleUserLogout(true);
    }

    renderStudentProfileSection();
  });

  trackRealtimeRef(db.ref("batches"), "value", (snap) => {
    APP_STATE.batches = snap.val() || {};
    if (typeof window.renderHomeDashboard === "function") window.renderHomeDashboard();
    if (typeof window.renderAllBatchesGrid === "function") window.renderAllBatchesGrid();
    if (typeof window.renderMyEnrolledBatches === "function") window.renderMyEnrolledBatches();
  });

  trackRealtimeRef(db.ref("books"), "value", (snap) => {
    APP_STATE.books = snap.val() || {};
    if (typeof window.renderBookStoreGrid === "function") window.renderBookStoreGrid();
  });

  trackRealtimeRef(db.ref(`enrollments/${uid}`), "value", (snap) => {
    APP_STATE.enrollments = snap.val() || {};
    if (typeof window.renderHomeDashboard === "function") window.renderHomeDashboard();
    if (typeof window.renderAllBatchesGrid === "function") window.renderAllBatchesGrid();
    if (typeof window.renderMyEnrolledBatches === "function") window.renderMyEnrolledBatches();
  });

  trackRealtimeRef(db.ref(`orders/${uid}`), "value", (snap) => {
    APP_STATE.orders = snap.val() || {};
    if (typeof window.renderHomePendingOrderBanner === "function") window.renderHomePendingOrderBanner();
    if (typeof window.renderStudentOrdersTracker === "function") window.renderStudentOrdersTracker();
  });

  trackRealtimeRef(db.ref("tests"), "value", (snap) => {
    APP_STATE.tests = snap.val() || {};
    if (typeof window.renderHomeDashboard === "function") window.renderHomeDashboard();
    if (typeof window.renderStudentTestsList === "function") window.renderStudentTestsList();
  });

  trackRealtimeRef(db.ref("testAttempts"), "value", (snap) => {
    APP_STATE.testAttempts = snap.val() || {};
    if (typeof window.renderStudentTestsList === "function") window.renderStudentTestsList();
  });

  trackRealtimeRef(db.ref(`doubts/${uid}`), "value", (snap) => {
    APP_STATE.doubts = snap.val() || {};
    if (typeof window.renderStudentDoubtsList === "function") window.renderStudentDoubtsList();
  });

  trackRealtimeRef(db.ref(`bookmarks/${uid}`), "value", (snap) => {
    APP_STATE.bookmarks = snap.val() || {};
    if (typeof window.renderStudentBookmarksList === "function") window.renderStudentBookmarksList();
  });

  trackRealtimeRef(db.ref("notifications"), "value", (snap) => {
    APP_STATE.notifications = snap.val() || {};
    processIncomingStudentNotifications();
  });

  switchStudentTab("home");
  setTimeout(() => enableAppPushNotifications(false), 1200);
}

function renderStudentProfileSection() {
  const p = APP_STATE.userProfile;
  if (!p) return;
  const firstLetter = (p.name || "S").trim().charAt(0).toUpperCase();
  const greet = document.getElementById("topbarUserGreeting");
  if (greet) greet.textContent = `नमस्ते, ${p.name}`;

  const av = document.getElementById("profileAvatarCircle");
  if (av) av.textContent = firstLetter;
  const idBadge = document.getElementById("profileStudentIdBadge");
  if (idBadge) idBadge.textContent = `ID: ${p.studentCode || p.uid.slice(0, 8).toUpperCase()}`;
  const nameEl = document.getElementById("profileNameText");
  if (nameEl) nameEl.textContent = p.name || "Student";
  const epEl = document.getElementById("profileEmailPhoneText");
  if (epEl) epEl.textContent = `${p.email || ""} • ${p.phone || ""}`;
  const tgEl = document.getElementById("profileTargetText");
  if (tgEl) tgEl.textContent = `टारगेट: ${p.target || "All Courses"}`;
  const dvEl = document.getElementById("profileDeviceIdText");
  if (dvEl) dvEl.textContent = getOrCreateDeviceId();

  const pushEl = document.getElementById("profilePushStatus");
  if (pushEl) {
    const webGranted = "Notification" in window && Notification.permission === "granted";
    const webDenied = "Notification" in window && Notification.permission === "denied";
    if (isNativePushGranted || webGranted) {
      pushEl.textContent = "Active ✅";
      pushEl.className = "text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-extrabold";
    } else if (webDenied) {
      pushEl.textContent = "Blocked";
      pushEl.className = "text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-extrabold";
    }
  }
}

function updateHeaderCartBadges() {
  const count = (APP_STATE.cart || []).reduce((acc, item) => acc + (Number(item.qty) || 1), 0);
  const badge = document.getElementById("headerCartBadge");
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }
  const btnCnt = document.getElementById("storeCartCountBtn");
  if (btnCnt) btnCnt.textContent = count;
}

// =========================================================
// 5. NOTIFICATIONS CENTER & CLOSED-APP NATIVE + WEB FCM PUSH
// =========================================================
function getCapacitorPushPlugin() {
  try {
    const cap = window.Capacitor;
    if (cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform()) {
      return (cap.Plugins && cap.Plugins.PushNotifications) || null;
    }
  } catch (e) {}
  return null;
}

function getFilteredStudentNotifications() {
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  const target = (APP_STATE.userProfile && APP_STATE.userProfile.target) || "";
  const activeBatchIds = Object.keys(APP_STATE.enrollments || {}).filter(
    (bId) => APP_STATE.enrollments[bId] && APP_STATE.enrollments[bId].active
  );

  return Object.values(APP_STATE.notifications || {})
    .filter((n) => {
      if (!n || !n.title) return false;
      if (n.targetType === "ALL") return true;
      if (n.targetType === "USER" && n.targetValue === uid) return true;
      if (n.targetType === "CATEGORY" && n.targetValue === target) return true;
      if (n.targetType === "BATCH" && activeBatchIds.includes(n.targetValue)) return true;
      return false;
    })
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

function processIncomingStudentNotifications() {
  const list = getFilteredStudentNotifications();
  const unread = list.filter((n) => (Number(n.createdAt) || 0) > studentKnownNotifTs);
  const badge = document.getElementById("headerNotifBadge");
  if (badge) {
    badge.textContent = unread.length;
    badge.classList.toggle("hidden", unread.length === 0);
  }

  if (unread.length > 0 && studentKnownNotifTs > 0) {
    const latest = unread[0];
    triggerAlertFeedback();
    showToast(`🔔 ${latest.title}`, "INFO");
    if (!getCapacitorPushPlugin()) {
      fireNativeStatusBarNotification(`🔔 ${latest.title}`, latest.message || "", latest.id);
    }
  }
}

function openNotificationsModal() {
  const list = getFilteredStudentNotifications();
  const body = document.getElementById("notificationsListBody");
  if (body) {
    body.innerHTML = list.length
      ? list.map((n) => `
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <div class="flex items-center justify-between text-[10px] font-extrabold text-indigo-600">
              <span><i class="fa-solid fa-bullhorn mr-1"></i>${escapeHtml(n.targetType || "NOTICE")}</span>
              <span class="text-slate-400">${formatDateTime(n.createdAt)}</span>
            </div>
            <h4 class="text-xs sm:text-sm font-extrabold text-slate-900">${escapeHtml(n.title)}</h4>
            <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(n.message || "")}</p>
          </div>
        `).join("")
      : `<div class="text-center py-8 text-xs font-bold text-slate-400">अभी कोई नया नोटिस या अलर्ट नहीं है।</div>`;
  }

  studentKnownNotifTs = Date.now();
  localStorage.setItem("GURUKUL_LAST_SEEN_NOTIF_TS", String(studentKnownNotifTs));
  const badge = document.getElementById("headerNotifBadge");
  if (badge) badge.classList.add("hidden");
  openModalById("notificationsModal");
}

async function fireNativeStatusBarNotification(title, body, tagId) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.active) {
        reg.active.postMessage({
          type: "SHOW_NATIVE_NOTIFICATION",
          title,
          body,
          tag: tagId || `GURUKUL_${Date.now()}`
        });
        return;
      }
    }
    new Notification(title, { body, icon: APP_CONFIG.logoUrl });
  } catch (e) {}
}

async function saveUserFcmToken(tokenValue, platformName) {
  if (!tokenValue || !APP_STATE.currentUser) return;
  const uid = APP_STATE.currentUser.uid;
  await db.ref(`fcmTokens/${uid}`).set({
    uid,
    token: tokenValue,
    platform: platformName,
    name: (APP_STATE.userProfile && APP_STATE.userProfile.name) || "Student",
    target: (APP_STATE.userProfile && APP_STATE.userProfile.target) || "ALL",
    updatedAt: Date.now()
  });
}

async function enableAppPushNotifications(isManualClick = false) {
  // 1. NATIVE ANDROID APK PUSH (WORKS EVEN WHEN APP IS FORCE-CLOSED)
  const nativePush = getCapacitorPushPlugin();
  if (nativePush) {
    try {
      try {
        await nativePush.createChannel({
          id: "gurukul_alerts",
          name: "Gurukul Alerts",
          description: "Live classes, notices & payment updates",
          importance: 5,
          visibility: 1,
          sound: "default",
          vibration: true
        });
      } catch (e) {}

      if (!nativePushListenersBound) {
        nativePushListenersBound = true;

        nativePush.addListener("registration", async (tokenObj) => {
          if (tokenObj && tokenObj.value) {
            isNativePushGranted = true;
            await saveUserFcmToken(tokenObj.value, "ANDROID_APK");
            renderStudentProfileSection();
          }
        });

        nativePush.addListener("registrationError", (err) => {
          console.warn("Native Push Registration Error:", err);
        });

        nativePush.addListener("pushNotificationReceived", (notif) => {
          triggerAlertFeedback();
          showToast(`🔔 ${(notif && notif.title) || "नया अपडेट आया है"}`, "INFO");
        });

        nativePush.addListener("pushNotificationActionPerformed", () => {
          openNotificationsModal();
        });
      }

      let perm = await nativePush.checkPermissions();
      if (perm.receive !== "granted") {
        perm = await nativePush.requestPermissions();
      }

      if (perm.receive !== "granted") {
        isNativePushGranted = false;
        renderStudentProfileSection();
        if (isManualClick) {
          showAppAlert(
            "कृपया फोन की Settings → Apps → GURUKUL ONLINE APP → Notifications में जाकर अनुमति (Allow) चालू करें।",
            "अनुमति आवश्यक",
            "WARNING"
          );
        }
        return;
      }

      isNativePushGranted = true;
      await nativePush.register();
      renderStudentProfileSection();
      if (isManualClick) showToast("Android बैकग्राउंड पुश नोटिफिकेशन चालू हो गया!", "SUCCESS");
      return;
    } catch (err) {
      console.warn("Native Push Error:", err);
    }
  }

  // 2. WEB / CHROME PWA PUSH FALLBACK
  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      if (isManualClick) showToast("इस ब्राउज़र में बैकग्राउंड नोटिफिकेशन सपोर्ट नहीं है।", "WARNING");
      return;
    }

    if (!isManualClick && Notification.permission === "denied") return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      if (isManualClick) {
        showAppAlert("कृपया फोन/ब्राउज़र सेटिंग में जाकर Notification की अनुमति (Allow) दें ताकि बंद ऐप में भी अलर्ट मिल सकें।", "अनुमति आवश्यक", "WARNING");
      }
      renderStudentProfileSection();
      return;
    }

    const swReg = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    if (messaging) {
      const token = await messaging.getToken({
        vapidKey: APP_CONFIG.vapidKey,
        serviceWorkerRegistration: swReg
      });

      if (token) {
        await saveUserFcmToken(token, "WEB_PWA");
        if (isManualClick) showToast("बैकग्राउंड पुश नोटिफिकेशन सफलतापूर्वक चालू हो गया!", "SUCCESS");
      }

      messaging.onMessage((payload) => {
        const d = (payload && (payload.notification || payload.data)) || {};
        if (d.title) {
          triggerAlertFeedback();
          showToast(`🔔 ${d.title}`, "INFO");
          fireNativeStatusBarNotification(d.title, d.body || "", `FCM_${Date.now()}`);
        }
      });
    }
    renderStudentProfileSection();
  } catch (err) {
    console.warn("FCM Setup Info:", err.message);
  }
}

// =========================================================
// 6. APP BOOTSTRAP & FIREBASE AUTH OBSERVER
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
  applyAppTheme(APP_STATE.theme);
  initPublicSettingsListener();

  auth.onAuthStateChanged(async (user) => {
    detachAllAppListeners();

    if (!user) {
      APP_STATE.currentUser = null;
      APP_STATE.userProfile = null;
      APP_STATE.isAdmin = false;
      document.getElementById("studentAppShell").classList.add("hidden");
      document.getElementById("adminAppShell").classList.add("hidden");
      document.getElementById("authScreenView").classList.remove("hidden");
      checkAppOnlySecurityGate();
      hideAppSplashLoader();
      return;
    }

    if (user.uid === APP_CONFIG.adminUid) {
      APP_STATE.currentUser = user;
      APP_STATE.isAdmin = true;
      document.getElementById("authScreenView").classList.add("hidden");
      document.getElementById("studentAppShell").classList.add("hidden");
      document.getElementById("adminAppShell").classList.remove("hidden");
      checkAppOnlySecurityGate();
      if (typeof window.initAdminDashboard === "function") window.initAdminDashboard();
      hideAppSplashLoader();
      return;
    }

    try {
      const splashTxt = document.getElementById("splashStatusText");
      if (splashTxt) splashTxt.textContent = "डिवाइस सिक्योरिटी और कोर्स लोड हो रहे हैं...";

      const snap = await db.ref(`users/${user.uid}`).once("value");
      let profile = snap.val();

      if (!profile) {
        profile = {
          uid: user.uid,
          studentCode: `GUR-${Date.now().toString().slice(-4)}`,
          name: user.displayName || (user.email ? user.email.split("@")[0] : "Student"),
          phone: "",
          email: user.email || "",
          target: "All",
          role: "STUDENT",
          blocked: false,
          boundDeviceId: getOrCreateDeviceId(),
          deviceResetCount: 0,
          createdAt: Date.now()
        };
        await db.ref(`users/${user.uid}`).set(profile);
      }

      if (profile.blocked === true) {
        await showAppAlert("आपका अकाउंट ब्लॉक कर दिया गया है। कृपया हेल्पलाइन पर संपर्क करें।", "Access Denied", "DANGER");
        await handleUserLogout(true);
        hideAppSplashLoader();
        return;
      }

      const deviceAllowed = await verifyAndBindStudentDevice(user.uid, profile);
      if (deviceAllowed) {
        startStudentAppSession(user, profile);
      }
    } catch (err) {
      console.error("Session init error:", err);
      await showAppAlert("लॉगिन डेटा लोड करने में समस्या आई। कृपया इंटरनेट चेक करके दोबारा प्रयास करें।", "Connection Error", "DANGER");
    } finally {
      hideAppSplashLoader();
    }
  });
});
