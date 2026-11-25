/* =====================================================================
   GURUKUL ONLINE APP — COURSES, COUPONS, ZERO-PANIC UPI & CLASSROOM
   File: js/courses.js
   ===================================================================== */

let selectedBatchCategory = "All";
let activeCheckoutContext = null;
let activeBatchCoupon = null;
let activeClassroomData = { batchId: null, content: null, selectedSubject: "ALL" };
let homeBannerAutoTimer = null;

// =========================================================
// 1. HOME DASHBOARD, BANNERS & ZERO-PANIC PENDING BANNER
// =========================================================
function renderHomeBanners() {
  const track = document.getElementById("homeBannerTrack");
  if (!track) return;

  const customBanners = (APP_STATE.publicSettings && APP_STATE.publicSettings.banners) || [];
  if (customBanners.length > 0) {
    track.innerHTML = customBanners.map((b) => `
      <div class="banner-slide hero-gradient text-white shadow-lg cursor-pointer" onclick="${b.batchId ? `openBatchDetailModal('${escapeHtml(b.batchId)}')` : `switchStudentTab('batches')`}">
        ${b.imageUrl
          ? `<img src="${escapeHtml(b.imageUrl)}" alt="${escapeHtml(b.title || 'Offer')}" class="w-full h-40 sm:h-52 object-cover" />`
          : `<div class="p-5 sm:p-6 space-y-1.5">
              <span class="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">${escapeHtml(b.badge || "SPECIAL OFFER")}</span>
              <h3 class="text-lg sm:text-2xl font-extrabold">${escapeHtml(b.title || "GURUKUL ONLINE APP")}</h3>
              <p class="text-xs text-indigo-100">${escapeHtml(b.subtitle || "")}</p>
            </div>`
        }
      </div>
    `).join("");
  } else {
    track.innerHTML = `
      <div class="banner-slide hero-gradient text-white p-5 sm:p-6 shadow-xl">
        <span class="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">New Batches Live</span>
        <h2 class="text-lg sm:text-2xl font-extrabold mt-2">सपनों की तैयारी, गुरुकुल के साथ!</h2>
        <p class="text-xs text-indigo-100 mt-1 max-w-md">Class 6th–12th, Rajasthan CET, RRB, SSC व सभी प्रतियोगी परीक्षाओं के Live/Recorded बैच, नोट्स और टेस्ट सीरीज।</p>
        <button type="button" onclick="switchStudentTab('batches')" class="mt-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs shadow">
          बैच एक्सप्लोर करें <i class="fa-solid fa-arrow-right ml-1"></i>
        </button>
      </div>
      <div class="banner-slide emerald-gradient text-white p-5 sm:p-6 shadow-xl">
        <span class="bg-white text-emerald-800 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">Official Book Store</span>
        <h2 class="text-lg sm:text-2xl font-extrabold mt-2">प्रिंटेड नोट्स व गाइड्स सीधे घर मंगाएं</h2>
        <p class="text-xs text-emerald-100 mt-1 max-w-md">100% सुरक्षित ऑनलाइन UPI पेमेंट (0% फीस) के साथ फास्ट होम डिलीवरी और लाइव ऑर्डर ट्रैकिंग।</p>
        <button type="button" onclick="switchStudentTab('bookstore')" class="mt-3 bg-white text-emerald-800 font-extrabold px-4 py-2 rounded-xl text-xs shadow">
          बुक स्टोर खोलें <i class="fa-solid fa-store ml-1"></i>
        </button>
      </div>
    `;
  }

  // Auto-slide every 5 seconds
  if (homeBannerAutoTimer) clearInterval(homeBannerAutoTimer);
  const slidesCount = track.children.length;
  if (slidesCount > 1) {
    let curSlide = 0;
    homeBannerAutoTimer = setInterval(() => {
      if (APP_STATE.activeTab !== "home") return;
      curSlide = (curSlide + 1) % slidesCount;
      track.scrollTo({ left: curSlide * track.clientWidth, behavior: "smooth" });
    }, 5000);
  }
}

