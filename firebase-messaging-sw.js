importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBBdiz2-H7Dr4CmtVwfrng-7l39VA5qx2M",
  authDomain: "gurukul-online-app.firebaseapp.com",
  databaseURL: "https://gurukul-online-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gurukul-online-app",
  storageBucket: "gurukul-online-app.firebasestorage.app",
  messagingSenderId: "309899461267",
  appId: "1:309899461267:web:4ffdbd867f6703b7b90366"
});

const messaging = firebase.messaging();
const APP_LOGO = "https://gsssdhankoli.github.io/Logo.png/logo.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ऐप बंद या बैकग्राउंड में होने पर नोटिफिकेशन दिखाना (डबल नोटिफिकेशन से बचाव सहित)
messaging.onBackgroundMessage((payload) => {
  if (payload && payload.notification) return;

  const data = (payload && payload.data) || {};
  const title = data.title || "GURUKUL ONLINE APP";
  const body = data.body || "नया अपडेट आया है — देखने के लिए टैप करें।";

  const options = {
    body: body,
    icon: APP_LOGO,
    badge: APP_LOGO,
    vibrate: [300, 120, 300, 120, 400],
    tag: data.tag || ("GURUKUL_BG_" + Date.now()),
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || "./index.html"
    }
  };

  return self.registration.showNotification(title, options);
});

// ऐप खुला होने पर भी स्टेटस बार में वाइब्रेटिंग नोटिफिकेशन दिखाना
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NATIVE_NOTIFICATION") {
    const title = event.data.title || "GURUKUL ONLINE APP";
    const options = {
      body: event.data.body || "",
      icon: APP_LOGO,
      badge: APP_LOGO,
      vibrate: [300, 120, 300],
      tag: event.data.tag || ("GURUKUL_FG_" + Date.now()),
      renotify: true,
      data: {
        url: event.data.url || "./index.html"
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// नोटिफिकेशन पर टैप करने पर सीधा ऐप खोलना
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "./index.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
        
