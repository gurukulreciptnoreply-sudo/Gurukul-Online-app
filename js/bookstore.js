/* =====================================================================
   GURUKUL ONLINE APP — OFFICIAL BOOK STORE (ONLINE PAYMENT ONLY / NO COD)
   File: js/bookstore.js
   ===================================================================== */

let activeBookCartCoupon = null;

// =========================================================
// 1. BOOK STORE GRID & SEARCH RENDERER
// =========================================================
function renderBookStoreGrid() {
  const grid = document.getElementById("bookStoreGrid");
  if (!grid) return;

  const q = (document.getElementById("bookSearchInput")?.value || "").trim().toLowerCase();
  const books = Object.values(APP_STATE.books || {})
    .filter((b) => {
      if (!b || b.status === "HIDDEN") return false;
      if (q) {
        const hay = `${b.title || ""} ${b.author || ""} ${b.category || ""} ${b.description || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!books.length) {
    grid.innerHTML = `
      <div class="col-span-2 sm:col-span-3 lg:col-span-4 ed-card p-8 rounded-2xl text-center space-y-2">
        <i class="fa-solid fa-book-open text-3xl text-amber-400"></i>
        <h4 class="text-sm font-extrabold">अभी कोई किताब उपलब्ध नहीं है</h4>
        <p class="text-xs text-slate-500">नई प्रिंटेड किताबें और नोट्स जल्द ही स्टोर में जोड़े जाएंगे।</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = books.map((b) => {
    const price = Number(b.offerPrice || b.price || 0);
    const mrp = Number(b.mrp || price);
    const discPct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const stock = Number(b.stock ?? 10);
    const outOfStock = stock <= 0;
    const inCartItem = (APP_STATE.cart || []).find((c) => c.bookId === b.bookId);

    return `
      <div class="ed-card ed-card-hover rounded-2xl overflow-hidden flex flex-col justify-between">
        <div>
          <div class="relative h-40 sm:h-48 bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center" onclick="openBookDetailModal('${escapeHtml(b.bookId)}')">
            ${b.coverUrl
              ? `<img src="${escapeHtml(b.coverUrl)}" alt="${escapeHtml(b.title)}" class="w-full h-full object-cover" />`
              : `<div class="w-full h-full brand-gradient text-white flex flex-col items-center justify-center p-3 text-center">
                  <i class="fa-solid fa-book text-3xl text-amber-300 mb-1.5"></i>
                  <span class="text-[11px] font-extrabold line-clamp-3">${escapeHtml(b.title)}</span>
                </div>`
            }
            ${outOfStock
              ? `<span class="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">OUT OF STOCK</span>`
              : discPct > 0
                ? `<span class="absolute top-2 left-2 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">${discPct}% OFF</span>`
                : ""
            }
            ${stock > 0 && stock <= 5
              ? `<span class="absolute bottom-2 left-2 bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-md shadow">सिर्फ ${stock} बचीं</span>`
              : ""
            }
          </div>

          <div class="p-3 space-y-1">
            <span class="text-[9px] font-extrabold text-indigo-600 uppercase">${escapeHtml(b.category || "Printed Book")}</span>
            <h4 class="font-extrabold text-xs sm:text-sm leading-snug line-clamp-2 cursor-pointer" onclick="openBookDetailModal('${escapeHtml(b.bookId)}')">${escapeHtml(b.title)}</h4>
            <p class="text-[10px] text-slate-500 truncate">${escapeHtml(b.author || "Gurukul Publications")}</p>
            <div class="flex items-baseline gap-1.5 pt-1">
              <span class="text-sm sm:text-base font-black text-emerald-700">${formatCurrency(price)}</span>
              ${mrp > price ? `<span class="text-[10px] line-through text-slate-400 font-bold">${formatCurrency(mrp)}</span>` : ""}
            </div>
          </div>
        </div>

        <div class="px-3 pb-3 pt-1 flex gap-1.5">
          ${outOfStock
            ? `<button type="button" disabled class="w-full bg-slate-200 text-slate-500 font-extrabold py-2 rounded-xl text-[11px] cursor-not-allowed">स्टॉक खत्म</button>`
            : inCartItem
              ? `<button type="button" onclick="openBookCartModal()" class="w-full bg-amber-400 text-slate-950 font-extrabold py-2 rounded-xl text-[11px] shadow"><i class="fa-solid fa-cart-check mr-1"></i>कार्ट में (${inCartItem.qty})</button>`
              : `<button type="button" onclick="addBookToCart('${escapeHtml(b.bookId)}')" class="w-full brand-gradient text-white font-extrabold py-2 rounded-xl text-[11px] shadow"><i class="fa-solid fa-cart-plus mr-1"></i>Add to Cart</button>`
          }
        </div>
      </div>
    `;
  }).join("");
}

// =========================================================
// 2. BOOK DETAIL MODAL & SAMPLE PAGE PREVIEW
// =========================================================
function openBookDetailModal(bookId) {
  const b = APP_STATE.books && APP_STATE.books[bookId];
  if (!b) return;

  const price = Number(b.offerPrice || b.price || 0);
  const mrp = Number(b.mrp || price);
  const shippingFee = Number(b.shippingFee || 0);
  const stock = Number(b.stock ?? 10);
  const outOfStock = stock <= 0;

  document.getElementById("bookDetailBody").innerHTML = `
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="w-full sm:w-40 h-52 rounded-2xl overflow-hidden bg-slate-100 border shrink-0 flex items-center justify-center">
        ${b.coverUrl
          ? `<img src="${escapeHtml(b.coverUrl)}" class="w-full h-full object-cover" />`
          : `<div class="w-full h-full brand-gradient text-white flex items-center justify-center p-3 text-center"><i class="fa-solid fa-book text-4xl text-amber-300"></i></div>`
        }
      </div>

      <div class="flex-1 space-y-2 text-xs">
        <div class="flex flex-wrap gap-1.5">
          <span class="bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">${escapeHtml(b.category || "Book")}</span>
          <span class="px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${outOfStock ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}">
            ${outOfStock ? "Out of Stock" : `In Stock (${stock})`}
          </span>
        </div>

        <h3 class="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">${escapeHtml(b.title)}</h3>
        <p class="text-[11px] font-bold text-slate-500">लेखक / प्रकाशक: ${escapeHtml(b.author || "Gurukul Senior Secondary School Dhankoli")}</p>

        <div class="flex items-baseline gap-2 pt-1">
          <span class="text-xl font-black text-emerald-700">${formatCurrency(price)}</span>
          ${mrp > price ? `<span class="text-xs line-through text-slate-400 font-bold">${formatCurrency(mrp)}</span>` : ""}
          <span class="text-[11px] font-bold text-indigo-700">
            ${shippingFee > 0 ? `+ ${formatCurrency(shippingFee)} डिलीवरी चार्ज` : "• FREE Home Delivery"}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-1 text-[11px] font-bold text-slate-600">
          <div class="bg-slate-50 p-2 rounded-xl border"><i class="fa-solid fa-file-lines text-indigo-500 mr-1"></i>पेज: ${escapeHtml(b.pages || "Print Edition")}</div>
          <div class="bg-slate-50 p-2 rounded-xl border"><i class="fa-solid fa-language text-indigo-500 mr-1"></i>भाषा: ${escapeHtml(b.medium || "Hindi / Eng")}</div>
        </div>
      </div>
    </div>

    ${b.description ? `
      <div class="bg-slate-50 p-3.5 rounded-2xl border text-xs text-slate-700 leading-relaxed whitespace-pre-line">
        <strong class="block text-slate-900 mb-1">किताब का विवरण:</strong>
        ${escapeHtml(b.description)}
      </div>
    ` : ""}

    ${b.samplePdfUrl ? `
      <button type="button" onclick="openProtectedPdfViewer('${escapeHtml(b.samplePdfUrl)}', 'Sample Preview — ${escapeHtml(b.title)}')" class="w-full bg-slate-900 text-amber-300 font-extrabold py-2.5 rounded-xl text-xs shadow flex items-center justify-center gap-2">
        <i class="fa-solid fa-eye"></i> किताब के सैंपल पेज देखें (Sample Pages Preview)
      </button>
    ` : ""}

    <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] font-bold text-amber-950">
      <i class="fa-solid fa-shield-halved text-amber-600 mr-1"></i>
      <strong>भुगतान नियम:</strong> यह किताब केवल <strong>100% सुरक्षित ऑनलाइन UPI पेमेंट</strong> से ऑर्डर होती है (Cash on Delivery उपलब्ध नहीं है)। ऑर्डर के तुरंत बाद PDF इनवॉइस व लाइव ट्रैकिंग मिलेगी।
    </div>

    <div class="grid grid-cols-2 gap-2.5 pt-1">
      <button type="button" ${outOfStock ? "disabled" : ""} onclick="addBookToCart('${escapeHtml(b.bookId)}'); closeModalById('bookDetailModal');" class="bg-indigo-100 text-indigo-900 font-extrabold py-3 rounded-xl text-xs disabled:opacity-40">
        <i class="fa-solid fa-cart-plus mr-1"></i> कार्ट में जोड़ें
      </button>
      <button type="button" ${outOfStock ? "disabled" : ""} onclick="buySingleBookNow('${escapeHtml(b.bookId)}')" class="emerald-gradient text-white font-extrabold py-3 rounded-xl text-xs shadow-lg disabled:opacity-40">
        <i class="fa-solid fa-bolt mr-1"></i> अभी खरीदें (Buy Now)
      </button>
    </div>
  `;

  openModalById("bookDetailModal");
}

// =========================================================
// 3. SHOPPING CART MANAGEMENT (LOCALSTORAGE PERSISTED)
// =========================================================
function saveBookCartState() {
  localStorage.setItem("GURUKUL_BOOK_CART", JSON.stringify(APP_STATE.cart || []));
  updateHeaderCartBadges();
  renderBookStoreGrid();
}

function addBookToCart(bookId, silent = false) {
  const b = APP_STATE.books && APP_STATE.books[bookId];
  if (!b) return;

  const stock = Number(b.stock ?? 10);
  if (stock <= 0) {
    return showToast("यह किताब फिलहाल आउट ऑफ स्टॉक है।", "DANGER");
  }

  const cart = APP_STATE.cart || [];
  const existing = cart.find((it) => it.bookId === bookId);

  if (existing) {
    if (existing.qty >= stock) {
      return showToast(`अधिकतम उपलब्ध स्टॉक (${stock}) पहले ही कार्ट में है।`, "WARNING");
    }
    existing.qty += 1;
  } else {
    cart.push({
      bookId: b.bookId,
      title: b.title,
      price: Number(b.offerPrice || b.price || 0),
      shippingFee: Number(b.shippingFee || 0),
      coverUrl: b.coverUrl || "",
      qty: 1
    });
  }

  APP_STATE.cart = cart;
  saveBookCartState();
  if (!silent) showToast(`'${b.title}' कार्ट में जोड़ी गई!`, "SUCCESS");
}

function buySingleBookNow(bookId) {
  const inCart = (APP_STATE.cart || []).some((it) => it.bookId === bookId);
  if (!inCart) addBookToCart(bookId, true);
  closeModalById("bookDetailModal");
  openBookCartModal();
}

function updateBookCartQty(bookId, delta) {
  const cart = APP_STATE.cart || [];
  const idx = cart.findIndex((it) => it.bookId === bookId);
  if (idx === -1) return;

  const liveBook = APP_STATE.books && APP_STATE.books[bookId];
  const maxStock = liveBook ? Number(liveBook.stock ?? 10) : 10;
  const nextQty = cart[idx].qty + delta;

  if (nextQty <= 0) {
    cart.splice(idx, 1);
  } else if (nextQty > maxStock) {
    showToast(`अधिकतम उपलब्ध स्टॉक केवल ${maxStock} है।`, "WARNING");
    return;
  } else {
    cart[idx].qty = nextQty;
  }

  APP_STATE.cart = cart;
  activeBookCartCoupon = null;
  saveBookCartState();
  renderBookCartModalContent();
}

function syncCartPricesWithLiveCatalog() {
  const validCart = [];
  (APP_STATE.cart || []).forEach((item) => {
    const live = APP_STATE.books && APP_STATE.books[item.bookId];
    if (!live || live.status === "HIDDEN" || Number(live.stock ?? 10) <= 0) return;
    validCart.push({
      bookId: live.bookId,
      title: live.title,
      price: Number(live.offerPrice || live.price || 0),
      shippingFee: Number(live.shippingFee || 0),
      coverUrl: live.coverUrl || "",
      qty: Math.min(item.qty, Number(live.stock ?? 10))
    });
  });
  APP_STATE.cart = validCart;
  saveBookCartState();
}

function calculateBookCartTotals() {
  const cart = APP_STATE.cart || [];
  const subtotal = cart.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  // डिलीवरी चार्ज: कार्ट की किताबों में सबसे ज्यादा शिपिंग चार्ज (एक ही पार्सल में आने पर बार-बार चार्ज न लगे)
  const shippingTotal = cart.reduce((maxFee, it) => Math.max(maxFee, Number(it.shippingFee) || 0), 0);
  const discount = activeBookCartCoupon ? Number(activeBookCartCoupon.discountAmount || 0) : 0;
  const finalAmount = Math.max(1, subtotal + shippingTotal - discount);
  return { subtotal, shippingTotal, discount, finalAmount };
}

// =========================================================
// 4. BOOK CART MODAL + ADDRESS FORM + ONLINE-ONLY CHECKOUT
// =========================================================
function openBookCartModal() {
  syncCartPricesWithLiveCatalog();
  activeBookCartCoupon = null;
  renderBookCartModalContent();
  openModalById("bookCartModal");
}

function getSavedShippingAddress() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("GURUKUL_SAVED_ADDRESS") || "{}");
  } catch (e) {}
  const p = APP_STATE.userProfile || {};
  return {
    fullName: saved.fullName || p.name || "",
    phone: saved.phone || p.phone || "",
    addressLine: saved.addressLine || "",
    landmark: saved.landmark || "",
    city: saved.city || "",
    state: saved.state || "Rajasthan",
    pincode: saved.pincode || ""
  };
}

