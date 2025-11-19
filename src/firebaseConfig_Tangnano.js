// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

// Tang Nano Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzXzocbdytn4N8vLrT-V2JYZ8pgqWrbC0",
  authDomain: "self-balancing-7a9fe.firebaseapp.com",
  databaseURL: "https://self-balancing-7a9fe-default-rtdb.firebaseio.com",
  projectId: "self-balancing-7a9fe",
  storageBucket: "self-balancing-7a9fe.firebasestorage.app",
  messagingSenderId: "1044959372723",
  appId: "1:1044959372723:web:7e1f73307107cf91ba97c6",
  measurementId: "G-357J7ZXYED"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig, "tangnano");
const analytics = getAnalytics(app);
const database = getDatabase(app);

export { database, analytics };
export default app;
