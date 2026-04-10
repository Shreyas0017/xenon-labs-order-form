import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore/lite";
import {
  GoogleAuthProvider,
  getAuth,
  signOut,
  signInWithPopup,
  type User,
} from "firebase/auth";

const requiredEnv = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const firebaseConfig = {
  apiKey: requiredEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requiredEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requiredEnv("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const ADMIN_EMAIL = requiredEnv("VITE_ADMIN_EMAIL").toLowerCase();

const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export function getSignedInUser(): User {
  if (!auth.currentUser) {
    throw new Error("Not signed in. Please sign in with Google first.");
  }
  return auth.currentUser;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email || !ADMIN_EMAIL) return false;
  return email.toLowerCase() === ADMIN_EMAIL;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

if (typeof window !== "undefined") {
  void isSupported().then((supported) => {
    if (supported) {
      getAnalytics(app);
    }
  });
}
