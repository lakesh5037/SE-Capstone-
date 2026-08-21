// useFCM.ts — React hook that initializes Firebase Messaging for the web portal
// ─────────────────────────────────────────────────────────────────────────────
// Usage: Call useFCM(email) inside App.tsx after the user is logged in.
// Returns: { token, permissionStatus, isSupported }

import { useEffect, useState } from 'react';
import { firebaseConfig, isFirebaseConfigured } from '../firebaseConfig';
import { apiService } from '../services/api';

// Lazy-initialize Firebase to avoid loading it for unauthenticated users
let firebaseApp: any = null;
let messagingInstance: any = null;

const initFirebase = async () => {
  if (!isFirebaseConfigured()) {
    console.warn('[HemoScan FCM] Firebase not configured — skipping initialization.');
    return null;
  }

  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApps()[0];
    }

    messagingInstance = getMessaging(firebaseApp);
    return { messaging: messagingInstance, getToken, onMessage };
  } catch (error) {
    console.warn('[HemoScan FCM] Firebase init failed:', error);
    return null;
  }
};

interface FCMState {
  token: string | null;
  permissionStatus: NotificationPermission | 'unsupported';
  isSupported: boolean;
}

export const useFCM = (email: string | null): FCMState => {
  const [state, setState] = useState<FCMState>({
    token: null,
    permissionStatus: 'default',
    isSupported: false,
  });

  useEffect(() => {
    if (!email) return;

    // Check browser support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState(s => ({ ...s, permissionStatus: 'unsupported', isSupported: false }));
      return;
    }

    setState(s => ({ ...s, isSupported: true }));

    const setupFCM = async () => {
      const firebase = await initFirebase();
      if (!firebase) return;

      const { messaging, getToken, onMessage } = firebase;

      // Request notification permission
      let permission: NotificationPermission;
      try {
        permission = await Notification.requestPermission();
      } catch {
        permission = 'denied';
      }

      setState(s => ({ ...s, permissionStatus: permission }));

      if (permission !== 'granted') {
        console.log('[HemoScan FCM] Notification permission denied.');
        return;
      }

      try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: firebaseConfig.vapidKey,
          serviceWorkerRegistration: registration,
        });

        if (token) {
          setState(s => ({ ...s, token }));
          localStorage.setItem('fcm_token_web', token);

          // Save token to backend
          await apiService.saveFcmToken(email, token);
          console.log('[HemoScan FCM] Token registered successfully.');
        }

        // Handle foreground messages
        onMessage(messaging, (payload: any) => {
          console.log('[HemoScan FCM] Foreground message:', payload);

          // Show a browser notification manually (since foreground doesn't auto-show)
          if (Notification.permission === 'granted' && payload.notification) {
            new Notification(payload.notification.title || 'HemoScan', {
              body: payload.notification.body,
              icon: '/favicon.ico',
            });
          }
        });

      } catch (error) {
        console.warn('[HemoScan FCM] Token registration failed:', error);
      }
    };

    setupFCM();
  }, [email]);

  return state;
};
