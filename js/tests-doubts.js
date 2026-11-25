/* =====================================================================
   GURUKUL ONLINE APP — CBT TEST SERIES, RANK/SOLUTIONS & DOUBT DESK
   File: js/tests-doubts.js
   ===================================================================== */

let activeCBT = null;
let cbtTimerInterval = null;
let activeSolutionFilter = "ALL";
let cachedResultAnswersMap = {};

// =========================================================
// 1. STUDENT CBT TESTS LIST (MY STUDY -> CBT TESTS)
// =========================================================
function renderStudentTestsList() {
  const box = document.getElementById("myTestsBox");
  if (!box) return;

  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  const tests = Object.values(APP_STATE.tests || {})
    .filter((t) => t && t.status === "ACTIVE")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!tests.length) {
    box.innerHTML = `
      <div class="sm:col-span-2 ed-card p-8 rounded-2xl text-center space-y-2">
        <i class="fa-solid fa-laptop-code text-3xl text-pink-400"></i>
        <h4 class="text-sm font-extrabold">अभी कोई ऑनलाइन CBT टेस्ट लाइव नहीं है</h4>
        <p class="text-xs text-slate-500">नया टेस्ट अपलोड होते ही आपको नोटिफिकेशन मिल जाएगा।</p>
      </div>
    `;
    return;
  }

  box.innerHTML = tests.map((t) => {
    const hasAccess = APP_STATE.isAdmin || t.isFree || (t.batchId && isStudentEnrolledInBatch(t.batchId));
    const attemptsForTest = (APP_STATE.testAttempts && APP_STATE.testAttempts[t.testId]) || {};
    const myAttempt = uid ? attemptsForTest[uid] : null;
    const isCompleted = Boolean(myAttempt && myAttempt.graded);
    const totalQ = (t.questions || []).length;
    const maxMarks = totalQ * (Number(t.plusMark) || 4);
    const batchName = t.batchId && APP_STATE.batches[t.batchId] ? APP_STATE.batches[t.batchId].title : "";

    return `
      <div class="ed-card p-4 rounded-2xl flex flex-col justify-between gap-3 text-xs">
        <div class="space-y-1.5">
          <div class="flex flex-wrap items-center justify-between gap-1.5">
            <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black ${t.isFree ? "bg-emerald-100 text-emerald-800" : "bg-pink-100 text-pink-800"}">
              ${t.isFree ? "FREE CBT TEST" : "BATCH TEST SERIES"}
            </span>
            <span class="text-[10px] font-bold text-slate-500">${escapeHtml(t.category || "All Exams")}</span>
          </div>
          <h4 class="font-extrabold text-sm text-slate-900 leading-snug">${escapeHtml(t.title)}</h4>
          ${batchName ? `<p class="text-[11px] font-bold text-indigo-600"><i class="fa-solid fa-layer-group mr-1"></i>${escapeHtml(batchName)}</p>` : ""}
          <div class="flex flex-wrap gap-2 pt-1 text-[11px] font-semibold text-slate-600">
            <span><i class="fa-solid fa-list-ol text-indigo-500 mr-1"></i>${totalQ} सवाल (${maxMarks} अंक)</span>
            <span><i class="fa-regular fa-clock text-amber-500 mr-1"></i>${t.duration || 30} मिनट</span>
            <span><i class="fa-solid fa-scale-balanced text-rose-500 mr-1"></i>+${t.plusMark || 4} / -${t.minusMark || 1}</span>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
          ${isCompleted
            ? `<div class="text-[11px] font-extrabold text-emerald-700">स्कोर: ${myAttempt.score}/${myAttempt.maxMarks} (${myAttempt.percentage}%)</div>
               <button type="button" onclick="renderCBTResultAndAnalysis('${escapeHtml(t.testId)}')" class="emerald-gradient text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow"><i class="fa-solid fa-chart-pie mr-1"></i>रिजल्ट व सॉल्यूशन</button>`
            : hasAccess
              ? `<div class="text-[11px] font-bold text-slate-500">${Object.keys(attemptsForTest).length} छात्रों ने दिया</div>
                 <button type="button" onclick="openCBTTestOverview('${escapeHtml(t.testId)}')" class="brand-gradient text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow"><i class="fa-solid fa-play mr-1"></i>टेस्ट शुरू करें</button>`
              : `<div class="text-[11px] font-bold text-rose-600"><i class="fa-solid fa-lock mr-1"></i>बैच आवश्यक</div>
                 <button type="button" onclick="openBatchDetailModal('${escapeHtml(t.batchId)}')" class="bg-amber-400 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs shadow">बैच देखें</button>`
          }
        </div>
      </div>
    `;
  }).join("");
}

