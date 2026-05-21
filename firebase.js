import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyClHDzTGncpd_5-Gnc4zmL3JVrXX1tiGKQ",
  authDomain: "admin-hu-874c2.firebaseapp.com",
  projectId: "admin-hu-874c2",
  storageBucket: "admin-hu-874c2.firebasestorage.app",
  messagingSenderId: "419870283564",
  appId: "1:419870283564:web:18054f24b31b52eb7b7e89"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
