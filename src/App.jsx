import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./utils/firebase";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

// Import Semua Halaman
import CustomerPage from "./pages/CustomerPage";
import CashierPage from "./pages/CashierPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RecapPage from "./pages/RecapPage";
import CalculatorPage from "./pages/CalculatorPage";

// Mengirim sinyal "kasir masih aktif" (lastActive) tiap menit selama kasir login
// dan kedai berstatus buka. Berjalan di SEMUA halaman kasir (dashboard, kasir, rekap, kalkulator),
// jadi sinyal tidak putus saat kasir berpindah halaman.
function ShopHeartbeat() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "shop"), (snap) => {
      setIsOpen(snap.exists() && snap.data().isOpen === true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const kirim = () =>
      setDoc(doc(db, "settings", "shop"), { lastActive: serverTimestamp() }, { merge: true })
        .catch((err) => console.error("Gagal mengirim heartbeat:", err));
    kirim();
    const id = setInterval(kirim, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") kirim(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isOpen]);

  return null;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return null; // Transisi loading bersih

  return (
    <BrowserRouter>
      {user && <ShopHeartbeat />}
      <Routes>
        {/* Halaman Pelanggan (Terbuka Publik) */}
        <Route path="/menu" element={<CustomerPage />} />

        {/* Akses Root (/) */}
        {/* Dialihkan ke dashboard agar kasir yang biasa buka '/' langsung masuk ke menu utama */}
        <Route 
          path="/" 
          element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} 
        />

        {/* Halaman Login */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} 
        />

        {/* Halaman Dashboard (Pusat Kendali - Diproteksi) */}
        <Route 
          path="/dashboard" 
          element={user ? <DashboardPage /> : <Navigate to="/login" replace />} 
        />

        {/* Halaman Kasir (Diproteksi) */}
        <Route 
          path="/cashier" 
          element={user ? <CashierPage /> : <Navigate to="/login" replace />} 
        />

        {/* Halaman Rekap (Diproteksi) */}
        <Route 
          path="/recap" 
          element={user ? <RecapPage /> : <Navigate to="/login" replace />} 
        />

        <Route 
          path="/calculator" 
          element={user ? <CalculatorPage /> : <Navigate to="/login" replace />} 
        />

        {/* Catch All Route, alihkan ke halaman menu pelanggan jika URL ngawur */}
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </BrowserRouter>
  );
}