function renderBookCartModalContent() {
  const body = document.getElementById("bookCartBody");
  if (!body) return;

  const cart = APP_STATE.cart || [];
  if (!cart.length) {
    body.innerHTML = `
      <div class="py-10 text-center space-y-3">
        <i class="fa-solid fa-cart-shopping text-4xl text-slate-300"></i>
        <h4 class="text-sm font-extrabold text-slate-700">आपका बुक कार्ट खाली है</h4>
        <p class="text-xs text-slate-500">ऑर्डर करने के लिए बुक स्टोर से अपनी पसंदीदा किताबें चुनें।</p>
        <button type="button" onclick="closeModalById('bookCartModal'); switchStudentTab('bookstore')" class="brand-gradient text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow">बुक स्टोर खोलें</button>
      </div>
    `;
    return;
  }

  const totals = calculateBookCartTotals();
  const addr = getSavedShippingAddress();

  body.innerHTML = `
    <!-- Cart Items -->
    <div class="space-y-2.5">
      ${cart.map((it) => `
        <div class="p-3 rounded-2xl bg-slate-50 border flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-11 h-14 rounded-lg bg-indigo-100 overflow-hidden shrink-0 flex items-center justify-center">
              ${it.coverUrl ? `<img src="${escapeHtml(it.coverUrl)}" class="w-full h-full object-cover" />` : `<i class="fa-solid fa-book text-indigo-600"></i>`}
            </div>
            <div class="min-w-0">
              <h5 class="font-extrabold text-slate-900 truncate">${escapeHtml(it.title)}</h5>
              <div class="text-[11px] font-black text-emerald-700">${formatCurrency(it.price)} × ${it.qty} = ${formatCurrency(it.price * it.qty)}</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="updateBookCartQty('${escapeHtml(it.bookId)}', -1)" class="w-7 h-7 rounded-lg bg-white border font-black text-slate-700">-</button>
            <span class="w-5 text-center font-extrabold">${it.qty}</span>
            <button type="button" onclick="updateBookCartQty('${escapeHtml(it.bookId)}', 1)" class="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black">+</button>
          </div>
        </div>
      `).join("")}
    </div>

    <!-- Coupon Box -->
    <div class="bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl space-y-1.5">
      <div class="flex gap-2">
        <input type="text" id="bookCartCouponInput" value="${activeBookCartCoupon ? escapeHtml(activeBookCartCoupon.code) : ""}" placeholder="कूपन कोड (यदि हो)" class="ed-input flex-1 px-3 py-2 rounded-xl text-xs font-extrabold uppercase bg-white" />
        <button type="button" onclick="applyBookCartCoupon()" class="bg-indigo-600 text-white font-extrabold px-4 py-2 rounded-xl text-xs">Apply</button>
      </div>
      <div id="bookCartCouponMsg" class="text-[11px] font-bold ${activeBookCartCoupon ? "text-emerald-700" : ""}">
        ${activeBookCartCoupon ? `✅ कूपन '${escapeHtml(activeBookCartCoupon.code)}' लागू (${formatCurrency(activeBookCartCoupon.discountAmount)} छूट)` : ""}
      </div>
    </div>

    <!-- Bill Summary -->
    <div class="p-3.5 rounded-2xl bg-slate-50 border space-y-1.5 text-xs">
      <div class="flex justify-between font-semibold text-slate-600"><span>किताबों का मूल्य (Subtotal)</span><span>${formatCurrency(totals.subtotal)}</span></div>
      <div class="flex justify-between font-semibold text-slate-600"><span>होम डिलीवरी चार्ज</span><span class="${totals.shippingTotal === 0 ? "text-emerald-600 font-extrabold" : ""}">${totals.shippingTotal === 0 ? "FREE" : formatCurrency(totals.shippingTotal)}</span></div>
      ${totals.discount > 0 ? `<div class="flex justify-between font-bold text-emerald-700"><span>कूपन छूट</span><span>- ${formatCurrency(totals.discount)}</span></div>` : ""}
      <div class="flex justify-between font-black text-sm text-slate-900 pt-1.5 border-t border-slate-200">
        <span>कुल ऑनलाइन भुगतान (Only UPI)</span>
        <span class="text-indigo-700">${formatCurrency(totals.finalAmount)}</span>
      </div>
    </div>

    <!-- Shipping Address Form -->
    <div class="p-4 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
      <h4 class="font-extrabold text-sm text-slate-900"><i class="fa-solid fa-location-dot text-rose-600 mr-1.5"></i> होम डिलीवरी का पूरा पता (Delivery Address)</h4>
      <div class="grid sm:grid-cols-2 gap-2">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">प्राप्तकर्ता का पूरा नाम *</label>
          <input type="text" id="shipFullName" value="${escapeHtml(addr.fullName)}" placeholder="पूरा नाम" class="ed-input w-full px-3 py-2 rounded-xl text-xs font-semibold" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">मोबाइल नंबर (10 अंक) *</label>
          <input type="tel" id="shipPhone" maxlength="10" value="${escapeHtml(addr.phone)}" placeholder="9876543210" class="ed-input w-full px-3 py-2 rounded-xl text-xs font-semibold" />
        </div>
      </div>
      <div>
        <label class="block text-[10px] font-bold text-slate-500 mb-0.5">पूरा पता (गाँव/मोहल्ला, मकान नं., पोस्ट) *</label>
        <textarea id="shipAddressLine" rows="2" placeholder="गाँव/वार्ड, पोस्ट, तहसील..." class="ed-input w-full px-3 py-2 rounded-xl text-xs font-semibold">${escapeHtml(addr.addressLine)}</textarea>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">शहर / जिला *</label>
          <input type="text" id="shipCity" value="${escapeHtml(addr.city)}" placeholder="जैसे: Didwana-Kuchaman" class="ed-input w-full px-3 py-2 rounded-xl text-xs font-semibold" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">राज्य (State) *</label>
          <input type="text" id="shipState" value="${escapeHtml(addr.state)}" placeholder="Rajasthan" class="ed-input w-full px-3 py-2 rounded-xl text-xs font-semibold" />
        </div>
        <div class="col-span-2 sm:col-span-1">
          <label class="block text-[10px] font-bold text-slate-500 mb-0.5">पिनकोड (6 अंक) *</label>
          <input type="tel" id="shipPincode" maxlength="6" value="${escapeHtml(addr.pincode)}" placeholder="341516" class="ed-input w-full px-3 py-2 rounded-xl text-xs font-extrabold tracking-wider" />
        </div>
      </div>
    </div>

    <!-- Payment Policy Note (Strictly Online / No COD) -->
    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-900 flex items-center gap-2">
      <i class="fa-solid fa-lock text-emerald-600 text-sm shrink-0"></i>
      <span>भुगतान माध्यम: केवल <strong>ऑनलाइन UPI पेमेंट (0% फीस)</strong>। Cash on Delivery (COD) उपलब्ध नहीं है।</span>
    </div>

    <button type="button" onclick="proceedBookCartToOnlinePayment()" class="w-full emerald-gradient text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2">
      <i class="fa-solid fa-shield-check"></i> ऑनलाइन UPI पेमेंट करें — ${formatCurrency(totals.finalAmount)}
    </button>
  `;
}