// =========================================================
// 2. CBT OVERVIEW & EXAM INSTRUCTIONS SCREEN
// =========================================================
function openCBTTestOverview(testId) {
  const t = APP_STATE.tests && APP_STATE.tests[testId];
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  if (!t || !uid) return;

  const hasAccess = APP_STATE.isAdmin || t.isFree || (t.batchId && isStudentEnrolledInBatch(t.batchId));
  if (!hasAccess) {
    showToast("यह टेस्ट केवल संबंधित बैच के छात्रों के लिए है।", "WARNING");
    if (t.batchId) openBatchDetailModal(t.batchId);
    return;
  }

  // यदि छात्र पहले ही टेस्ट दे चुका है तो सीधे रिजल्ट व सॉल्यूशन दिखाएं
  const myAttempt = APP_STATE.testAttempts && APP_STATE.testAttempts[testId] && APP_STATE.testAttempts[testId][uid];
  if (myAttempt && myAttempt.graded) {
    return renderCBTResultAndAnalysis(testId);
  }

  const totalQ = (t.questions || []).length;
  const maxMarks = totalQ * (Number(t.plusMark) || 4);
  const timerKey = `GURUKUL_CBT_START_${testId}_${uid}`;
  const isResuming = Boolean(localStorage.getItem(timerKey));

  document.getElementById("cbtModalTitle").textContent = t.title;
  document.getElementById("cbtModalSub").textContent = `${totalQ} Questions • ${t.duration || 30} Minutes • +${t.plusMark || 4} / -${t.minusMark || 1}`;
  document.getElementById("cbtRunnerBody").innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div class="p-3 rounded-2xl bg-indigo-50 border border-indigo-200">
          <div class="text-[10px] font-bold text-indigo-700">कुल प्रश्न</div>
          <div class="text-lg font-black text-indigo-900">${totalQ}</div>
        </div>
        <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
          <div class="text-[10px] font-bold text-emerald-700">अधिकतम अंक</div>
          <div class="text-lg font-black text-emerald-900">${maxMarks}</div>
        </div>
        <div class="p-3 rounded-2xl bg-amber-50 border border-amber-200">
          <div class="text-[10px] font-bold text-amber-800">कुल समय</div>
          <div class="text-lg font-black text-amber-900">${t.duration || 30} Min</div>
        </div>
        <div class="p-3 rounded-2xl bg-rose-50 border border-rose-200">
          <div class="text-[10px] font-bold text-rose-700">मार्किंग स्कीम</div>
          <div class="text-lg font-black text-rose-900">+${t.plusMark || 4} / -${t.minusMark || 1}</div>
        </div>
      </div>

      <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
        <h4 class="font-extrabold text-sm text-slate-900"><i class="fa-solid fa-circle-info text-indigo-600 mr-1.5"></i> परीक्षा के महत्वपूर्ण निर्देश:</h4>
        <ul class="list-disc pl-5 space-y-1.5 font-semibold text-slate-700 leading-relaxed">
          <li>प्रत्येक सही उत्तर के लिए <strong>+${t.plusMark || 4} अंक</strong> मिलेंगे और प्रत्येक गलत उत्तर पर <strong>-${t.minusMark || 1} नेगेटिव मार्किंग</strong> कटेगी।</li>
          <li>समय समाप्त होते ही आपका टेस्ट अपने-आप सबमिट हो जाएगा। पेज रिफ्रेश करने पर टाइमर रीसेट नहीं होता।</li>
          <li>यह टेस्ट केवल <strong>1 बार</strong> दिया जा सकता है। सबमिट होते ही आपकी <strong>All-Student Rank, NTA Percentile, टॉपर तुलना</strong> और हर सवाल का <strong>डिटेल्ड सॉल्यूशन</strong> खुल जाएगा।</li>
          <li>प्रश्नों की स्थिति के रंग: <span class="text-emerald-600 font-extrabold">हरा = उत्तर दिया</span>, <span class="text-violet-600 font-extrabold">बैंगनी = रिव्यू के लिए मार्क</span>, <span class="text-rose-600 font-extrabold">लाल = देखा पर उत्तर नहीं दिया</span>।</li>
        </ul>
      </div>

      <label class="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 cursor-pointer font-extrabold text-indigo-950">
        <input type="checkbox" id="cbtTermsAgreeChk" class="w-4 h-4 accent-indigo-600" ${isResuming ? "checked" : ""} />
        <span>मैंने सभी निर्देश पढ़ लिए हैं और मैं लाइव CBT टेस्ट देने के लिए तैयार हूँ।</span>
      </label>

      <button type="button" onclick="startCBTTestSession('${escapeHtml(testId)}')" class="w-full brand-gradient text-white font-extrabold py-3.5 rounded-2xl text-sm shadow-xl flex items-center justify-center gap-2">
        <i class="fa-solid fa-bolt"></i> ${isResuming ? "अधूरा टेस्ट वहीं से जारी रखें (Resume)" : "लाइव CBT टेस्ट शुरू करें (Start Now)"}
      </button>
    </div>
  `;

  openModalById("cbtRunnerModal");
}

// =========================================================
// 3. LIVE CBT RUNNER ENGINE (PERSISTENT TIMER + PALETTE)
// =========================================================
function startCBTTestSession(testId) {
  const chk = document.getElementById("cbtTermsAgreeChk");
  if (chk && !chk.checked) {
    return showAppAlert("टेस्ट शुरू करने से पहले निर्देशों वाले बॉक्स पर टिक करें।", "निर्देश स्वीकार करें", "DANGER");
  }

  const t = APP_STATE.tests && APP_STATE.tests[testId];
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  if (!t || !uid || !(t.questions || []).length) return;

  const timerKey = `GURUKUL_CBT_START_${testId}_${uid}`;
  const draftKey = `GURUKUL_CBT_DRAFT_${testId}_${uid}`;

  let startedAtMs = Number(localStorage.getItem(timerKey)) || 0;
  if (!startedAtMs) {
    startedAtMs = Date.now();
    localStorage.setItem(timerKey, String(startedAtMs));
  }

  const durationSec = (Number(t.duration) || 30) * 60;
  const endTimeMs = startedAtMs + durationSec * 1000;

  let savedDraft = { answers: {}, marked: {}, visited: { 0: true }, currentIndex: 0 };
  try {
    const raw = localStorage.getItem(draftKey);
    if (raw) savedDraft = { ...savedDraft, ...JSON.parse(raw) };
  } catch (e) {}

  activeCBT = {
    testId,
    uid,
    startedAtMs,
    endTimeMs,
    durationSec,
    currentIndex: Number(savedDraft.currentIndex) || 0,
    answers: savedDraft.answers || {},
    marked: savedDraft.marked || {},
    visited: savedDraft.visited || { 0: true },
    isSubmitting: false
  };

  renderActiveCBTQuestionScreen();

  if (cbtTimerInterval) clearInterval(cbtTimerInterval);
  cbtTimerInterval = setInterval(() => {
    if (!activeCBT) return;
    const secLeft = Math.max(0, Math.floor((activeCBT.endTimeMs - Date.now()) / 1000));
    const timerEl = document.getElementById("cbtLiveTimerDisplay");
    if (timerEl) {
      timerEl.textContent = formatCBTClock(secLeft);
      if (secLeft <= 120) {
        timerEl.classList.add("animate-pulse", "bg-rose-600");
        timerEl.classList.remove("bg-slate-800");
      }
    }
    if (secLeft <= 0) {
      clearInterval(cbtTimerInterval);
      cbtTimerInterval = null;
      submitActiveCBTTest(true);
    }
  }, 1000);
}

function formatCBTClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function persistCBTDraftLocally() {
  if (!activeCBT) return;
  const draftKey = `GURUKUL_CBT_DRAFT_${activeCBT.testId}_${activeCBT.uid}`;
  localStorage.setItem(draftKey, JSON.stringify({
    answers: activeCBT.answers,
    marked: activeCBT.marked,
    visited: activeCBT.visited,
    currentIndex: activeCBT.currentIndex
  }));
}

function renderActiveCBTQuestionScreen() {
  if (!activeCBT) return;
  const t = APP_STATE.tests[activeCBT.testId];
  if (!t || !t.questions) return;

  const idx = activeCBT.currentIndex;
  const q = t.questions[idx];
  const totalQ = t.questions.length;
  activeCBT.visited[idx] = true;
  persistCBTDraftLocally();

  const secLeft = Math.max(0, Math.floor((activeCBT.endTimeMs - Date.now()) / 1000));
  const answeredCount = Object.keys(activeCBT.answers).length;
  const markedCount = Object.keys(activeCBT.marked).filter((k) => activeCBT.marked[k]).length;
  const selectedOpt = activeCBT.answers[idx] || "";

  document.getElementById("cbtRunnerBody").innerHTML = `
    <!-- Sticky Top Live Bar -->
    <div class="sticky top-0 z-20 bg-slate-900 text-white p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 shadow-lg">
      <div class="flex items-center gap-2 text-xs font-extrabold">
        <span class="bg-indigo-600 px-2.5 py-1 rounded-lg">Q ${idx + 1} / ${totalQ}</span>
        <span class="text-emerald-400">हल: ${answeredCount}</span>
        <span class="text-violet-300 hidden sm:inline">रिव्यू: ${markedCount}</span>
      </div>
      <div class="flex items-center gap-2">
        <div id="cbtLiveTimerDisplay" class="px-3 py-1 rounded-xl font-mono font-black text-sm ${secLeft <= 120 ? "bg-rose-600 animate-pulse" : "bg-slate-800 text-amber-300"}">
          <i class="fa-regular fa-clock mr-1"></i>${formatCBTClock(secLeft)}
        </div>
        <button type="button" onclick="confirmSubmitActiveCBT()" class="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shadow">Submit</button>
      </div>
    </div>

    <!-- Main Question + Palette Split -->
    <div class="grid lg:grid-cols-3 gap-4">
      <!-- Question Card -->
      <div class="lg:col-span-2 ed-card p-4 sm:p-5 rounded-2xl space-y-4">
        <div class="flex items-start justify-between gap-2">
          <div class="text-sm sm:text-base font-extrabold text-slate-900 leading-relaxed whitespace-pre-line">
            <span class="text-indigo-600">Q${idx + 1}.</span> ${escapeHtml(q.q)}
          </div>
          <span class="text-[10px] font-black px-2 py-1 rounded-lg bg-slate-100 text-slate-600 shrink-0">+${t.plusMark || 4} / -${t.minusMark || 1}</span>
        </div>

        ${q.imageUrl ? `<img src="${escapeHtml(q.imageUrl)}" class="max-h-56 rounded-xl border border-slate-200 mx-auto object-contain" />` : ""}

        <div class="space-y-2.5">
          ${["A", "B", "C", "D"].map((opt) => {
            const isSel = selectedOpt === opt;
            return `
              <button type="button" onclick="selectCBTOption('${opt}')" class="w-full text-left p-3.5 rounded-2xl border-2 transition flex items-start gap-3 ${isSel ? "border-indigo-600 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"}">
                <span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${isSel ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}">${opt}</span>
                <span class="text-xs sm:text-sm font-bold text-slate-800 pt-0.5 leading-snug">${escapeHtml(q[opt] || "")}</span>
              </button>
            `;
          }).join("")}
        </div>

        <!-- Bottom Action Buttons -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <div class="flex gap-2">
            <button type="button" onclick="jumpToCBTQuestion(${Math.max(0, idx - 1)})" ${idx === 0 ? "disabled" : ""} class="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-extrabold disabled:opacity-40"><i class="fa-solid fa-chevron-left mr-1"></i> पिछला</button>
            <button type="button" onclick="clearCBTOption()" class="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-extrabold">Clear</button>
          </div>
          <div class="flex gap-2">
            <button type="button" onclick="markCBTForReviewAndNext()" class="px-3 py-2 rounded-xl bg-violet-100 text-violet-800 text-xs font-extrabold"><i class="fa-solid fa-flag mr-1"></i> Review & Next</button>
            ${idx < totalQ - 1
              ? `<button type="button" onclick="jumpToCBTQuestion(${idx + 1})" class="brand-gradient text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow">Save & Next <i class="fa-solid fa-chevron-right ml-1"></i></button>`
              : `<button type="button" onclick="confirmSubmitActiveCBT()" class="emerald-gradient text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow">Final Submit <i class="fa-solid fa-check ml-1"></i></button>`
            }
          </div>
        </div>
      </div>

      <!-- Question Palette -->
      <div class="ed-card p-4 rounded-2xl space-y-3 h-fit">
        <div class="text-xs font-extrabold text-slate-700 flex items-center justify-between">
          <span><i class="fa-solid fa-grip text-indigo-600 mr-1"></i> Question Palette</span>
          <span class="text-[10px] text-slate-400">टैप करके जाएं</span>
        </div>
        <div class="flex flex-wrap gap-2">
          ${t.questions.map((_, i) => {
            const isCur = i === idx;
            const isAns = Boolean(activeCBT.answers[i]);
            const isMrk = Boolean(activeCBT.marked[i]);
            const isVis = Boolean(activeCBT.visited[i]);
            let cls = "bg-white text-slate-700";
            if (isMrk) cls = "q-marked";
            else if (isAns) cls = "q-answered";
            else if (isVis && !isCur) cls = "q-visited";
            return `<button type="button" onclick="jumpToCBTQuestion(${i})" class="cbt-q-pill ${cls} ${isCur ? "q-current" : ""}">${i + 1}</button>`;
          }).join("")}
        </div>
        <div class="grid grid-cols-2 gap-1.5 pt-2 border-t text-[10px] font-bold text-slate-600">
          <div><span class="inline-block w-2.5 h-2.5 rounded bg-emerald-500 mr-1"></span>उत्तर दिया (${answeredCount})</div>
          <div><span class="inline-block w-2.5 h-2.5 rounded bg-violet-500 mr-1"></span>रिव्यू (${markedCount})</div>
          <div><span class="inline-block w-2.5 h-2.5 rounded bg-rose-500 mr-1"></span>छोड़ा गया</div>
          <div><span class="inline-block w-2.5 h-2.5 rounded border border-slate-300 bg-white mr-1"></span>नहीं देखा</div>
        </div>
      </div>
    </div>
  `;
}

function selectCBTOption(opt) {
  if (!activeCBT) return;
  activeCBT.answers[activeCBT.currentIndex] = opt;
  delete activeCBT.marked[activeCBT.currentIndex];
  renderActiveCBTQuestionScreen();
}

function clearCBTOption() {
  if (!activeCBT) return;
  delete activeCBT.answers[activeCBT.currentIndex];
  delete activeCBT.marked[activeCBT.currentIndex];
  renderActiveCBTQuestionScreen();
}

function markCBTForReviewAndNext() {
  if (!activeCBT) return;
  const t = APP_STATE.tests[activeCBT.testId];
  activeCBT.marked[activeCBT.currentIndex] = true;
  if (t && activeCBT.currentIndex < t.questions.length - 1) {
    activeCBT.currentIndex++;
  }
  renderActiveCBTQuestionScreen();
}

function jumpToCBTQuestion(newIdx) {
  if (!activeCBT) return;
  activeCBT.currentIndex = newIdx;
  renderActiveCBTQuestionScreen();
}

async function confirmSubmitActiveCBT() {
  if (!activeCBT) return;
  const t = APP_STATE.tests[activeCBT.testId];
  const totalQ = (t && t.questions ? t.questions.length : 0);
  const ansCnt = Object.keys(activeCBT.answers).length;
  const ok = await showAppConfirm(
    `आपने ${totalQ} में से ${ansCnt} प्रश्नों के उत्तर दिए हैं (${totalQ - ansCnt} छोड़े गए)।\n\nक्या आप वाकई फाइनल सबमिट करना चाहते हैं? इसके बाद बदलाव नहीं हो सकेगा।`,
    "टेस्ट सबमिट पुष्टि"
  );
  if (ok) submitActiveCBTTest(false);
}

// =========================================================
// 4. SECURE 2-STEP SUBMISSION (ALIGNED WITH FIREBASE RULES)
// =========================================================
async function submitActiveCBTTest(isAutoSubmit = false) {
  if (!activeCBT || activeCBT.isSubmitting) return;
  activeCBT.isSubmitting = true;

  if (cbtTimerInterval) {
    clearInterval(cbtTimerInterval);
    cbtTimerInterval = null;
  }

  const { testId, uid, answers, startedAtMs, durationSec } = activeCBT;
  const t = APP_STATE.tests[testId];
  if (!t) return;

  document.getElementById("cbtRunnerBody").innerHTML = `
    <div class="py-16 text-center space-y-3">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-indigo-600"></i>
      <h4 class="text-sm font-extrabold">${isAutoSubmit ? "समय समाप्त! टेस्ट ऑटो-सबमिट हो रहा है..." : "आपका टेस्ट सबमिट और चेक हो रहा है..."}</h4>
      <p class="text-xs text-slate-500">रैंक, परसेंटाइल और डिटेल्ड सॉल्यूशन तैयार हो रहा है।</p>
    </div>
  `;

  try {
    const p = APP_STATE.userProfile || {};
    const timeTakenSec = Math.min(durationSec, Math.max(1, Math.floor((Date.now() - startedAtMs) / 1000)));
    const attemptRef = db.ref(`testAttempts/${testId}/${uid}`);

    // Step 1: Mark submitted = true (Unlocks testAnswers/{testId} read via RTDB Rules)
    const initialSubmission = {
      uid,
      studentName: p.name || "Student",
      studentCode: p.studentCode || "",
      answers: answers || {},
      submitted: true,
      graded: false,
      timeTakenSec,
      submittedAt: Date.now()
    };
    await attemptRef.set(initialSubmission);

    // Step 2: Fetch protected Answer Key & Solutions from testAnswers/{testId}
    const ansSnap = await db.ref(`testAnswers/${testId}`).once("value");
    const ansKeyMap = ansSnap.val() || {};
    cachedResultAnswersMap[testId] = ansKeyMap;

    // Step 3: Grade securely & Lock permanently (graded = true)
    const plusMark = Number(t.plusMark) || 4;
    const minusMark = Number(t.minusMark) || 1;
    let rightCount = 0;
    let wrongCount = 0;
    let unattemptedCount = 0;

    (t.questions || []).forEach((_, idx) => {
      const chosen = answers[idx];
      const keyEntry = ansKeyMap[idx];
      const correctOpt = (typeof keyEntry === "object" && keyEntry ? keyEntry.correct : keyEntry || "A").toUpperCase();

      if (!chosen) unattemptedCount++;
      else if (chosen === correctOpt) rightCount++;
      else wrongCount++;
    });

    const totalQ = (t.questions || []).length;
    const maxMarks = totalQ * plusMark;
    const score = Number((rightCount * plusMark - wrongCount * minusMark).toFixed(2));
    const percentage = maxMarks > 0 ? Number(Math.max(0, (score / maxMarks) * 100).toFixed(2)) : 0;
    const attemptedTotal = rightCount + wrongCount;
    const accuracy = attemptedTotal > 0 ? Number(((rightCount / attemptedTotal) * 100).toFixed(1)) : 0;

    const finalGraded = {
      ...initialSubmission,
      score,
      maxMarks,
      percentage,
      accuracy,
      rightCount,
      wrongCount,
      unattemptedCount,
      graded: true
    };
    await attemptRef.update(finalGraded);

    if (!APP_STATE.testAttempts[testId]) APP_STATE.testAttempts[testId] = {};
    APP_STATE.testAttempts[testId][uid] = finalGraded;

    // Clear local timer & draft
    localStorage.removeItem(`GURUKUL_CBT_START_${testId}_${uid}`);
    localStorage.removeItem(`GURUKUL_CBT_DRAFT_${testId}_${uid}`);
    activeCBT = null;

    triggerAlertFeedback();
    showToast("टेस्ट सफलतापूर्वक सबमिट हो गया!", "SUCCESS");
    renderStudentTestsList();
    renderCBTResultAndAnalysis(testId);
  } catch (err) {
    console.error("CBT Submit Error:", err);
    if (activeCBT) activeCBT.isSubmitting = false;
    await showAppAlert("टेस्ट सबमिट करने में समस्या आई: " + (err.message || "इंटरनेट चेक करें"), "त्रुटि", "DANGER");
  }
}

// =========================================================
// 5. RESULT ANALYSIS: RANK, NTA PERCENTILE, TOPPER & SOLUTIONS
// =========================================================
async function renderCBTResultAndAnalysis(testId) {
  const t = APP_STATE.tests && APP_STATE.tests[testId];
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  if (!t || !uid) return;

  activeSolutionFilter = "ALL";
  document.getElementById("cbtModalTitle").textContent = `रिजल्ट व सॉल्यूशन — ${t.title}`;
  document.getElementById("cbtModalSub").textContent = "All-Student Rank • NTA Percentile • टॉपर तुलना • विस्तृत हल";
  document.getElementById("cbtRunnerBody").innerHTML = `
    <div class="py-12 text-center space-y-2 text-xs">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-indigo-600"></i>
      <p class="font-bold text-slate-500">ऑल-स्टूडेंट रैंक और सॉल्यूशन लोड हो रहे हैं...</p>
    </div>
  `;
  openModalById("cbtRunnerModal");

  try {
    // Fresh fetch of attempts and answer key
    const [attSnap, ansSnap] = await Promise.all([
      db.ref(`testAttempts/${testId}`).once("value"),
      db.ref(`testAnswers/${testId}`).once("value")
    ]);

    const attemptsObj = attSnap.val() || {};
    const ansKeyMap = ansSnap.val() || {};
    APP_STATE.testAttempts[testId] = attemptsObj;
    cachedResultAnswersMap[testId] = ansKeyMap;

    const myAtt = attemptsObj[uid];
    if (!myAtt || !myAtt.graded) {
      return openCBTTestOverview(testId);
    }

    // Sort all graded candidates (Score DESC -> Time Taken ASC -> Wrong Count ASC)
    const allGraded = Object.values(attemptsObj)
      .filter((a) => a && a.graded)
      .sort((a, b) => (b.score - a.score) || ((a.timeTakenSec || 9999) - (b.timeTakenSec || 9999)) || (a.wrongCount - b.wrongCount));

    const totalCandidates = allGraded.length || 1;
    const myRank = Math.max(1, allGraded.findIndex((a) => a.uid === uid) + 1);
    const topper = allGraded[0] || myAtt;

    // NTA Standard Percentile Formula: (Candidates with score <= myScore / Total) * 100
    const equalOrBelowCount = allGraded.filter((a) => Number(a.score) <= Number(myAtt.score)).length;
    const ntaPercentile = Number(((equalOrBelowCount / totalCandidates) * 100).toFixed(2));

    const avgScore = Number((allGraded.reduce((s, a) => s + (Number(a.score) || 0), 0) / totalCandidates).toFixed(1));
    const avgAcc = Number((allGraded.reduce((s, a) => s + (Number(a.accuracy) || 0), 0) / totalCandidates).toFixed(1));

    const body = document.getElementById("cbtRunnerBody");
    body.innerHTML = `
      <!-- KPI Score Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
        <div class="p-3 rounded-2xl hero-gradient text-white shadow">
          <div class="text-[10px] text-indigo-200 font-bold">ऑल-स्टूडेंट रैंक</div>
          <div class="text-xl font-black text-amber-300">#${myRank} <span class="text-xs font-bold text-indigo-200">/ ${totalCandidates}</span></div>
        </div>
        <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
          <div class="text-[10px] font-bold text-emerald-700">आपका स्कोर</div>
          <div class="text-xl font-black text-emerald-800">${myAtt.score} <span class="text-xs">/ ${myAtt.maxMarks}</span></div>
          <div class="text-[10px] font-bold text-emerald-700">${myAtt.percentage}% अंक</div>
        </div>
        <div class="p-3 rounded-2xl bg-purple-50 border border-purple-200">
          <div class="text-[10px] font-bold text-purple-700">NTA परसेंटाइल</div>
          <div class="text-xl font-black text-purple-800">${ntaPercentile}%ile</div>
          <div class="text-[10px] font-bold text-purple-600">Accuracy: ${myAtt.accuracy}%</div>
        </div>
        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <div class="text-[10px] font-bold text-slate-600">सही / गलत / छोड़े</div>
          <div class="text-base font-black mt-0.5">
            <span class="text-emerald-600">${myAtt.rightCount}</span> /
            <span class="text-rose-600">${myAtt.wrongCount}</span> /
            <span class="text-slate-500">${myAtt.unattemptedCount}</span>
          </div>
          <div class="text-[10px] font-bold text-slate-500">समय: ${formatCBTClock(myAtt.timeTakenSec || 0)}</div>
        </div>
      </div>

      <!-- Topper Comparison Table -->
      <div class="ed-card rounded-2xl overflow-hidden text-xs">
        <div class="bg-slate-900 text-white px-4 py-2.5 font-extrabold flex items-center justify-between">
          <span><i class="fa-solid fa-trophy text-amber-400 mr-1.5"></i> टॉपर के साथ तुलना (Topper vs You)</span>
          <span class="text-[10px] text-amber-300">Topper: ${escapeHtml(topper.studentName || "Rank 1")}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-center border-collapse">
            <thead class="bg-slate-100 text-slate-600 text-[11px]">
              <tr>
                <th class="p-2 text-left">पैरामीटर</th>
                <th class="p-2 text-indigo-700">आप (You)</th>
                <th class="p-2 text-emerald-700">टॉपर (#1)</th>
                <th class="p-2 text-slate-600">औसत (Avg)</th>
              </tr>
            </thead>
            <tbody class="divide-y font-bold">
              <tr><td class="p-2 text-left">कुल स्कोर</td><td class="p-2 text-indigo-700">${myAtt.score}</td><td class="p-2 text-emerald-700">${topper.score}</td><td class="p-2">${avgScore}</td></tr>
              <tr><td class="p-2 text-left">Accuracy %</td><td class="p-2 text-indigo-700">${myAtt.accuracy}%</td><td class="p-2 text-emerald-700">${topper.accuracy}%</td><td class="p-2">${avgAcc}%</td></tr>
              <tr><td class="p-2 text-left">सही / गलत प्रश्न</td><td class="p-2">${myAtt.rightCount} / ${myAtt.wrongCount}</td><td class="p-2">${topper.rightCount} / ${topper.wrongCount}</td><td class="p-2">-</td></tr>
              <tr><td class="p-2 text-left">लगा समय</td><td class="p-2">${formatCBTClock(myAtt.timeTakenSec || 0)}</td><td class="p-2">${formatCBTClock(topper.timeTakenSec || 0)}</td><td class="p-2">-</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top 5 Leaderboard -->
      <div class="ed-card p-3.5 rounded-2xl space-y-2 text-xs">
        <div class="font-extrabold text-slate-800"><i class="fa-solid fa-medal text-amber-500 mr-1"></i> टॉप 5 लीडरबोर्ड</div>
        <div class="space-y-1.5">
          ${allGraded.slice(0, 5).map((cand, i) => `
            <div class="p-2 rounded-xl flex items-center justify-between ${cand.uid === uid ? "bg-indigo-50 border border-indigo-300" : "bg-slate-50 border border-slate-100"}">
              <div class="flex items-center gap-2 font-bold">
                <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${i === 0 ? "bg-amber-400 text-slate-950" : i === 1 ? "bg-slate-300 text-slate-900" : i === 2 ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-700"}">#${i + 1}</span>
                <span>${escapeHtml(cand.studentName || "Student")} ${cand.uid === uid ? "(आप)" : ""}</span>
              </div>
              <span class="font-black text-indigo-700">${cand.score}/${cand.maxMarks} <span class="text-[10px] text-slate-500">(${cand.percentage}%)</span></span>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Solutions Filter & Detailed List -->
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h4 class="font-extrabold text-sm text-slate-900"><i class="fa-solid fa-book-open text-indigo-600 mr-1.5"></i> प्रश्न-वार उत्तर और सॉल्यूशन</h4>
          <div class="flex gap-1.5 flex-wrap">
            <button type="button" onclick="filterCBTSolutions('${escapeHtml(testId)}', 'ALL')" class="cbt-sol-fbtn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-600 text-white" data-filter="ALL">सभी</button>
            <button type="button" onclick="filterCBTSolutions('${escapeHtml(testId)}', 'RIGHT')" class="cbt-sol-fbtn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-700" data-filter="RIGHT">सही (${myAtt.rightCount})</button>
            <button type="button" onclick="filterCBTSolutions('${escapeHtml(testId)}', 'WRONG')" class="cbt-sol-fbtn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-700" data-filter="WRONG">गलत (${myAtt.wrongCount})</button>
            <button type="button" onclick="filterCBTSolutions('${escapeHtml(testId)}', 'LEFT')" class="cbt-sol-fbtn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-700" data-filter="LEFT">छोड़े (${myAtt.unattemptedCount})</button>
          </div>
        </div>
        <div id="cbtDetailedSolutionsBox" class="space-y-3"></div>
      </div>
    `;

    renderCBTSolutionsCards(testId, "ALL");
  } catch (err) {
    console.error("Result load error:", err);
    document.getElementById("cbtRunnerBody").innerHTML = `<div class="p-6 text-center text-xs font-bold text-rose-600">रिजल्ट लोड करने में त्रुटि आई।</div>`;
  }
}

function filterCBTSolutions(testId, filterMode) {
  activeSolutionFilter = filterMode;
  document.querySelectorAll(".cbt-sol-fbtn").forEach((btn) => {
    const active = btn.getAttribute("data-filter") === filterMode;
    btn.className = active
      ? "cbt-sol-fbtn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-600 text-white"
      : "cbt-sol-fbtn px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-slate-100 text-slate-700";
  });
  renderCBTSolutionsCards(testId, filterMode);
}

function renderCBTSolutionsCards(testId, filterMode) {
  const box = document.getElementById("cbtDetailedSolutionsBox");
  const t = APP_STATE.tests && APP_STATE.tests[testId];
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  const myAtt = APP_STATE.testAttempts && APP_STATE.testAttempts[testId] && APP_STATE.testAttempts[testId][uid];
  const ansKeyMap = cachedResultAnswersMap[testId] || {};
  if (!box || !t || !myAtt) return;

  const myAns = myAtt.answers || {};
  const cards = [];

  (t.questions || []).forEach((q, idx) => {
    const chosen = myAns[idx] || "";
    const keyEntry = ansKeyMap[idx];
    const correctOpt = (typeof keyEntry === "object" && keyEntry ? keyEntry.correct : keyEntry || "A").toUpperCase();
    const explanation = (typeof keyEntry === "object" && keyEntry && keyEntry.explanation) ? keyEntry.explanation : "";

    const state = !chosen ? "LEFT" : (chosen === correctOpt ? "RIGHT" : "WRONG");
    if (filterMode !== "ALL" && state !== filterMode) return;

    const statusBadge = state === "RIGHT"
      ? `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black text-[10px]">✅ सही (+${t.plusMark || 4})</span>`
      : state === "WRONG"
        ? `<span class="bg-rose-100 text-rose-700 px-2 py-0.5 rounded font-black text-[10px]">❌ गलत (-${t.minusMark || 1})</span>`
        : `<span class="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-black text-[10px]">⚪ छोड़ा गया (0)</span>`;

    cards.push(`
      <div class="ed-card p-4 rounded-2xl space-y-2.5 text-xs">
        <div class="flex items-start justify-between gap-2">
          <div class="font-extrabold text-sm text-slate-900">Q${idx + 1}. ${escapeHtml(q.q)}</div>
          ${statusBadge}
        </div>
        <div class="grid sm:grid-cols-2 gap-2">
          ${["A", "B", "C", "D"].map((opt) => {
            let optCls = "border-slate-200 bg-slate-50 text-slate-700";
            if (opt === correctOpt) optCls = "border-emerald-500 bg-emerald-50 text-emerald-900 font-extrabold";
            else if (opt === chosen && chosen !== correctOpt) optCls = "border-rose-500 bg-rose-50 text-rose-900 font-extrabold";
            return `<div class="p-2.5 rounded-xl border ${optCls}"><strong>(${opt})</strong> ${escapeHtml(q[opt] || "")}</div>`;
          }).join("")}
        </div>
        ${explanation ? `
          <div class="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold leading-relaxed">
            <strong class="text-indigo-700"><i class="fa-solid fa-lightbulb mr-1"></i>सॉल्यूशन:</strong> ${escapeHtml(explanation)}
          </div>
        ` : ""}
      </div>
    `);
  });

  box.innerHTML = cards.length
    ? cards.join("")
    : `<div class="p-6 bg-slate-50 rounded-2xl text-center text-xs font-bold text-slate-400">इस फिल्टर में कोई प्रश्न नहीं है।</div>`;
}

async function closeCBTRunnerModal() {
  if (activeCBT && !activeCBT.isSubmitting) {
    const ok = await showAppConfirm(
      "आपका लाइव टेस्ट अभी चल रहा है! बैकग्राउंड में टाइमर चलता रहेगा। क्या आप इसे अस्थायी रूप से बंद करना चाहते हैं?",
      "लाइव टेस्ट चेतावनी"
    );
    if (!ok) return;
  }
  if (cbtTimerInterval) {
    clearInterval(cbtTimerInterval);
    cbtTimerInterval = null;
  }
  activeCBT = null;
  closeModalById("cbtRunnerModal");
}

// =========================================================
// 6. PHOTO-BASED STUDENT DOUBT ENGINE (ASK & TRACK REPLIES)
// =========================================================
async function submitStudentDoubt() {
  const uid = APP_STATE.currentUser && APP_STATE.currentUser.uid;
  if (!uid) return;

  const subject = (document.getElementById("doubtSubjectInput")?.value || "").trim();
  const question = (document.getElementById("doubtQuestionInput")?.value || "").trim();
  const fileEl = document.getElementById("doubtPhotoInput");

  if (!subject || !question) {
    return showAppAlert("कृपया विषय (Subject) और अपना सवाल दोनों लिखें।", "अधूरी जानकारी", "DANGER");
  }

  const btn = document.getElementById("btnSubmitDoubt");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> भेजा जा रहा है...';

  try {
    let photoBase64 = "";
    if (fileEl && fileEl.files && fileEl.files[0]) {
      photoBase64 = await compressImageToBase64(fileEl.files[0], 720, 0.72);
    }

    const p = APP_STATE.userProfile || {};
    const doubtId = `DBT_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    const doubtObj = {
      doubtId,
      uid,
      studentName: p.name || "Student",
      studentCode: p.studentCode || "",
      studentPhone: p.phone || "",
      subject,
      question,
      photoBase64,
      status: "PENDING",
      replyText: "",
      replyPhotoBase64: "",
      createdAt: Date.now(),
      repliedAt: null
    };

    await db.ref(`doubts/${uid}/${doubtId}`).set(doubtObj);

    document.getElementById("doubtSubjectInput").value = "";
    document.getElementById("doubtQuestionInput").value = "";
    if (fileEl) fileEl.value = "";

    showToast("आपका डाउट टीचर को भेज दिया गया है!", "SUCCESS");
  } catch (err) {
    console.error("Doubt submit error:", err);
    await showAppAlert("डाउट भेजने में समस्या आई: " + (err.message || "कृपया दोबारा प्रयास करें"), "त्रुटि", "DANGER");
  } finally {
    btn.disabled = false;
    btn.textContent = "डाउट सबमिट करें";
  }
}

function renderStudentDoubtsList() {
  const box = document.getElementById("myDoubtsBox");
  if (!box) return;

  const list = Object.values(APP_STATE.doubts || {}).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (!list.length) {
    box.innerHTML = `
      <div class="ed-card p-6 rounded-2xl text-center text-xs font-bold text-slate-400">
        अभी तक आपने कोई डाउट नहीं पूछा है। ऊपर दिए बॉक्स से सवाल या उसकी फोटो भेजें।
      </div>
    `;
    return;
  }

  box.innerHTML = list.map((d) => {
    const solved = d.status === "SOLVED";
    return `
      <div class="ed-card p-4 rounded-2xl space-y-2.5 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="bg-violet-100 text-violet-800 px-2.5 py-0.5 rounded-full font-extrabold text-[10px]">${escapeHtml(d.subject)}</span>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-slate-400">${formatDateTime(d.createdAt)}</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${solved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}">
              ${solved ? "✅ SOLVED" : "⏳ PENDING REPLY"}
            </span>
          </div>
        </div>

        <p class="font-bold text-slate-900 whitespace-pre-line leading-relaxed">${escapeHtml(d.question)}</p>
        ${d.photoBase64 ? `<img src="${d.photoBase64}" onclick="previewDoubtFullImage(this.src)" class="max-h-48 rounded-xl border border-slate-200 cursor-pointer object-contain bg-slate-50" title="बड़ा देखने के लिए टैप करें" />` : ""}

        ${solved ? `
          <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
            <div class="text-[11px] font-extrabold text-emerald-900 flex items-center justify-between">
              <span><i class="fa-solid fa-chalkboard-user mr-1"></i> टीचर का जवाब (Solution):</span>
              <span class="text-[10px] text-emerald-700">${formatDateTime(d.repliedAt)}</span>
            </div>
            <p class="text-xs font-semibold text-slate-800 whitespace-pre-line leading-relaxed">${escapeHtml(d.replyText || "")}</p>
            ${d.replyPhotoBase64 ? `<img src="${d.replyPhotoBase64}" onclick="previewDoubtFullImage(this.src)" class="max-h-56 rounded-xl border border-emerald-300 cursor-pointer object-contain bg-white" />` : ""}
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function previewDoubtFullImage(src) {
  if (!src) return;
  const overlay = document.createElement("div");
  overlay.className = "fixed inset-0 z-[99980] bg-slate-950/95 flex items-center justify-center p-4 cursor-pointer";
  overlay.innerHTML = `
    <div class="relative max-w-3xl w-full flex flex-col items-center gap-3">
      <img src="${src}" class="max-h-[82vh] max-w-full rounded-2xl border-2 border-white/20 shadow-2xl object-contain" />
      <button type="button" class="bg-rose-600 text-white font-extrabold px-5 py-2 rounded-xl text-xs">बंद करें (Close)</button>
    </div>
  `;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}
