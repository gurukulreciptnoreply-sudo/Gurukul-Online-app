/* =====================================================================
   GURUKUL ONLINE APP — UNIFIED FINAL ADMIN CONTROL PANEL (8 MODULES)
   File: js/admin.js
   Includes:
   - 8 Core Admin Modules (Payments, Batches, CBT Tests, Books, Students,
     Doubts, Marketing/Push, Live UPI & Security)
   - Smart CBT Test Builder (Bulk || Upload, Auto-Save Draft, Image,
     Topic-Wise / Weekly / Complete Syllabus Sections & Test Scheduler)
   - Live Class Scheduler (Admin Picker + Student Live Countdown)
   - Zero-Blank Universal PDF Engine (Browser + Android APK Share/Save)
   - Exact 3-Labels-Per-A4 Shipping Sheet & Clean Tax Invoice Receipt
   - Smooth Auto-Rotate Cinema Landscape Video Player (Auto-Hide HUD)
   ===================================================================== */

const ADMIN_STATE = {
  activeTab: "payments",
  users: {},
  enrollments: {},
  orders: {},         // Nested: orders[uid][orderId]
  batches: {},
  books: {},
  tests: {},
  testAttempts: {},
  doubts: {},         // Nested: doubts[uid][doubtId]
  coupons: {},
  fcmTokens: {},
  securityLogs: {},
  selectedBatchForContent: "",
  selectedBatchContentItems: {},
  paymentFilter: "PENDING_VERIFICATION",
  doubtFilter: "PENDING",
  studentSearch: "",
  draftTestQuestions: [],
  draftTestMeta: null,
  bulkRawText: "",
  testInputMode: "bulk",
  editingQuestionIdx: -1,
  bulkStripNumbering: true,
  adminTestTypeFilter: "ALL",
  editingBatchId: null,
  editingBookId: null,
  knownPendingCount: -1
};

