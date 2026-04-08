import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRVeYV_F1JfDJPXwIzbU_oYoILzRC_itk",
  authDomain: "rivezm3aya.firebaseapp.com",
  projectId: "rivezm3aya",
  storageBucket: "rivezm3aya.firebasestorage.app",
  messagingSenderId: "286754093215",
  appId: "1:286754093215:web:a6280c9238af387bdd0aaa",
  measurementId: "G-P4F2YSKSDH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
