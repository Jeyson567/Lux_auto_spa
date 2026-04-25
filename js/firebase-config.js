import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcK51QDlTKd91AjLeg5t3LiGULNtlgFWc",
  authDomain: "car-wash-edad9.firebaseapp.com",
  projectId: "car-wash-edad9",
  storageBucket: "car-wash-edad9.firebasestorage.app",
  messagingSenderId: "714767786271",
  appId: "1:714767786271:web:56c1e80d804b536798502a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