// =========================================================
// 1. ADMIN BOOTSTRAP & REALTIME MASTER LISTENERS
// =========================================================
function initAdminDashboard() {
  ADMIN_STATE.knownPendingCount = -1;

  trackRealtimeRef(db.ref("users"), "value", (snap) => {
    ADMIN_STATE.users = snap.val() || {};
    updateAdminKPIStats();
    if (ADMIN_STATE.activeTab === "students") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("enrollments"), "value", (snap) => {
    ADMIN_STATE.enrollments = snap.val() || {};
    if (ADMIN_STATE.activeTab === "students") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("orders"), "value", (snap) => {
    ADMIN_STATE.orders = snap.val() || {};
    const flat = getAllOrdersFlat();
    const pendingCnt = flat.filter((o) => o.status === "PENDING_VERIFICATION").length;

    if (ADMIN_STATE.knownPendingCount !== -1 && pendingCnt > ADMIN_STATE.knownPendingCount) {
      triggerAlertFeedback();
      showToast("💰 नया UPI पेमेंट अप्रूवल के लिए आया है!", "WARNING");
    }
    ADMIN_STATE.knownPendingCount = pendingCnt;

    updateAdminKPIStats();
    if (ADMIN_STATE.activeTab === "payments" || ADMIN_STATE.activeTab === "books") {
      renderAdminWorkspace();
    }
  });

  trackRealtimeRef(db.ref("batches"), "value", (snap) => {
    ADMIN_STATE.batches = snap.val() || {};
    APP_STATE.batches = ADMIN_STATE.batches;
    updateAdminKPIStats();
    if (ADMIN_STATE.activeTab === "batches" || ADMIN_STATE.activeTab === "tests" || ADMIN_STATE.activeTab === "marketing") {
      renderAdminWorkspace();
    }
  });

  trackRealtimeRef(db.ref("books"), "value", (snap) => {
    ADMIN_STATE.books = snap.val() || {};
    APP_STATE.books = ADMIN_STATE.books;
    updateAdminKPIStats();
    if (ADMIN_STATE.activeTab === "books") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("tests"), "value", (snap) => {
    ADMIN_STATE.tests = snap.val() || {};
    APP_STATE.tests = ADMIN_STATE.tests;
    if (ADMIN_STATE.activeTab === "tests") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("testAttempts"), "value", (snap) => {
    ADMIN_STATE.testAttempts = snap.val() || {};
    if (ADMIN_STATE.activeTab === "tests") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("doubts"), "value", (snap) => {
    ADMIN_STATE.doubts = snap.val() || {};
    if (ADMIN_STATE.activeTab === "doubts") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("coupons"), "value", (snap) => {
    ADMIN_STATE.coupons = snap.val() || {};
    if (ADMIN_STATE.activeTab === "marketing") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("fcmTokens"), "value", (snap) => {
    ADMIN_STATE.fcmTokens = snap.val() || {};
    if (ADMIN_STATE.activeTab === "marketing") renderAdminWorkspace();
  });

  trackRealtimeRef(db.ref("securityLogs").limitToLast(60), "value", (snap) => {
    ADMIN_STATE.securityLogs = snap.val() || {};
    if (ADMIN_STATE.activeTab === "settings") renderAdminWorkspace();
  });

  switchAdminTab("payments");
  adminCheckEmailQuotaUI(true);
}

function getAllOrdersFlat() {
  const list = [];
  Object.entries(ADMIN_STATE.orders || {}).forEach(([uid, userOrders]) => {
    if (!userOrders) return;
    Object.values(userOrders).forEach((ord) => {
      if (ord && ord.orderId) list.push({ ...ord, uid: ord.uid || uid });
    });
  });
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function getAllDoubtsFlat() {
  const list = [];
  Object.entries(ADMIN_STATE.doubts || {}).forEach(([uid, userDoubts]) => {
    if (!userDoubts) return;
    Object.values(userDoubts).forEach((d) => {
      if (d && d.doubtId) list.push({ ...d, uid: d.uid || uid });
    });
  });
  return list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function updateAdminKPIStats() {
  const orders = getAllOrdersFlat();
  const approvedRev = orders
    .filter((o) => o.status === "APPROVED")
    .reduce((sum, o) => sum + (Number(o.finalAmount) || 0), 0);
  const pendingPay = orders.filter((o) => o.status === "PENDING_VERIFICATION").length;
  const studentCnt = Object.keys(ADMIN_STATE.users || {}).length;
  const batchCnt = Object.keys(ADMIN_STATE.batches || {}).length;
  const bookCnt = Object.keys(ADMIN_STATE.books || {}).length;

  const rEl = document.getElementById("statAdminRevenue");
  const sEl = document.getElementById("statAdminStudents");
  const pEl = document.getElementById("statAdminPendingPay");
  const cEl = document.getElementById("statAdminCatalog");

  if (rEl) rEl.textContent = formatCurrency(approvedRev);
  if (sEl) sEl.textContent = studentCnt;
  if (pEl) pEl.textContent = pendingPay;
  if (cEl) cEl.textContent = `${batchCnt} / ${bookCnt}`;
}

async function adminCheckEmailQuotaUI(silent = false) {
  const lbl = document.getElementById("adminEmailQuotaLabel");
  if (lbl) lbl.textContent = "Checking...";
  const res = await checkAllEmailServersQuota();
  if (lbl) lbl.textContent = `Quota: ${res.totalQuota}/200`;

  if (!silent) {
    const lines = res.servers.map((s, i) => `${i + 1}. ${s.name}: ${s.quotaLeft} ईमेल शेष (${s.status})`).join("\n");
    await showAppAlert(`आज का कुल बचा हुआ ईमेल कोटा: ${res.totalQuota}\n\n${lines}`, "Email OTP & Receipt Pool Status", "INFO");
  }
}

function switchAdminTab(tabName) {
  ADMIN_STATE.activeTab = tabName;
  document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active-admin-tab"));
  const activeBtn = document.getElementById(`admTabBtn_${tabName}`);
  if (activeBtn) activeBtn.classList.add("active-admin-tab");
  renderAdminWorkspace();
}

function renderAdminWorkspace() {
  const container = document.getElementById("adminWorkspaceContainer");
  if (!container) return;

  switch (ADMIN_STATE.activeTab) {
    case "payments": return renderAdminPaymentsTab(container);
    case "batches": return renderAdminBatchesTab(container);
    case "tests": return renderAdminTestsTab(container);
    case "books": return renderAdminBooksTab(container);
    case "students": return renderAdminStudentsTab(container);
    case "doubts": return renderAdminDoubtsTab(container);
    case "marketing": return renderAdminMarketingTab(container);
    case "settings": return renderAdminSettingsTab(container);
  }
}

// =========================================================
// TAB 1: PAYMENTS VERIFICATION & 1-CLICK APPROVAL DESK
// =========================================================
function renderAdminPaymentsTab(container) {
  const all = getAllOrdersFlat();
  const counts = {
    PENDING_VERIFICATION: all.filter((o) => o.status === "PENDING_VERIFICATION").length,
    APPROVED: all.filter((o) => o.status === "APPROVED").length,
    UTR_CORRECTION_REQUIRED: all.filter((o) => o.status === "UTR_CORRECTION_REQUIRED").length,
    REJECTED: all.filter((o) => o.status === "REJECTED").length,
    ALL: all.length
  };

  const filtered = ADMIN_STATE.paymentFilter === "ALL"
    ? all
    : all.filter((o) => o.status === ADMIN_STATE.paymentFilter);

  container.innerHTML = `
    <div class="ed-card p-4 rounded-2xl space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm sm:text-base font-extrabold"><i class="fa-solid fa-indian-rupee-sign text-emerald-600 mr-1.5"></i> UPI पेमेंट वेरिफिकेशन डेस्क (1-Click Approve)</h2>
        <div class="flex flex-wrap gap-1.5 text-[11px] font-extrabold">
          ${[
            ["PENDING_VERIFICATION", `⏳ Pending (${counts.PENDING_VERIFICATION})`],
            ["APPROVED", `✅ Approved (${counts.APPROVED})`],
            ["UTR_CORRECTION_REQUIRED", `⚠️ UTR Fix (${counts.UTR_CORRECTION_REQUIRED})`],
            ["REJECTED", `❌ Rejected (${counts.REJECTED})`],
            ["ALL", `All (${counts.ALL})`]
          ].map(([key, lbl]) => `
            <button type="button" onclick="ADMIN_STATE.paymentFilter='${key}'; renderAdminWorkspace();" class="px-3 py-1.5 rounded-xl ${ADMIN_STATE.paymentFilter === key ? "bg-indigo-600 text-white shadow" : "bg-slate-100 text-slate-700"}">${lbl}</button>
          `).join("")}
        </div>
      </div>

      <div class="space-y-3">
        ${filtered.length ? filtered.map((o) => `
          <div class="p-4 rounded-2xl border ${o.status === "PENDING_VERIFICATION" ? "border-amber-400 bg-amber-50/40" : "border-slate-200 bg-slate-50"} space-y-2.5 text-xs">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-mono font-black text-indigo-700">${escapeHtml(o.orderId)}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${o.orderType === "BOOK" ? "bg-amber-200 text-amber-950" : "bg-indigo-100 text-indigo-800"}">${o.orderType}</span>
                <span class="text-[10px] text-slate-500">${formatDateTime(o.createdAt)}</span>
              </div>
              <span class="text-base font-black text-emerald-700">${formatCurrency(o.finalAmount)}</span>
            </div>

            <div class="grid sm:grid-cols-2 gap-2 bg-white p-3 rounded-xl border">
              <div>
                <div class="font-extrabold text-slate-900">${escapeHtml(o.title)}</div>
                <div class="text-[11px] text-slate-600 mt-0.5">छात्र: <strong>${escapeHtml(o.studentName)}</strong> (${escapeHtml(o.studentPhone || "-")})</div>
                <div class="text-[11px] text-slate-500">${escapeHtml(o.studentEmail || "")}</div>
              </div>
              <div class="space-y-0.5">
                <div class="text-[11px]">UTR / Ref No: <strong class="font-mono text-sm text-rose-700 bg-rose-50 px-2 py-0.5 rounded">${escapeHtml(o.utrNumber || "-")}</strong></div>
                <div class="text-[11px] text-slate-600">Paid To UPI: <strong>${escapeHtml(o.paidToUpi || "-")}</strong></div>
                <div class="text-[11px] font-bold">Status: <span class="text-indigo-700">${escapeHtml(o.status)}</span></div>
              </div>
            </div>

            ${o.proofBase64 ? `
              <div>
                <button type="button" onclick="adminPreviewOrderProof('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="bg-slate-800 text-amber-300 font-bold px-3 py-1.5 rounded-xl text-[11px]">
                  <i class="fa-solid fa-image mr-1"></i> पेमेंट स्क्रीनशॉट देखें
                </button>
              </div>
            ` : ""}

            <div class="flex flex-wrap gap-2 pt-1">
              ${o.status !== "APPROVED" ? `
                <button type="button" onclick="adminApproveOrder('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="emerald-gradient text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow">
                  <i class="fa-solid fa-circle-check mr-1"></i> 1-Click Approve & Activate
                </button>
                <button type="button" onclick="adminRequestUtrFix('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="bg-amber-500 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs">
                  <i class="fa-solid fa-pen mr-1"></i> UTR सुधार मांगें
                </button>
                <button type="button" onclick="adminRejectOrder('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="bg-rose-600 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs">
                  <i class="fa-solid fa-xmark mr-1"></i> Reject
                </button>
              ` : ""}
              <button type="button" onclick="adminDownloadOrderReceipt('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="bg-slate-900 text-amber-300 font-bold px-3.5 py-2 rounded-xl text-xs">
                <i class="fa-solid fa-file-pdf mr-1"></i> Receipt PDF
              </button>
              <a href="${buildWhatsAppHelpLink(`Namaste ${o.studentName}, aapke GURUKUL ONLINE APP order ${o.orderId} (${o.title}) ke sambandh me:`)}" target="_blank" class="bg-emerald-100 text-emerald-800 font-extrabold px-3 py-2 rounded-xl text-xs">
                <i class="fa-brands fa-whatsapp mr-1"></i> Student WhatsApp
              </a>
            </div>
          </div>
        `).join("") : `<div class="p-8 text-center text-xs font-bold text-slate-400">इस कैटेगरी में कोई पेमेंट ऑर्डर नहीं है।</div>`}
      </div>
    </div>
  `;
}

function adminPreviewOrderProof(uid, orderId) {
  const ord = ADMIN_STATE.orders[uid] && ADMIN_STATE.orders[uid][orderId];
  if (ord && ord.proofBase64) previewDoubtFullImage(ord.proofBase64);
}

function adminDownloadOrderReceipt(uid, orderId) {
  const ord = ADMIN_STATE.orders[uid] && ADMIN_STATE.orders[uid][orderId];
  if (ord) window.generateOrderReceiptPDF(orderId, ord);
}

async function adminApproveOrder(uid, orderId) {
  const ord = ADMIN_STATE.orders[uid] && ADMIN_STATE.orders[uid][orderId];
  if (!ord) return;

  const ok = await showAppConfirm(
    `क्या आपने बैंक/UPI में ${formatCurrency(ord.finalAmount)} (UTR: ${ord.utrNumber}) मिला लिया है?\n\nApprove करते ही छात्र (${ord.studentName}) का ${ord.orderType === "BOOK" ? "बुक ऑर्डर कन्फर्म" : "कोर्स तुरंत चालू"} हो जाएगा और उसे ईमेल व नोटिफिकेशन मिल जाएगा।`,
    "पेमेंट अप्रूवल पुष्टि"
  );
  if (!ok) return;

  try {
    const updates = {};
    updates[`orders/${uid}/${orderId}/status`] = "APPROVED";
    updates[`orders/${uid}/${orderId}/approvedAt`] = Date.now();
    updates[`orders/${uid}/${orderId}/updatedAt`] = Date.now();
    updates[`orders/${uid}/${orderId}/adminNote`] = "पेमेंट सफलतापूर्वक वेरीफाई हो गया है। धन्यवाद!";

    if (ord.orderType === "COURSE" && ord.itemId) {
      const days = Number(ord.validityDays) || 365;
      updates[`enrollments/${uid}/${ord.itemId}`] = {
        batchId: ord.itemId,
        batchTitle: ord.title,
        active: true,
        isFreeEnroll: false,
        orderId: ord.orderId,
        enrolledAt: Date.now(),
        expiresAt: Date.now() + days * 86400000
      };
    } else if (ord.orderType === "BOOK") {
      updates[`orders/${uid}/${orderId}/shippingStatus`] = "PLACED";
      if (Array.isArray(ord.items)) {
        ord.items.forEach((it) => {
          const bk = ADMIN_STATE.books[it.bookId];
          if (bk) {
            const nextStock = Math.max(0, (Number(bk.stock) || 0) - (Number(it.qty) || 1));
            updates[`books/${it.bookId}/stock`] = nextStock;
          }
        });
      }
    }

    const notifId = `NTF_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    updates[`notifications/${notifId}`] = {
      id: notifId,
      targetType: "USER",
      targetValue: uid,
      title: ord.orderType === "BOOK" ? "🎉 बुक ऑर्डर कन्फर्म हो गया!" : "🎉 आपका कोर्स एक्टिवेट हो गया है!",
      message: `${ord.title} (${formatCurrency(ord.finalAmount)}) का पेमेंट अप्रूव हो गया है। ${ord.orderType === "BOOK" ? "आपका पार्सल जल्द पैक होकर डिस्पैच किया जाएगा।" : "My Study टैब में जाकर पढ़ाई शुरू करें!"}`,
      createdAt: Date.now()
    };

    await db.ref().update(updates);
    showToast("पेमेंट अप्रूव और एक्टिवेट हो गया!", "SUCCESS");

    if (ord.studentEmail) {
      sendAppEmail({
        to: ord.studentEmail,
        type: "RECEIPT",
        subject: `✅ पेमेंट अप्रूव्ड: ${ord.title} (${ord.orderId})`,
        htmlBody: buildOfficialEmailHTML({
          heading: ord.orderType === "BOOK" ? "आपका बुक ऑर्डर कन्फर्म हो गया है!" : "आपका ऑनलाइन कोर्स चालू हो गया है! 🎉",
          userName: ord.studentName,
          bodyHtml: `
            <p>बधाई हो! आपका <strong>${formatCurrency(ord.finalAmount)}</strong> का पेमेंट (UTR: <strong>${escapeHtml(ord.utrNumber)}</strong>) वेरीफाई कर लिया गया है।</p>
            <p><strong>विवरण:</strong> ${escapeHtml(ord.title)}<br/><strong>Order ID:</strong> ${escapeHtml(ord.orderId)}</p>
            <p>अब आप ऐप में लॉगिन करके अपनी ऑफिशियल रसीद/इनवॉइस डाउनलोड कर सकते हैं।</p>
          `
        })
      }).catch(() => {});
    }
  } catch (err) {
    await showAppAlert("अप्रूव करने में त्रुटि: " + err.message, "Error", "DANGER");
  }
}

async function adminRequestUtrFix(uid, orderId) {
  const ord = ADMIN_STATE.orders[uid] && ADMIN_STATE.orders[uid][orderId];
  if (!ord) return;
  const reason = await showAppPrompt(
    "छात्र के लिए कारण लिखें (ताकि वह बिना घबराए सही 12-अंकों का UTR दोबारा डाल सके):",
    "दर्ज किया गया UTR नंबर हमारे बैंक स्टेटमेंट से मैच नहीं हुआ। कृपया सही 12-अंकों का UTR दोबारा सबमिट करें।",
    "UTR सुधार अनुरोध"
  );
  if (!reason) return;

  const notifId = `NTF_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  await db.ref().update({
    [`orders/${uid}/${orderId}/status`]: "UTR_CORRECTION_REQUIRED",
    [`orders/${uid}/${orderId}/adminNote`]: reason,
    [`orders/${uid}/${orderId}/updatedAt`]: Date.now(),
    [`notifications/${notifId}`]: {
      id: notifId,
      targetType: "USER",
      targetValue: uid,
      title: "⚠️ UTR नंबर सुधारें (घबराएं नहीं)",
      message: `Order ${orderId}: ${reason}`,
      createdAt: Date.now()
    }
  });
  showToast("छात्र को UTR सुधारने का अनुरोध भेज दिया गया।", "WARNING");
}

async function adminRejectOrder(uid, orderId) {
  const reason = await showAppPrompt("अस्वीकृत (Reject) करने का स्पष्ट कारण लिखें:", "पेमेंट प्राप्त नहीं हुआ / अमान्य UTR।", "ऑर्डर Reject करें");
  if (!reason) return;

  const notifId = `NTF_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  await db.ref().update({
    [`orders/${uid}/${orderId}/status`]: "REJECTED",
    [`orders/${uid}/${orderId}/adminNote`]: reason,
    [`orders/${uid}/${orderId}/updatedAt`]: Date.now(),
    [`notifications/${notifId}`]: {
      id: notifId,
      targetType: "USER",
      targetValue: uid,
      title: "❌ पेमेंट ऑर्डर अस्वीकृत",
      message: `Order ${orderId} अस्वीकृत किया गया। कारण: ${reason}। सहायता हेतु हेल्पलाइन पर संपर्क करें।`,
      createdAt: Date.now()
    }
  });
  showToast("ऑर्डर Reject कर दिया गया।", "INFO");
}

// =========================================================
// TAB 2: BATCH BUILDER, CONTENT UPLOADER & LIVE SCHEDULER
// =========================================================
function renderAdminBatchesTab(container) {
  const batches = Object.values(ADMIN_STATE.batches || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const editB = ADMIN_STATE.editingBatchId ? ADMIN_STATE.batches[ADMIN_STATE.editingBatchId] : null;
  const selBatchId = ADMIN_STATE.selectedBatchForContent || (batches[0] ? batches[0].batchId : "");
  if (selBatchId && selBatchId !== ADMIN_STATE.selectedBatchForContent) {
    ADMIN_STATE.selectedBatchForContent = selBatchId;
    loadAdminBatchContentItems(selBatchId);
  }

  const contentItems = Object.values(ADMIN_STATE.selectedBatchContentItems || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  container.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4">
      <!-- Create / Edit Batch Form -->
      <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-extrabold text-indigo-800"><i class="fa-solid fa-plus-circle mr-1"></i> ${editB ? "बैच एडिट करें" : "नया ऑनलाइन बैच बनाएं"}</h3>
          ${editB ? `<button type="button" onclick="ADMIN_STATE.editingBatchId=null; renderAdminWorkspace();" class="text-rose-600 font-bold">Cancel Edit</button>` : ""}
        </div>

        <div class="grid sm:grid-cols-2 gap-2.5">
          <input type="text" id="admBatchTitle" value="${escapeHtml(editB?.title || "")}" placeholder="बैच का नाम (जैसे: Class 12 Science Board 2027) *" class="ed-input sm:col-span-2 px-3 py-2 rounded-xl font-bold" />
          <select id="admBatchCategory" class="ed-input px-3 py-2 rounded-xl font-bold">
            ${APP_CONFIG.categories.filter((c) => c !== "All").map((c) => `<option value="${escapeHtml(c)}" ${editB?.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>
          <select id="admBatchIsFree" class="ed-input px-3 py-2 rounded-xl font-bold">
            <option value="false" ${!editB?.isFree ? "selected" : ""}>Paid Batch (सशुल्क)</option>
            <option value="true" ${editB?.isFree ? "selected" : ""}>Free Batch (बिल्कुल फ्री)</option>
          </select>
          <input type="number" id="admBatchMrp" value="${editB?.mrp ?? 999}" placeholder="MRP (₹)" class="ed-input px-3 py-2 rounded-xl font-bold" />
          <input type="number" id="admBatchOffer" value="${editB?.offerPrice ?? 499}" placeholder="Offer Price (₹)" class="ed-input px-3 py-2 rounded-xl font-bold" />
          <input type="number" id="admBatchValidity" value="${editB?.validityDays ?? 365}" placeholder="वैधता (दिनों में)" class="ed-input px-3 py-2 rounded-xl font-bold" />
          <input type="text" id="admBatchMedium" value="${escapeHtml(editB?.medium || "Hindi Medium")}" placeholder="माध्यम (Hindi/English)" class="ed-input px-3 py-2 rounded-xl font-bold" />
        </div>

        <input type="text" id="admBatchThumbUrl" value="${escapeHtml(editB?.thumbnail || "")}" placeholder="बैनर/थंबनेल इमेज लिंक (या नीचे फोटो अपलोड करें)" class="ed-input w-full px-3 py-2 rounded-xl" />
        <input type="file" id="admBatchThumbFile" accept="image/*" class="ed-input w-full px-3 py-1.5 rounded-xl" />
        <input type="text" id="admBatchDemoUrl" value="${escapeHtml(editB?.demoVideoUrl || "")}" placeholder="फ्री डेमो वीडियो YouTube Unlisted लिंक (वैकल्पिक)" class="ed-input w-full px-3 py-2 rounded-xl" />
        <textarea id="admBatchDesc" rows="2" placeholder="बैच का संक्षिप्त विवरण..." class="ed-input w-full px-3 py-2 rounded-xl">${escapeHtml(editB?.description || "")}</textarea>
        <textarea id="admBatchFeatures" rows="2" placeholder="विशेषताएं (हर लाइन में 1 पॉइंट)..." class="ed-input w-full px-3 py-2 rounded-xl">${escapeHtml(editB?.features || "Live & Recorded HD Classes\nProtected PDF Notes & eBooks\nChapter-wise DPP Homework\nOnline CBT Test Series")}</textarea>

        <button type="button" onclick="adminSaveBatch()" class="w-full brand-gradient text-white font-extrabold py-3 rounded-xl text-xs shadow-lg">
          <i class="fa-solid fa-floppy-disk mr-1"></i> ${editB ? "बैच अपडेट करें" : "नया बैच सेव और लाइव करें"}
        </button>
      </div>

      <!-- Existing Batches List -->
      <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
        <h3 class="text-sm font-extrabold">सभी ऑनलाइन बैचेस (${batches.length})</h3>
        <div class="space-y-2.5 max-h-[460px] overflow-y-auto custom-scroll pr-1">
          ${batches.length ? batches.map((b) => `
            <div class="p-3 rounded-xl bg-slate-50 border flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${b.isFree ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}">${b.isFree ? "FREE" : formatCurrency(b.offerPrice)}</span>
                  <span class="text-[10px] text-slate-500">${escapeHtml(b.category)}</span>
                </div>
                <div class="font-extrabold text-slate-900 truncate mt-0.5">${escapeHtml(b.title)}</div>
              </div>
              <div class="flex gap-1 shrink-0">
                <button type="button" onclick="adminSelectBatchForContent('${escapeHtml(b.batchId)}')" class="bg-indigo-600 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px]">कंटेंट</button>
                <button type="button" onclick="ADMIN_STATE.editingBatchId='${escapeHtml(b.batchId)}'; renderAdminWorkspace();" class="bg-amber-100 text-amber-900 font-bold px-2.5 py-1.5 rounded-lg text-[10px]">Edit</button>
                <button type="button" onclick="adminDeleteBatch('${escapeHtml(b.batchId)}')" class="bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-lg text-[10px]"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join("") : `<p class="text-center text-slate-400 py-8">अभी कोई बैच नहीं बना है।</p>`}
        </div>
      </div>
    </div>

    <!-- Batch Content Uploader (Live/Recorded Videos + Live Scheduler, Notes, eBooks, DPP) -->
    <div class="ed-card p-4 rounded-2xl space-y-4 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold text-emerald-800"><i class="fa-solid fa-video mr-1.5"></i> बैच कंटेंट अपलोडर व Live Class Scheduler</h3>
        <select onchange="adminSelectBatchForContent(this.value)" class="ed-input px-3 py-2 rounded-xl font-extrabold min-w-[220px]">
          <option value="">-- बैच चुनें --</option>
          ${batches.map((b) => `<option value="${escapeHtml(b.batchId)}" ${selBatchId === b.batchId ? "selected" : ""}>${escapeHtml(b.title)}</option>`).join("")}
        </select>
      </div>

      ${selBatchId ? `
        <div class="grid sm:grid-cols-3 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border">
          <select id="admContType" onchange="document.getElementById('admContScheduleWrap').classList.toggle('hidden', this.value !== 'LIVE')" class="ed-input px-3 py-2 rounded-xl font-extrabold bg-white">
            <option value="VIDEO">🎥 Recorded Class (YouTube Unlisted)</option>
            <option value="LIVE">🔴 Live Class (YouTube Live + Schedule)</option>
            <option value="NOTES">📄 Protected Notes PDF</option>
            <option value="EBOOK">📚 Protected eBook PDF</option>
            <option value="DPP">📝 DPP / Homework PDF</option>
          </select>
          <input type="text" id="admContSubject" placeholder="विषय (जैसे: Physics / Maths / GK) *" class="ed-input px-3 py-2 rounded-xl font-bold bg-white" />
          <input type="text" id="admContChapter" placeholder="अध्याय (जैसे: Chapter 1 - Optics) *" class="ed-input px-3 py-2 rounded-xl font-bold bg-white" />
          <input type="text" id="admContTitle" placeholder="लेक्चर / नोट्स का शीर्षक *" class="ed-input sm:col-span-3 px-3 py-2 rounded-xl font-bold bg-white" />

          <!-- Built-in Live Class Schedule Date & Time -->
          <div id="admContScheduleWrap" class="sm:col-span-3 hidden bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex flex-wrap items-center gap-2">
            <label for="admContScheduleTime" class="text-[11px] font-extrabold text-rose-800"><i class="fa-regular fa-clock mr-1"></i> Live Class Schedule (दिनांक व समय):</label>
            <input type="datetime-local" id="admContScheduleTime" class="ed-input px-3 py-1.5 rounded-lg bg-white font-bold text-xs" />
            <span class="text-[10px] text-slate-500 font-semibold">(खाली छोड़ने पर क्लास तुरंत लाइव दिखेगी)</span>
          </div>

          <input type="text" id="admContUrl" placeholder="YouTube Unlisted/Live लिंक या Google Drive/Direct PDF लिंक *" class="ed-input sm:col-span-2 px-3 py-2 rounded-xl bg-white" />
          <input type="text" id="admContDppUrl" placeholder="अटैच्ड DPP PDF लिंक (वैकल्पिक)" class="ed-input px-3 py-2 rounded-xl bg-white" />
          <button type="button" onclick="adminAddBatchContentItem()" class="sm:col-span-3 emerald-gradient text-white font-extrabold py-2.5 rounded-xl text-xs shadow">
            <i class="fa-solid fa-cloud-arrow-up mr-1"></i> कंटेंट सुरक्षित अपलोड / शेड्यूल करें
          </button>
        </div>

        <div class="space-y-2 max-h-[380px] overflow-y-auto custom-scroll">
          ${contentItems.length ? contentItems.map((it) => `
            <div class="p-3 rounded-xl border bg-white flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <span class="px-2 py-0.5 rounded ${it.type === "LIVE" ? "bg-rose-100 text-rose-800" : "bg-indigo-100 text-indigo-800"} font-black text-[9px]">${escapeHtml(it.type)}</span>
                <span class="text-[10px] font-bold text-slate-500 ml-1">${escapeHtml(it.subject)} → ${escapeHtml(it.chapter)}</span>
                <div class="font-extrabold text-slate-900 mt-0.5">${escapeHtml(it.title)}</div>
                ${it.scheduledAt ? `<div class="text-[10px] font-extrabold text-rose-700 mt-0.5"><i class="fa-regular fa-clock mr-1"></i>Scheduled: ${formatDateTime(it.scheduledAt)}</div>` : ""}
              </div>
              <div class="flex gap-1.5">
                ${(it.type === "LIVE" || it.type === "VIDEO")
                  ? `<button type="button" onclick="openProtectedVideoPlayer({lectureId:'${escapeHtml(it.itemId)}',title:'${escapeHtml(it.title)}',videoUrl:'${escapeHtml(it.url)}'})" class="bg-slate-900 text-amber-300 font-bold px-2.5 py-1.5 rounded-lg text-[10px]">Preview</button>`
                  : `<button type="button" onclick="openProtectedPdfViewer('${escapeHtml(it.url)}','${escapeHtml(it.title)}')" class="bg-slate-900 text-amber-300 font-bold px-2.5 py-1.5 rounded-lg text-[10px]">Preview</button>`
                }
                <button type="button" onclick="adminDeleteBatchContentItem('${escapeHtml(it.itemId)}')" class="bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-lg text-[10px]"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join("") : `<p class="text-center text-slate-400 py-5">इस बैच में अभी कोई क्लास या PDF नहीं जोड़ी गई है।</p>`}
        </div>
      ` : `<p class="text-slate-400 font-bold">कंटेंट जोड़ने के लिए पहले ऊपर कोई बैच बनाएं या चुनें।</p>`}
    </div>
  `;
}

async function adminSaveBatch() {
  const title = document.getElementById("admBatchTitle").value.trim();
  if (!title) return showAppAlert("कृपया बैच का नाम दर्ज करें।", "अधूरी जानकारी", "DANGER");

  const isFree = document.getElementById("admBatchIsFree").value === "true";
  let thumbnail = document.getElementById("admBatchThumbUrl").value.trim();
  const fileEl = document.getElementById("admBatchThumbFile");
  if (fileEl && fileEl.files && fileEl.files[0]) {
    thumbnail = await compressImageToBase64(fileEl.files[0], 720, 0.75);
  }

  const batchId = ADMIN_STATE.editingBatchId || `BCH_${Date.now()}`;
  const prev = ADMIN_STATE.batches[batchId] || {};
  const batchObj = {
    batchId,
    title,
    category: document.getElementById("admBatchCategory").value,
    isFree,
    mrp: isFree ? 0 : (Number(document.getElementById("admBatchMrp").value) || 0),
    offerPrice: isFree ? 0 : (Number(document.getElementById("admBatchOffer").value) || 0),
    validityDays: Number(document.getElementById("admBatchValidity").value) || 365,
    medium: document.getElementById("admBatchMedium").value.trim() || "Hindi Medium",
    thumbnail,
    demoVideoUrl: document.getElementById("admBatchDemoUrl").value.trim(),
    description: document.getElementById("admBatchDesc").value.trim(),
    features: document.getElementById("admBatchFeatures").value.trim(),
    status: "ACTIVE",
    createdAt: prev.createdAt || Date.now(),
    updatedAt: Date.now()
  };

  await db.ref(`batches/${batchId}`).set(batchObj);
  ADMIN_STATE.editingBatchId = null;
  ADMIN_STATE.selectedBatchForContent = batchId;
  showToast("बैच सफलतापूर्वक सेव हो गया!", "SUCCESS");
  renderAdminWorkspace();
}

async function adminDeleteBatch(batchId) {
  const ok = await showAppConfirm("क्या आप इस बैच और इसके अंदर के सभी वीडियो/नोट्स को स्थायी रूप से हटाना चाहते हैं?", "बैच हटाएं");
  if (!ok) return;
  await db.ref(`batches/${batchId}`).remove();
  await db.ref(`paidContent/${batchId}`).remove();
  if (ADMIN_STATE.selectedBatchForContent === batchId) ADMIN_STATE.selectedBatchForContent = "";
  showToast("बैच हटा दिया गया।", "INFO");
}

function adminSelectBatchForContent(batchId) {
  ADMIN_STATE.selectedBatchForContent = batchId;
  loadAdminBatchContentItems(batchId);
}

async function loadAdminBatchContentItems(batchId) {
  if (!batchId) {
    ADMIN_STATE.selectedBatchContentItems = {};
    return renderAdminWorkspace();
  }
  const snap = await db.ref(`paidContent/${batchId}/items`).once("value");
  ADMIN_STATE.selectedBatchContentItems = snap.val() || {};
  if (ADMIN_STATE.activeTab === "batches") renderAdminWorkspace();
}

async function adminAddBatchContentItem() {
  const bId = ADMIN_STATE.selectedBatchForContent;
  if (!bId) return;

  const type = document.getElementById("admContType").value;
  const subject = document.getElementById("admContSubject").value.trim() || "General";
  const chapter = document.getElementById("admContChapter").value.trim() || "Chapter 1";
  const title = document.getElementById("admContTitle").value.trim();
  const url = document.getElementById("admContUrl").value.trim();
  const dppPdfUrl = document.getElementById("admContDppUrl").value.trim();
  const schedRaw = document.getElementById("admContScheduleTime")?.value || "";
  const scheduledAt = type === "LIVE" && schedRaw ? new Date(schedRaw).getTime() : null;

  if (!title || !url) {
    return showAppAlert("कृपया शीर्षक (Title) और वीडियो/PDF लिंक दोनों दर्ज करें।", "अधूरी जानकारी", "DANGER");
  }

  const itemId = `CNT_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const obj = { itemId, type, subject, chapter, title, url, dppPdfUrl, scheduledAt, createdAt: Date.now() };
  await db.ref(`paidContent/${bId}/items/${itemId}`).set(obj);
  ADMIN_STATE.selectedBatchContentItems[itemId] = obj;
  showToast(scheduledAt ? "Live Class सफलतापूर्वक शेड्यूल हो गई!" : "कंटेंट बैच में जुड़ गया!", "SUCCESS");
  renderAdminWorkspace();
}

async function adminDeleteBatchContentItem(itemId) {
  const bId = ADMIN_STATE.selectedBatchForContent;
  if (!bId) return;
  await db.ref(`paidContent/${bId}/items/${itemId}`).remove();
  delete ADMIN_STATE.selectedBatchContentItems[itemId];
  showToast("कंटेंट हटा दिया गया।", "INFO");
  renderAdminWorkspace();
}

// =========================================================
// TAB 3: SMART CBT TEST BUILDER (BULK ||, SECTIONS, SCHEDULER)
// =========================================================
const CBT_DRAFT_STORAGE_KEY = "GURUKUL_ADMIN_CBT_DRAFT_V2";

const CBT_TEST_TYPE_META = {
  TOPIC_WISE: { label: "Topic-Wise Test", badge: "📘 Topic-Wise", cls: "bg-sky-100 text-sky-800" },
  WEEKLY: { label: "Weekly Test", badge: "📅 Weekly Test", cls: "bg-violet-100 text-violet-800" },
  FULL_SYLLABUS: { label: "Complete Syllabus Test", badge: "🎯 Complete Syllabus", cls: "bg-amber-100 text-amber-900" }
};

function normalizeTestType(val) {
  const v = String(val || "").toUpperCase();
  if (v === "TOPIC_WISE" || v === "TOPIC") return "TOPIC_WISE";
  if (v === "WEEKLY") return "WEEKLY";
  return "FULL_SYLLABUS";
}

function toLocalDatetimeInput(ts) {
  const n = Number(ts) || 0;
  if (n <= 0) return "";
  const d = new Date(n);
  if (isNaN(d.getTime())) return "";
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getDefaultTestMeta() {
  const firstCat = (typeof APP_CONFIG !== "undefined" && Array.isArray(APP_CONFIG.categories))
    ? (APP_CONFIG.categories.find((c) => c !== "All") || "All")
    : "";
  return {
    editingTestId: null,
    title: "",
    testType: "TOPIC_WISE",
    scheduledAt: 0,
    batchId: "",
    category: firstCat,
    duration: 30,
    plusMark: 4,
    minusMark: 1
  };
}

function loadCbtDraftLocal() {
  try {
    const raw = localStorage.getItem(CBT_DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      ADMIN_STATE.draftTestMeta = { ...getDefaultTestMeta(), ...(parsed.meta || {}) };
      ADMIN_STATE.draftTestMeta.testType = normalizeTestType(ADMIN_STATE.draftTestMeta.testType);
      ADMIN_STATE.draftTestQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
      ADMIN_STATE.bulkRawText = parsed.bulkRawText || "";
      return;
    }
  } catch (e) {}
  ADMIN_STATE.draftTestMeta = getDefaultTestMeta();
  ADMIN_STATE.draftTestQuestions = [];
  ADMIN_STATE.bulkRawText = "";
}

function saveCbtDraftLocal() {
  try {
    localStorage.setItem(CBT_DRAFT_STORAGE_KEY, JSON.stringify({
      meta: ADMIN_STATE.draftTestMeta || getDefaultTestMeta(),
      questions: ADMIN_STATE.draftTestQuestions || [],
      bulkRawText: ADMIN_STATE.bulkRawText || ""
    }));
  } catch (e) {}
}

loadCbtDraftLocal();

function normalizeCorrectOption(ansRaw, opts) {
  const cleaned = String(ansRaw || "").trim();
  if (!cleaned) return "";
  const direct = cleaned.match(/^(?:ans(?:wer)?|option|opt|correct)?\s*[:\-\.\(\[]*\s*([A-D1-4])\s*[\)\.\]]*$/i);
  if (direct) {
    const ch = direct[1].toUpperCase();
    if (ch === "1") return "A";
    if (ch === "2") return "B";
    if (ch === "3") return "C";
    if (ch === "4") return "D";
    return ch;
  }
  const low = cleaned.toLowerCase();
  for (const k of ["A", "B", "C", "D"]) {
    if ((opts[k] || "").trim().toLowerCase() === low) return k;
  }
  return "";
}

function adminParsePipeBulk(rawText, stripNum = true) {
  const valid = [];
  const errors = [];
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return { valid, errors };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed);
      const arr = Array.isArray(json) ? json : (Array.isArray(json.questions) ? json.questions : null);
      if (arr) {
        arr.forEach((item, idx) => {
          const q = String(item.q || item.question || "").trim();
          const A = String(item.A || item.a || item.optA || "").trim();
          const B = String(item.B || item.b || item.optB || "").trim();
          const C = String(item.C || item.c || item.optC || "").trim();
          const D = String(item.D || item.d || item.optD || "").trim();
          const correct = normalizeCorrectOption(item.correct || item.ans || item.answer, { A, B, C, D });
          if (!q || !A || !B || !C || !D || !correct) {
            errors.push({ lineNo: idx + 1, reason: "JSON item mein question, A-D ya sahi answer missing hai" });
          } else {
            valid.push({
              q, A, B, C, D, correct,
              explanation: String(item.explanation || item.solution || item.exp || "").trim(),
              imageUrl: String(item.imageUrl || item.image || "").trim()
            });
          }
        });
        return { valid, errors };
      }
    } catch (e) {}
  }

  const lines = trimmed.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();
    if (!line) return;

    const parts = line.split("||").map((p) => p.trim());
    if (parts.length < 6) {
      errors.push({ lineNo, reason: `Sirf ${parts.length} parts mile (kam se kam 6 chahiye: Q || A || B || C || D || Ans)` });
      return;
    }

    let q = parts[0];
    if (stripNum) q = q.replace(/^\s*(?:Q\.?\s*\d+|\d+\s*[\.\)])\s+/i, "").trim();
    const A = parts[1];
    const B = parts[2];
    const C = parts[3];
    const D = parts[4];
    const correct = normalizeCorrectOption(parts[5], { A, B, C, D });
    let explanation = parts[6] || "";
    let imageUrl = parts[7] || "";

    if (!imageUrl && /^(https?:\/\/|data:image\/)/i.test(explanation)) {
      imageUrl = explanation;
      explanation = "";
    }

    if (!q || !A || !B || !C || !D) {
      errors.push({ lineNo, reason: "Question ya kisi option (A/B/C/D) ka text khali hai" });
      return;
    }
    if (!correct) {
      errors.push({ lineNo, reason: `Invalid answer "${parts[5]}" (sirf A, B, C, D ya 1-4 likhein)` });
      return;
    }

    valid.push({ q, A, B, C, D, correct, explanation, imageUrl });
  });

  return { valid, errors };
}

function adminSyncTestMeta() {
  const m = ADMIN_STATE.draftTestMeta || getDefaultTestMeta();
  const tEl = document.getElementById("admTestTitle");
  const typeEl = document.getElementById("admTestType");
  const schedEl = document.getElementById("admTestSchedule");
  const bEl = document.getElementById("admTestBatch");
  const cEl = document.getElementById("admTestCategory");
  const dEl = document.getElementById("admTestDuration");
  const pEl = document.getElementById("admTestPlus");
  const nEl = document.getElementById("admTestMinus");

  if (tEl) m.title = tEl.value;
  if (typeEl) m.testType = normalizeTestType(typeEl.value);
  if (schedEl) {
    const ms = schedEl.value ? new Date(schedEl.value).getTime() : 0;
    m.scheduledAt = (!isNaN(ms) && ms > 0) ? ms : 0;
  }
  if (bEl) m.batchId = bEl.value;
  if (cEl) m.category = cEl.value;
  if (dEl) m.duration = dEl.value === "" ? "" : Number(dEl.value);
  if (pEl) m.plusMark = pEl.value === "" ? "" : Number(pEl.value);
  if (nEl) m.minusMark = nEl.value === "" ? "" : Number(nEl.value);

  ADMIN_STATE.draftTestMeta = m;
  saveCbtDraftLocal();
}

function adminClearTestSchedule() {
  const schedEl = document.getElementById("admTestSchedule");
  if (schedEl) schedEl.value = "";
  if (ADMIN_STATE.draftTestMeta) {
    ADMIN_STATE.draftTestMeta.scheduledAt = 0;
    saveCbtDraftLocal();
  }
  showToast("Schedule हटा दिया गया — अब टेस्ट तुरंत Live होगा।", "INFO");
}

function updateBulkLiveStatus() {
  const box = document.getElementById("admBulkStatusBox");
  if (!box) return;
  const { valid, errors } = adminParsePipeBulk(ADMIN_STATE.bulkRawText, ADMIN_STATE.bulkStripNumbering);
  if (!valid.length && !errors.length) {
    box.innerHTML = `<span class="text-slate-500">Format: <code>Question || A || B || C || D || Ans || Explanation || ImageURL</code></span>`;
    return;
  }
  const errHtml = errors.length
    ? `<div class="mt-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 max-h-24 overflow-y-auto space-y-0.5 text-[10px]">
         ${errors.map((e) => `<div><strong>Line ${e.lineNo}:</strong> ${escapeHtml(e.reason)}</div>`).join("")}
       </div>`
    : "";
  box.innerHTML = `
    <div class="flex flex-wrap items-center gap-2 font-extrabold text-[11px]">
      <span class="text-emerald-700">✅ Valid: ${valid.length} sawal</span>
      ${errors.length ? `<span class="text-rose-600">⚠️ Errors: ${errors.length} line</span>` : `<span class="text-indigo-600">Sabhi lines sahi hain!</span>`}
    </div>
    ${errHtml}
  `;
}

function adminOnBulkTextInput(val) {
  ADMIN_STATE.bulkRawText = val;
  saveCbtDraftLocal();
  updateBulkLiveStatus();
}

function adminInsertPipeSample() {
  const sample = [
    "राजस्थान की राजधानी कौन सी है? || जोधपुर || जयपुर || उदयपुर || अजमेर || B || जयपुर को पिंक सिटी भी कहते हैं।",
    "भारत के संविधान को कब अंगीकृत किया गया? || 15 अगस्त 1947 || 26 जनवरी 1950 || 26 नवम्बर 1949 || 2 अक्टूबर 1948 || C || 26 नवम्बर 1949 को संविधान सभा द्वारा अपनाया गया।",
    "सूर्य के सबसे निकट ग्रह कौन सा है? || शुक्र || बुध || मंगल || पृथ्वी || B"
  ].join("\n");
  const ta = document.getElementById("admBulkTextarea");
  if (ta) {
    ta.value = ta.value.trim() ? (ta.value.trim() + "\n" + sample) : sample;
    adminOnBulkTextInput(ta.value);
  }
}

function adminHandleBulkFileUpload(inputEl) {
  const file = inputEl && inputEl.files && inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (ev) {
    const content = String(ev.target.result || "");
    const ta = document.getElementById("admBulkTextarea");
    if (ta) ta.value = content;
    adminOnBulkTextInput(content);
    showToast(`"${file.name}" लोड हो गई! अब नीचे Import बटन दबाएं।`, "SUCCESS");
  };
  reader.readAsText(file, "UTF-8");
  inputEl.value = "";
}

function adminImportBulkQuestions() {
  adminSyncTestMeta();
  const { valid, errors } = adminParsePipeBulk(ADMIN_STATE.bulkRawText, ADMIN_STATE.bulkStripNumbering);
  if (!valid.length) {
    return showAppAlert(
      errors.length
        ? `कोई भी सही प्रश्न नहीं मिला।\nपहली त्रुटि (Line ${errors[0].lineNo}): ${errors[0].reason}`
        : "कृपया बॉक्स में || फॉर्मेट में प्रश्न पेस्ट करें।",
      "बल्क इम्पोर्ट त्रुटि",
      "DANGER"
    );
  }
  ADMIN_STATE.draftTestQuestions.push(...valid);
  ADMIN_STATE.bulkRawText = "";
  saveCbtDraftLocal();
  showToast(`${valid.length} प्रश्न लिस्ट में जुड़ गए!${errors.length ? ` (${errors.length} गलत लाइनें छोड़ी गईं)` : ""}`, "SUCCESS");
  renderAdminWorkspace();
}

function adminSwitchTestInputMode(mode) {
  adminSyncTestMeta();
  ADMIN_STATE.testInputMode = mode;
  if (mode === "bulk") ADMIN_STATE.editingQuestionIdx = -1;
  renderAdminWorkspace();
}

async function adminPushDraftQuestion() {
  adminSyncTestMeta();
  const q = (document.getElementById("admQText")?.value || "").trim();
  const A = (document.getElementById("admQA")?.value || "").trim();
  const B = (document.getElementById("admQB")?.value || "").trim();
  const C = (document.getElementById("admQC")?.value || "").trim();
  const D = (document.getElementById("admQD")?.value || "").trim();
  const correct = document.getElementById("admQCorrect")?.value || "A";
  const explanation = (document.getElementById("admQExp")?.value || "").trim();
  let imageUrl = (document.getElementById("admQImgUrl")?.value || "").trim();

  const imgFileEl = document.getElementById("admQImgFile");
  if (imgFileEl && imgFileEl.files && imgFileEl.files[0] && typeof compressImageToBase64 === "function") {
    imageUrl = await compressImageToBase64(imgFileEl.files[0], 720, 0.75);
  }

  if (!q || !A || !B || !C || !D) {
    return showAppAlert("कृपया प्रश्न और चारों विकल्प (A, B, C, D) भरें।", "अधूरा प्रश्न", "DANGER");
  }

  const qObj = { q, A, B, C, D, correct, explanation, imageUrl };
  if (ADMIN_STATE.editingQuestionIdx >= 0 && ADMIN_STATE.draftTestQuestions[ADMIN_STATE.editingQuestionIdx]) {
    ADMIN_STATE.draftTestQuestions[ADMIN_STATE.editingQuestionIdx] = qObj;
    showToast(`प्रश्न #${ADMIN_STATE.editingQuestionIdx + 1} अपडेट हो गया!`, "SUCCESS");
    ADMIN_STATE.editingQuestionIdx = -1;
  } else {
    ADMIN_STATE.draftTestQuestions.push(qObj);
    showToast(`प्रश्न #${ADMIN_STATE.draftTestQuestions.length} जोड़ा गया!`, "SUCCESS");
  }

  saveCbtDraftLocal();
  renderAdminWorkspace();
}

function adminEditDraftQuestion(idx) {
  adminSyncTestMeta();
  if (!ADMIN_STATE.draftTestQuestions[idx]) return;
  ADMIN_STATE.testInputMode = "single";
  ADMIN_STATE.editingQuestionIdx = idx;
  renderAdminWorkspace();
}

function adminMoveDraftQuestion(idx, dir) {
  adminSyncTestMeta();
  const target = idx + dir;
  if (target < 0 || target >= ADMIN_STATE.draftTestQuestions.length) return;
  const arr = ADMIN_STATE.draftTestQuestions;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  saveCbtDraftLocal();
  renderAdminWorkspace();
}

function adminRemoveDraftQuestion(idx) {
  adminSyncTestMeta();
  ADMIN_STATE.draftTestQuestions.splice(idx, 1);
  if (ADMIN_STATE.editingQuestionIdx === idx) ADMIN_STATE.editingQuestionIdx = -1;
  saveCbtDraftLocal();
  renderAdminWorkspace();
}

async function adminClearTestDraft() {
  const ok = await showAppConfirm("क्या आप पूरा ड्राफ्ट (टाइटल और सभी जुड़े प्रश्न) साफ करना चाहते हैं?", "ड्राफ्ट क्लियर करें");
  if (!ok) return;
  ADMIN_STATE.draftTestQuestions = [];
  ADMIN_STATE.draftTestMeta = getDefaultTestMeta();
  ADMIN_STATE.bulkRawText = "";
  ADMIN_STATE.editingQuestionIdx = -1;
  localStorage.removeItem(CBT_DRAFT_STORAGE_KEY);
  showToast("ड्राफ्ट क्लियर हो गया।", "INFO");
  renderAdminWorkspace();
}

function adminExportDraftAsPipe() {
  if (!ADMIN_STATE.draftTestQuestions.length) return showToast("कॉपी करने के लिए कोई प्रश्न नहीं है।", "WARNING");
  const text = ADMIN_STATE.draftTestQuestions.map((dq) => {
    const cols = [dq.q, dq.A, dq.B, dq.C, dq.D, dq.correct];
    if (dq.explanation || dq.imageUrl) cols.push(dq.explanation || "");
    if (dq.imageUrl) cols.push(dq.imageUrl);
    return cols.join(" || ");
  }).join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast("सभी प्रश्न || फॉर्मेट में कॉपी हो गए!", "SUCCESS"));
  } else {
    ADMIN_STATE.testInputMode = "bulk";
    ADMIN_STATE.bulkRawText = text;
    saveCbtDraftLocal();
    renderAdminWorkspace();
    showToast("प्रश्न बल्क बॉक्स में आ गए हैं, वहां से कॉपी कर लें।", "INFO");
  }
}

async function adminEditPublishedTest(testId) {
  const t = ADMIN_STATE.tests && ADMIN_STATE.tests[testId];
  if (!t) return;
  try {
    const ansSnap = await db.ref(`testAnswers/${testId}`).once("value");
    const ansMap = ansSnap.val() || {};
    const merged = (t.questions || []).map((qItem, idx) => {
      const aItem = ansMap[idx];
      const correct = (typeof aItem === "object" && aItem ? aItem.correct : aItem || "A").toUpperCase();
      const explanation = (typeof aItem === "object" && aItem && aItem.explanation) ? aItem.explanation : "";
      return {
        q: qItem.q || "",
        A: qItem.A || "",
        B: qItem.B || "",
        C: qItem.C || "",
        D: qItem.D || "",
        correct,
        explanation,
        imageUrl: qItem.imageUrl || ""
      };
    });

    ADMIN_STATE.draftTestMeta = {
      editingTestId: testId,
      title: t.title || "",
      testType: normalizeTestType(t.testType),
      scheduledAt: Number(t.scheduledAt) || 0,
      batchId: t.batchId || "",
      category: t.category || "",
      duration: t.duration ?? 30,
      plusMark: t.plusMark ?? 4,
      minusMark: (t.minusMark !== undefined && t.minusMark !== null) ? t.minusMark : 1
    };
    ADMIN_STATE.draftTestQuestions = merged;
    ADMIN_STATE.editingQuestionIdx = -1;
    saveCbtDraftLocal();
    showToast(`"${t.title}" एडिट मोड में लोड हो गया (${merged.length} प्रश्न)!`, "INFO");
    renderAdminWorkspace();
  } catch (err) {
    showAppAlert("टेस्ट लोड करने में त्रुटि: " + err.message, "Error", "DANGER");
  }
}

async function adminPublishCBTTest() {
  adminSyncTestMeta();
  const m = ADMIN_STATE.draftTestMeta || getDefaultTestMeta();
  const title = String(m.title || "").trim();
  if (!title || !ADMIN_STATE.draftTestQuestions.length) {
    return showAppAlert("कृपया टेस्ट का नाम लिखें और कम से कम 1 प्रश्न जोड़ें।", "अधूरा टेस्ट", "DANGER");
  }

  const batchId = m.batchId || "";
  const isEdit = Boolean(m.editingTestId);
  const testId = isEdit ? m.editingTestId : `TST_${Date.now()}`;
  const prev = (isEdit && ADMIN_STATE.tests[testId]) ? ADMIN_STATE.tests[testId] : {};

  const testType = normalizeTestType(m.testType);
  const scheduledAt = Number(m.scheduledAt) || 0;
  const duration = (m.duration !== "" && Number(m.duration) > 0) ? Number(m.duration) : 30;
  const plusMark = (m.plusMark !== "" && Number(m.plusMark) > 0) ? Number(m.plusMark) : 4;
  const minusMark = (m.minusMark !== "" && m.minusMark !== null && m.minusMark !== undefined) ? Math.max(0, Number(m.minusMark)) : 0;

  const publicQuestions = ADMIN_STATE.draftTestQuestions.map((item) => {
    const obj = { q: item.q, A: item.A, B: item.B, C: item.C, D: item.D };
    if (item.imageUrl) obj.imageUrl = item.imageUrl;
    return obj;
  });
  const secretAnswers = ADMIN_STATE.draftTestQuestions.map((item) => ({
    correct: item.correct,
    explanation: item.explanation || ""
  }));

  await db.ref().update({
    [`tests/${testId}`]: {
      testId,
      title,
      testType,
      scheduledAt,
      batchId,
      isFree: !batchId,
      category: m.category || "All",
      duration,
      plusMark,
      minusMark,
      status: "ACTIVE",
      questions: publicQuestions,
      createdAt: prev.createdAt || Date.now(),
      updatedAt: Date.now()
    },
    [`testAnswers/${testId}`]: secretAnswers
  });

  ADMIN_STATE.draftTestQuestions = [];
  ADMIN_STATE.draftTestMeta = getDefaultTestMeta();
  ADMIN_STATE.bulkRawText = "";
  ADMIN_STATE.editingQuestionIdx = -1;
  localStorage.removeItem(CBT_DRAFT_STORAGE_KEY);

  const isUpcoming = scheduledAt > Date.now();
  showToast(
    isUpcoming
      ? `टेस्ट शेड्यूल हो गया (${formatDateTime(scheduledAt)})!`
      : (isEdit ? "CBT टेस्ट अपडेट हो गया!" : "ऑनलाइन CBT टेस्ट लाइव हो गया!"),
    "SUCCESS"
  );
  renderAdminWorkspace();
}

async function adminViewTestLeaderboard(testId) {
  const attObj = (ADMIN_STATE.testAttempts && ADMIN_STATE.testAttempts[testId]) || {};
  const list = Object.values(attObj).filter((a) => a && a.graded).sort((a, b) => b.score - a.score);
  if (!list.length) return showAppAlert("अभी तक किसी छात्र ने यह टेस्ट सबमिट नहीं किया है।", "रिजल्ट खाली है");

  const lines = list.slice(0, 20).map((a, i) => `#${i + 1} ${a.studentName} — ${a.score}/${a.maxMarks} (${a.percentage}%) | सही:${a.rightCount} गलत:${a.wrongCount}`).join("\n");
  await showAppAlert(lines, "Top 20 Student Rank List", "INFO");
}

async function adminDeleteCBTTest(testId) {
  const ok = await showAppConfirm("क्या आप इस टेस्ट और उसके सभी रिज़ल्ट्स को हटाना चाहते हैं?", "टेस्ट हटाएं");
  if (!ok) return;
  await db.ref().update({
    [`tests/${testId}`]: null,
    [`testAnswers/${testId}`]: null,
    [`testAttempts/${testId}`]: null
  });
  showToast("टेस्ट हटा दिया गया।", "INFO");
}

function renderAdminTestsTab(container) {
  const allTests = Object.values(ADMIN_STATE.tests || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const batches = Object.values(ADMIN_STATE.batches || {});
  const m = { ...getDefaultTestMeta(), ...(ADMIN_STATE.draftTestMeta || {}) };
  m.testType = normalizeTestType(m.testType);
  const editQ = (ADMIN_STATE.editingQuestionIdx >= 0) ? ADMIN_STATE.draftTestQuestions[ADMIN_STATE.editingQuestionIdx] : null;
  const categories = (APP_CONFIG && APP_CONFIG.categories ? APP_CONFIG.categories : []).filter((c) => c !== "All");
  const now = Date.now();

  const filteredTests = allTests.filter((t) => {
    const f = ADMIN_STATE.adminTestTypeFilter || "ALL";
    if (f === "ALL") return true;
    if (f === "UPCOMING") return (Number(t.scheduledAt) || 0) > now;
    return normalizeTestType(t.testType) === f;
  });

  const upcomingCnt = allTests.filter((t) => (Number(t.scheduledAt) || 0) > now).length;

  container.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4 text-xs">
      <!-- Smart CBT Test Builder -->
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-extrabold text-pink-700">
            <i class="fa-solid fa-laptop-code mr-1.5"></i> ${m.editingTestId ? "CBT टेस्ट एडिट करें" : "नया ऑनलाइन CBT टेस्ट बनाएं"}
          </h3>
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">Auto-Save ON</span>
            ${(ADMIN_STATE.draftTestQuestions.length || m.title || m.editingTestId)
              ? `<button type="button" onclick="adminClearTestDraft()" class="text-rose-600 font-extrabold text-[11px]">Clear Draft</button>`
              : ""}
          </div>
        </div>

        <div class="grid sm:grid-cols-2 gap-2">
          <input type="text" id="admTestTitle" value="${escapeHtml(m.title || "")}" oninput="adminSyncTestMeta()" placeholder="टेस्ट का नाम (जैसे: Science Chapter 1 Test) *" class="ed-input sm:col-span-2 px-3 py-2 rounded-xl font-bold" />

          <select id="admTestType" onchange="adminSyncTestMeta()" class="ed-input px-3 py-2 rounded-xl font-extrabold text-indigo-900 bg-indigo-50/40">
            <option value="TOPIC_WISE" ${m.testType === "TOPIC_WISE" ? "selected" : ""}>📘 Topic-Wise Test</option>
            <option value="WEEKLY" ${m.testType === "WEEKLY" ? "selected" : ""}>📅 Weekly Test</option>
            <option value="FULL_SYLLABUS" ${m.testType === "FULL_SYLLABUS" ? "selected" : ""}>🎯 Complete Syllabus Test</option>
          </select>

          <select id="admTestBatch" onchange="adminSyncTestMeta()" class="ed-input px-3 py-2 rounded-xl font-bold">
            <option value="" ${!m.batchId ? "selected" : ""}>FREE Test (सभी छात्रों के लिए)</option>
            ${batches.map((b) => `<option value="${escapeHtml(b.batchId)}" ${m.batchId === b.batchId ? "selected" : ""}>Batch: ${escapeHtml(b.title)}</option>`).join("")}
          </select>

          <select id="admTestCategory" onchange="adminSyncTestMeta()" class="ed-input px-3 py-2 rounded-xl font-bold">
            ${categories.map((c) => `<option value="${escapeHtml(c)}" ${m.category === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
          </select>

          <div class="grid grid-cols-3 gap-1.5">
            <input type="number" id="admTestDuration" value="${escapeHtml(String(m.duration ?? 30))}" oninput="adminSyncTestMeta()" placeholder="मिनट" title="समय (मिनट)" class="ed-input px-2 py-2 rounded-xl font-bold" />
            <input type="number" id="admTestPlus" value="${escapeHtml(String(m.plusMark ?? 4))}" step="0.5" oninput="adminSyncTestMeta()" placeholder="+अंक" title="सही उत्तर के अंक" class="ed-input px-2 py-2 rounded-xl font-bold" />
            <input type="number" id="admTestMinus" value="${escapeHtml(String(m.minusMark ?? 1))}" step="0.25" min="0" oninput="adminSyncTestMeta()" placeholder="-अंक" title="गलत उत्तर कटौती (0 = No Negative)" class="ed-input px-2 py-2 rounded-xl font-bold" />
          </div>

          <div class="sm:col-span-2 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
            <div class="flex items-center justify-between">
              <label for="admTestSchedule" class="text-[11px] font-extrabold text-amber-950">
                <i class="fa-regular fa-calendar-check text-amber-600 mr-1"></i> Upcoming Schedule (वैकल्पिक — पहले से शेड्यूल करें)
              </label>
              ${m.scheduledAt ? `<button type="button" onclick="adminClearTestSchedule()" class="text-[10px] font-extrabold text-rose-600">Remove Schedule</button>` : `<span class="text-[10px] text-slate-500">खाली छोड़ें = तुरंत Live</span>`}
            </div>
            <input type="datetime-local" id="admTestSchedule" value="${toLocalDatetimeInput(m.scheduledAt)}" onchange="adminSyncTestMeta()" class="ed-input w-full px-3 py-1.5 rounded-lg bg-white font-bold text-slate-800" />
          </div>
        </div>

        <div class="flex gap-1.5 bg-slate-100 p-1 rounded-xl font-extrabold">
          <button type="button" onclick="adminSwitchTestInputMode('bulk')" class="flex-1 py-2 rounded-lg text-xs transition ${ADMIN_STATE.testInputMode === "bulk" ? "bg-indigo-600 text-white shadow" : "text-slate-700"}">
            <i class="fa-solid fa-bolt mr-1"></i> Bulk Upload (|| Format)
          </button>
          <button type="button" onclick="adminSwitchTestInputMode('single')" class="flex-1 py-2 rounded-lg text-xs transition ${ADMIN_STATE.testInputMode === "single" ? "bg-indigo-600 text-white shadow" : "text-slate-700"}">
            <i class="fa-solid fa-plus mr-1"></i> ${editQ ? `Edit Q#${ADMIN_STATE.editingQuestionIdx + 1}` : "1-by-1 + Image"}
          </button>
        </div>

        ${ADMIN_STATE.testInputMode === "bulk" ? `
          <div class="bg-slate-50 p-3 rounded-2xl border space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-1.5">
              <span class="font-extrabold text-slate-800">हर लाइन में 1 प्रश्न (<code>||</code> से अलग करें)</span>
              <div class="flex gap-1.5">
                <button type="button" onclick="adminInsertPipeSample()" class="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-1 rounded-lg text-[10px]">Sample डालें</button>
                <label class="bg-slate-800 text-amber-300 font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">
                  <i class="fa-solid fa-file-import mr-1"></i>.txt / .json फ़ाइल
                  <input type="file" accept=".txt,.json,.csv" onchange="adminHandleBulkFileUpload(this)" class="hidden" />
                </label>
              </div>
            </div>

            <textarea id="admBulkTextarea" rows="6" oninput="adminOnBulkTextInput(this.value)" placeholder="प्रश्न || Option A || Option B || Option C || Option D || सही उत्तर (A/B/C/D) || व्याख्या (वैकल्पिक) || Image URL (वैकल्पिक)" class="ed-input w-full px-3 py-2 rounded-xl bg-white font-mono text-[11px] leading-relaxed">${escapeHtml(ADMIN_STATE.bulkRawText || "")}</textarea>

            <label class="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
              <input type="checkbox" ${ADMIN_STATE.bulkStripNumbering ? "checked" : ""} onchange="ADMIN_STATE.bulkStripNumbering=this.checked; adminOnBulkTextInput(document.getElementById('admBulkTextarea').value);" class="accent-indigo-600" />
              <span>आगे से अपने-आप "1." या "Q1." हटाएं</span>
            </label>

            <div id="admBulkStatusBox" class="text-[11px]"></div>

            <button type="button" onclick="adminImportBulkQuestions()" class="w-full bg-slate-900 text-amber-300 font-extrabold py-2.5 rounded-xl shadow">
              <i class="fa-solid fa-file-circle-plus mr-1"></i> सभी Valid प्रश्न लिस्ट में जोड़ें
            </button>
          </div>
        ` : `
          <div class="bg-slate-50 p-3 rounded-2xl border space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-slate-800">${editQ ? `प्रश्न #${ADMIN_STATE.editingQuestionIdx + 1} एडिट करें` : "नया प्रश्न जोड़ें"}</span>
              ${editQ ? `<button type="button" onclick="ADMIN_STATE.editingQuestionIdx=-1; renderAdminWorkspace();" class="text-rose-600 font-bold text-[10px]">Cancel Edit</button>` : ""}
            </div>
            <textarea id="admQText" rows="2" placeholder="प्रश्न लिखें..." class="ed-input w-full px-3 py-2 rounded-xl bg-white font-bold">${escapeHtml(editQ?.q || "")}</textarea>
            <div class="grid grid-cols-2 gap-2">
              <input type="text" id="admQA" value="${escapeHtml(editQ?.A || "")}" placeholder="Option A" class="ed-input px-2.5 py-1.5 rounded-lg bg-white" />
              <input type="text" id="admQB" value="${escapeHtml(editQ?.B || "")}" placeholder="Option B" class="ed-input px-2.5 py-1.5 rounded-lg bg-white" />
              <input type="text" id="admQC" value="${escapeHtml(editQ?.C || "")}" placeholder="Option C" class="ed-input px-2.5 py-1.5 rounded-lg bg-white" />
              <input type="text" id="admQD" value="${escapeHtml(editQ?.D || "")}" placeholder="Option D" class="ed-input px-2.5 py-1.5 rounded-lg bg-white" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <select id="admQCorrect" class="ed-input px-2.5 py-1.5 rounded-lg bg-white font-extrabold">
                ${["A", "B", "C", "D"].map((opt) => `<option value="${opt}" ${(editQ?.correct || "A") === opt ? "selected" : ""}>सही: ${opt}</option>`).join("")}
              </select>
              <input type="text" id="admQExp" value="${escapeHtml(editQ?.explanation || "")}" placeholder="सॉल्यूशन / व्याख्या (वैकल्पिक)" class="ed-input col-span-2 px-2.5 py-1.5 rounded-lg bg-white" />
            </div>
            <div class="grid sm:grid-cols-2 gap-2">
              <input type="text" id="admQImgUrl" value="${escapeHtml(editQ?.imageUrl || "")}" placeholder="प्रश्न इमेज लिंक (वैकल्पिक)" class="ed-input px-2.5 py-1.5 rounded-lg bg-white" />
              <input type="file" id="admQImgFile" accept="image/*" class="ed-input px-2 py-1 rounded-lg bg-white text-[10px]" />
            </div>
            <button type="button" onclick="adminPushDraftQuestion()" class="w-full bg-slate-900 text-amber-300 font-extrabold py-2 rounded-xl">
              ${editQ ? `✅ प्रश्न #${ADMIN_STATE.editingQuestionIdx + 1} अपडेट करें` : "+ लिस्ट में प्रश्न जोड़ें"}
            </button>
          </div>
        `}

        <div class="space-y-1.5">
          <div class="flex items-center justify-between font-extrabold text-slate-700">
            <span>जुड़े हुए प्रश्न: <span class="text-indigo-700">${ADMIN_STATE.draftTestQuestions.length}</span></span>
            ${ADMIN_STATE.draftTestQuestions.length ? `<button type="button" onclick="adminExportDraftAsPipe()" class="text-indigo-600 text-[10px] font-bold"><i class="fa-regular fa-copy mr-1"></i>|| फॉर्मेट कॉपी करें</button>` : ""}
          </div>
          ${ADMIN_STATE.draftTestQuestions.length ? `
            <div class="max-h-48 overflow-y-auto custom-scroll space-y-1.5 pr-1">
              ${ADMIN_STATE.draftTestQuestions.map((dq, i) => `
                <div class="p-2 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-bold">Q${i + 1}. ${escapeHtml(dq.q)} <strong class="text-emerald-700">[${dq.correct}]</strong></div>
                    <div class="text-[10px] text-slate-500 flex gap-2">
                      ${dq.explanation ? `<span>💡 व्याख्या</span>` : ""}
                      ${dq.imageUrl ? `<span>🖼️ इमेज</span>` : ""}
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="adminMoveDraftQuestion(${i}, -1)" class="px-1.5 py-0.5 rounded bg-white border text-[10px]">↑</button>
                    <button type="button" onclick="adminMoveDraftQuestion(${i}, 1)" class="px-1.5 py-0.5 rounded bg-white border text-[10px]">↓</button>
                    <button type="button" onclick="adminEditDraftQuestion(${i})" class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">Edit</button>
                    <button type="button" onclick="adminRemoveDraftQuestion(${i})" class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-black text-[10px]">✕</button>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : `<div class="p-3 rounded-xl bg-slate-50 text-center text-slate-400 font-bold">अभी कोई प्रश्न नहीं जुड़ा है।</div>`}
        </div>

        <button type="button" onclick="adminPublishCBTTest()" class="w-full emerald-gradient text-white font-extrabold py-3 rounded-xl shadow-lg">
          <i class="fa-solid fa-paper-plane mr-1"></i> ${m.editingTestId ? "अपडेट किया हुआ CBT टेस्ट सेव करें" : "CBT टेस्ट पब्लिश / शेड्यूल करें"}
        </button>
      </div>

      <!-- Published & Scheduled Tests List -->
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <h3 class="text-sm font-extrabold">CBT टेस्ट लिस्ट (${filteredTests.length}/${allTests.length})</h3>
        <div class="flex flex-wrap gap-1.5 text-[10px] font-extrabold">
          ${[
            ["ALL", `All (${allTests.length})`],
            ["UPCOMING", `⏰ Upcoming (${upcomingCnt})`],
            ["TOPIC_WISE", "📘 Topic-Wise"],
            ["WEEKLY", "📅 Weekly"],
            ["FULL_SYLLABUS", "🎯 Complete Syllabus"]
          ].map(([k, lbl]) => `
            <button type="button" onclick="ADMIN_STATE.adminTestTypeFilter='${k}'; renderAdminWorkspace();" class="px-2.5 py-1 rounded-lg ${(ADMIN_STATE.adminTestTypeFilter || "ALL") === k ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}">${lbl}</button>
          `).join("")}
        </div>

        <div class="space-y-2.5 max-h-[540px] overflow-y-auto custom-scroll">
          ${filteredTests.length ? filteredTests.map((t) => {
            const attCnt = Object.keys((ADMIN_STATE.testAttempts && ADMIN_STATE.testAttempts[t.testId]) || {}).length;
            const minusVal = (t.minusMark !== undefined && t.minusMark !== null) ? t.minusMark : 1;
            const tMeta = CBT_TEST_TYPE_META[normalizeTestType(t.testType)];
            const schedMs = Number(t.scheduledAt) || 0;
            const isUpcoming = schedMs > now;

            return `
              <div class="p-3 rounded-xl ${isUpcoming ? "bg-amber-50/60 border-amber-300" : "bg-slate-50 border-slate-200"} border space-y-1.5">
                <div class="flex flex-wrap items-center justify-between gap-1.5">
                  <div class="flex flex-wrap items-center gap-1">
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${tMeta.cls}">${tMeta.badge}</span>
                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${t.isFree ? "bg-emerald-100 text-emerald-800" : "bg-pink-100 text-pink-800"}">${t.isFree ? "FREE" : "BATCH"}</span>
                    ${isUpcoming ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-slate-950">⏰ UPCOMING</span>` : ""}
                  </div>
                  <span class="text-[10px] font-bold text-indigo-700">${attCnt} छात्रों ने दिया</span>
                </div>
                <div class="font-extrabold text-sm text-slate-900">${escapeHtml(t.title)}</div>
                ${isUpcoming ? `<div class="text-[11px] font-extrabold text-amber-800"><i class="fa-regular fa-clock mr-1"></i>शेड्यूल समय: ${formatDateTime(schedMs)}</div>` : ""}
                <div class="text-[11px] text-slate-500">${(t.questions || []).length} सवाल • ${t.duration} Min • +${t.plusMark}/-${minusVal}</div>
                <div class="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" onclick="adminEditPublishedTest('${escapeHtml(t.testId)}')" class="bg-amber-100 text-amber-900 font-bold px-3 py-1.5 rounded-lg text-[10px]"><i class="fa-solid fa-pen mr-1"></i>Edit Test</button>
                  <button type="button" onclick="adminViewTestLeaderboard('${escapeHtml(t.testId)}')" class="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-[10px]">रैंक लिस्ट देखें</button>
                  <button type="button" onclick="adminDeleteCBTTest('${escapeHtml(t.testId)}')" class="bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-lg text-[10px]">हटाएं</button>
                </div>
              </div>
            `;
          }).join("") : `<p class="text-center text-slate-400 py-8">इस सेक्शन में कोई टेस्ट नहीं है।</p>`}
        </div>
      </div>
    </div>
  `;

  if (ADMIN_STATE.testInputMode === "bulk") updateBulkLiveStatus();
}

// =========================================================
// TAB 4: BOOK STORE MANAGER & 3-PER-A4 SHIPPING DISPATCH
// =========================================================
function renderAdminBooksTab(container) {
  const books = Object.values(ADMIN_STATE.books || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const editBk = ADMIN_STATE.editingBookId ? ADMIN_STATE.books[ADMIN_STATE.editingBookId] : null;
  const bookOrders = getAllOrdersFlat().filter((o) => o.orderType === "BOOK" && o.status === "APPROVED");

  container.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4 text-xs">
      <!-- Add / Edit Book -->
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <div class="flex justify-between items-center">
          <h3 class="text-sm font-extrabold text-amber-700"><i class="fa-solid fa-book mr-1.5"></i> ${editBk ? "किताब एडिट करें" : "नई किताब जोड़ें (Online Only)"}</h3>
          ${editBk ? `<button type="button" onclick="ADMIN_STATE.editingBookId=null; renderAdminWorkspace();" class="text-rose-600 font-bold">Cancel</button>` : ""}
        </div>

        <div class="grid sm:grid-cols-2 gap-2">
          <input type="text" id="admBkTitle" value="${escapeHtml(editBk?.title || "")}" placeholder="किताब का नाम *" class="ed-input sm:col-span-2 px-3 py-2 rounded-xl font-bold" />
          <input type="text" id="admBkAuthor" value="${escapeHtml(editBk?.author || "Gurukul Publications")}" placeholder="लेखक / प्रकाशक" class="ed-input px-3 py-2 rounded-xl" />
          <input type="text" id="admBkCat" value="${escapeHtml(editBk?.category || "Competitive / Board")}" placeholder="कैटेगरी (जैसे: CET / 12th)" class="ed-input px-3 py-2 rounded-xl" />
          <input type="number" id="admBkMrp" value="${editBk?.mrp ?? 350}" placeholder="MRP (₹)" class="ed-input px-3 py-2 rounded-xl font-bold" />
          <input type="number" id="admBkOffer" value="${editBk?.offerPrice ?? 249}" placeholder="Offer Price (₹)" class="ed-input px-3 py-2 rounded-xl font-bold" />
          <input type="number" id="admBkShip" value="${editBk?.shippingFee ?? 0}" placeholder="डिलीवरी चार्ज (₹, 0 = Free)" class="ed-input px-3 py-2 rounded-xl font-bold" />
          <input type="number" id="admBkStock" value="${editBk?.stock ?? 25}" placeholder="उपलब्ध स्टॉक" class="ed-input px-3 py-2 rounded-xl font-bold" />
        </div>
        <input type="text" id="admBkCoverUrl" value="${escapeHtml(editBk?.coverUrl || "")}" placeholder="कवर फोटो लिंक (या नीचे से अपलोड करें)" class="ed-input w-full px-3 py-2 rounded-xl" />
        <input type="file" id="admBkCoverFile" accept="image/*" class="ed-input w-full px-3 py-1.5 rounded-xl" />
        <input type="text" id="admBkSampleUrl" value="${escapeHtml(editBk?.samplePdfUrl || "")}" placeholder="सैंपल पेज PDF लिंक (वैकल्पिक)" class="ed-input w-full px-3 py-2 rounded-xl" />
        <textarea id="admBkDesc" rows="2" placeholder="किताब का विवरण..." class="ed-input w-full px-3 py-2 rounded-xl">${escapeHtml(editBk?.description || "")}</textarea>

        <button type="button" onclick="adminSaveBook()" class="w-full gold-gradient text-slate-950 font-extrabold py-3 rounded-xl shadow">
          <i class="fa-solid fa-floppy-disk mr-1"></i> ${editBk ? "किताब अपडेट करें" : "किताब स्टोर में जोड़ें"}
        </button>
      </div>

      <!-- Catalog List -->
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <h3 class="text-sm font-extrabold">स्टोर की किताबें (${books.length})</h3>
        <div class="space-y-2 max-h-[430px] overflow-y-auto custom-scroll">
          ${books.length ? books.map((b) => `
            <div class="p-3 rounded-xl bg-slate-50 border flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-extrabold text-slate-900 truncate">${escapeHtml(b.title)}</div>
                <div class="text-[11px] text-slate-600">${formatCurrency(b.offerPrice)} (MRP ${formatCurrency(b.mrp)}) • स्टॉक: <strong class="${b.stock <= 3 ? "text-rose-600" : "text-emerald-700"}">${b.stock}</strong></div>
              </div>
              <div class="flex gap-1 shrink-0">
                <button type="button" onclick="ADMIN_STATE.editingBookId='${escapeHtml(b.bookId)}'; renderAdminWorkspace();" class="bg-amber-100 text-amber-900 font-bold px-2.5 py-1.5 rounded-lg text-[10px]">Edit</button>
                <button type="button" onclick="adminDeleteBook('${escapeHtml(b.bookId)}')" class="bg-rose-100 text-rose-700 font-bold px-2.5 py-1.5 rounded-lg text-[10px]"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          `).join("") : `<p class="text-center text-slate-400 py-8">अभी कोई किताब नहीं जोड़ी गई है।</p>`}
        </div>
      </div>
    </div>

    <!-- Approved Book Orders Dispatch & 3-Per-A4 Shipping Labels -->
    <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold text-indigo-800"><i class="fa-solid fa-truck-fast mr-1.5"></i> कन्फर्म बुक ऑर्डर डिस्पैच व शिपिंग लेबल (${bookOrders.length})</h3>
        ${bookOrders.length ? `
          <button type="button" onclick="adminPrintAllLabels3PerA4()" class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-[11px] shadow">
            <i class="fa-solid fa-layer-group mr-1"></i> Print 3 Labels / A4 Sheet
          </button>
        ` : ""}
      </div>
      <div class="space-y-2.5">
        ${bookOrders.length ? bookOrders.map((o) => `
          <div class="p-3.5 rounded-2xl border bg-slate-50 space-y-2">
            <div class="flex flex-wrap justify-between gap-2">
              <div class="font-extrabold text-slate-900">${escapeHtml(o.orderId)} — ${escapeHtml(o.title)} (${formatCurrency(o.finalAmount)})</div>
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px]">${escapeHtml(o.shippingStatus || "PLACED")}</span>
            </div>
            ${o.shippingAddress ? `
              <p class="text-[11px] text-slate-700 bg-white p-2.5 rounded-xl border">
                <strong>पता:</strong> ${escapeHtml(o.shippingAddress.fullName)} (${escapeHtml(o.shippingAddress.phone)}) —
                ${escapeHtml(o.shippingAddress.addressLine)}, ${escapeHtml(o.shippingAddress.city)}, ${escapeHtml(o.shippingAddress.state)} - <strong>${escapeHtml(o.shippingAddress.pincode)}</strong>
              </p>
            ` : ""}
            <div class="flex flex-wrap items-center gap-2">
              <select id="shipStat_${escapeHtml(o.orderId)}" class="ed-input px-2.5 py-1.5 rounded-xl font-bold bg-white">
                ${["PLACED", "PACKED", "SHIPPED", "DELIVERED"].map((st) => `<option value="${st}" ${(o.shippingStatus || "PLACED") === st ? "selected" : ""}>${st}</option>`).join("")}
              </select>
              <input type="text" id="shipTrack_${escapeHtml(o.orderId)}" value="${escapeHtml(o.courierTracking || "")}" placeholder="कूरियर नाम व ट्रैकिंग नंबर..." class="ed-input flex-1 min-w-[180px] px-3 py-1.5 rounded-xl bg-white" />
              <button type="button" onclick="adminUpdateBookShipping('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="bg-indigo-600 text-white font-extrabold px-3.5 py-1.5 rounded-xl">Update Tracking</button>
              <button type="button" onclick="adminPrintShippingLabelPDF('${escapeHtml(o.uid)}','${escapeHtml(o.orderId)}')" class="bg-slate-900 text-amber-300 font-extrabold px-3.5 py-1.5 rounded-xl"><i class="fa-solid fa-print mr-1"></i>Shipping Label</button>
            </div>
          </div>
        `).join("") : `<p class="text-center text-slate-400 py-5">कोई अप्रूव्ड बुक ऑर्डर पेंडिंग नहीं है।</p>`}
      </div>
    </div>
  `;
}

async function adminSaveBook() {
  const title = document.getElementById("admBkTitle").value.trim();
  if (!title) return showAppAlert("कृपया किताब का नाम दर्ज करें।", "अधूरी जानकारी", "DANGER");

  let coverUrl = document.getElementById("admBkCoverUrl").value.trim();
  const fileEl = document.getElementById("admBkCoverFile");
  if (fileEl && fileEl.files && fileEl.files[0]) {
    coverUrl = await compressImageToBase64(fileEl.files[0], 600, 0.75);
  }

  const bookId = ADMIN_STATE.editingBookId || `BK_${Date.now()}`;
  const prev = ADMIN_STATE.books[bookId] || {};
  await db.ref(`books/${bookId}`).set({
    bookId,
    title,
    author: document.getElementById("admBkAuthor").value.trim(),
    category: document.getElementById("admBkCat").value.trim(),
    mrp: Number(document.getElementById("admBkMrp").value) || 0,
    offerPrice: Number(document.getElementById("admBkOffer").value) || 0,
    shippingFee: Number(document.getElementById("admBkShip").value) || 0,
    stock: Number(document.getElementById("admBkStock").value) || 0,
    coverUrl,
    samplePdfUrl: document.getElementById("admBkSampleUrl").value.trim(),
    description: document.getElementById("admBkDesc").value.trim(),
    status: "ACTIVE",
    createdAt: prev.createdAt || Date.now(),
    updatedAt: Date.now()
  });

  ADMIN_STATE.editingBookId = null;
  showToast("किताब स्टोर में सेव हो गई!", "SUCCESS");
  renderAdminWorkspace();
}

async function adminDeleteBook(bookId) {
  const ok = await showAppConfirm("क्या आप इस किताब को स्टोर से हटाना चाहते हैं?", "किताब हटाएं");
  if (!ok) return;
  await db.ref(`books/${bookId}`).remove();
  showToast("किताब हटा दी गई।", "INFO");
}

async function adminUpdateBookShipping(uid, orderId) {
  const st = document.getElementById(`shipStat_${orderId}`)?.value || "PLACED";
  const trk = (document.getElementById(`shipTrack_${orderId}`)?.value || "").trim();
  const notifId = `NTF_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

  await db.ref().update({
    [`orders/${uid}/${orderId}/shippingStatus`]: st,
    [`orders/${uid}/${orderId}/courierTracking`]: trk,
    [`orders/${uid}/${orderId}/updatedAt`]: Date.now(),
    [`notifications/${notifId}`]: {
      id: notifId,
      targetType: "USER",
      targetValue: uid,
      title: `📦 बुक ऑर्डर अपडेट: ${st}`,
      message: `आपका ऑर्डर ${orderId} अब '${st}' स्थिति में है। ${trk ? `ट्रैकिंग: ${trk}` : ""}`,
      createdAt: Date.now()
    }
  });
  showToast(`शिपिंग स्टेटस '${st}' अपडेट हो गया!`, "SUCCESS");
}

// =========================================================
// TAB 5: STUDENTS, MANUAL ACCESS GRANT, DEVICE RESET & BLOCK
// =========================================================
function renderAdminStudentsTab(container) {
  const q = (ADMIN_STATE.studentSearch || "").toLowerCase();
  const students = Object.values(ADMIN_STATE.users || {})
    .filter((u) => {
      if (!u || !u.uid) return false;
      if (!q) return true;
      return `${u.name || ""} ${u.email || ""} ${u.phone || ""} ${u.studentCode || ""}`.toLowerCase().includes(q);
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const batches = Object.values(ADMIN_STATE.batches || {});

  container.innerHTML = `
    <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold"><i class="fa-solid fa-users text-blue-600 mr-1.5"></i> छात्र मैनेजमेंट, डिवाइस रीसेट व मैनुअल बैच एक्सेस (${students.length})</h3>
        <input type="text" value="${escapeHtml(ADMIN_STATE.studentSearch)}" oninput="ADMIN_STATE.studentSearch=this.value; renderAdminWorkspace();" placeholder="नाम, फोन, ईमेल या ID खोजें..." class="ed-input px-3.5 py-2 rounded-xl min-w-[230px]" />
      </div>

      <div class="space-y-2.5 max-h-[560px] overflow-y-auto custom-scroll">
        ${students.length ? students.map((u) => {
          const userEnr = Object.values((ADMIN_STATE.enrollments && ADMIN_STATE.enrollments[u.uid]) || {}).filter((e) => e && e.active);
          return `
            <div class="p-3.5 rounded-2xl border ${u.blocked ? "border-rose-400 bg-rose-50/50" : "border-slate-200 bg-slate-50"} space-y-2">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span class="font-mono font-black text-indigo-700">${escapeHtml(u.studentCode || u.uid.slice(0, 8))}</span>
                  <strong class="text-sm text-slate-900 ml-1.5">${escapeHtml(u.name || "Student")}</strong>
                  ${u.blocked ? `<span class="ml-1.5 bg-rose-600 text-white px-2 py-0.5 rounded-full text-[9px] font-black">BLOCKED</span>` : ""}
                  <div class="text-[11px] text-slate-600">${escapeHtml(u.phone || "-")} • ${escapeHtml(u.email || "-")} • Target: ${escapeHtml(u.target || "-")}</div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button type="button" onclick="adminResetStudentDevice('${escapeHtml(u.uid)}')" class="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-1.5 rounded-lg text-[10px]"><i class="fa-solid fa-mobile-screen mr-1"></i>डिवाइस रीसेट</button>
                  <button type="button" onclick="adminToggleBlockStudent('${escapeHtml(u.uid)}', ${!u.blocked})" class="${u.blocked ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"} font-bold px-2.5 py-1.5 rounded-lg text-[10px]">${u.blocked ? "Unblock" : "Block/Suspend"}</button>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200">
                ${userEnr.map((e) => `
                  <span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg text-[10px] font-extrabold">
                    ${escapeHtml(e.batchTitle || e.batchId)}
                    <button type="button" onclick="adminRevokeStudentBatch('${escapeHtml(u.uid)}','${escapeHtml(e.batchId)}')" class="text-rose-600 ml-1" title="एक्सेस हटाएं">✕</button>
                  </span>
                `).join("")}

                <select id="grantSel_${escapeHtml(u.uid)}" class="ed-input px-2 py-1 rounded-lg text-[10px] font-bold bg-white ml-auto">
                  <option value="">+ मैनुअल बैच दें (ऑफलाइन छात्रों हेतु)</option>
                  ${batches.map((b) => `<option value="${escapeHtml(b.batchId)}">${escapeHtml(b.title)}</option>`).join("")}
                </select>
                <button type="button" onclick="adminGrantBatchManually('${escapeHtml(u.uid)}')" class="bg-slate-900 text-amber-300 font-extrabold px-2.5 py-1 rounded-lg text-[10px]">Grant Access</button>
              </div>
            </div>
          `;
        }).join("") : `<p class="text-center text-slate-400 py-8">कोई छात्र नहीं मिला।</p>`}
      </div>
    </div>
  `;
}

async function adminResetStudentDevice(uid) {
  const ok = await showAppConfirm("क्या आप इस छात्र का Single-Device Lock रीसेट करना चाहते हैं ताकि वह नए मोबाइल में लॉगिन कर सके?", "डिवाइस रीसेट");
  if (!ok) return;
  await db.ref(`users/${uid}`).update({ boundDeviceId: null, deviceResetCount: 0 });
  showToast("छात्र का डिवाइस लॉक रीसेट हो गया!", "SUCCESS");
}

async function adminToggleBlockStudent(uid, shouldBlock) {
  const ok = await showAppConfirm(shouldBlock ? "क्या आप इस छात्र को ब्लॉक/सस्पेंड करना चाहते हैं?" : "क्या आप इस छात्र को अनब्लॉक करना चाहते हैं?", "अकाउंट सुरक्षा");
  if (!ok) return;
  await db.ref(`users/${uid}/blocked`).set(Boolean(shouldBlock));
  showToast(shouldBlock ? "छात्र को ब्लॉक कर दिया गया।" : "छात्र अनब्लॉक हो गया।", shouldBlock ? "WARNING" : "SUCCESS");
}

async function adminGrantBatchManually(uid) {
  const bId = document.getElementById(`grantSel_${uid}`)?.value;
  if (!bId || !ADMIN_STATE.batches[bId]) return showToast("कृपया पहले कोई बैच चुनें।", "WARNING");

  const daysStr = await showAppPrompt("कितने दिनों की वैधता देनी है?", String(ADMIN_STATE.batches[bId].validityDays || 365), "मैनुअल बैच एक्सेस");
  if (!daysStr) return;
  const days = Math.max(1, Number(daysStr) || 365);

  await db.ref(`enrollments/${uid}/${bId}`).set({
    batchId: bId,
    batchTitle: ADMIN_STATE.batches[bId].title,
    active: true,
    isFreeEnroll: false,
    grantedByAdmin: true,
    enrolledAt: Date.now(),
    expiresAt: Date.now() + days * 86400000
  });
  showToast(`'${ADMIN_STATE.batches[bId].title}' का एक्सेस दे दिया गया!`, "SUCCESS");
}

async function adminRevokeStudentBatch(uid, batchId) {
  const ok = await showAppConfirm("क्या आप इस छात्र से इस बैच का एक्सेस हटाना चाहते हैं?", "एक्सेस हटाएं");
  if (!ok) return;
  await db.ref(`enrollments/${uid}/${batchId}`).remove();
  showToast("बैच एक्सेस हटा दिया गया।", "INFO");
}

// =========================================================
// TAB 6: TEACHER DOUBT REPLY DESK (TEXT + PHOTO SOLUTION)
// =========================================================
function renderAdminDoubtsTab(container) {
  const all = getAllDoubtsFlat();
  const filtered = ADMIN_STATE.doubtFilter === "ALL" ? all : all.filter((d) => d.status === ADMIN_STATE.doubtFilter);

  container.innerHTML = `
    <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-extrabold text-violet-700"><i class="fa-solid fa-comments mr-1.5"></i> स्टूडेंट डाउट डेस्क (${all.length})</h3>
        <div class="flex gap-1.5 font-extrabold">
          ${[["PENDING", "⏳ Pending"], ["SOLVED", "✅ Solved"], ["ALL", "All"]].map(([k, l]) => `
            <button type="button" onclick="ADMIN_STATE.doubtFilter='${k}'; renderAdminWorkspace();" class="px-3 py-1.5 rounded-xl ${ADMIN_STATE.doubtFilter === k ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700"}">${l}</button>
          `).join("")}
        </div>
      </div>

      <div class="space-y-3">
        ${filtered.length ? filtered.map((d) => `
          <div class="p-4 rounded-2xl border bg-slate-50 space-y-2.5">
            <div class="flex flex-wrap justify-between gap-2">
              <div>
                <span class="bg-violet-100 text-violet-800 px-2 py-0.5 rounded font-black text-[10px]">${escapeHtml(d.subject)}</span>
                <strong class="ml-1.5 text-slate-900">${escapeHtml(d.studentName)}</strong> (${escapeHtml(d.studentPhone || "-")})
              </div>
              <span class="text-[10px] text-slate-500">${formatDateTime(d.createdAt)}</span>
            </div>
            <p class="font-bold text-slate-800 whitespace-pre-line bg-white p-2.5 rounded-xl border">${escapeHtml(d.question)}</p>
            ${d.photoBase64 ? `<img src="${d.photoBase64}" onclick="previewDoubtFullImage(this.src)" class="max-h-40 rounded-xl border cursor-pointer" />` : ""}

            <div class="space-y-2 pt-2 border-t">
              <textarea id="dbtRepTxt_${escapeHtml(d.doubtId)}" rows="2" placeholder="टीचर का उत्तर / सॉल्यूशन लिखें..." class="ed-input w-full px-3 py-2 rounded-xl bg-white">${escapeHtml(d.replyText || "")}</textarea>
              <div class="flex flex-wrap items-center gap-2">
                <input type="file" id="dbtRepImg_${escapeHtml(d.doubtId)}" accept="image/*" class="ed-input flex-1 px-2.5 py-1.5 rounded-xl bg-white" />
                <button type="button" onclick="adminReplyStudentDoubt('${escapeHtml(d.uid)}','${escapeHtml(d.doubtId)}')" class="emerald-gradient text-white font-extrabold px-4 py-2 rounded-xl shadow">जवाब भेजें (Mark Solved)</button>
              </div>
            </div>
          </div>
        `).join("") : `<p class="text-center text-slate-400 py-8">कोई डाउट पेंडिंग नहीं है।</p>`}
      </div>
    </div>
  `;
}

async function adminReplyStudentDoubt(uid, doubtId) {
  const replyText = (document.getElementById(`dbtRepTxt_${doubtId}`)?.value || "").trim();
  const fileEl = document.getElementById(`dbtRepImg_${doubtId}`);
  let replyPhotoBase64 = "";
  if (fileEl && fileEl.files && fileEl.files[0]) {
    replyPhotoBase64 = await compressImageToBase64(fileEl.files[0], 720, 0.72);
  }
  if (!replyText && !replyPhotoBase64) {
    return showAppAlert("कृपया उत्तर लिखें या सॉल्यूशन की फोटो अपलोड करें।", "अधूरा जवाब", "DANGER");
  }

  const notifId = `NTF_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const updates = {
    [`doubts/${uid}/${doubtId}/status`]: "SOLVED",
    [`doubts/${uid}/${doubtId}/replyText`]: replyText,
    [`doubts/${uid}/${doubtId}/repliedAt`]: Date.now(),
    [`notifications/${notifId}`]: {
      id: notifId,
      targetType: "USER",
      targetValue: uid,
      title: "✅ आपके डाउट का जवाब आ गया है!",
      message: replyText ? replyText.slice(0, 120) : "टीचर ने आपके सवाल का फोटो सॉल्यूशन भेजा है। My Study → डाउट डेस्क देखें।",
      createdAt: Date.now()
    }
  };
  if (replyPhotoBase64) updates[`doubts/${uid}/${doubtId}/replyPhotoBase64`] = replyPhotoBase64;

  await db.ref().update(updates);
  showToast("डाउट का जवाब भेज दिया गया!", "SUCCESS");
}

// =========================================================
// TAB 7: COUPONS, HOME BANNERS & BACKGROUND PUSH BROADCAST
// =========================================================
function renderAdminMarketingTab(container) {
  const coupons = Object.values(ADMIN_STATE.coupons || {});
  const banners = (APP_STATE.publicSettings && APP_STATE.publicSettings.banners) || [];
  const batches = Object.values(ADMIN_STATE.batches || {});
  const tokenCnt = Object.keys(ADMIN_STATE.fcmTokens || {}).length;

  container.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4 text-xs">
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-extrabold text-rose-700"><i class="fa-solid fa-bullhorn mr-1.5"></i> नोटिफिकेशन व बैकग्राउंड Push भेजें</h3>
          <span class="bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">${tokenCnt} Push Devices</span>
        </div>
        <select id="admNotifTargetType" onchange="document.getElementById('admNotifTargetValWrap').classList.toggle('hidden', this.value==='ALL')" class="ed-input w-full px-3 py-2 rounded-xl font-bold">
          <option value="ALL">सभी छात्रों को (All Students)</option>
          <option value="CATEGORY">किसी विशेष कैटेगरी को</option>
          <option value="BATCH">किसी विशेष बैच के छात्रों को</option>
        </select>
        <div id="admNotifTargetValWrap" class="hidden">
          <input type="text" id="admNotifTargetVal" placeholder="कैटेगरी नाम या Batch ID दर्ज करें" class="ed-input w-full px-3 py-2 rounded-xl" />
        </div>
        <input type="text" id="admNotifTitle" placeholder="नोटिस / अलर्ट का शीर्षक *" class="ed-input w-full px-3 py-2 rounded-xl font-bold" />
        <textarea id="admNotifMsg" rows="3" placeholder="पूरा संदेश लिखें..." class="ed-input w-full px-3 py-2 rounded-xl"></textarea>
        <button type="button" onclick="adminSendBroadcastPush()" class="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl shadow">
          <i class="fa-solid fa-bell mr-1"></i> तुरंत नोटिफिकेशन भेजें
        </button>
      </div>

      <div class="ed-card p-4 rounded-2xl space-y-3">
        <h3 class="text-sm font-extrabold text-indigo-700"><i class="fa-solid fa-tag mr-1.5"></i> डिस्काउंट कूपन कोड मैनेजर</h3>
        <div class="grid grid-cols-3 gap-2">
          <input type="text" id="admCpnCode" placeholder="CODE (जैसे: NEW20)" class="ed-input px-3 py-2 rounded-xl font-extrabold uppercase" />
          <select id="admCpnType" class="ed-input px-2 py-2 rounded-xl font-bold">
            <option value="PERCENT">% छूट</option>
            <option value="FLAT">₹ Flat छूट</option>
          </select>
          <input type="number" id="admCpnVal" placeholder="मान (जैसे: 20)" class="ed-input px-3 py-2 rounded-xl font-bold" />
        </div>
        <button type="button" onclick="adminSaveCouponCode()" class="w-full brand-gradient text-white font-extrabold py-2.5 rounded-xl">कूपन बनाएं / एक्टिव करें</button>
        <div class="space-y-1.5 max-h-44 overflow-y-auto custom-scroll">
          ${coupons.map((c) => `
            <div class="p-2.5 rounded-xl bg-slate-50 border flex items-center justify-between">
              <div><strong class="text-indigo-700">${escapeHtml(c.code)}</strong> — ${c.discountType === "FLAT" ? formatCurrency(c.discountValue) : c.discountValue + "%"} OFF</div>
              <button type="button" onclick="db.ref('coupons/${escapeHtml(c.code)}').remove()" class="text-rose-600 font-bold">Delete</button>
            </div>
          `).join("") || `<p class="text-slate-400 text-center py-4">कोई कूपन नहीं है।</p>`}
        </div>
      </div>
    </div>

    <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
      <h3 class="text-sm font-extrabold"><i class="fa-solid fa-images text-amber-600 mr-1.5"></i> होम अनाउंसमेंट और ऑफर बैनर</h3>
      <div class="flex gap-2">
        <input type="text" id="admAnnounceInput" value="${escapeHtml(APP_STATE.publicSettings.announcement || "")}" class="ed-input flex-1 px-3 py-2 rounded-xl font-bold" />
        <button type="button" onclick="db.ref('publicSettings/announcement').set(document.getElementById('admAnnounceInput').value.trim()).then(()=>showToast('अनाउंसमेंट अपडेट हो गया!','SUCCESS'))" class="bg-slate-900 text-amber-300 font-extrabold px-4 py-2 rounded-xl">Save Ticker</button>
      </div>
      <div class="grid sm:grid-cols-3 gap-2 pt-2 border-t">
        <input type="text" id="admBanTitle" placeholder="बैनर शीर्षक" class="ed-input px-3 py-2 rounded-xl font-bold" />
        <input type="text" id="admBanImg" placeholder="बैनर इमेज लिंक (वैकल्पिक)" class="ed-input px-3 py-2 rounded-xl" />
        <select id="admBanBatch" class="ed-input px-3 py-2 rounded-xl font-bold">
          <option value="">लिंक्ड बैच (वैकल्पिक)</option>
          ${batches.map((b) => `<option value="${escapeHtml(b.batchId)}">${escapeHtml(b.title)}</option>`).join("")}
        </select>
        <button type="button" onclick="adminAddHomeBanner()" class="sm:col-span-3 emerald-gradient text-white font-extrabold py-2 rounded-xl">+ नया होम बैनर जोड़ें</button>
      </div>
      <div class="grid sm:grid-cols-2 gap-2">
        ${banners.map((b, i) => `
          <div class="p-2.5 rounded-xl bg-slate-50 border flex items-center justify-between gap-2">
            <span class="font-bold truncate">${escapeHtml(b.title || "Banner " + (i + 1))}</span>
            <button type="button" onclick="adminDeleteHomeBanner(${i})" class="text-rose-600 font-bold">हटाएं</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function adminSendBroadcastPush() {
  const title = document.getElementById("admNotifTitle").value.trim();
  const message = document.getElementById("admNotifMsg").value.trim();
  const targetType = document.getElementById("admNotifTargetType").value;
  const targetValue = (document.getElementById("admNotifTargetVal")?.value || "").trim();
  if (!title || !message) return showAppAlert("कृपया शीर्षक और संदेश दोनों लिखें।", "अधूरी जानकारी", "DANGER");

  const notifId = `NTF_${Date.now()}`;
  await db.ref(`notifications/${notifId}`).set({
    id: notifId, title, message, targetType, targetValue, createdAt: Date.now()
  });

  const pushUrl = APP_STATE.publicSettings && APP_STATE.publicSettings.fcmPushServerUrl;
  const tokens = Object.values(ADMIN_STATE.fcmTokens || {}).map((t) => t.token).filter(Boolean);
  if (pushUrl && tokens.length > 0) {
    fetch(pushUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ title, body: message, tokens })
    }).catch(() => {});
  }

  document.getElementById("admNotifTitle").value = "";
  document.getElementById("admNotifMsg").value = "";
  showToast("नोटिफिकेशन सभी छात्रों को भेज दिया गया!", "SUCCESS");
}

async function adminSaveCouponCode() {
  const code = document.getElementById("admCpnCode").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const discountType = document.getElementById("admCpnType").value;
  const discountValue = Number(document.getElementById("admCpnVal").value) || 0;
  if (!code || discountValue <= 0) return showAppAlert("सही कूपन कोड और छूट का मान दर्ज करें।", "अमान्य कूपन", "DANGER");

  await db.ref(`coupons/${code}`).set({ code, discountType, discountValue, active: true, createdAt: Date.now() });
  showToast(`कूपन ${code} एक्टिव हो गया!`, "SUCCESS");
}

async function adminAddHomeBanner() {
  const title = document.getElementById("admBanTitle").value.trim();
  const imageUrl = document.getElementById("admBanImg").value.trim();
  const batchId = document.getElementById("admBanBatch").value;
  if (!title && !imageUrl) return showToast("शीर्षक या इमेज लिंक डालें।", "WARNING");

  const next = [...((APP_STATE.publicSettings && APP_STATE.publicSettings.banners) || []), { title, imageUrl, batchId, badge: "FEATURED" }];
  await db.ref("publicSettings/banners").set(next);
  showToast("होम बैनर जोड़ा गया!", "SUCCESS");
}

async function adminDeleteHomeBanner(idx) {
  const next = [...((APP_STATE.publicSettings && APP_STATE.publicSettings.banners) || [])];
  next.splice(idx, 1);
  await db.ref("publicSettings/banners").set(next);
  showToast("बैनर हटा दिया गया।", "INFO");
}

// =========================================================
// TAB 8: LIVE UPI PAYMENT CONFIG, APP-ONLY LOCK & AUDIT LOGS
// =========================================================
function renderAdminSettingsTab(container) {
  const pay = getLivePaymentConfig();
  const ps = APP_STATE.publicSettings || {};
  const logs = Object.values(ADMIN_STATE.securityLogs || {}).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  container.innerHTML = `
    <div class="grid lg:grid-cols-2 gap-4 text-xs">
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <h3 class="text-sm font-extrabold text-emerald-700"><i class="fa-solid fa-qrcode mr-1.5"></i> लाइव UPI पेमेंट सेटिंग (तुरंत बदलें)</h3>
        <p class="text-[11px] text-slate-500">यहाँ से UPI ID या अकाउंट होल्डर का नाम बदलते ही सभी छात्रों के पेमेंट पेज और QR कोड तुरंत अपडेट हो जाएंगे।</p>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">ऑफिशियल UPI ID *</label>
          <input type="text" id="admSetUpiId" value="${escapeHtml(pay.upiId)}" class="ed-input w-full px-3 py-2.5 rounded-xl font-mono font-extrabold" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">अकाउंट होल्डर का नाम (Bank Name) *</label>
          <input type="text" id="admSetHolder" value="${escapeHtml(pay.accountHolder)}" class="ed-input w-full px-3 py-2.5 rounded-xl font-bold" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">UPI ट्रांजेक्शन नोट</label>
          <input type="text" id="admSetNote" value="${escapeHtml(pay.merchantNote || "Gurukul Online Course & Books")}" class="ed-input w-full px-3 py-2.5 rounded-xl" />
        </div>
        <button type="button" onclick="adminSaveLivePaymentSettings()" class="w-full emerald-gradient text-white font-extrabold py-3 rounded-xl shadow">
          <i class="fa-solid fa-floppy-disk mr-1"></i> लाइव UPI सेटिंग सेव करें
        </button>
      </div>

      <div class="ed-card p-4 rounded-2xl space-y-3">
        <h3 class="text-sm font-extrabold text-indigo-700"><i class="fa-solid fa-shield-halved mr-1.5"></i> Anti-Piracy App-Only लॉक व APK सेटिंग</h3>
        <label class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border cursor-pointer">
          <div>
            <div class="font-extrabold text-slate-900">App-Only Security Lock (Browser Block)</div>
            <div class="text-[10px] text-slate-500">APK बनने के बाद ON करें—छात्र Chrome में कोर्स नहीं खोल पाएंगे।</div>
          </div>
          <input type="checkbox" id="admSetAppLock" class="w-5 h-5 accent-indigo-600" ${ps.appOnlyLock ? "checked" : ""} />
        </label>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">ऑफिशियल Android APK डाउनलोड लिंक</label>
          <input type="text" id="admSetApkUrl" value="${escapeHtml(ps.apkDownloadUrl || "")}" placeholder="https://github.com/.../releases/latest" class="ed-input w-full px-3 py-2 rounded-xl" />
        </div>
        <div>
          <label class="block text-[11px] font-bold text-slate-600 mb-1">Background FCM Push Relay URL (बंद ऐप Push हेतु)</label>
          <input type="text" id="admSetPushUrl" value="${escapeHtml(ps.fcmPushServerUrl || "")}" placeholder="Apps Script FCM Relay URL" class="ed-input w-full px-3 py-2 rounded-xl" />
        </div>
        <button type="button" onclick="adminSaveSecurityAndAppSettings()" class="w-full brand-gradient text-white font-extrabold py-3 rounded-xl shadow">सिक्योरिटी सेटिंग सेव करें</button>
      </div>
    </div>

    <div class="ed-card p-4 rounded-2xl space-y-3 text-xs">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-extrabold text-rose-700"><i class="fa-solid fa-user-shield mr-1.5"></i> सिक्योरिटी ऑडिट लॉग्स (${logs.length})</h3>
        ${logs.length ? `<button type="button" onclick="db.ref('securityLogs').remove().then(()=>showToast('लॉग्स क्लियर हो गए','INFO'))" class="bg-rose-100 text-rose-700 font-bold px-3 py-1 rounded-lg text-[10px]">Clear Logs</button>` : ""}
      </div>
      <div class="space-y-1.5 max-h-64 overflow-y-auto custom-scroll">
        ${logs.length ? logs.map((l) => `
          <div class="p-2.5 rounded-xl bg-slate-50 border flex flex-wrap justify-between gap-2 text-[11px]">
            <div>
              <span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-black text-[9px]">${escapeHtml(l.eventType)}</span>
              <strong class="ml-1">${escapeHtml(l.name || "Unknown")}</strong> — ${escapeHtml(l.details || "")}
            </div>
            <span class="text-slate-400">${formatDateTime(l.timestamp)}</span>
          </div>
        `).join("") : `<p class="text-center text-slate-400 py-5">कोई संदिग्ध गतिविधि रिकॉर्ड नहीं हुई है।</p>`}
      </div>
    </div>
  `;
}

async function adminSaveLivePaymentSettings() {
  const upiId = document.getElementById("admSetUpiId").value.trim();
  const accountHolder = document.getElementById("admSetHolder").value.trim();
  const merchantNote = document.getElementById("admSetNote").value.trim();
  if (!upiId || !upiId.includes("@") || !accountHolder) {
    return showAppAlert("कृपया सही UPI ID (जैसे: 8739840038@ybl) और अकाउंट होल्डर का नाम दर्ज करें।", "अमान्य UPI", "DANGER");
  }
  await db.ref("publicSettings/payment").set({ upiId, accountHolder, merchantNote });
  showToast("लाइव UPI सेटिंग सभी छात्रों के लिए अपडेट हो गई!", "SUCCESS");
}

async function adminSaveSecurityAndAppSettings() {
  await db.ref("publicSettings").update({
    appOnlyLock: Boolean(document.getElementById("admSetAppLock").checked),
    apkDownloadUrl: document.getElementById("admSetApkUrl").value.trim(),
    fcmPushServerUrl: document.getElementById("admSetPushUrl").value.trim()
  });
  showToast("सिक्योरिटी और ऐप सेटिंग सेव हो गई!", "SUCCESS");
}

// =========================================================
// MODULE 9: ZERO-BLANK UNIVERSAL PDF ENGINE (BROWSER + APK)
// =========================================================
async function fetchImageToBase64Safe(url) {
  if (!url || url.startsWith("data:")) return url || "";
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { mode: "cors", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return "";
  }
}

async function inlineStageImagesForPdf(stageEl) {
  const imgs = Array.from(stageEl.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") || "";
      if (!src) { img.remove(); return; }
      if (src.startsWith("data:")) return;
      const b64 = await fetchImageToBase64Safe(src);
      if (b64) {
        img.removeAttribute("crossorigin");
        img.setAttribute("src", b64);
      } else {
        img.remove();
      }
    })
  );
}

function blobToBase64Only(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      resolve(res.includes("base64,") ? res.split("base64,")[1] : "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function exportHtmlStringToPdfUniversal(htmlString, filename) {
  const prevX = window.scrollX || 0;
  const prevY = window.scrollY || 0;

  const busyOverlay = document.createElement("div");
  busyOverlay.style.cssText =
    "position:fixed;inset:0;z-index:999999;background:rgba(15,23,42,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;font-family:Arial,sans-serif;gap:12px;";
  busyOverlay.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin" style="font-size:30px;color:#fbbf24;"></i><div style="font-size:14px;font-weight:800;">PDF तैयार हो रही है, कृपया 2 सेकंड रुकें...</div>';
  document.body.appendChild(busyOverlay);

  // असली (0,0) पर visible 748px स्टेज — html2canvas इसे 100% साफ कैप्चर करता है
  const stage = document.createElement("div");
  stage.style.cssText =
    "position:absolute;top:0;left:0;width:748px;background:#ffffff;color:#0f172a;padding:0;margin:0;box-sizing:border-box;z-index:999990;font-family:Arial,sans-serif;";
  stage.innerHTML = htmlString;
  document.body.appendChild(stage);

  try {
    window.scrollTo(0, 0);
    await inlineStageImagesForPdf(stage);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))));

    const opt = {
      margin: 6,
      filename: filename,
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        logging: false
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] }
    };

    const isNativeApk = Boolean(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );

    if (!isNativeApk) {
      await html2pdf().set(opt).from(stage).save();
      showToast("PDF सफलतापूर्वक डाउनलोड हो गई!", "SUCCESS");
      return;
    }

    const pdfBlob = await html2pdf().set(opt).from(stage).outputPdf("blob");
    const base64Data = await blobToBase64Only(pdfBlob);
    const plugins = (window.Capacitor && window.Capacitor.Plugins) || {};

    if (plugins.Filesystem && plugins.Share && base64Data) {
      const saved = await plugins.Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: "CACHE"
      });
      await plugins.Share.share({
        title: filename,
        text: "GURUKUL ONLINE APP — Official PDF",
        url: saved.uri,
        dialogTitle: "PDF सेव, शेयर या प्रिंट करें"
      });
      showToast("PDF तैयार है! Save या Print चुनें।", "SUCCESS");
      return;
    }

    // Fallback agar purana APK install ho
    const blobUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch (err) {
    console.error("Universal PDF Error:", err);
    showToast("PDF बनाने में समस्या आई: " + (err.message || "पुनः प्रयास करें"), "DANGER");
  } finally {
    stage.remove();
    busyOverlay.remove();
    window.scrollTo(prevX, prevY);
  }
}

// 1. Clean Official Tax Invoice & Order Slip (Works for BOTH Admin & Student)
window.generateOrderReceiptPDF = async function (orderId, overrideOrderObj = null) {
  const o = overrideOrderObj || (APP_STATE.orders && APP_STATE.orders[orderId]);
  if (!o) return showToast("ऑर्डर विवरण नहीं मिला।", "DANGER");

  const itemsList = Array.isArray(o.items) && o.items.length
    ? o.items.map((it, idx) => `
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(it.title || o.title)}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">${Number(it.qty) || 1}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency((Number(it.offerPrice || it.price) || 0) * (Number(it.qty) || 1))}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">1</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;">${escapeHtml(o.title)}</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">1</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">${formatCurrency(o.finalAmount)}</td>
        </tr>
      `;

  const shipAddrHtml = o.shippingAddress
    ? `<div style="margin:12px 0;padding:10px 12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;line-height:1.5;">
         <strong>Delivery Address:</strong> ${escapeHtml(o.shippingAddress.fullName || o.studentName)} (${escapeHtml(o.shippingAddress.phone || o.studentPhone || "")}) —
         ${escapeHtml(o.shippingAddress.addressLine || "")}, ${escapeHtml(o.shippingAddress.city || "")}, ${escapeHtml(o.shippingAddress.state || "")} - <strong>${escapeHtml(o.shippingAddress.pincode || "")}</strong>
       </div>`
    : "";

  const receiptHtml = `
    <div style="width:724px;margin:0 auto;padding:20px;border:2px solid #1e293b;border-radius:10px;background:#ffffff;color:#0f172a;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #1e293b;margin-bottom:14px;">
        <tr>
          <td style="width:76px;padding-bottom:12px;vertical-align:middle;">
            <img src="${APP_CONFIG.logoUrl}" style="width:66px;height:66px;object-fit:contain;display:block;" />
          </td>
          <td style="padding-bottom:12px;padding-left:10px;vertical-align:middle;">
            <div style="font-size:20px;font-weight:900;color:#312e81;letter-spacing:0.3px;">${escapeHtml(APP_CONFIG.appName)}</div>
            <div style="font-size:12.5px;font-weight:800;color:#0f172a;margin-top:2px;">${escapeHtml(APP_CONFIG.schoolName)}</div>
            <div style="font-size:11px;color:#475569;margin-top:2px;">${escapeHtml(APP_CONFIG.address)} | Helpline: ${escapeHtml(APP_CONFIG.helplines.join(", "))}</div>
          </td>
        </tr>
      </table>

      <div style="text-align:center;background:#eef2ff;border:1px solid #c7d2fe;color:#312e81;font-weight:900;font-size:13px;padding:7px;border-radius:6px;margin-bottom:14px;letter-spacing:0.5px;">
        OFFICIAL TAX INVOICE &amp; ORDER SLIP
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;">
        <tr>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f8fafc;width:22%;font-weight:700;">Order ID</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;width:28%;font-weight:900;color:#312e81;">${escapeHtml(o.orderId)}</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f8fafc;width:22%;font-weight:700;">Date &amp; Time</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;width:28%;">${escapeHtml(formatDateTime(o.createdAt))}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700;">Student Name</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:800;">${escapeHtml(o.studentName || "-")}</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700;">Student ID / Mobile</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;">${escapeHtml(o.studentCode || "")} ${o.studentPhone ? "| " + escapeHtml(o.studentPhone) : ""}</td>
        </tr>
        <tr>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700;">UPI UTR / Ref No.</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:800;color:#b91c1c;">${escapeHtml(o.utrNumber || "-")}</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:700;">Payment Status</td>
          <td style="padding:7px 10px;border:1px solid #cbd5e1;font-weight:900;color:${o.status === "APPROVED" ? "#047857" : "#b45309"};">${escapeHtml(o.status || "PENDING")}</td>
        </tr>
      </table>

      ${shipAddrHtml}
       
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;">
            <th style="padding:8px 10px;border:1px solid #0f172a;width:48px;">#</th>
            <th style="padding:8px 10px;border:1px solid #0f172a;text-align:left;">Description</th>
            <th style="padding:8px 10px;border:1px solid #0f172a;width:65px;">Qty</th>
            <th style="padding:8px 10px;border:1px solid #0f172a;width:120px;text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
          <tr style="background:#ecfdf5;">
            <td colspan="3" style="padding:10px;border:1px solid #cbd5e1;text-align:right;font-weight:900;color:#065f46;">Net Paid Amount (Online UPI)</td>
            <td style="padding:10px;border:1px solid #cbd5e1;text-align:right;font-weight:900;font-size:15px;color:#065f46;">${formatCurrency(o.finalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-top:22px;font-size:11px;color:#475569;">
        <tr>
          <td style="vertical-align:bottom;line-height:1.6;">
            • Digital Computer Generated Receipt — Valid Official Proof.<br/>
            • Paid To UPI: <strong>${escapeHtml(o.paidToUpi || getLivePaymentConfig().upiId)}</strong>
          </td>
          <td style="text-align:right;vertical-align:bottom;width:200px;">
            <div style="font-weight:900;font-size:13px;color:#312e81;">Gurukul Online</div>
            <div style="border-top:1px solid #94a3b8;margin-top:4px;padding-top:3px;">Authorized Signatory</div>
          </td>
        </tr>
      </table>
    </div>
  `;

  await exportHtmlStringToPdfUniversal(receiptHtml, `Receipt_${o.orderId}.pdf`);
};

// 2. Exact 3-Labels-Per-A4 Shipping Label Builder (334px × 3 + 28px = 1030px < 1076px A4)
function buildSingleA4ThirdLabelHTML(o) {
  const a = o.shippingAddress || {};
  const qr = buildQrImageUrl(`${o.orderId}|${a.pincode || ""}`, 76);
  return `
    <div style="width:724px;height:332px;box-sizing:border-box;border:2px dashed #0f172a;border-radius:8px;padding:12px 16px;margin:0 auto 12px auto;background:#ffffff;color:#0f172a;font-family:Arial,sans-serif;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #0f172a;margin-bottom:10px;">
        <tr>
          <td style="padding-bottom:8px;vertical-align:middle;">
            <div style="font-size:15px;font-weight:900;color:#312e81;letter-spacing:0.2px;">PREPAID BOOK PARCEL — DO NOT COLLECT CASH</div>
            <div style="font-size:12px;font-weight:700;color:#334155;margin-top:3px;">Order ID: ${escapeHtml(o.orderId)} &nbsp;|&nbsp; Paid Online: ${formatCurrency(o.finalAmount)}</div>
          </td>
          <td style="width:70px;text-align:right;padding-bottom:8px;vertical-align:middle;">
            <img src="${qr}" style="width:58px;height:58px;display:inline-block;" />
          </td>
        </tr>
      </table>

      <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:10px;line-height:1.45;">
        <div style="font-size:10px;font-weight:800;color:#475569;text-transform:uppercase;">DELIVER TO (प्राप्तकर्ता):</div>
        <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:2px;">${escapeHtml(a.fullName || o.studentName)} &nbsp;<span style="font-size:13px;font-weight:700;">(+91 ${escapeHtml(a.phone || o.studentPhone || "")})</span></div>
        <div style="font-size:12.5px;color:#1e293b;margin-top:3px;">${escapeHtml(a.addressLine || "")}</div>
        <div style="font-size:13px;color:#0f172a;font-weight:700;margin-top:3px;">${escapeHtml(a.city || "")}, ${escapeHtml(a.state || "")} — <span style="font-size:14px;font-weight:900;background:#e0e7ff;padding:2px 6px;border-radius:4px;">PIN: ${escapeHtml(a.pincode || "")}</span></div>
      </div>

      <table style="width:100%;border-collapse:collapse;border-top:1px solid #cbd5e1;font-size:11px;color:#334155;">
        <tr>
          <td style="padding-top:7px;width:54%;"><strong>Items:</strong> ${escapeHtml(o.title)}</td>
          <td style="padding-top:7px;text-align:right;"><strong>FROM:</strong> ${escapeHtml(APP_CONFIG.appName)}, Dhankoli (${escapeHtml(APP_CONFIG.helplines[0])})</td>
        </tr>
      </table>
    </div>
  `;
}

async function adminPrintShippingLabelPDF(uid, orderId) {
  const o = ADMIN_STATE.orders[uid] && ADMIN_STATE.orders[uid][orderId];
  if (!o || !o.shippingAddress) return showToast("शिपिंग पता उपलब्ध नहीं है।", "DANGER");
  await exportHtmlStringToPdfUniversal(buildSingleA4ThirdLabelHTML(o), `ShippingLabel_${o.orderId}.pdf`);
}

async function adminPrintAllLabels3PerA4() {
  const bookOrders = getAllOrdersFlat().filter(
    (o) => o.orderType === "BOOK" && o.status === "APPROVED" && o.shippingAddress
  );
  if (!bookOrders.length) return showToast("प्रिंट करने के लिए कोई अप्रूव्ड बुक ऑर्डर नहीं है।", "WARNING");

  let pagesHtml = "";
  for (let i = 0; i < bookOrders.length; i += 3) {
    const chunk = bookOrders.slice(i, i + 3);
    const hasMore = i + 3 < bookOrders.length;
    pagesHtml += `<div style="width:728px;background:#ffffff;${hasMore ? "page-break-after:always;" : ""}">${chunk.map(buildSingleA4ThirdLabelHTML).join("")}</div>`;
  }

  await exportHtmlStringToPdfUniversal(pagesHtml, `Gurukul_Shipping_Labels_3PerA4_${Date.now()}.pdf`);
}

// =========================================================
// MODULE 10: SMOOTH AUTO-ROTATE CINEMA LANDSCAPE PLAYER &
//            STUDENT LIVE CLASS COUNTDOWN BANNER
// =========================================================
(function initCinemaPlayerAndLiveCountdown() {
  if (!document.getElementById("gurukulCinemaPlayerCSS")) {
    const st = document.createElement("style");
    st.id = "gurukulCinemaPlayerCSS";
    st.textContent = `
      #protectedVideoModal.cinema-active {
        position: fixed !important;
        inset: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        background: #000000 !important;
        display: block !important;
        overflow: hidden !important;
        z-index: 99980 !important;
      }
      #protectedVideoCard.cinema-active {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        max-width: none !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border-radius: 0 !important;
        border: none !important;
        background: #000000 !important;
        overflow: hidden !important;
        z-index: 99985 !important;
      }
      #protectedVideoCard.cinema-active .cinema-stage {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
        max-height: none !important;
        aspect-ratio: auto !important;
        background: #000000 !important;
        z-index: 10 !important;
      }
      #protectedVideoCard.cinema-active .cinema-stage #ytPlayerMount,
      #protectedVideoCard.cinema-active .cinema-stage iframe,
      #protectedVideoCard.cinema-active .cinema-stage video {
        position: absolute !important;
        inset: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
      #protectedVideoCard.cinema-active .cinema-header {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 60 !important;
        padding: 6px 14px !important;
        background: linear-gradient(to bottom, rgba(0,0,0,0.88), rgba(0,0,0,0.35) 75%, transparent) !important;
        transition: opacity 0.25s ease, transform 0.25s ease !important;
      }
      #protectedVideoCard.cinema-active .cinema-controls {
        position: absolute !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        z-index: 60 !important;
        padding: 4px 14px 8px !important;
        background: linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0.45) 75%, transparent) !important;
        transition: opacity 0.25s ease, transform 0.25s ease !important;
      }
      #protectedVideoCard.cinema-active .cinema-controls button,
      #protectedVideoCard.cinema-active .cinema-controls select {
        padding: 4px 8px !important;
        font-size: 11px !important;
        min-height: 28px !important;
      }
      #protectedVideoCard.cinema-active .cinema-extra-hidden {
        display: none !important;
      }
      #protectedVideoCard.cinema-active.hud-hidden .cinema-header {
        opacity: 0 !important;
        transform: translateY(-100%) !important;
        pointer-events: none !important;
      }
      #protectedVideoCard.cinema-active.hud-hidden .cinema-controls {
        opacity: 0 !important;
        transform: translateY(100%) !important;
        pointer-events: none !important;
      }
      #cinemaTapOverlay {
        position: absolute !important;
        inset: 0 !important;
        z-index: 45 !important;
        background: transparent !important;
        cursor: pointer !important;
        -webkit-tap-highlight-color: transparent;
      }
    `;
    document.head.appendChild(st);
  }

  let manualFullscreenActive = false;
  let hudAutoHideTimer = null;

  function scheduleHudHide() {
    if (hudAutoHideTimer) clearTimeout(hudAutoHideTimer);
    const card = document.getElementById("protectedVideoCard");
    if (!card || !card.classList.contains("cinema-active")) return;
    card.classList.remove("hud-hidden");
    hudAutoHideTimer = setTimeout(() => {
      if (card.classList.contains("cinema-active")) {
        card.classList.add("hud-hidden");
      }
    }, 2800);
  }

  function tagCinemaParts(card) {
    const ytMount = document.getElementById("ytPlayerMount");
    const stageWrap = ytMount ? ytMount.parentElement : null;
    const seekSlider = document.getElementById("playerSeekSlider");

    let headerBar = null;
    let controlBar = null;

    Array.from(card.children).forEach((child) => {
      child.classList.remove("cinema-header", "cinema-stage", "cinema-controls", "cinema-extra-hidden");
      if (stageWrap && (child === stageWrap || child.contains(stageWrap))) {
        child.classList.add("cinema-stage");
      } else if (seekSlider && child.contains(seekSlider)) {
        controlBar = child;
        child.classList.add("cinema-controls");
      } else if (!headerBar) {
        headerBar = child;
        child.classList.add("cinema-header");
      } else {
        child.classList.add("cinema-extra-hidden");
      }
    });

    if (stageWrap && !document.getElementById("cinemaTapOverlay")) {
      const tapLayer = document.createElement("div");
      tapLayer.id = "cinemaTapOverlay";
      tapLayer.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!card.classList.contains("cinema-active")) return;
        if (card.classList.contains("hud-hidden")) {
          scheduleHudHide();
        } else {
          if (hudAutoHideTimer) clearTimeout(hudAutoHideTimer);
          card.classList.add("hud-hidden");
        }
      });
      stageWrap.appendChild(tapLayer);
    }

    [headerBar, controlBar].forEach((bar) => {
      if (!bar || bar.dataset.hudBound === "1") return;
      bar.dataset.hudBound = "1";
      bar.addEventListener("click", () => scheduleHudHide(), { passive: true });
      bar.addEventListener("touchstart", () => scheduleHudHide(), { passive: true });
      bar.addEventListener("input", () => scheduleHudHide(), { passive: true });
    });
  }

  function syncPlayerOrientationLayout() {
    const modal = document.getElementById("protectedVideoModal");
    const card = document.getElementById("protectedVideoCard");
    if (!modal || !card || modal.classList.contains("hidden")) return;

    const isPhoneLandscape = window.innerWidth > window.innerHeight && window.innerHeight <= 620;
    const shouldBeCinema = manualFullscreenActive || isPhoneLandscape;

    tagCinemaParts(card);

    if (shouldBeCinema) {
      const wasActive = card.classList.contains("cinema-active");
      modal.classList.add("cinema-active");
      card.classList.add("cinema-active");
      if (!wasActive) scheduleHudHide();
    } else {
      modal.classList.remove("cinema-active");
      card.classList.remove("cinema-active", "hud-hidden");
      if (hudAutoHideTimer) clearTimeout(hudAutoHideTimer);
    }
  }

  window.addEventListener("resize", syncPlayerOrientationLayout);
  window.addEventListener("orientationchange", () => setTimeout(syncPlayerOrientationLayout, 180));
  if (screen.orientation && typeof screen.orientation.addEventListener === "function") {
    screen.orientation.addEventListener("change", () => setTimeout(syncPlayerOrientationLayout, 180));
  }

  window.toggleCustomVideoFullscreen = async function () {
    const card = document.getElementById("protectedVideoCard");
    if (!card) return;

    manualFullscreenActive = !manualFullscreenActive;

    if (manualFullscreenActive) {
      syncPlayerOrientationLayout();
      try {
        if (card.requestFullscreen) await card.requestFullscreen();
        else if (card.webkitRequestFullscreen) await card.webkitRequestFullscreen();
      } catch (e) {}
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock("landscape");
        }
      } catch (e) {}
      scheduleHudHide();
    } else {
      try {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
      } catch (e) {}
      try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      } catch (e) {}
      setTimeout(syncPlayerOrientationLayout, 120);
    }
  };

  const _origOpenVideo = window.openProtectedVideoPlayer;
  if (typeof _origOpenVideo === "function") {
    window.openProtectedVideoPlayer = function (...args) {
      manualFullscreenActive = false;
      const res = _origOpenVideo.apply(this, args);
      setTimeout(syncPlayerOrientationLayout, 180);
      return res;
    };
  }

  const _origCloseVideo = window.closeProtectedVideoPlayer;
  if (typeof _origCloseVideo === "function") {
    window.closeProtectedVideoPlayer = function (...args) {
      manualFullscreenActive = false;
      if (hudAutoHideTimer) clearTimeout(hudAutoHideTimer);
      const modal = document.getElementById("protectedVideoModal");
      const card = document.getElementById("protectedVideoCard");
      if (modal) modal.classList.remove("cinema-active");
      if (card) card.classList.remove("cinema-active", "hud-hidden");
      try {
        if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      } catch (e) {}
      try {
        if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      } catch (e) {}
      return _origCloseVideo.apply(this, args);
    };
  }

  // Student Classroom: Upcoming Scheduled Live Class Countdown Banner
  let liveScheduleTicker = null;
  const _origRenderClassroom = window.renderBatchClassroomContent;
  if (typeof _origRenderClassroom === "function") {
    window.renderBatchClassroomContent = function (...args) {
      _origRenderClassroom.apply(this, args);
      if (liveScheduleTicker) clearInterval(liveScheduleTicker);

      const items = (typeof activeClassroomData !== "undefined" && activeClassroomData && activeClassroomData.content && activeClassroomData.content.items) || {};
      const scheduledLive = Object.values(items).filter((it) => it && it.type === "LIVE" && it.scheduledAt && Number(it.scheduledAt) > Date.now());
      if (!scheduledLive.length) return;

      const body = document.getElementById("classroomBody");
      if (!body) return;

      const banner = document.createElement("div");
      banner.className = "bg-rose-50 border-2 border-rose-300 p-3.5 rounded-2xl space-y-2 mb-3";
      banner.innerHTML = `
        <div class="text-xs font-extrabold text-rose-800"><i class="fa-solid fa-tower-broadcast animate-pulse mr-1.5"></i> आगामी शेड्यूल्ड Live Classes (${scheduledLive.length})</div>
        <div id="liveScheduleCardsBox" class="space-y-2"></div>
      `;
      body.prepend(banner);

      const updateCountdowns = () => {
        const box = document.getElementById("liveScheduleCardsBox");
        if (!box) { clearInterval(liveScheduleTicker); return; }
        const now = Date.now();
        box.innerHTML = scheduledLive.map((it) => {
          const diff = Number(it.scheduledAt) - now;
          if (diff <= 0) {
            return `
              <div class="bg-white p-2.5 rounded-xl border border-emerald-300 flex items-center justify-between gap-2 text-xs">
                <div><span class="bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">🔴 LIVE NOW</span> <strong class="ml-1">${escapeHtml(it.title)}</strong></div>
                <button type="button" onclick="openClassroomLectureItem('${escapeHtml(it.itemId)}')" class="bg-rose-600 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px]">Join Live</button>
              </div>
            `;
          }
          const hrs = Math.floor(diff / 3600000);
          const mins = Math.floor((diff % 3600000) / 60000);
          const secs = Math.floor((diff % 60000) / 1000);
          return `
            <div class="bg-white p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <div class="font-extrabold text-slate-900">${escapeHtml(it.title)}</div>
                <div class="text-[10px] font-bold text-slate-500">समय: ${formatDateTime(it.scheduledAt)}</div>
              </div>
              <span class="bg-slate-900 text-amber-300 font-mono font-extrabold px-2.5 py-1 rounded-lg text-[11px]">⏳ ${String(hrs).padStart(2, "0")}h : ${String(mins).padStart(2, "0")}m : ${String(secs).padStart(2, "0")}s</span>
            </div>
          `;
        }).join("");
      };

      updateCountdowns();
      liveScheduleTicker = setInterval(updateCountdowns, 1000);
    };
  }
})();
/* =====================================================================
   V4 BULLETPROOF DIRECT-CANVAS PDF ENGINE (ZERO html2canvas, ZERO BLANK)
   Paste at the very bottom of js/admin.js
   - Works 100% in Mobile Browser, Desktop & Android APK (Offline Ready)
   - Clean Tax Invoice Receipt + Exact 3-Labels-Per-A4 Sheet
   ===================================================================== */
