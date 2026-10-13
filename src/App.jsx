import React, { Suspense, lazy, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Box, Typography, CssBaseline } from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { LazyMotion, domAnimation } from "framer-motion";
import { auth, db } from "./utils/firebase"; 
import { COLORS } from "./utils/constants";

// 1. LAZY IMPORT (Code Splitting)
const CustomerPage = lazy(() => import("./pages/CustomerPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CashierPage = lazy(() => import("./pages/CashierPage"));
const RecapPage = lazy(() => import("./pages/RecapPage"));
const CalculatorPage = lazy(() => import("./pages/CalculatorPage"));

// 2. KOMPONEN LOADING SEDERHANA
const LoadingScreen = () => (
  <Box
    component="main"
    role="status"
    aria-live="polite"
    sx={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      minHeight: "100vh",
      justifyContent: "center",
      alignItems: "center",
      bgcolor: COLORS.background,
      px: 3,
    }}
  >
    <style>{`
      @keyframes takoyakiBounce {
        0%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-5px); }
      }

      @media (prefers-reduced-motion: reduce) {
        .loading-takoyaki { animation: none !important; }
      }
    `}</style>

    {/* Animasi takoyaki sederhana */}
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 2.5 }}>
      <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1, height: 32 }}>
        {[0, 0.15, 0.3].map((delay) => (
          <Box
            key={delay}
            className="loading-takoyaki"
            sx={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "radial-gradient(circle at 30% 25%, #FFE7B6, #FFC66F 45%, #E88D38)",
              boxShadow: "0 2px 5px rgba(107,65,27,0.12)",
              animation: "takoyakiBounce 1s ease-in-out infinite",
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </Box>

      {/* Piring takoyaki */}
      <Box
        sx={{
          width: 86,
          height: 7,
          borderRadius: "50%",
          bgcolor: "#FFF1D8",
          border: "1px solid rgba(200,126,48,0.25)",
        }}
      />
    </Box>

    <Typography
      variant="h6"
      sx={{ fontWeight: 800, textAlign: "center" }}
    >
      Sebentar, ya!
    </Typography>

    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ mt: 0.5, textAlign: "center" }}
    >
      Kami sedang menyiapkan halaman untukmu.
    </Typography>
  </Box>
);

// 3. KOMPONEN GLOBAL HEARTBEAT (Berjalan di latar belakang)
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
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Pengecekan status login Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  if (isAuthChecking) {
    return <LoadingScreen />;
  }

  return (
    <BrowserRouter>
      <CssBaseline />
      
      {/* 4. JALANKAN HEARTBEAT HANYA JIKA KASIR SUDAH LOGIN */}
      {user && <ShopHeartbeat />}
      
      {/* 
        OPTIMASI 3: LAZYMOTION 
        Mengurangi beban RAM HP dengan menunda muatan mesin animasi berat 
        sampai halaman benar-benar siap.
      */}
      <LazyMotion features={domAnimation}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            
            {/* HALAMAN PUBLIK (Aman dari Heartbeat, hanya baca) */}
            <Route path="/" element={<CustomerPage />} />
            
            <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

            {/* HALAMAN PRIVAT (Semuanya dilindungi oleh Heartbeat) */}
            <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/login" replace />} />
            <Route path="/cashier" element={user ? <CashierPage /> : <Navigate to="/login" replace />} />
            <Route path="/recap" element={user ? <RecapPage /> : <Navigate to="/login" replace />} />
            <Route path="/calculator" element={user ? <CalculatorPage /> : <Navigate to="/login" replace />} />
            
          </Routes>
        </Suspense>
      </LazyMotion>
    </BrowserRouter>
  );
}