async function applyBookCartCoupon() {
  const code = (document.getElementById("bookCartCouponInput")?.value || "").trim().toUpperCase();
  const msgEl = document.getElementById("bookCartCouponMsg");
  if (!code) return;

  const snap = await db.ref(`coupons/${code}`).once("value");
  const c = snap.val();
  if (!c || !c.active || (c.expiresAt && Number(c.expiresAt) < Date.now())) {
    activeBookCartCoupon = null;
    if (msgEl) {
      msgEl.className = "text-[11px] font-bold text-rose-600";
      msgEl.textContent = "❌ अमान्य या एक्सपायर कूपन कोड।";
    }
    return;
  }

  const cart = APP_STATE.cart || [];
  const subtotal = cart.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
  const discAmt = c.discountType === "FLAT"
    ? Math.min(subtotal, Number(c.discountValue) || 0)
    : Math.round((subtotal * (Number(c.discountValue) || 0)) / 100);

  activeBookCartCoupon = { code, discountAmount: discAmt };
  showToast(`कूपन ${code} लागू हो गया!`, "SUCCESS");
  renderBookCartModalContent();
}

function proceedBookCartToOnlinePayment() {
  const cart = APP_STATE.cart || [];
  if (!cart.length) return;

  const fullName = (document.getElementById("shipFullName")?.value || "").trim();
  const phone = (document.getElementById("shipPhone")?.value || "").trim();
  const addressLine = (document.getElementById("shipAddressLine")?.value || "").trim();
  const city = (document.getElementById("shipCity")?.value || "").trim();
  const state = (document.getElementById("shipState")?.value || "").trim();
  const pincode = (document.getElementById("shipPincode")?.value || "").trim();

  if (!fullName || !/^\d{10}$/.test(phone) || !addressLine || !city || !state || !/^\d{6}$/.test(pincode)) {
    return showAppAlert(
      "कृपया सही नाम, 10-अंकों का मोबाइल नंबर, पूरा पता, जिला/शहर और 6-अंकों का पिनकोड दर्ज करें।",
      "डिलीवरी पता अधूरा है",
      "DANGER"
    );
  }

  const shippingAddress = { fullName, phone, addressLine, city, state, pincode };
  localStorage.setItem("GURUKUL_SAVED_ADDRESS", JSON.stringify(shippingAddress));

  const totals = calculateBookCartTotals();
  const titleSummary = cart.length === 1
    ? `${cart[0].title} (x${cart[0].qty})`
    : `${cart[0].title} + ${cart.length - 1} अन्य किताबें`;

  closeModalById("bookCartModal");
  openUnifiedUpiCheckout({
    orderType: "BOOK",
    itemId: cart.map((c) => c.bookId).join(","),
    title: titleSummary,
    items: cart.map((c) => ({
      bookId: c.bookId,
      title: c.title,
      price: c.price,
      qty: c.qty
    })),
    shippingAddress,
    originalPrice: totals.subtotal + totals.shippingTotal,
    discountAmount: totals.discount,
    couponCode: activeBookCartCoupon ? activeBookCartCoupon.code : "",
    finalAmount: totals.finalAmount
  });
}
