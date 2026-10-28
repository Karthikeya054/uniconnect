/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

/*
 * A service worker is a static file: it cannot read environment variables at
 * runtime, so this config has to be filled in before deploying.
 *
 * Replace the placeholders below with your own Firebase web config — the same
 * values you put in PUBLIC_FIREBASE_* in .env (see README → Push notifications).
 * Leaving them as-is only disables background push; the rest of the app is
 * unaffected.
 */
firebase.initializeApp({
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Force immediate takeover
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const title = payload.notification?.title || payload.data?.title || 'UniConnect Alert';
    const body = payload.notification?.body || payload.data?.body || '';
    const taskId = payload.data?.taskId;
    const type = payload.data?.type;
    const action = payload.data?.action;
    const sourceId = payload.data?.sourceId || taskId || `notif-${Date.now()}`;

    const notificationOptions = {
        body: body,
        icon: '/nxtwave-logo.png',
        badge: '/nxtwave-logo.png',
        tag: sourceId,
        renotify: true,
        vibrate: [200, 100, 200],
        requireInteraction: !!taskId && (body.includes('DUE') || body.includes('OVERDUE')),
        data: {
            taskId,
            type,
            action,
            url: taskId ? `/communication-tasks/${taskId}` : (action === 'OPEN_REQUESTS' ? '/users' : null)
        }
    };

    return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const data = event.notification.data;
    let targetUrl = data?.url || '/';
    // Ensure absolute path
    if (targetUrl.startsWith('/')) {
        targetUrl = self.location.origin + targetUrl;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 1. Try to find existing tab
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            // 2. Try to find ANY app tab and navigate it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'navigate' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // 3. Open new window
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