(function () {
  const A4_W = 1240;
  const A4_H = 1754;
  const FONT_FAMILY = 'Arial, "Noto Sans Devanagari", "Segoe UI", sans-serif';

  // 1. Safe CORS Image Loader (Logo / QR) — Never Taints Canvas
  function loadImageForCanvas(url) {
    return new Promise(async (resolve) => {
      if (!url) return resolve(null);
      try {
        if (!url.startsWith("data:")) {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 3500);
          const res = await fetch(url, { mode: "cors", signal: ctrl.signal });
          clearTimeout(t);
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await new Promise((r) => {
              const fr = new FileReader();
              fr.onloadend = () => r(typeof fr.result === "string" ? fr.result : "");
              fr.onerror = () => r("");
              fr.readAsDataURL(blob);
            });
            if (dataUrl) url = dataUrl;
          }
        }
      } catch (e) {}

      const img = new Image();
      img.crossOrigin = "anonymous";
      const timer = setTimeout(() => resolve(null), 3500);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url;
    });
  }

  // 2. Canvas Drawing Helpers
  function createA4Canvas() {
    const c = document.createElement("canvas");
    c.width = A4_W;
    c.height = A4_H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, A4_W, A4_H);
    ctx.textBaseline = "top";
    return { canvas: c, ctx };
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!raw) return y;
    const words = raw.split(" ");
    const lines = [];
    let current = "";

    for (let i = 0; i < words.length; i++) {
      const test = current ? `${current} ${words[i]}` : words[i];
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = words[i];
        if (lines.length >= maxLines) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);

    lines.forEach((ln, idx) => {
      let out = ln;
      if (idx === maxLines - 1 && lines.length === maxLines && ctx.measureText(out).width > maxWidth) {
        while (out.length > 3 && ctx.measureText(out + "...").width > maxWidth) {
          out = out.slice(0, -1);
        }
        out += "...";
      }
      ctx.fillText(out, x, y + idx * lineHeight);
    });

    return y + lines.length * lineHeight;
  }

  // 3. Pure JavaScript Multi-Page PDF 1.4 Generator (No html2canvas / No CDN)
  function buildPdfBytesFromCanvases(canvases) {
    const enc = (s) => new TextEncoder().encode(s);
    const chunks = [];
    let offset = 0;
    const push = (u8) => { chunks.push(u8); offset += u8.length; };

    push(enc("%PDF-1.4\n"));
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    const pageCount = canvases.length;
    const totalObjs = 2 + pageCount * 3;
    const offsets = new Array(totalObjs + 1).fill(0);

    offsets[1] = offset;
    push(enc("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));

    const kids = [];
    for (let i = 0; i < pageCount; i++) kids.push(`${3 + i * 3} 0 R`);
    offsets[2] = offset;
    push(enc(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>\nendobj\n`));

    for (let i = 0; i < pageCount; i++) {
      const c = canvases[i];
      const dataUrl = c.toDataURL("image/jpeg", 0.94);
      const b64 = dataUrl.split(",")[1];
      const bin = atob(b64);
      const jpg = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) jpg[j] = bin.charCodeAt(j);

      const pObj = 3 + i * 3;
      const imgObj = 4 + i * 3;
      const cntObj = 5 + i * 3;

      offsets[pObj] = offset;
      push(enc(`${pObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imgObj} 0 R >> >> /Contents ${cntObj} 0 R >>\nendobj\n`));

      offsets[imgObj] = offset;
      push(enc(`${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`));
      push(jpg);
      push(enc("\nendstream\nendobj\n"));

      const cs = "q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n";
      offsets[cntObj] = offset;
      push(enc(`${cntObj} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}endstream\nendobj\n`));
    }

    const xrefStart = offset;
    let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
    for (let k = 1; k <= totalObjs; k++) {
      xref += String(offsets[k]).padStart(10, "0") + " 00000 n \n";
    }
    push(enc(xref));
    push(enc(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`));

    const merged = new Uint8Array(offset);
    let pos = 0;
    for (const ch of chunks) {
      merged.set(ch, pos);
      pos += ch.length;
    }
    return merged;
  }

  function uint8ToBase64(u8) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  // 4. Universal Save / Share Handler (Browser Direct Download + Android APK Share/Print)
  async function saveCanvasesAsPdf(canvases, filename) {
    const pdfBytes = buildPdfBytesFromCanvases(canvases);
    const isNativeApk = Boolean(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === "function" &&
      window.Capacitor.isNativePlatform()
    );

    if (isNativeApk) {
      const plugins = (window.Capacitor && window.Capacitor.Plugins) || {};
      if (plugins.Filesystem && plugins.Share) {
        const b64 = uint8ToBase64(pdfBytes);
        const saved = await plugins.Filesystem.writeFile({
          path: filename,
          data: b64,
          directory: "CACHE"
        });
        await plugins.Share.share({
          title: filename,
          text: "GURUKUL ONLINE APP — Official PDF",
          url: saved.uri,
          dialogTitle: "PDF सेव, शेयर या प्रिंट करें"
        });
        showToast("PDF तैयार है! Save या Print चुनें।", "SUCCESS");
        return;
      }
      showToast("नया APK बिल्ड इंस्टॉल करें — अभी प्रीव्यू सेव किया जा रहा है।", "WARNING");
    }

    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showToast("PDF सफलतापूर्वक डाउनलोड हो गई!", "SUCCESS");
  }

  // 5. DRAW OFFICIAL TAX INVOICE & ORDER RECEIPT (A4)
  async function generateCanvasReceiptPDF(orderId, overrideOrderObj = null) {
    const o = overrideOrderObj || (APP_STATE.orders && APP_STATE.orders[orderId]);
    if (!o) return showToast("ऑर्डर विवरण नहीं मिला।", "DANGER");

    showToast("रसीद PDF तैयार हो रही है...", "INFO");
    try {
      const logoImg = await loadImageForCanvas(APP_CONFIG.logoUrl);
      const { canvas, ctx } = createA4Canvas();

      // Outer Frame
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 4;
      roundedRectPath(ctx, 50, 50, 1140, 1654, 18);
      ctx.stroke();

      // Header Section
      if (logoImg) {
        ctx.drawImage(logoImg, 84, 82, 112, 112);
      }
      const hx = logoImg ? 218 : 84;
      ctx.fillStyle = "#312e81";
      ctx.font = `900 38px ${FONT_FAMILY}`;
      ctx.fillText(String(APP_CONFIG.appName || "GURUKUL ONLINE APP"), hx, 86);

      ctx.fillStyle = "#0f172a";
      ctx.font = `800 22px ${FONT_FAMILY}`;
      ctx.fillText(String(APP_CONFIG.schoolName || "GURUKUL SENIOR SECONDARY SCHOOL DHANKOLI"), hx, 134);

      ctx.fillStyle = "#475569";
      ctx.font = `600 19px ${FONT_FAMILY}`;
      drawWrappedText(
        ctx,
        `${APP_CONFIG.address || ""} | Helpline: ${(APP_CONFIG.helplines || []).join(", ")}`,
        hx,
        166,
        940,
        24,
        2
      );

      // Header Divider
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, 224);
      ctx.lineTo(1160, 224);
      ctx.stroke();

      // Official Banner
      ctx.fillStyle = "#eef2ff";
      roundedRectPath(ctx, 80, 246, 1080, 58, 10);
      ctx.fill();
      ctx.strokeStyle = "#c7d2fe";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#312e81";
      ctx.font = `900 25px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.fillText("OFFICIAL TAX INVOICE & ORDER SLIP", A4_W / 2, 261);
      ctx.textAlign = "left";

      // Order Meta Grid (3 rows x 2 pairs)
      const rows = [
        ["Order ID", String(o.orderId || "-"), "Date & Time", String(formatDateTime(o.createdAt))],
        ["Student Name", String(o.studentName || "-"), "ID / Mobile", `${o.studentCode || ""} ${o.studentPhone ? "| " + o.studentPhone : ""}`.trim() || "-"],
        ["UPI UTR / Ref No.", String(o.utrNumber || "-"), "Payment Status", String(o.status || "PENDING")]
      ];

      let y = 326;
      const rowH = 66;
      const colX = [80, 310, 620, 860, 1160];

      rows.forEach((r, idx) => {
        // Label Backgrounds
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(colX[0], y, colX[1] - colX[0], rowH);
        ctx.fillRect(colX[2], y, colX[3] - colX[2], rowH);

        // Cell Borders
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        for (let c = 0; c < 4; c++) {
          ctx.strokeRect(colX[c], y, colX[c + 1] - colX[c], rowH);
        }

        // Left Pair
        ctx.fillStyle = "#334155";
        ctx.font = `700 20px ${FONT_FAMILY}`;
        ctx.fillText(r[0], colX[0] + 14, y + 21);

        ctx.fillStyle = idx === 2 ? "#b91c1c" : (idx === 0 ? "#312e81" : "#0f172a");
        ctx.font = `800 20px ${FONT_FAMILY}`;
        drawWrappedText(ctx, r[1], colX[1] + 14, y + 21, colX[2] - colX[1] - 24, 24, 2);

        // Right Pair
        ctx.fillStyle = "#334155";
        ctx.font = `700 20px ${FONT_FAMILY}`;
        ctx.fillText(r[2], colX[2] + 14, y + 21);

        ctx.fillStyle = idx === 2 ? (o.status === "APPROVED" ? "#047857" : "#b45309") : "#0f172a";
        ctx.font = `800 20px ${FONT_FAMILY}`;
        drawWrappedText(ctx, r[3], colX[3] + 14, y + 21, colX[4] - colX[3] - 24, 24, 2);

        y += rowH;
      });

      // Delivery Address Box (if Book Order)
      if (o.shippingAddress) {
        const a = o.shippingAddress;
        y += 24;
        ctx.fillStyle = "#f8fafc";
        roundedRectPath(ctx, 80, y, 1080, 128, 10);
        ctx.fill();
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#475569";
        ctx.font = `800 18px ${FONT_FAMILY}`;
        ctx.fillText("DELIVERY ADDRESS (प्राप्तकर्ता का पता):", 100, y + 14);

        ctx.fillStyle = "#0f172a";
        ctx.font = `800 22px ${FONT_FAMILY}`;
        ctx.fillText(`${a.fullName || o.studentName || ""}  (+91 ${a.phone || o.studentPhone || ""})`, 100, y + 44);

        ctx.fillStyle = "#1e293b";
        ctx.font = `600 20px ${FONT_FAMILY}`;
        drawWrappedText(
          ctx,
          `${a.addressLine || ""}, ${a.city || ""}, ${a.state || ""} - PIN: ${a.pincode || ""}`,
          100,
          y + 78,
          1040,
          26,
          2
        );
        y += 128;
      }

      // Items Table
      y += 32;
      const tCols = [80, 165, 860, 965, 1160];
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(tCols[0], y, 1080, 58);

      ctx.fillStyle = "#ffffff";
      ctx.font = `800 21px ${FONT_FAMILY}`;
      ctx.fillText("#", tCols[0] + 32, y + 18);
      ctx.fillText("Description", tCols[1] + 18, y + 18);
      ctx.fillText("Qty", tCols[2] + 32, y + 18);
      ctx.textAlign = "right";
      ctx.fillText("Amount", tCols[4] - 18, y + 18);
      ctx.textAlign = "left";
      y += 58;

      const items = (Array.isArray(o.items) && o.items.length)
        ? o.items.map((it) => ({
            title: String(it.title || o.title || "Item"),
            qty: Number(it.qty) || 1,
            amt: (Number(it.offerPrice || it.price) || 0) * (Number(it.qty) || 1)
          }))
        : [{ title: String(o.title || "Course / Book"), qty: 1, amt: Number(o.finalAmount) || 0 }];

      items.forEach((it, idx) => {
        const rh = 68;
        ctx.fillStyle = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        ctx.fillRect(tCols[0], y, 1080, rh);
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        for (let c = 0; c < 4; c++) {
          ctx.strokeRect(tCols[c], y, tCols[c + 1] - tCols[c], rh);
        }

        ctx.fillStyle = "#0f172a";
        ctx.font = `700 21px ${FONT_FAMILY}`;
        ctx.fillText(String(idx + 1), tCols[0] + 32, y + 22);
        drawWrappedText(ctx, it.title, tCols[1] + 18, y + 20, tCols[2] - tCols[1] - 32, 26, 2);
        ctx.fillText(String(it.qty), tCols[2] + 38, y + 22);
        ctx.textAlign = "right";
        ctx.font = `800 22px ${FONT_FAMILY}`;
        ctx.fillText(formatCurrency(it.amt), tCols[4] - 18, y + 22);
        ctx.textAlign = "left";
        y += rh;
      });

      // Net Paid Row
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(tCols[0], y, 1080, 74);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(tCols[0], y, 1080, 74);

      ctx.fillStyle = "#065f46";
      ctx.font = `900 24px ${FONT_FAMILY}`;
      ctx.textAlign = "right";
      ctx.fillText("Net Paid Amount (Online UPI):", tCols[3] - 16, y + 24);
      ctx.font = `900 28px ${FONT_FAMILY}`;
      ctx.fillText(formatCurrency(o.finalAmount), tCols[4] - 18, y + 22);
      ctx.textAlign = "left";

      // Footer & Signature
      const fy = Math.max(y + 130, 1460);
      ctx.fillStyle = "#475569";
      ctx.font = `600 20px ${FONT_FAMILY}`;
      ctx.fillText("• Digital Computer Generated Receipt — Valid Official Proof.", 84, fy);
      ctx.fillText(`• Paid To UPI: ${o.paidToUpi || getLivePaymentConfig().upiId}`, 84, fy + 34);

      ctx.textAlign = "right";
      ctx.fillStyle = "#312e81";
      ctx.font = `900 26px ${FONT_FAMILY}`;
      ctx.fillText("Gurukul Online", 1156, fy - 4);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(910, fy + 36);
      ctx.lineTo(1156, fy + 36);
      ctx.stroke();
      ctx.fillStyle = "#475569";
      ctx.font = `700 19px ${FONT_FAMILY}`;
      ctx.fillText("Authorized Signatory", 1156, fy + 46);
      ctx.textAlign = "left";

      await saveCanvasesAsPdf([canvas], `Receipt_${o.orderId}.pdf`);
    } catch (err) {
      console.error("Canvas Receipt PDF Error:", err);
      showToast("रसीद PDF बनाने में त्रुटि: " + (err.message || ""), "DANGER");
    }
  }

  // 6. DRAW ONE EXACT 1/3-A4 SHIPPING LABEL AT SPECIFIED Y (Height = 534px)
  function drawShippingLabelSlot(ctx, o, qrImg, startY) {
    const a = o.shippingAddress || {};
    const x = 45;
    const w = 1150;
    const h = 534;

    // White Card + Dashed Scissor-Cut Border
    ctx.save();
    ctx.fillStyle = "#ffffff";
    roundedRectPath(ctx, x, startY, w, h, 14);
    ctx.fill();

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3.5;
    ctx.setLineDash([14, 9]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top Header
    ctx.fillStyle = "#312e81";
    ctx.font = `900 27px ${FONT_FAMILY}`;
    ctx.fillText("PREPAID BOOK PARCEL — DO NOT COLLECT CASH", x + 28, startY + 24);

    ctx.fillStyle = "#334155";
    ctx.font = `700 22px ${FONT_FAMILY}`;
    ctx.fillText(
      `Order ID: ${o.orderId || "-"}   |   Paid Online: ${formatCurrency(o.finalAmount)}`,
      x + 28,
      startY + 66
    );

    // QR Code (Top-Right)
    if (qrImg) {
      ctx.drawImage(qrImg, x + w - 134, startY + 18, 108, 108);
    }

    // Header Bottom Divider
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 24, startY + 136);
    ctx.lineTo(x + w - 24, startY + 136);
    ctx.stroke();

    // Deliver To Box
    const bx = x + 26;
    const by = startY + 152;
    const bw = w - 52;
    const bh = 282;

    ctx.fillStyle = "#f8fafc";
    roundedRectPath(ctx, bx, by, bw, bh, 10);
    ctx.fill();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.fillStyle = "#475569";
    ctx.font = `800 18px ${FONT_FAMILY}`;
    ctx.fillText("DELIVER TO (प्राप्तकर्ता):", bx + 22, by + 18);

    ctx.fillStyle = "#0f172a";
    ctx.font = `900 30px ${FONT_FAMILY}`;
    const nameStr = `${a.fullName || o.studentName || "Student"}  (+91 ${a.phone || o.studentPhone || ""})`;
    drawWrappedText(ctx, nameStr, bx + 22, by + 48, bw - 44, 34, 1);

    ctx.fillStyle = "#1e293b";
    ctx.font = `600 24px ${FONT_FAMILY}`;
    const addrEndY = drawWrappedText(ctx, String(a.addressLine || ""), bx + 22, by + 98, bw - 44, 34, 2);

    const cityState = `${a.city || ""}, ${a.state || ""}`.replace(/^,\s*|,\s*$/g, "");
    const pinY = Math.max(addrEndY + 12, by + 188);
    ctx.fillStyle = "#0f172a";
    ctx.font = `800 25px ${FONT_FAMILY}`;
    ctx.fillText(cityState, bx + 22, pinY + 8);

    // Highlighted PIN Pill
    const pinText = `PIN: ${a.pincode || "------"}`;
    ctx.font = `900 28px ${FONT_FAMILY}`;
    const pinW = ctx.measureText(pinText).width + 34;
    const pinX = bx + bw - pinW - 22;
    ctx.fillStyle = "#e0e7ff";
    roundedRectPath(ctx, pinX, pinY, pinW, 48, 8);
    ctx.fill();
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1e1b4b";
    ctx.fillText(pinText, pinX + 17, pinY + 10);

    // Footer Row
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 24, startY + 452);
    ctx.lineTo(x + w - 24, startY + 452);
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = `700 20px ${FONT_FAMILY}`;
    drawWrappedText(ctx, `Items: ${o.title || "Books"}`, x + 28, startY + 468, 600, 26, 2);

    ctx.textAlign = "right";
    ctx.fillStyle = "#334155";
    ctx.font = `800 19px ${FONT_FAMILY}`;
    ctx.fillText(
      `FROM: ${APP_CONFIG.appName || "GURUKUL ONLINE APP"}, Dhankoli (${(APP_CONFIG.helplines && APP_CONFIG.helplines[0]) || "9772564359"})`,
      x + w - 28,
      startY + 474
    );
    ctx.textAlign = "left";
    ctx.restore();
  }

  // Single Shipping Label (Exact 1/3 A4 Size at Top of Page)
  async function generateCanvasSingleLabelPDF(uid, orderId) {
    const o = ADMIN_STATE.orders[uid] && ADMIN_STATE.orders[uid][orderId];
    if (!o || !o.shippingAddress) return showToast("शिपिंग पता उपलब्ध नहीं है।", "DANGER");

    showToast("शिपिंग लेबल PDF तैयार हो रही है...", "INFO");
    try {
      const qrUrl = buildQrImageUrl(`${o.orderId}|${o.shippingAddress.pincode || ""}`, 140);
      const qrImg = await loadImageForCanvas(qrUrl);
      const { canvas, ctx } = createA4Canvas();
      drawShippingLabelSlot(ctx, o, qrImg, 40);
      await saveCanvasesAsPdf([canvas], `ShippingLabel_${o.orderId}.pdf`);
    } catch (err) {
      console.error("Single Label PDF Error:", err);
      showToast("लेबल PDF बनाने में त्रुटि: " + (err.message || ""), "DANGER");
    }
  }

  // Bulk 3-Labels-Per-A4 Sheet (Exact 3 Labels per Page, Auto Multi-Page)
  async function generateCanvasAllLabels3PerA4PDF() {
    const bookOrders = getAllOrdersFlat().filter(
      (o) => o.orderType === "BOOK" && o.status === "APPROVED" && o.shippingAddress
    );
    if (!bookOrders.length) return showToast("प्रिंट करने के लिए कोई अप्रूव्ड बुक ऑर्डर नहीं है।", "WARNING");

    showToast(`${bookOrders.length} लेबल की A4 शीट तैयार हो रही है...`, "INFO");
    try {
      const qrImgs = await Promise.all(
        bookOrders.map((o) =>
          loadImageForCanvas(buildQrImageUrl(`${o.orderId}|${o.shippingAddress.pincode || ""}`, 140))
        )
      );

      const canvases = [];
      const slotYs = [40, 610, 1180]; // 3 slots × 534px + gaps = 1714px inside 1754px A4

      for (let i = 0; i < bookOrders.length; i += 3) {
        const { canvas, ctx } = createA4Canvas();
        for (let s = 0; s < 3; s++) {
          const idx = i + s;
          if (idx >= bookOrders.length) break;
          drawShippingLabelSlot(ctx, bookOrders[idx], qrImgs[idx], slotYs[s]);
        }
        canvases.push(canvas);
      }

      await saveCanvasesAsPdf(canvases, `Gurukul_Labels_3PerA4_${Date.now()}.pdf`);
    } catch (err) {
      console.error("3-Per-A4 Labels PDF Error:", err);
      showToast("A4 लेबल शीट बनाने में त्रुटि: " + (err.message || ""), "DANGER");
    }
  }

  // Bind immediately AND after window load so no earlier script can overwrite it
  function bindDirectPdfHandlers() {
    window.generateOrderReceiptPDF = generateCanvasReceiptPDF;
    window.adminPrintShippingLabelPDF = generateCanvasSingleLabelPDF;
    window.adminPrintAllLabels3PerA4 = generateCanvasAllLabels3PerA4PDF;
  }
  bindDirectPdfHandlers();
  window.addEventListener("load", bindDirectPdfHandlers);
})();
