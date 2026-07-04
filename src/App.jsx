import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CustomerPage from "./pages/CustomerPage";
import CashierPage from "./pages/CashierPage";
import LoginPage from "./pages/LoginPage";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./utils/firebase";

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

        {/* Halaman Kasir (Diproteksi Ketat) */}
        <Route 
          path="/" 
          element={user ? <CashierPage /> : <Navigate to="/login" replace />} 
        />

        {/* Halaman Login */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/" replace /> : <LoginPage />} 
        />

        {/* Catch All Route, alihkan ke halaman menu */}
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </BrowserRouter>
  );
}