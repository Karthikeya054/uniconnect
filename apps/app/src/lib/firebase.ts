import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";

/**
 * Firebase web config.
 *
 * These values are public by design — they ship to the browser — but they are
 * read from PUBLIC_FIREBASE_* environment variables so a fork points at its own
 * Firebase project instead of inheriting someone else's. See .env.example.
 *
 * Push notifications are optional: with the variables absent the app runs
 * normally and getFcmToken() simply returns null.
 */
const firebaseConfig = {
    apiKey: env.PUBLIC_FIREBASE_API_KEY,
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: env.PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.PUBLIC_FIREBASE_APP_ID,
    measurementId: env.PUBLIC_FIREBASE_MEASUREMENT_ID
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

const app = isConfigured
    ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
    : null;

export const getFcmToken = async () => {
    if (!browser || !app) return null;
    const vapidKey = env.PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;
    try {
        const messaging = getMessaging(app);
        return await getToken(messaging, { vapidKey });
    } catch (error) {
        console.error("Error getting FCM token:", error);
        return null;
    }
};

export const onForegroundMessage = (callback: (payload: any) => void) => {
    if (!browser || !app) return;
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
};

export { app };
