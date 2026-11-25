/* =====================================================================
   GURUKUL ONLINE APP — PROTECTED VIDEO PLAYER, WATERMARK, CHAT & PDF.JS
   File: js/player-pdf.js
   ===================================================================== */

// Video Player State
let ytPlayerInstance = null;
let html5VideoEl = null;
let ytApiReady = Boolean(window.YT && window.YT.Player);
let pendingVideoConfig = null;
let activeVideoMeta = null;
let videoProgressTimer = null;
let videoWatermarkTimer = null;
let activeLiveChatRef = null;
let isVideoPlaying = false;

// PDF Viewer State
let activePdfDoc = null;
let activePdfScale = 1.15;
let activePdfUrl = "";
let pdfWatermarkTimer = null;

// Configure PDF.js Worker
if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// YouTube IFrame API Global Callback
window.onYouTubeIframeAPIReady = function () {
  ytApiReady = true;
  if (pendingVideoConfig) {
    const cfg = pendingVideoConfig;
    pendingVideoConfig = null;
    mountYouTubeProtectedPlayer(cfg.ytId);
  }
};

// =========================================================
// 1. WATERMARK HELPER (ANTI-CAMERA-RECORDING PROTECTION)
// =========================================================
function getStudentWatermarkText() {
  if (APP_STATE.isAdmin) return "ADMIN PREVIEW • GURUKUL ONLINE";
  const p = APP_STATE.userProfile || {};
  const name = (p.name || "Student").slice(0, 22);
  const idPart = p.phone || p.studentCode || (APP_STATE.currentUser ? APP_STATE.currentUser.uid.slice(0, 8) : "");
  return `${name} • ${idPart} • GURUKUL`;
}

function startMovingWatermark(elementId, isVideo = true) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = getStudentWatermarkText();

  const moveNow = () => {
    const topPct = isVideo ? (10 + Math.floor(Math.random() * 68)) : (12 + Math.floor(Math.random() * 72));
    const leftPct = 6 + Math.floor(Math.random() * 52);
    el.style.top = `${topPct}%`;
    el.style.left = `${leftPct}%`;
  };

  moveNow();
  if (isVideo) {
    if (videoWatermarkTimer) clearInterval(videoWatermarkTimer);
    videoWatermarkTimer = setInterval(moveNow, 6500);
  } else {
    if (pdfWatermarkTimer) clearInterval(pdfWatermarkTimer);
    pdfWatermarkTimer = setInterval(moveNow, 7000);
  }
}

function stopMovingWatermark(isVideo = true) {
  if (isVideo && videoWatermarkTimer) {
    clearInterval(videoWatermarkTimer);
    videoWatermarkTimer = null;
  }
  if (!isVideo && pdfWatermarkTimer) {
    clearInterval(pdfWatermarkTimer);
    pdfWatermarkTimer = null;
  }
}

// =========================================================
// 2. PROTECTED VIDEO PLAYER (YOUTUBE UNLISTED / LIVE + MP4)
// =========================================================
function extractYouTubeVideoId(url) {
  if (!url) return null;
  const clean = String(url).trim();
  const match = clean.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/
  );
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  return null;
}