function renderHomePendingOrderBanner() {
  const box = document.getElementById("homePendingOrderBanner");
  if (!box) return;

  const orders = Object.values(APP_STATE.orders || {});
  const attentionOrders = orders
    .filter((o) => o && (o.status === "PENDING_VERIFICATION" || o.status === "UTR_CORRECTION_REQUIRED"))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!attentionOrders.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  const latest = attentionOrders[0];
  const isUtrFix = latest.status === "UTR_CORRECTION_REQUIRED";
  const waMsg = `Namaste Sir, mera Order ID: ${latest.orderId}, UTR: ${latest.utrNumber}, Amount: Rs.${latest.finalAmount} (${latest.title}) verification ke liye pending hai.`;

  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="p-4 rounded-2xl border-2 ${isUtrFix ? "bg-rose-50 border-rose-400" : "bg-amber-50 border-amber-400"} space-y-2.5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl ${isUtrFix ? "bg-rose-600" : "bg-amber-500"} text-white flex items-center justify-center shrink-0">
            <i class="fa-solid ${isUtrFix ? "fa-triangle-exclamation" : "fa-shield-halved"}"></i>
          </div>
          <div>
            <h4 class="text-xs sm:text-sm font-extrabold ${isUtrFix ? "text-rose-900" : "text-amber-950"}">
              ${isUtrFix ? "⚠️ UTR नंबर सुधारना आवश्यक है" : "🛡️ आपका पेमेंट पूरी तरह सुरक्षित है (Verifying)"}
            </h4>
            <p class="text-[11px] font-bold text-slate-700">${escapeHtml(latest.title)} • ${formatCurrency(latest.finalAmount)} • ID: ${escapeHtml(latest.orderId)}</p>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full text-[10px] font-black ${isUtrFix ? "bg-rose-600 text-white" : "bg-amber-500 text-slate-950"}">
          ${isUtrFix ? "ACTION REQUIRED" : "15–30 Min Verification"}
        </span>
      </div>
      ${isUtrFix && latest.adminNote ? `<p class="text-xs font-bold text-rose-800 bg-white/80 p-2 rounded-xl border border-rose-200">एडमिन संदेश: ${escapeHtml(latest.adminNote)}</p>` : ""}
      <div class="flex flex-wrap gap-2">
        ${isUtrFix
          ? `<button type="button" onclick="openUtrCorrectionModal('${escapeHtml(latest.orderId)}')" class="bg-rose-600 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow"><i class="fa-solid fa-pen mr-1"></i> सही UTR दोबारा डालें</button>`
          : `<button type="button" onclick="generateOrderReceiptPDF('${escapeHtml(latest.orderId)}')" class="bg-slate-900 text-amber-300 font-extrabold px-3.5 py-2 rounded-xl text-xs shadow"><i class="fa-solid fa-file-pdf mr-1"></i> रसीद PDF डाउनलोड</button>`
        }
        <button type="button" onclick="switchStudentTab('mystudy', 'orders')" class="bg-indigo-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs">लाइव स्टेटस देखें</button>
        <a href="${buildWhatsAppHelpLink(waMsg)}" target="_blank" class="bg-emerald-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i> WhatsApp Help</a>
      </div>
    </div>
  `;
}

function renderHomeDashboard() {
  renderHomeBanners();
  renderHomePendingOrderBanner();

  const featBox = document.getElementById("homeFeaturedBatches");
  if (featBox) {
    const batches = Object.values(APP_STATE.batches || {})
      .filter((b) => b && b.status !== "HIDDEN")
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 6);

    featBox.innerHTML = batches.length
      ? batches.map((b) => buildBatchCardHTML(b)).join("")
      : `<div class="sm:col-span-2 lg:col-span-3 ed-card p-6 rounded-2xl text-center text-xs font-bold text-slate-400">नए ऑनलाइन बैचेस जल्द ही जोड़े जाएंगे।</div>`;
  }

  const testsBox = document.getElementById("homeFreeTests");
  if (testsBox) {
    const freeTests = Object.values(APP_STATE.tests || {})
      .filter((t) => t && t.status === "ACTIVE" && t.isFree)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 4);

    testsBox.innerHTML = freeTests.length
      ? freeTests.map((t) => `
          <div class="ed-card p-3.5 rounded-2xl flex items-center justify-between gap-3">
            <div class="min-w-0">
              <span class="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded-full">FREE CBT TEST</span>
              <h4 class="font-extrabold text-xs sm:text-sm mt-1 truncate">${escapeHtml(t.title)}</h4>
              <p class="text-[11px] text-slate-500">${(t.questions || []).length} सवाल • ${t.duration || 30} मिनट • +${t.plusMark || 4}/-${t.minusMark || 1}</p>
            </div>
            <button type="button" onclick="openCBTTestOverview('${escapeHtml(t.testId)}')" class="bg-pink-600 hover:bg-pink-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shrink-0 shadow">टेस्ट दें</button>
          </div>
        `).join("")
      : `<div class="sm:col-span-2 ed-card p-5 rounded-2xl text-center text-xs font-bold text-slate-400">अभी कोई फ्री ऑनलाइन टेस्ट लाइव नहीं है।</div>`;
  }
}

// =========================================================
// 2. BATCHES CATALOG, FILTERS & ENROLLMENT STATUS HELPERS
// =========================================================
function isStudentEnrolledInBatch(batchId) {
  const b = APP_STATE.batches[batchId];
  if (APP_STATE.isAdmin) return true;
  if (b && b.isFree) {
    const enr = APP_STATE.enrollments[batchId];
    return Boolean(enr && enr.active);
  }
  const enr = APP_STATE.enrollments[batchId];
  if (!enr || !enr.active) return false;
  if (enr.expiresAt && Number(enr.expiresAt) < Date.now()) return false;
  return true;
}

function getPendingOrderForBatch(batchId) {
  return Object.values(APP_STATE.orders || {}).find(
    (o) => o && o.orderType === "COURSE" && o.itemId === batchId && (o.status === "PENDING_VERIFICATION" || o.status === "UTR_CORRECTION_REQUIRED")
  );
}

function buildBatchCardHTML(b) {
  const enrolled = isStudentEnrolledInBatch(b.batchId);
  const pendingOrd = !enrolled ? getPendingOrderForBatch(b.batchId) : null;
  const price = b.isFree ? 0 : Number(b.offerPrice || b.price || 0);
  const mrp = Number(b.mrp || price);
  const discountPct = !b.isFree && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return `
    <div class="ed-card ed-card-hover rounded-2xl overflow-hidden flex flex-col justify-between">
      <div>
        <div class="relative h-36 bg-slate-900 overflow-hidden cursor-pointer" onclick="openBatchDetailModal('${escapeHtml(b.batchId)}')">
          ${b.thumbnail
            ? `<img src="${escapeHtml(b.thumbnail)}" alt="${escapeHtml(b.title)}" class="w-full h-full object-cover" />`
            : `<div class="w-full h-full hero-gradient flex flex-col items-center justify-center p-4 text-center text-white">
                <i class="fa-solid fa-graduation-cap text-3xl text-amber-300 mb-1.5"></i>
                <span class="text-xs font-extrabold line-clamp-2">${escapeHtml(b.title)}</span>
              </div>`
          }
          <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-black shadow ${b.isFree ? "bg-emerald-500 text-white" : "bg-amber-400 text-slate-950"}">
            ${b.isFree ? "FREE BATCH" : (discountPct > 0 ? `${discountPct}% OFF` : "PAID BATCH")}
          </span>
          <span class="absolute bottom-2 right-2 bg-slate-950/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
            ${escapeHtml(b.category || "All")}
          </span>
        </div>

        <div class="p-3.5 space-y-1.5">
          <h3 class="font-extrabold text-sm leading-snug line-clamp-2 cursor-pointer" onclick="openBatchDetailModal('${escapeHtml(b.batchId)}')">${escapeHtml(b.title)}</h3>
          <p class="text-[11px] text-slate-500 line-clamp-2">${escapeHtml(b.tagline || b.description || "Live & Recorded Classes, PDF Notes & CBT Test Series")}</p>
          <div class="flex items-center justify-between pt-1 text-[11px] font-bold text-slate-500">
            <span><i class="fa-regular fa-clock mr-1 text-indigo-500"></i>${b.validityDays || 365} दिन वैधता</span>
            <span><i class="fa-solid fa-language mr-1 text-indigo-500"></i>${escapeHtml(b.medium || "Hindi / Eng")}</span>
          </div>
        </div>
      </div>

      <div class="px-3.5 pb-3.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          ${b.isFree
            ? `<span class="text-base font-black text-emerald-600">FREE</span>`
            : `<div class="flex items-baseline gap-1.5">
                <span class="text-base font-black text-indigo-700">${formatCurrency(price)}</span>
                ${mrp > price ? `<span class="text-[11px] line-through text-slate-400 font-bold">${formatCurrency(mrp)}</span>` : ""}
              </div>`
          }
        </div>
        ${enrolled
          ? `<button type="button" onclick="openBatchClassroom('${escapeHtml(b.batchId)}')" class="emerald-gradient text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow"><i class="fa-solid fa-play mr-1"></i>पढ़ें (Open)</button>`
          : pendingOrd
            ? `<button type="button" onclick="switchStudentTab('mystudy','orders')" class="bg-amber-500 text-slate-950 font-extrabold px-3 py-2 rounded-xl text-xs shadow">⏳ Verifying</button>`
            : `<button type="button" onclick="openBatchDetailModal('${escapeHtml(b.batchId)}')" class="brand-gradient text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow">${b.isFree ? "फ्री जॉइन करें" : "विवरण / खरीदें"}</button>`
        }
      </div>
    </div>
  `;
}

function renderAllBatchesGrid() {
  const chipsEl = document.getElementById("batchCategoryChips");
  if (chipsEl) {
    chipsEl.innerHTML = APP_CONFIG.categories.map((cat) => `
      <button type="button" onclick="selectBatchCategory('${escapeHtml(cat)}')" class="category-chip ${selectedBatchCategory === cat ? "active" : ""} px-3.5 py-1.5 rounded-xl text-xs font-extrabold">
        ${escapeHtml(cat)}
      </button>
    `).join("");
  }

  const container = document.getElementById("allBatchesContainer");
  if (!container) return;

  const q = (document.getElementById("batchSearchInput")?.value || "").trim().toLowerCase();
  const priceMode = document.getElementById("batchPriceFilter")?.value || "ALL";

  const filtered = Object.values(APP_STATE.batches || {})
    .filter((b) => {
      if (!b || b.status === "HIDDEN") return false;
      if (selectedBatchCategory !== "All" && b.category !== selectedBatchCategory) return false;
      if (priceMode === "FREE" && !b.isFree) return false;
      if (priceMode === "PAID" && b.isFree) return false;
      if (q) {
        const hay = `${b.title || ""} ${b.category || ""} ${b.description || ""} ${b.tagline || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  container.innerHTML = filtered.length
    ? filtered.map((b) => buildBatchCardHTML(b)).join("")
    : `<div class="sm:col-span-2 lg:col-span-3 ed-card p-8 rounded-2xl text-center text-xs font-bold text-slate-400">इस कैटेगरी में अभी कोई बैच उपलब्ध नहीं है।</div>`;
}

