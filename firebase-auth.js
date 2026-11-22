import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtlEEDA-oRjbAd-lREAG5bL3COrYWV37E",
  authDomain: "quizmate-49434.firebaseapp.com",
  projectId: "quizmate-49434",
  storageBucket: "quizmate-49434.firebasestorage.app",
  messagingSenderId: "895848275193",
  appId: "1:895848275193:web:63f5dda7b772bfd22a1628",
  measurementId: "G-CCNMF32T4C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

window.googleSignIn = async function () {
  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();

    const response = await fetch(
      `${window.QUIZMATE_API_URL}/google-login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ idToken })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Google login failed.");
    }

    if (typeof window.completeQuizMateLogin !== "function") {
      throw new Error("QuizMate login connection is not ready.");
    }

    await window.completeQuizMateLogin(data.user);

  } catch (error) {
    console.error("Google sign-in error:", error);

    const message =
      error.code === "auth/popup-closed-by-user"
        ? "Google sign-in was cancelled."
        : error.message || "Google sign-in failed.";

    if (typeof window.showQuizMateToast === "function") {
      window.showQuizMateToast(message);
    } else {
      alert(message);
    }
  }
};