function formatSecondsToMMSS(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function openProtectedVideoPlayer(meta) {
  if (!meta || !meta.videoUrl) {
    return showToast("वीडियो लिंक उपलब्ध नहीं है।", "DANGER");
  }

  // Cleanup any previous player
  destroyActiveVideoPlayer();

  activeVideoMeta = {
    lectureId: meta.lectureId || `LEC_${Date.now()}`,
    batchId: meta.batchId || "",
    title: meta.title || "Online Class",
    subject: meta.subject || "",
    chapter: meta.chapter || "",
    videoUrl: meta.videoUrl,
    isDemo: Boolean(meta.isDemo)
  };

  document.getElementById("playerVideoTitle").textContent = activeVideoMeta.title;
  document.getElementById("playerVideoSub").textContent =
    `${activeVideoMeta.subject ? activeVideoMeta.subject + " • " : ""}${APP_CONFIG.appName} Protected Stream`;

  document.getElementById("playerSeekSlider").value = 0;
  document.getElementById("playerCurrentTime").textContent = "00:00";
  document.getElementById("playerDurationTime").textContent = "00:00";
  document.getElementById("playerSpeedSelect").value = "1";
  document.getElementById("videoLiveChatPanel").classList.add("hidden");

  updateVideoBookmarkButtonUI();
  openModalById("protectedVideoModal");
  startMovingWatermark("videoDynamicWatermark", true);

  const ytId = extractYouTubeVideoId(activeVideoMeta.videoUrl);
  if (ytId) {
    if (ytApiReady || (window.YT && window.YT.Player)) {
      ytApiReady = true;
      mountYouTubeProtectedPlayer(ytId);
    } else {
      pendingVideoConfig = { ytId };
      document.getElementById("ytPlayerMount").innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-xs text-slate-300 gap-2">
          <i class="fa-solid fa-spinner fa-spin text-xl text-amber-400"></i>
          <span>प्रोटेक्टेड प्लेयर लोड हो रहा है...</span>
        </div>
      `;
    }
  } else {
    mountHtml5ProtectedVideo(activeVideoMeta.videoUrl);
  }
}

function mountYouTubeProtectedPlayer(ytId) {
  const mount = document.getElementById("ytPlayerMount");
  if (!mount) return;
  mount.innerHTML = `<div id="ytInnerIframeHost" class="w-full h-full"></div>`;

  ytPlayerInstance = new YT.Player("ytInnerIframeHost", {
    videoId: ytId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      origin: window.location.origin
    },
    events: {
      onReady: (e) => {
        try { e.target.playVideo(); } catch (err) {}
        isVideoPlaying = true;
        updatePlayPauseBtnIcon();
        startVideoProgressTracker();
      },
      onStateChange: (e) => {
        if (typeof YT !== "undefined") {
          isVideoPlaying = e.data === YT.PlayerState.PLAYING;
          updatePlayPauseBtnIcon();
        }
      }
    }
  });
}

function mountHtml5ProtectedVideo(url) {
  const mount = document.getElementById("ytPlayerMount");
  if (!mount) return;
  mount.innerHTML = `
    <video id="nativeProtectedVideoEl" class="w-full h-full bg-black object-contain" playsinline autoplay controlsList="nodownload noplaybackrate" oncontextmenu="return false;">
      <source src="${escapeHtml(url)}" type="video/mp4" />
    </video>
  `;
  html5VideoEl = document.getElementById("nativeProtectedVideoEl");
  if (html5VideoEl) {
    html5VideoEl.onplay = () => { isVideoPlaying = true; updatePlayPauseBtnIcon(); };
    html5VideoEl.onpause = () => { isVideoPlaying = false; updatePlayPauseBtnIcon(); };
    startVideoProgressTracker();
  }
}

function updatePlayPauseBtnIcon() {
  const btn = document.getElementById("btnCustomPlayPause");
  if (!btn) return;
  btn.innerHTML = isVideoPlaying
    ? '<i class="fa-solid fa-pause"></i>'
    : '<i class="fa-solid fa-play"></i>';
}

function startVideoProgressTracker() {
  if (videoProgressTimer) clearInterval(videoProgressTimer);
  videoProgressTimer = setInterval(() => {
    let cur = 0;
    let dur = 0;
    if (ytPlayerInstance && typeof ytPlayerInstance.getCurrentTime === "function") {
      cur = ytPlayerInstance.getCurrentTime() || 0;
      dur = ytPlayerInstance.getDuration() || 0;
    } else if (html5VideoEl) {
      cur = html5VideoEl.currentTime || 0;
      dur = html5VideoEl.duration || 0;
    }

    const curEl = document.getElementById("playerCurrentTime");
    const durEl = document.getElementById("playerDurationTime");
    const slider = document.getElementById("playerSeekSlider");

    if (curEl) curEl.textContent = formatSecondsToMMSS(cur);
    if (durEl) durEl.textContent = dur > 0 ? formatSecondsToMMSS(dur) : "LIVE";
    if (slider && dur > 0) {
      slider.value = Math.min(100, Math.max(0, (cur / dur) * 100));
    }
  }, 600);
}

function toggleCustomVideoPlayPause() {
  if (ytPlayerInstance && typeof ytPlayerInstance.getPlayerState === "function") {
    const state = ytPlayerInstance.getPlayerState();
    if (state === 1) {
      ytPlayerInstance.pauseVideo();
      isVideoPlaying = false;
    } else {
      ytPlayerInstance.playVideo();
      isVideoPlaying = true;
    }
    updatePlayPauseBtnIcon();
  } else if (html5VideoEl) {
    if (html5VideoEl.paused) {
      html5VideoEl.play();
      isVideoPlaying = true;
    } else {
      html5VideoEl.pause();
      isVideoPlaying = false;
    }
    updatePlayPauseBtnIcon();
  }
}

function skipCustomVideo(deltaSec) {
  if (ytPlayerInstance && typeof ytPlayerInstance.getCurrentTime === "function") {
    const cur = ytPlayerInstance.getCurrentTime() || 0;
    const dur = ytPlayerInstance.getDuration() || 0;
    const next = Math.max(0, dur > 0 ? Math.min(dur, cur + deltaSec) : cur + deltaSec);
    ytPlayerInstance.seekTo(next, true);
  } else if (html5VideoEl) {
    html5VideoEl.currentTime = Math.max(0, (html5VideoEl.currentTime || 0) + deltaSec);
  }
}

function seekCustomVideo(percentVal) {
  const pct = Number(percentVal) || 0;
  if (ytPlayerInstance && typeof ytPlayerInstance.getDuration === "function") {
    const dur = ytPlayerInstance.getDuration() || 0;
    if (dur > 0) ytPlayerInstance.seekTo((pct / 100) * dur, true);
  } else if (html5VideoEl && html5VideoEl.duration) {
    html5VideoEl.currentTime = (pct / 100) * html5VideoEl.duration;
  }
}

function changeCustomVideoSpeed(rateVal) {
  const rate = Number(rateVal) || 1;
  if (ytPlayerInstance && typeof ytPlayerInstance.setPlaybackRate === "function") {
    ytPlayerInstance.setPlaybackRate(rate);
  } else if (html5VideoEl) {
    html5VideoEl.playbackRate = rate;
  }
  showToast(`वीडियो स्पीड ${rate}x सेट की गई`, "INFO");
}

function toggleCustomVideoFullscreen() {
  const card = document.getElementById("protectedVideoCard");
  if (!card) return;
  const isNowFull = card.classList.toggle("player-fullscreen-active");
  if (isNowFull) {
    if (card.requestFullscreen) card.requestFullscreen().catch(() => {});
  } else {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }
}

function destroyActiveVideoPlayer() {
  if (videoProgressTimer) {
    clearInterval(videoProgressTimer);
    videoProgressTimer = null;
  }
  if (ytPlayerInstance) {
    try { ytPlayerInstance.destroy(); } catch (e) {}
    ytPlayerInstance = null;
  }
  if (html5VideoEl) {
    try { html5VideoEl.pause(); } catch (e) {}
    html5VideoEl = null;
  }
  pendingVideoConfig = null;
  isVideoPlaying = false;
  detachLiveChatListener();

  const mount = document.getElementById("ytPlayerMount");
  if (mount) mount.innerHTML = "";
}

function closeProtectedVideoPlayer() {
  const card = document.getElementById("protectedVideoCard");
  if (card) card.classList.remove("player-fullscreen-active");
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  stopMovingWatermark(true);
  destroyActiveVideoPlayer();
  activeVideoMeta = null;
  closeModalById("protectedVideoModal");
}

// =========================================================
// 3. LIVE CLASS CHAT (REAL-TIME PER LECTURE)
// =========================================================
function detachLiveChatListener() {
  if (activeLiveChatRef) {
    try { activeLiveChatRef.off(); } catch (e) {}
    activeLiveChatRef = null;
  }
}

function toggleVideoLiveChat() {
  const panel = document.getElementById("videoLiveChatPanel");
  if (!panel || !activeVideoMeta) return;
  const isOpening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !isOpening);

  if (isOpening) {
    attachLiveChatListener(activeVideoMeta.lectureId);
  } else {
    detachLiveChatListener();
  }
}

function attachLiveChatListener(lectureId) {
  detachLiveChatListener();
  const box = document.getElementById("videoLiveChatMessages");
  if (!box || !lectureId) return;

  box.innerHTML = `<div class="text-center text-[11px] text-slate-400 py-3">लाइव चैट लोड हो रही है...</div>`;
  const chatRef = db.ref(`liveChat/${lectureId}`).limitToLast(60);
  activeLiveChatRef = chatRef;

  chatRef.on("value", (snap) => {
    const msgs = Object.values(snap.val() || {}).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!msgs.length) {
      box.innerHTML = `<div class="text-center text-[11px] text-slate-500 py-4">अभी कोई संदेश नहीं है। अपना पहला सवाल पूछें!</div>`;
      return;
    }

    box.innerHTML = msgs.map((m) => `
      <div class="p-2 rounded-xl ${m.isAdmin ? "bg-indigo-900/70 border border-amber-400/50" : "bg-slate-900 border border-slate-800"}">
        <div class="flex items-center justify-between gap-2 text-[10px]">
          <span class="font-extrabold ${m.isAdmin ? "text-amber-300" : "text-indigo-300"}">
            ${m.isAdmin ? "👨‍🏫 Teacher / Admin" : escapeHtml(m.senderName || "Student")}
          </span>
          <span class="text-slate-500">${formatDateTime(m.createdAt)}</span>
        </div>
        <p class="text-xs text-slate-100 mt-0.5 break-words">${escapeHtml(m.text || "")}</p>
      </div>
    `).join("");
    box.scrollTop = box.scrollHeight;
  });
}

async function sendLiveChatMessage() {
  if (!activeVideoMeta || !APP_STATE.currentUser) return;
  const inp = document.getElementById("videoLiveChatInput");
  const text = (inp ? inp.value : "").trim();
  if (!text) return;

  inp.value = "";
  const msgId = `MSG_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await db.ref(`liveChat/${activeVideoMeta.lectureId}/${msgId}`).set({
    msgId,
    uid: APP_STATE.currentUser.uid,
    senderName: APP_STATE.isAdmin ? "Teacher / Admin" : ((APP_STATE.userProfile && APP_STATE.userProfile.name) || "Student"),
    isAdmin: Boolean(APP_STATE.isAdmin),
    text: text.slice(0, 300),
    createdAt: Date.now()
  });
}

// =========================================================
// 4. VIDEO LECTURE BOOKMARKS (SAVE FOR QUICK REVISION)
// =========================================================
function updateVideoBookmarkButtonUI() {
  const btn = document.getElementById("btnBookmarkVideo");
  if (!btn || !activeVideoMeta) return;
  const isSaved = Boolean(APP_STATE.bookmarks && APP_STATE.bookmarks[activeVideoMeta.lectureId]);
  btn.innerHTML = isSaved
    ? '<i class="fa-solid fa-bookmark text-amber-400"></i>'
    : '<i class="fa-regular fa-bookmark"></i>';
}

async function toggleCurrentVideoBookmark() {
  if (!activeVideoMeta || !APP_STATE.currentUser || APP_STATE.isAdmin) return;
  const uid = APP_STATE.currentUser.uid;
  const lId = activeVideoMeta.lectureId;
  const exists = Boolean(APP_STATE.bookmarks && APP_STATE.bookmarks[lId]);

  if (exists) {
    await db.ref(`bookmarks/${uid}/${lId}`).remove();
    delete APP_STATE.bookmarks[lId];
    showToast("बुकमार्क से हटा दिया गया।", "INFO");
  } else {
    const rec = {
      lectureId: lId,
      batchId: activeVideoMeta.batchId,
      title: activeVideoMeta.title,
      subject: activeVideoMeta.subject || "",
      chapter: activeVideoMeta.chapter || "",
      videoUrl: activeVideoMeta.videoUrl,
      savedAt: Date.now()
    };
    await db.ref(`bookmarks/${uid}/${lId}`).set(rec);
    APP_STATE.bookmarks[lId] = rec;
    showToast("क्लास बुकमार्क में सेव हो गई!", "SUCCESS");
  }
  updateVideoBookmarkButtonUI();
  renderStudentBookmarksList();
}

function renderStudentBookmarksList() {
  const box = document.getElementById("myBookmarksBox");
  if (!box) return;

  const list = Object.values(APP_STATE.bookmarks || {}).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  if (!list.length) {
    box.innerHTML = `
      <div class="ed-card p-8 rounded-2xl text-center text-xs font-bold text-slate-400">
        अभी कोई लेक्चर बुकमार्क नहीं किया गया है। किसी भी क्लास को देखते समय ऊपर 🔖 आइकन दबाकर सेव करें।
      </div>
    `;
    return;
  }

  box.innerHTML = list.map((b) => `
    <div class="ed-card p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
      <div class="min-w-0 flex-1">
        <span class="text-[10px] font-extrabold text-indigo-600">${escapeHtml(b.subject || "Saved Lecture")}</span>
        <h4 class="font-extrabold text-sm truncate">${escapeHtml(b.title)}</h4>
        <p class="text-[10px] text-slate-400">Saved: ${formatDateOnly(b.savedAt)}</p>
      </div>
      <div class="flex items-center gap-1.5">
        <button type="button" onclick="openBookmarkedLecture('${escapeHtml(b.lectureId)}')" class="brand-gradient text-white font-extrabold px-3.5 py-2 rounded-xl text-xs shadow"><i class="fa-solid fa-play mr-1"></i>Watch</button>
        <button type="button" onclick="removeBookmarkItem('${escapeHtml(b.lectureId)}')" class="bg-rose-100 text-rose-700 font-bold px-2.5 py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join("");
}

function openBookmarkedLecture(lectureId) {
  const b = APP_STATE.bookmarks && APP_STATE.bookmarks[lectureId];
  if (!b) return;
  if (b.batchId && !isStudentEnrolledInBatch(b.batchId)) {
    return showAppAlert("इस क्लास को देखने के लिए संबंधित बैच का एक्टिव सब्सक्रिप्शन आवश्यक है।", "एक्सेस लॉक", "DANGER");
  }
  openProtectedVideoPlayer(b);
}

async function removeBookmarkItem(lectureId) {
  if (!APP_STATE.currentUser) return;
  await db.ref(`bookmarks/${APP_STATE.currentUser.uid}/${lectureId}`).remove();
  showToast("बुकमार्क हटा दिया गया।", "INFO");
}

// =========================================================
// 5. PROTECTED PDF.JS CANVAS VIEWER (NO-DOWNLOAD + GDRIVE SAFE)
// =========================================================
function extractGoogleDriveFileId(url) {
  if (!url) return null;
  const m1 = String(url).match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m1 && m1[1]) return m1[1];
  const m2 = String(url).match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (m2 && m2[1]) return m2[1];
  return null;
}

async function openProtectedPdfViewer(pdfUrl, title = "Protected Notes / eBook") {
  if (!pdfUrl) return showToast("PDF लिंक उपलब्ध नहीं है।", "DANGER");

  activePdfUrl = pdfUrl.trim();
  activePdfDoc = null;
  activePdfScale = window.innerWidth < 640 ? 0.95 : 1.25;

  document.getElementById("pdfViewerTitle").textContent = title;
  document.getElementById("pdfViewerPageInfo").textContent = "सुरक्षित डॉक्यूमेंट लोड हो रहा है...";
  const container = document.getElementById("pdfCanvasContainer");
  container.innerHTML = `
    <div class="py-16 text-center text-slate-300 space-y-2 text-xs">
      <i class="fa-solid fa-spinner fa-spin text-2xl text-amber-400"></i>
      <p>प्रोटेक्टेड PDF रेंडर हो रही है (No-Download Mode)...</p>
    </div>
  `;

  openModalById("protectedPdfModal");
  startMovingWatermark("pdfDynamicWatermark", false);

  // Google Drive लिंक को सीधे सुरक्षित Preview Frame (Pop-Out Blocked) में खोलें ताकि CORS एरर न आए
  const gDriveId = extractGoogleDriveFileId(activePdfUrl);
  if (gDriveId) {
    return mountProtectedDrivePreviewFallback(gDriveId);
  }

  // Direct PDF URL -> PDF.js Canvas Render (100% No-Download Canvas)
  if (typeof pdfjsLib !== "undefined") {
    try {
      const loadingTask = pdfjsLib.getDocument({ url: activePdfUrl });
      activePdfDoc = await loadingTask.promise;
      await renderAllPdfCanvasPages();
      return;
    } catch (err) {
      console.warn("PDF.js CORS fallback triggered:", err.message);
    }
  }

  // Fallback for non-CORS third-party PDF links
  mountProtectedIframePdfFallback(activePdfUrl);
}

async function renderAllPdfCanvasPages() {
  if (!activePdfDoc) return;
  const container = document.getElementById("pdfCanvasContainer");
  const totalPages = activePdfDoc.numPages;
  document.getElementById("pdfViewerPageInfo").textContent = `कुल पेज: ${totalPages} • Protected Canvas Mode (डाउनलोड बंद)`;
  container.innerHTML = "";

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await activePdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: activePdfScale });

    const pageWrap = document.createElement("div");
    pageWrap.className = "pdf-page-box";

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    canvas.oncontextmenu = () => false;

    pageWrap.appendChild(canvas);
    container.appendChild(pageWrap);

    await page.render({ canvasContext: ctx, viewport }).promise;
  }
}

function mountProtectedDrivePreviewFallback(fileId) {
  const container = document.getElementById("pdfCanvasContainer");
  document.getElementById("pdfViewerPageInfo").textContent = "Protected Cloud Viewer • Download & Pop-Out Blocked";
  container.innerHTML = `
    <div class="relative w-full h-[70vh] rounded-xl overflow-hidden bg-slate-950 border border-slate-700">
      <iframe
        src="https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview"
        class="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin"
        allow="autoplay">
      </iframe>
      <!-- Google Drive के ऊपरी दाएं Pop-Out/Download बटन को ब्लॉक करने वाली सुरक्षा पट्टी -->
      <div class="absolute top-0 right-0 w-20 h-14 bg-slate-900 z-20 flex items-center justify-center border-bl-xl" title="Protected">
        <i class="fa-solid fa-shield-halved text-amber-400 text-sm"></i>
      </div>
    </div>
  `;
}

function mountProtectedIframePdfFallback(url) {
  const container = document.getElementById("pdfCanvasContainer");
  document.getElementById("pdfViewerPageInfo").textContent = "Protected Document Viewer";
  container.innerHTML = `
    <div class="relative w-full h-[70vh] rounded-xl overflow-hidden bg-white">
      <iframe
        src="https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}"
        class="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin">
      </iframe>
      <div class="absolute top-0 right-0 w-16 h-14 bg-slate-900/95 z-20 flex items-center justify-center">
        <i class="fa-solid fa-lock text-amber-400 text-xs"></i>
      </div>
    </div>
  `;
}

async function adjustPdfZoom(delta) {
  if (!activePdfDoc) {
    return showToast("ज़ूम कंट्रोल केवल डायरेक्ट PDF.js कैनवास फाइल्स पर काम करता है।", "INFO");
  }
  activePdfScale = Math.min(2.4, Math.max(0.65, Number((activePdfScale + delta).toFixed(2))));
  await renderAllPdfCanvasPages();
}

function closeProtectedPdfViewer() {
  stopMovingWatermark(false);
  activePdfDoc = null;
  activePdfUrl = "";
  const container = document.getElementById("pdfCanvasContainer");
  if (container) container.innerHTML = "";
  closeModalById("protectedPdfModal");
}

// Disable right-click / long-press copy menu inside protected media modals
document.addEventListener("contextmenu", (e) => {
  if (e.target && e.target.closest && e.target.closest(".protected-media-zone")) {
    e.preventDefault();
  }
});