function selectBatchCategory(cat) {
  selectedBatchCategory = cat;
  renderAllBatchesGrid();
}

function renderMyEnrolledBatches() {
  const box = document.getElementById("myEnrolledBatchesBox");
  if (!box) return;

  const myList = Object.entries(APP_STATE.enrollments || {})
    .filter(([bId, enr]) => enr && enr.active && APP_STATE.batches[bId])
    .map(([bId, enr]) => ({ batch: APP_STATE.batches[bId], enr }))
    .sort((a, b) => (b.enr.enrolledAt || 0) - (a.enr.enrolledAt || 0));

  if (!myList.length) {
    box.innerHTML = `
      <div class="sm:col-span-2 ed-card p-7 rounded-2xl text-center space-y-3">
        <i class="fa-solid fa-book-open-reader text-3xl text-indigo-400"></i>
        <h4 class="text-sm font-extrabold">अभी आपने कोई बैच जॉइन नहीं किया है</h4>
        <p class="text-xs text-slate-500">फ्री और पेड कोर्सेज देखने के लिए Batches टैब में जाएं।</p>
        <button type="button" onclick="switchStudentTab('batches')" class="brand-gradient text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow">सभी बैच देखें</button>
      </div>
    `;
    return;
  }

  box.innerHTML = myList.map(({ batch, enr }) => {
    const expired = !batch.isFree && enr.expiresAt && Number(enr.expiresAt) < Date.now();
    const daysLeft = enr.expiresAt ? Math.max(0, Math.ceil((Number(enr.expiresAt) - Date.now()) / 86400000)) : 365;
    return `
      <div class="ed-card p-4 rounded-2xl space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${expired ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}">
              ${expired ? "EXPIRED" : (batch.isFree ? "FREE ACTIVE" : `ACTIVE • ${daysLeft} दिन शेष`)}
            </span>
            <h4 class="font-extrabold text-sm mt-1">${escapeHtml(batch.title)}</h4>
            <p class="text-[11px] text-slate-500">${escapeHtml(batch.category || "")} • वैधता: ${enr.expiresAt ? formatDateOnly(enr.expiresAt) : "Unlimited"}</p>
          </div>
        </div>
        ${expired
          ? `<button type="button" onclick="openBatchDetailModal('${escapeHtml(batch.batchId)}')" class="w-full bg-amber-500 text-slate-950 font-extrabold py-2.5 rounded-xl text-xs">कोर्स रिन्यू करें (Renew)</button>`
          : `<button type="button" onclick="openBatchClassroom('${escapeHtml(batch.batchId)}')" class="w-full brand-gradient text-white font-extrabold py-2.5 rounded-xl text-xs shadow flex items-center justify-center gap-1.5"><i class="fa-solid fa-chalkboard-user"></i> क्लासरूम खोलें (Videos, Notes & DPP)</button>`
        }
      </div>
    `;
  }).join("");
}

// =========================================================
// 3. BATCH DETAILS MODAL, DEMO VIDEO & COUPON CODE ENGINE
// =========================================================
function openBatchDetailModal(batchId) {
  const b = APP_STATE.batches[batchId];
  if (!b) return;
  activeBatchCoupon = null;

  const enrolled = isStudentEnrolledInBatch(batchId);
  const pendingOrd = !enrolled ? getPendingOrderForBatch(batchId) : null;
  const basePrice = b.isFree ? 0 : Number(b.offerPrice || b.price || 0);
  const mrp = Number(b.mrp || basePrice);
  const features = (b.features || "Live & Recorded HD Classes\nProtected PDF Notes & eBooks\nChapter-wise DPP Homework\nOnline CBT Test Series\nDirect Teacher Doubt Support").split("\n").filter(Boolean);

  document.getElementById("batchDetailModalTitle").textContent = b.title;
  document.getElementById("batchDetailModalBody").innerHTML = `
    <div class="rounded-2xl overflow-hidden border border-slate-200">
      ${b.thumbnail
        ? `<img src="${escapeHtml(b.thumbnail)}" class="w-full h-44 object-cover" />`
        : `<div class="hero-gradient text-white p-6 text-center"><i class="fa-solid fa-graduation-cap text-4xl text-amber-300"></i><h3 class="text-lg font-extrabold mt-2">${escapeHtml(b.title)}</h3></div>`
      }
    </div>

    <div class="flex flex-wrap items-center gap-2 text-[11px] font-extrabold">
      <span class="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg">${escapeHtml(b.category || "All")}</span>
      <span class="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg"><i class="fa-regular fa-clock mr-1"></i>वैधता: ${b.validityDays || 365} दिन</span>
      <span class="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">${escapeHtml(b.medium || "Hindi / English")}</span>
    </div>

    <p class="text-xs text-slate-600 leading-relaxed whitespace-pre-line">${escapeHtml(b.description || "")}</p>

    <div class="bg-slate-50 p-3.5 rounded-2xl border space-y-1.5">
      <h4 class="text-xs font-extrabold text-indigo-900"><i class="fa-solid fa-star text-amber-500 mr-1"></i> इस बैच में क्या-क्या मिलेगा:</h4>
      <ul class="space-y-1 text-xs font-semibold text-slate-700">
        ${features.map((f) => `<li><i class="fa-solid fa-circle-check text-emerald-600 mr-1.5"></i>${escapeHtml(f)}</li>`).join("")}
      </ul>
    </div>

    ${b.demoVideoUrl ? `
      <button type="button" onclick="openProtectedVideoPlayer({ lectureId:'DEMO_${escapeHtml(b.batchId)}', batchId:'${escapeHtml(b.batchId)}', title:'Demo Class — ${escapeHtml(b.title)}', videoUrl:'${escapeHtml(b.demoVideoUrl)}', isDemo:true })" class="w-full bg-slate-900 text-amber-300 font-extrabold py-2.5 rounded-xl text-xs shadow flex items-center justify-center gap-2">
        <i class="fa-solid fa-circle-play text-sm"></i> फ्री डेमो क्लास देखें (Watch Free Demo)
      </button>
    ` : ""}

    ${!b.isFree && !enrolled && !pendingOrd ? `
      <div class="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl space-y-2">
        <label class="block text-[11px] font-extrabold text-indigo-900"><i class="fa-solid fa-tag mr-1"></i> क्या आपके पास डिस्काउंट कूपन कोड है?</label>
        <div class="flex gap-2">
          <input type="text" id="batchCouponInput" placeholder="जैसे: GURUKUL20" class="ed-input flex-1 px-3 py-2 rounded-xl text-xs font-extrabold uppercase bg-white" />
          <button type="button" onclick="applyCourseCouponCode('${escapeHtml(b.batchId)}')" class="bg-indigo-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs">Apply</button>
        </div>
        <div id="batchCouponStatusMsg" class="text-[11px] font-bold"></div>
      </div>
    ` : ""}

    <div class="pt-2 border-t flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-[10px] font-bold text-slate-500">कुल देय राशि (0% Extra Fee)</div>
        <div class="flex items-baseline gap-2">
          <span id="batchModalFinalPrice" class="text-xl font-black text-indigo-700">${b.isFree ? "FREE (₹0)" : formatCurrency(basePrice)}</span>
          ${!b.isFree && mrp > basePrice ? `<span class="text-xs line-through text-slate-400 font-bold">${formatCurrency(mrp)}</span>` : ""}
        </div>
      </div>

      ${enrolled
        ? `<button type="button" onclick="closeModalById('batchDetailModal'); openBatchClassroom('${escapeHtml(b.batchId)}')" class="emerald-gradient text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-lg"><i class="fa-solid fa-play mr-1"></i> क्लासरूम खोलें</button>`
        : pendingOrd
          ? `<button type="button" onclick="closeModalById('batchDetailModal'); switchStudentTab('mystudy','orders')" class="bg-amber-500 text-slate-950 font-extrabold px-5 py-3 rounded-xl text-xs shadow">⏳ पेमेंट वेरिफिकेशन जारी है</button>`
          : b.isFree
            ? `<button type="button" onclick="enrollInFreeBatch('${escapeHtml(b.batchId)}')" class="emerald-gradient text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-lg"><i class="fa-solid fa-check-double mr-1"></i> अभी फ्री जॉइन करें</button>`
            : `<button type="button" onclick="startCourseUpiCheckout('${escapeHtml(b.batchId)}')" class="brand-gradient text-white font-extrabold px-6 py-3 rounded-xl text-xs shadow-lg"><i class="fa-solid fa-lock mr-1"></i> Buy Now (UPI पेमेंट)</button>`
      }
    </div>
  `;

  openModalById("batchDetailModal");
}

