// firebaseConfig.ts
// ────────────────────────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS:
//   1. Go to https://console.firebase.google.com
//   2. Select your project → Project Settings → General → Your apps → Web app
//   3. Copy the firebaseConfig object values into this file
//   4. Also update firebase-messaging-sw.js with the same values
// ────────────────────────────────────────────────────────────────────────────────

export const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyBzSKoSfx-G_KJXWMHF4QaGmVwSUazx53k",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "hemoscan-63fa0.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "hemoscan-63fa0",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "hemoscan-63fa0.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "763022396747",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:763022396747:web:e18d651bced8d38257ecce",
  // VAPID key from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
  vapidKey:          import.meta.env.VITE_FIREBASE_VAPID_KEY          || "YOUR_VAPID_KEY",
};

export const isFirebaseConfigured = (): boolean => {
  return !firebaseConfig.apiKey.startsWith("YOUR_");
};
