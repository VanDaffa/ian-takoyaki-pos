import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPz9oez60xCDjaxKlzH1POVDrK2uk2lOE",
  authDomain: "ian-takoyaki-pos.firebaseapp.com",
  projectId: "ian-takoyaki-pos",
  storageBucket: "ian-takoyaki-pos.firebasestorage.app",
  messagingSenderId: "893398320918",
  appId: "1:893398320918:web:d0f11394d538d9fac8f237"
};


// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore Database
export const auth = getAuth(app);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});