async function applyCourseCouponCode(batchId) {
  const b = APP_STATE.batches[batchId];
  const code = (document.getElementById("batchCouponInput")?.value || "").trim().toUpperCase();
  const msgEl = document.getElementById("batchCouponStatusMsg");
  if (!b || !code) return;

  const snap = await db.ref(`coupons/${code}`).once("value");
  const c = snap.val();
  if (!c || !c.active) {
    activeBatchCoupon = null;
    msgEl.className = "text-[11px] font-bold text-rose-600";
    msgEl.textContent = "❌ यह कूपन कोड अमान्य या एक्सपायर हो चुका है।";
    document.getElementById("batchModalFinalPrice").textContent = formatCurrency(b.offerPrice || b.price || 0);
    return;
  }

  if (c.expiresAt && Number(c.expiresAt) < Date.now()) {
    activeBatchCoupon = null;
    msgEl.className = "text-[11px] font-bold text-rose-600";
    msgEl.textContent = "❌ इस कूपन कोड की समय-सीमा समाप्त हो गई है।";
    return;
  }

  const basePrice = Number(b.offerPrice || b.price || 0);
  const discAmt = c.discountType === "FLAT"
    ? Math.min(basePrice, Number(c.discountValue) || 0)
    : Math.round((basePrice * (Number(c.discountValue) || 0)) / 100);
  const finalPrice = Math.max(1, basePrice - discAmt);

  activeBatchCoupon = { code, discountAmount: discAmt, finalPrice };
  msgEl.className = "text-[11px] font-extrabold text-emerald-700";
  msgEl.textContent = `✅ कूपन '${code}' लागू हुआ! आपको ${formatCurrency(discAmt)} की छूट मिली।`;
  document.getElementById("batchModalFinalPrice").textContent = formatCurrency(finalPrice);
  showToast(`कूपन ${code} लागू हो गया!`, "SUCCESS");
}

async function enrollInFreeBatch(batchId) {
  const b = APP_STATE.batches[batchId];
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  if (!b || !uid || !b.isFree) return;

  const validityMs = (Number(b.validityDays) || 365) * 86400000;
  await db.ref(`enrollments/${uid}/${batchId}`).set({
    batchId,
    batchTitle: b.title,
    active: true,
    isFreeEnroll: true,
    enrolledAt: Date.now(),
    expiresAt: Date.now() + validityMs
  });

  closeModalById("batchDetailModal");
  showToast(`बधाई हो! आप '${b.title}' में जुड़ गए हैं।`, "SUCCESS");
  openBatchClassroom(batchId);
}

function startCourseUpiCheckout(batchId) {
  const b = APP_STATE.batches[batchId];
  if (!b) return;
  const basePrice = Number(b.offerPrice || b.price || 0);
  const discountAmount = activeBatchCoupon ? activeBatchCoupon.discountAmount : 0;
  const finalAmount = activeBatchCoupon ? activeBatchCoupon.finalPrice : basePrice;

  closeModalById("batchDetailModal");
  openUnifiedUpiCheckout({
    orderType: "COURSE",
    itemId: batchId,
    title: b.title,
    validityDays: Number(b.validityDays) || 365,
    originalPrice: basePrice,
    discountAmount,
    couponCode: activeBatchCoupon ? activeBatchCoupon.code : "",
    finalAmount
  });
}

// =========================================================
// 4. ZERO-PANIC UNIFIED UPI CHECKOUT (COURSE + BOOK STORE)
// =========================================================
function openUnifiedUpiCheckout(payload) {
  const pay = getLivePaymentConfig();
  const orderId = payload.existingOrderId || generateUniqueOrderId(payload.orderType === "BOOK" ? "BKS" : "CRS");
  const upiUri = buildUpiDeepLink(payload.finalAmount, orderId, `${payload.orderType}: ${payload.title}`.slice(0, 45));
  const qrImg = buildQrImageUrl(upiUri, 230);

  activeCheckoutContext = { ...payload, orderId, upiIdSnapshot: pay.upiId, holderSnapshot: pay.accountHolder };

  document.getElementById("checkoutModalTitle").textContent = payload.existingOrderId
    ? `सही UTR दोबारा सबमिट करें (${orderId})`
    : `सुरक्षित UPI पेमेंट — ${formatCurrency(payload.finalAmount)}`;

  document.getElementById("upiCheckoutModalBody").innerHTML = `
    <!-- Order Summary Card -->
    <div class="p-3.5 rounded-2xl bg-slate-50 border space-y-1 text-xs">
      <div class="flex justify-between font-bold text-slate-500">
        <span>Order ID: <strong class="text-slate-900">${escapeHtml(orderId)}</strong></span>
        <span class="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-black text-[10px]">${payload.orderType === "BOOK" ? "BOOK STORE (ONLINE ONLY)" : "ONLINE COURSE"}</span>
      </div>
      <div class="font-extrabold text-sm text-slate-900">${escapeHtml(payload.title)}</div>
      <div class="flex items-center justify-between pt-1.5 border-t border-slate-200">
        <span class="font-bold text-slate-600">देय राशि (0% Gateway Charge):</span>
        <span class="text-lg font-black text-emerald-700">${formatCurrency(payload.finalAmount)}</span>
      </div>
    </div>

    <!-- Step 1: 1-Tap UPI App OR Scan Dynamic QR -->
    <div class="p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 space-y-3 text-center">
      <div class="text-xs font-extrabold text-indigo-950">स्टेप 1: नीचे बटन से पेमेंट करें या QR कोड स्कैन करें</div>

      <img src="${qrImg}" alt="UPI QR" class="w-48 h-48 mx-auto rounded-2xl border-4 border-white shadow-lg bg-white p-1" />

      <div class="bg-white p-2.5 rounded-xl border text-xs space-y-1">
        <div class="text-[10px] font-bold text-slate-500">ऑफिशियल पेमेंट अकाउंट (ध्यान से नाम मिलाएं):</div>
        <div class="font-extrabold text-slate-900">${escapeHtml(pay.accountHolder)}</div>
        <div class="flex items-center justify-center gap-2">
          <code class="bg-slate-100 px-2.5 py-1 rounded-lg font-mono font-bold text-indigo-700">${escapeHtml(pay.upiId)}</code>
          <button type="button" onclick="copyLiveUpiId('${escapeHtml(pay.upiId)}')" class="bg-slate-900 text-amber-300 px-2.5 py-1 rounded-lg text-[10px] font-extrabold">Copy UPI</button>
        </div>
      </div>

      <a href="${escapeHtml(upiUri)}" class="w-full inline-flex items-center justify-center gap-2 brand-gradient text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-lg">
        <i class="fa-solid fa-mobile-screen-button"></i> PhonePe / GPay / Paytm से 1-Tap पेमेंट करें
      </a>
      <p class="text-[10px] text-slate-500 leading-snug">
        यदि किसी UPI ऐप में डायरेक्ट बटन न खुले, तो ऊपर दिया गया <strong>QR कोड स्कैन</strong> करें या <strong>UPI ID कॉपी</strong> करके ठीक <strong>${formatCurrency(payload.finalAmount)}</strong> भेजें।
      </p>
    </div>

    <!-- Step 2: Enter 12-Digit UTR & Optional Screenshot -->
    <div class="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3">
      <div class="text-xs font-extrabold text-emerald-950">स्टेप 2: पेमेंट पूरा होने के बाद 12-अंकों का UTR / Ref No. डालें</div>
      <div>
        <label class="block text-[11px] font-bold text-slate-700 mb-1">12-Digit UTR / UPI Reference Number *</label>
        <input type="text" id="checkoutUtrInput" maxlength="20" placeholder="उदाहरण: 632918450123" class="ed-input w-full px-3.5 py-2.5 rounded-xl text-sm font-extrabold tracking-wider bg-white" />
      </div>
      <div>
        <label class="block text-[11px] font-bold text-slate-700 mb-1">पेमेंट स्क्रीनशॉट अपलोड करें (वैकल्पिक, जल्दी अप्रूवल के लिए)</label>
        <input type="file" id="checkoutProofFile" accept="image/*" class="ed-input w-full px-3 py-1.5 rounded-xl text-xs bg-white" />
      </div>

      <!-- Zero-Panic Reassurance Badge -->
      <div class="bg-white p-2.5 rounded-xl border border-emerald-200 text-[11px] text-slate-700 font-semibold leading-relaxed">
        <i class="fa-solid fa-shield-heart text-emerald-600 mr-1"></i>
        <strong>घबराएं नहीं (100% सुरक्षित):</strong> सबमिट करते ही आपको तुरंत <strong>Provisional Receipt PDF</strong> और <strong>Email प्रूफ</strong> मिल जाएगा। एडमिन 15–30 मिनट में UTR मिलाकर आपका ${payload.orderType === "BOOK" ? "बुक ऑर्डर कन्फर्म" : "कोर्स तुरंत चालू"} कर देंगे।
      </div>

      <button type="button" id="btnSubmitUpiPayment" onclick="submitUpiPaymentOrder()" class="w-full emerald-gradient text-white font-extrabold py-3.5 rounded-xl text-sm shadow-xl flex items-center justify-center gap-2">
        <i class="fa-solid fa-circle-check"></i> मैंने पेमेंट कर दिया — UTR सबमिट करें
      </button>
    </div>
  `;

  openModalById("upiCheckoutModal");
}

