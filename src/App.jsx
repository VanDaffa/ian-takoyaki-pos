import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./utils/firebase";

// Import Semua Halaman
import CustomerPage from "./pages/CustomerPage";
import CashierPage from "./pages/CashierPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import RecapPage from "./pages/RecapPage";
import CalculatorPage from "./pages/CalculatorPage";

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