function copyLiveUpiId(upiId) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(upiId).then(() => showToast(`UPI ID कॉपी हो गई: ${upiId}`, "SUCCESS"));
  } else {
    showToast(`UPI ID: ${upiId}`, "INFO");
  }
}

async function submitUpiPaymentOrder() {
  if (!activeCheckoutContext || !APP_STATE.currentUser) return;

  const utr = (document.getElementById("checkoutUtrInput")?.value || "").trim().replace(/\s+/g, "");
  if (!utr || utr.length < 10) {
    return showAppAlert("कृपया PhonePe/GPay/Paytm की रसीद से सही 12-अंकों का UTR / UPI Ref नंबर दर्ज करें।", "सही UTR आवश्यक", "DANGER");
  }

  const btn = document.getElementById("btnSubmitUpiPayment");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> सुरक्षित सेव हो रहा है...';

  try {
    let proofBase64 = "";
    const fileInput = document.getElementById("checkoutProofFile");
    if (fileInput && fileInput.files && fileInput.files[0]) {
      proofBase64 = await compressImageToBase64(fileInput.files[0], 640, 0.68);
    }

    const uid = APP_STATE.currentUser.uid;
    const p = APP_STATE.userProfile || {};
    const ctx = activeCheckoutContext;

    const orderRecord = {
      orderId: ctx.orderId,
      uid,
      studentCode: p.studentCode || "",
      studentName: p.name || "Student",
      studentEmail: p.email || APP_STATE.currentUser.email || "",
      studentPhone: p.phone || "",
      orderType: ctx.orderType,
      itemId: ctx.itemId || "",
      title: ctx.title,
      validityDays: ctx.validityDays || 365,
      items: ctx.items || null,
      shippingAddress: ctx.shippingAddress || null,
      originalPrice: Number(ctx.originalPrice || ctx.finalAmount),
      discountAmount: Number(ctx.discountAmount || 0),
      couponCode: ctx.couponCode || "",
      finalAmount: Number(ctx.finalAmount),
      paidToUpi: ctx.upiIdSnapshot,
      utrNumber: utr,
      proofBase64: proofBase64 || (ctx.existingProofBase64 || ""),
      status: "PENDING_VERIFICATION",
      shippingStatus: ctx.orderType === "BOOK" ? "PAYMENT_VERIFYING" : "",
      courierTracking: "",
      adminNote: "",
      createdAt: ctx.existingCreatedAt || Date.now(),
      updatedAt: Date.now()
    };

    await db.ref(`orders/${uid}/${ctx.orderId}`).set(orderRecord);
    APP_STATE.orders[ctx.orderId] = orderRecord;

    // Clear Book Cart if this was a Book Store purchase
    if (ctx.orderType === "BOOK" && !ctx.existingOrderId) {
      APP_STATE.cart = [];
      localStorage.setItem("GURUKUL_BOOK_CART", "[]");
      updateHeaderCartBadges();
    }

    // Send Automatic Official Confirmation Email (Zero-Panic Proof)
    if (orderRecord.studentEmail) {
      sendAppEmail({
        to: orderRecord.studentEmail,
        type: "RECEIPT",
        subject: `पेमेंट सुरक्षित प्राप्त हुआ (${orderRecord.orderId}) — ${APP_CONFIG.appName}`,
        htmlBody: buildOfficialEmailHTML({
          heading: "आपका ऑनलाइन पेमेंट सुरक्षित सबमिट हो गया है ✅",
          userName: orderRecord.studentName,
          bodyHtml: `
            <p>निश्चिंत रहें! आपका पेमेंट विवरण हमारे सिस्टम में सुरक्षित दर्ज हो गया है:</p>
            <div style="background:#f0fdf4;border:1.5px solid #16a34a;padding:14px;border-radius:12px;margin:12px 0;">
              <strong>Order ID:</strong> ${orderRecord.orderId}<br/>
              <strong>Item:</strong> ${escapeHtml(orderRecord.title)}<br/>
              <strong>Amount Paid:</strong> ${formatCurrency(orderRecord.finalAmount)}<br/>
              <strong>UTR / Ref No.:</strong> ${escapeHtml(orderRecord.utrNumber)}<br/>
              <strong>Current Status:</strong> Verifying (सामान्यतः 15–30 मिनट में अप्रूव हो जाएगा)
            </div>
            <p>अप्रूवल होते ही आपको ऐप में नोटिफिकेशन और ईमेल मिल जाएगा। किसी भी सहायता के लिए हेल्पलाइन <strong>${APP_CONFIG.helplines.join(", ")}</strong> पर संपर्क करें।</p>
          `
        })
      }).catch(() => {});
    }

    triggerAlertFeedback();
    showZeroPanicSuccessScreen(orderRecord);
  } catch (err) {
    console.error("Order Submit Error:", err);
    await showAppAlert("ऑर्डर सेव करने में समस्या आई: " + (err.message || "कृपया दोबारा प्रयास करें"), "त्रुटि", "DANGER");
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> मैंने पेमेंट कर दिया — UTR सबमिट करें';
  }
}

function showZeroPanicSuccessScreen(ord) {
  const waMsg = `Namaste Sir, maine GURUKUL ONLINE APP me payment submit kar diya hai.\nOrder ID: ${ord.orderId}\nItem: ${ord.title}\nAmount: Rs.${ord.finalAmount}\nUTR: ${ord.utrNumber}\nPlease approve kar dijiye.`;

  document.getElementById("checkoutModalTitle").textContent = "पेमेंट सुरक्षित सबमिट हुआ ✅";
  document.getElementById("upiCheckoutModalBody").innerHTML = `
    <div class="text-center space-y-3 py-2">
      <div class="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-inner">
        <i class="fa-solid fa-circle-check"></i>
      </div>
      <div>
        <span class="bg-emerald-600 text-white text-[10px] font-black px-3 py-0.5 rounded-full uppercase">100% Safe & Recorded</span>
        <h3 class="text-lg font-extrabold text-slate-900 mt-1.5">चिंता न करें! आपका पेमेंट सुरक्षित दर्ज हो गया है</h3>
        <p class="text-xs text-slate-600 mt-1">आपकी ईमेल पर कन्फर्मेशन प्रूफ भेज दिया गया है। एडमिन UTR चेक करके 15–30 मिनट में इसे एक्टिवेट कर देंगे।</p>
      </div>

      <!-- Live Zero-Panic Stepper -->
      <div class="bg-slate-50 p-3.5 rounded-2xl border text-left space-y-2 text-xs">
        <div class="flex items-center gap-2.5 text-emerald-700 font-extrabold">
          <i class="fa-solid fa-circle-check"></i> 1. Payment & UTR Submitted (${escapeHtml(ord.utrNumber)})
        </div>
        <div class="flex items-center gap-2.5 text-amber-600 font-extrabold">
          <i class="fa-solid fa-clock fa-spin"></i> 2. Admin UTR Verification (15–30 Min)
        </div>
        <div class="flex items-center gap-2.5 text-slate-400 font-bold">
          <i class="fa-regular fa-circle"></i> 3. ${ord.orderType === "BOOK" ? "Order Confirmed & Packed for Delivery" : "Course Automatically Unlocked in My Study"}
        </div>
      </div>

      <div class="grid sm:grid-cols-2 gap-2 pt-2">
        <button type="button" onclick="generateOrderReceiptPDF('${escapeHtml(ord.orderId)}')" class="bg-slate-900 text-amber-300 font-extrabold py-3 px-4 rounded-xl text-xs shadow flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-file-pdf"></i> Provisional Receipt PDF
        </button>
        <a href="${buildWhatsAppHelpLink(waMsg)}" target="_blank" class="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow flex items-center justify-center gap-1.5">
          <i class="fa-brands fa-whatsapp text-sm"></i> WhatsApp Fast Approval
        </a>
      </div>

      <button type="button" onclick="closeModalById('upiCheckoutModal'); switchStudentTab('mystudy','orders')" class="w-full bg-indigo-100 text-indigo-800 font-extrabold py-2.5 rounded-xl text-xs">
        मेरे पेमेंट्स और लाइव ट्रैकर में जाएं
      </button>
    </div>
  `;
}

function openUtrCorrectionModal(orderId) {
  const ord = APP_STATE.orders[orderId];
  if (!ord) return;
  openUnifiedUpiCheckout({
    orderType: ord.orderType,
    itemId: ord.itemId,
    title: ord.title,
    validityDays: ord.validityDays || 365,
    items: ord.items || null,
    shippingAddress: ord.shippingAddress || null,
    originalPrice: ord.originalPrice,
    discountAmount: ord.discountAmount,
    couponCode: ord.couponCode,
    finalAmount: ord.finalAmount,
    existingOrderId: ord.orderId,
    existingProofBase64: ord.proofBase64 || "",
    existingCreatedAt: ord.createdAt
  });
}

// =========================================================
// 5. STUDENT ORDERS & ZERO-PANIC TRACKER + RECEIPT PDF
// =========================================================
function renderStudentOrdersTracker() {
  const box = document.getElementById("myOrdersTrackerBox");
  if (!box) return;

  const list = Object.values(APP_STATE.orders || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!list.length) {
    box.innerHTML = `<div class="ed-card p-8 rounded-2xl text-center text-xs font-bold text-slate-400">अभी तक आपका कोई कोर्स पेमेंट या बुक ऑर्डर नहीं है।</div>`;
    return;
  }

  box.innerHTML = list.map((o) => {
    const statusMap = {
      PENDING_VERIFICATION: { label: "⏳ वेरिफिकेशन जारी (15–30 Min)", cls: "bg-amber-100 text-amber-900" },
      APPROVED: { label: "✅ कन्फर्म / एक्टिव", cls: "bg-emerald-100 text-emerald-800" },
      UTR_CORRECTION_REQUIRED: { label: "⚠️ सही UTR दोबारा डालें", cls: "bg-rose-100 text-rose-800" },
      REJECTED: { label: "❌ अस्वीकृत (Rejected)", cls: "bg-rose-100 text-rose-700" }
    };
    const st = statusMap[o.status] || statusMap.PENDING_VERIFICATION;
    const waMsg = `Namaste Sir, Help regarding Order ID: ${o.orderId}, UTR: ${o.utrNumber}, Amount: Rs.${o.finalAmount} (${o.title}).`;

    // Book delivery progress tracker
    let bookProgressHtml = "";
    if (o.orderType === "BOOK" && o.status === "APPROVED") {
      const stages = ["PLACED", "PACKED", "SHIPPED", "DELIVERED"];
      const curIdx = Math.max(0, stages.indexOf(o.shippingStatus || "PLACED"));
      bookProgressHtml = `
        <div class="bg-slate-50 p-3 rounded-xl border space-y-2">
          <div class="text-[11px] font-extrabold text-indigo-900"><i class="fa-solid fa-truck-fast mr-1"></i> लाइव डिलीवरी ट्रैकिंग:</div>
          <div class="grid grid-cols-4 gap-1 text-center text-[10px] font-extrabold">
            ${stages.map((s, i) => `
              <div class="py-1.5 px-1 rounded-lg ${i <= curIdx ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}">${s}</div>
            `).join("")}
          </div>
          ${o.courierTracking ? `<p class="text-[11px] font-bold text-slate-700">कूरियर ट्रैकिंग / विवरण: <span class="text-indigo-700">${escapeHtml(o.courierTracking)}</span></p>` : ""}
        </div>
      `;
    }

    return `
      <div class="ed-card p-4 rounded-2xl space-y-2.5 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="font-mono font-extrabold text-indigo-700">${escapeHtml(o.orderId)}</span>
            <span class="ml-1.5 text-[10px] text-slate-400">${formatDateTime(o.createdAt)}</span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-black ${st.cls}">${st.label}</span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-extrabold text-sm">${escapeHtml(o.title)}</div>
            <div class="text-[11px] text-slate-500">UTR: <strong>${escapeHtml(o.utrNumber || "-")}</strong> • टाइप: ${o.orderType === "BOOK" ? "Book Store" : "Online Course"}</div>
          </div>
          <div class="text-base font-black text-emerald-700">${formatCurrency(o.finalAmount)}</div>
        </div>

        ${o.adminNote ? `<div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold text-[11px]">एडमिन नोट: ${escapeHtml(o.adminNote)}</div>` : ""}
        ${bookProgressHtml}

        <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button type="button" onclick="generateOrderReceiptPDF('${escapeHtml(o.orderId)}')" class="bg-slate-900 text-amber-300 font-extrabold px-3 py-1.5 rounded-xl text-[11px]"><i class="fa-solid fa-file-pdf mr-1"></i> रसीद / इनवॉइस PDF</button>
          ${o.status === "UTR_CORRECTION_REQUIRED" ? `<button type="button" onclick="openUtrCorrectionModal('${escapeHtml(o.orderId)}')" class="bg-rose-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-[11px]"><i class="fa-solid fa-pen mr-1"></i> UTR सुधारें</button>` : ""}
          ${o.orderType === "COURSE" && o.status === "APPROVED" ? `<button type="button" onclick="openBatchClassroom('${escapeHtml(o.itemId)}')" class="emerald-gradient text-white font-extrabold px-3 py-1.5 rounded-xl text-[11px]"><i class="fa-solid fa-play mr-1"></i> कोर्स खोलें</button>` : ""}
          <a href="${buildWhatsAppHelpLink(waMsg)}" target="_blank" class="bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1"><i class="fa-brands fa-whatsapp"></i> Help</a>
        </div>
      </div>
    `;
  }).join("");
}

async function generateOrderReceiptPDF(orderId, overrideOrderObj = null) {
  const ord = overrideOrderObj || APP_STATE.orders[orderId];
  if (!ord) return showToast("ऑर्डर विवरण नहीं मिला।", "DANGER");

  const wrap = document.getElementById("pdfPrintWrapper");
  const area = document.getElementById("pdfPrintArea");
  wrap.classList.remove("hidden");

  const isApproved = ord.status === "APPROVED";
  const badgeText = isApproved
    ? (ord.orderType === "BOOK" ? "OFFICIAL TAX INVOICE & ORDER SLIP" : "OFFICIAL COURSE PAYMENT RECEIPT")
    : "PROVISIONAL PAYMENT RECEIPT (VERIFICATION IN PROGRESS)";

  const qr = buildQrImageUrl(`GURUKUL-ONLINE|${ord.orderId}|UTR:${ord.utrNumber}|AMT:${ord.finalAmount}|STATUS:${ord.status}`, 100);

  const itemsHtml = ord.orderType === "BOOK" && Array.isArray(ord.items)
    ? ord.items.map((it, idx) => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;">${escapeHtml(it.title)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">${it.qty}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;text-align:right;font-weight:bold;">${formatCurrency(it.price * it.qty)}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">1</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;">${escapeHtml(ord.title)} (${ord.validityDays || 365} Days Access)</td>
          <td style="border:1px solid #cbd5e1;padding:7px;text-align:center;">1</td>
          <td style="border:1px solid #cbd5e1;padding:7px;text-align:right;font-weight:bold;">${formatCurrency(ord.originalPrice)}</td>
        </tr>
      `;

  area.innerHTML = `
    <div style="border:3px solid #312e81;padding:22px;background:#ffffff;font-family:Arial,sans-serif;box-sizing:border-box;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px double #312e81;padding-bottom:12px;">
        <img src="${APP_CONFIG.logoUrl}" crossorigin="anonymous" style="width:70px;height:70px;object-fit:contain;" />
        <div style="text-align:center;flex:1;padding:0 10px;">
          <h1 style="margin:0;font-size:21px;color:#312e81;font-weight:900;">${APP_CONFIG.appName}</h1>
          <p style="margin:3px 0;font-size:11px;font-weight:bold;color:#1e293b;">${APP_CONFIG.schoolName}</p>
          <p style="margin:2px 0;font-size:10.5px;color:#475569;">${APP_CONFIG.address} | Helpline: ${APP_CONFIG.helplines.join(", ")}</p>
          <span style="display:inline-block;margin-top:6px;background:${isApproved ? "#059669" : "#d97706"};color:#ffffff;padding:4px 14px;border-radius:12px;font-size:10.5px;font-weight:bold;">
            ${badgeText}
          </span>
        </div>
        <img src="${qr}" crossorigin="anonymous" style="width:72px;height:72px;" />
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin:14px 0;">
        <tr>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;width:22%;background:#f8fafc;">Order ID</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:900;color:#312e81;width:28%;">${escapeHtml(ord.orderId)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;width:22%;background:#f8fafc;">Date & Time</td>
          <td style="border:1px solid #cbd5e1;padding:7px;width:28%;">${formatDateTime(ord.createdAt)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;background:#f8fafc;">Student Name</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;">${escapeHtml(ord.studentName)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;background:#f8fafc;">Student ID / Mobile</td>
          <td style="border:1px solid #cbd5e1;padding:7px;">${escapeHtml(ord.studentCode || "-")} | ${escapeHtml(ord.studentPhone || "-")}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;background:#f8fafc;">UPI UTR / Ref No.</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:900;color:#059669;">${escapeHtml(ord.utrNumber)}</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;background:#f8fafc;">Payment Status</td>
          <td style="border:1px solid #cbd5e1;padding:7px;font-weight:bold;color:${isApproved ? "#059669" : "#b45309"};">${escapeHtml(ord.status)}</td>
        </tr>
      </table>

      ${ord.shippingAddress ? `
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;font-size:11.5px;margin-bottom:12px;">
          <strong>Delivery Address:</strong> ${escapeHtml(ord.shippingAddress.fullName)} (${escapeHtml(ord.shippingAddress.phone)}) —
          ${escapeHtml(ord.shippingAddress.addressLine)}, ${escapeHtml(ord.shippingAddress.city)}, ${escapeHtml(ord.shippingAddress.state)} - <strong>${escapeHtml(ord.shippingAddress.pincode)}</strong>
        </div>
      ` : ""}

      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead style="background:#0f172a;color:#ffffff;">
          <tr>
            <th style="border:1px solid #334155;padding:7px;width:10%;">#</th>
            <th style="border:1px solid #334155;padding:7px;text-align:left;">Description</th>
            <th style="border:1px solid #334155;padding:7px;width:12%;">Qty</th>
            <th style="border:1px solid #334155;padding:7px;text-align:right;width:22%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          ${ord.discountAmount > 0 ? `
            <tr>
              <td colspan="3" style="border:1px solid #cbd5e1;padding:7px;text-align:right;font-weight:bold;color:#059669;">Coupon Discount (${escapeHtml(ord.couponCode || "OFFER")})</td>
              <td style="border:1px solid #cbd5e1;padding:7px;text-align:right;font-weight:bold;color:#059669;">- ${formatCurrency(ord.discountAmount)}</td>
            </tr>
          ` : ""}
          <tr style="background:#eef2ff;">
            <td colspan="3" style="border:1px solid #cbd5e1;padding:9px;text-align:right;font-weight:900;font-size:13px;">Net Paid Amount (Online UPI)</td>
            <td style="border:1px solid #cbd5e1;padding:9px;text-align:right;font-weight:900;font-size:15px;color:#312e81;">${formatCurrency(ord.finalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:42px;font-size:11px;">
        <div style="color:#475569;font-weight:bold;">
          ● Digital Computer Generated Receipt — Valid Official Proof.<br/>
          ● Paid To UPI: ${escapeHtml(ord.paidToUpi || getLivePaymentConfig().upiId)}
        </div>
        <div style="text-align:center;">
          <div style="font-family:cursive;font-size:20px;color:#312e81;font-weight:bold;border-bottom:1px solid #000;padding:0 16px;">Gurukul Online</div>
          <div style="font-weight:bold;margin-top:3px;">Authorized Signatory</div>
        </div>
      </div>
    </div>
  `;

  try {
    const opt = getSafePdfOptions(`Receipt_${ord.orderId}.pdf`, 920);
    await html2pdf().set(opt).from(area).save();
  } finally {
    wrap.classList.add("hidden");
  }
}

// =========================================================
// 6. SMART BATCH CLASSROOM (PROTECTED VIDEOS, NOTES, eBOOKS & DPP)
// =========================================================
async function openBatchClassroom(batchId) {
  const b = APP_STATE.batches[batchId];
  if (!b) return;

  if (!isStudentEnrolledInBatch(batchId)) {
    return openBatchDetailModal(batchId);
  }

  document.getElementById("classroomTitle").textContent = b.title;
  document.getElementById("classroomMeta").textContent = `${b.category || "Course"} • Protected Classes, Notes, eBooks & DPP`;
  document.getElementById("classroomBody").innerHTML = `
    <div class="py-12 text-center space-y-2">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-indigo-600"></i>
      <p class="text-xs font-bold text-slate-500">सुरक्षित क्लासरूम कंटेंट लोड हो रहा है...</p>
    </div>
  `;
  openModalById("batchClassroomModal");

  try {
    const snap = await db.ref(`paidContent/${batchId}`).once("value");
    const content = snap.val() || { items: {} };
    activeClassroomData = { batchId, content, selectedSubject: "ALL" };
    renderBatchClassroomContent();
  } catch (err) {
    document.getElementById("classroomBody").innerHTML = `
      <div class="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2 text-xs">
        <i class="fa-solid fa-lock text-2xl text-rose-600"></i>
        <h4 class="font-extrabold text-rose-900">कंटेंट एक्सेस अस्वीकृत (Access Locked)</h4>
        <p class="text-slate-600">इस बैच का एक्टिव सब्सक्रिप्शन आवश्यक है या वैधता समाप्त हो गई है।</p>
      </div>
    `;
  }
}

function renderBatchClassroomContent() {
  const { batchId, content, selectedSubject } = activeClassroomData;
  const body = document.getElementById("classroomBody");
  if (!body) return;

  const rawItems = Object.values((content && content.items) || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const batchTests = Object.values(APP_STATE.tests || {}).filter((t) => t && t.status === "ACTIVE" && t.batchId === batchId);

  const subjectsSet = new Set(["ALL"]);
  rawItems.forEach((it) => { if (it.subject) subjectsSet.add(it.subject); });
  const subjects = Array.from(subjectsSet);

  const filteredItems = selectedSubject === "ALL"
    ? rawItems
    : rawItems.filter((it) => it.subject === selectedSubject);

  // Group by Chapter
  const chaptersMap = {};
  filteredItems.forEach((it) => {
    const ch = it.chapter || "General / All Chapters";
    if (!chaptersMap[ch]) chaptersMap[ch] = [];
    chaptersMap[ch].push(it);
  });

  const typeBadge = {
    LIVE: { label: "🔴 LIVE CLASS", cls: "bg-rose-100 text-rose-700", icon: "fa-tower-broadcast" },
    VIDEO: { label: "🎥 RECORDED", cls: "bg-indigo-100 text-indigo-700", icon: "fa-circle-play" },
    NOTES: { label: "📄 NOTES PDF", cls: "bg-emerald-100 text-emerald-700", icon: "fa-file-pdf" },
    EBOOK: { label: "📚 eBOOK", cls: "bg-amber-100 text-amber-800", icon: "fa-book-open" },
    DPP: { label: "📝 DPP / HW", cls: "bg-violet-100 text-violet-700", icon: "fa-pen-ruler" }
  };

  body.innerHTML = `
    <!-- Subject Filter Pills -->
    <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      ${subjects.map((sub) => `
        <button type="button" onclick="setClassroomSubjectFilter('${escapeHtml(sub)}')" class="category-chip ${selectedSubject === sub ? "active" : ""} px-3.5 py-1.5 rounded-xl text-xs font-extrabold">
          ${sub === "ALL" ? "सभी विषय (All)" : escapeHtml(sub)}
        </button>
      `).join("")}
    </div>

    ${batchTests.length > 0 ? `
      <div class="bg-pink-50 border border-pink-200 p-3.5 rounded-2xl space-y-2">
        <div class="text-xs font-extrabold text-pink-900"><i class="fa-solid fa-laptop-code mr-1"></i> इस बैच की ऑनलाइन CBT टेस्ट सीरीज (${batchTests.length})</div>
        <div class="grid sm:grid-cols-2 gap-2">
          ${batchTests.map((t) => `
            <div class="bg-white p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs">
              <div class="min-w-0">
                <div class="font-extrabold truncate">${escapeHtml(t.title)}</div>
                <div class="text-[10px] text-slate-500">${(t.questions || []).length} सवाल • ${t.duration || 30} Min</div>
              </div>
              <button type="button" onclick="openCBTTestOverview('${escapeHtml(t.testId)}')" class="bg-pink-600 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] shrink-0">Open Test</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : ""}

    ${Object.keys(chaptersMap).length > 0
      ? Object.entries(chaptersMap).map(([chapterName, items]) => `
          <div class="border border-slate-200 rounded-2xl overflow-hidden">
            <div class="bg-slate-100 px-4 py-2.5 font-extrabold text-xs text-slate-800 flex items-center justify-between">
              <span><i class="fa-solid fa-folder-open text-indigo-600 mr-1.5"></i> ${escapeHtml(chapterName)}</span>
              <span class="text-[10px] text-slate-500">${items.length} आइटम</span>
            </div>
            <div class="divide-y divide-slate-100">
              ${items.map((it) => {
                const tb = typeBadge[it.type] || typeBadge.VIDEO;
                const isVideo = it.type === "LIVE" || it.type === "VIDEO";
                return `
                  <div class="p-3.5 bg-white flex flex-wrap items-center justify-between gap-2.5 text-xs">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-black ${tb.cls}">${tb.label}</span>
                        <span class="text-[10px] font-bold text-slate-500">${escapeHtml(it.subject || "")}</span>
                      </div>
                      <h5 class="font-extrabold text-sm text-slate-900 mt-1">${escapeHtml(it.title)}</h5>
                      ${it.description ? `<p class="text-[11px] text-slate-500">${escapeHtml(it.description)}</p>` : ""}
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      ${isVideo
                        ? `<button type="button" onclick="openClassroomLectureItem('${escapeHtml(it.itemId)}')" class="brand-gradient text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow flex items-center gap-1.5"><i class="fa-solid fa-play"></i> Watch</button>`
                        : `<button type="button" onclick="openClassroomPdfItem('${escapeHtml(it.itemId)}')" class="emerald-gradient text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow flex items-center gap-1.5"><i class="fa-solid fa-book-open"></i> Open PDF</button>`
                      }
                      ${it.dppPdfUrl ? `<button type="button" onclick="openProtectedPdfViewer('${escapeHtml(it.dppPdfUrl)}', 'DPP: ${escapeHtml(it.title)}')" class="bg-violet-100 text-violet-800 font-extrabold px-2.5 py-2 rounded-xl text-[11px]">DPP</button>` : ""}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")
      : `<div class="p-8 bg-slate-50 rounded-2xl text-center text-xs font-bold text-slate-400">इस बैच में अभी कोई क्लास या नोट्स अपलोड नहीं हुए हैं।</div>`
    }
  `;
}

function setClassroomSubjectFilter(sub) {
  activeClassroomData.selectedSubject = sub;
  renderBatchClassroomContent();
}

function openClassroomLectureItem(itemId) {
  const it = activeClassroomData.content && activeClassroomData.content.items && activeClassroomData.content.items[itemId];
  if (!it) return;
  openProtectedVideoPlayer({
    lectureId: it.itemId,
    batchId: activeClassroomData.batchId,
    title: it.title,
    subject: it.subject || "",
    chapter: it.chapter || "",
    videoUrl: it.url,
    isDemo: false
  });
}

function openClassroomPdfItem(itemId) {
  const it = activeClassroomData.content && activeClassroomData.content.items && activeClassroomData.content.items[itemId];
  if (!it) return;
  openProtectedPdfViewer(it.url, `${it.title} (${it.subject || "Notes"})`);
      }
