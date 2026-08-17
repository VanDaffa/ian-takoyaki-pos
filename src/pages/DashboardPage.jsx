import React, { useState, useEffect } from "react";
import { 
  Box, Typography, Card, CardActionArea, Container, IconButton, 
  CssBaseline, Switch, Divider, Avatar 
} from "@mui/material";
import { 
  PointOfSale, InsertChartRounded, Storefront, 
  Logout, AccessTime, WavingHand, Calculate 
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Firebase & Utils
import { auth, db } from "../utils/firebase";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Jam Real-time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync Status Kedai dari Firebase
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "shop"), (docSnap) => {
      if (docSnap.exists()) {
        setIsShopOpen(docSnap.data().isOpen);
      }
    });
    return () => unsub();
  }, []);

  // SISTEM HEARTBEAT (DETAK JANTUNG KEDAI)
  useEffect(() => {
    let interval = null;
    if (isShopOpen) {
      interval = setInterval(async () => {
        try {
          await setDoc(doc(db, "settings", "shop"), { lastActive: serverTimestamp() }, { merge: true });
        } catch (error) {
          console.error("Gagal mengirim heartbeat:", error);
        }
      }, 60000);
    }
    return () => clearInterval(interval);
  }, [isShopOpen]);

  const handleToggleShop = async () => {
    playTone("click");
    const newStatus = !isShopOpen;
    await setDoc(doc(db, "settings", "shop"), { 
      isOpen: newStatus, 
      lastActive: newStatus ? serverTimestamp() : null 
    }, { merge: true });
  };

  const handleLogout = () => {
    playTone("delete");
    signOut(auth);
  };

  const navigateTo = (path) => {
    playTone("click");
    navigate(path);
  };

  // Konfigurasi Animasi Framer Motion
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: "spring", stiffness: 300, damping: 24 } 
    }
  };

  const timeString = currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateString = currentTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLORS.background,
        display: "flex",
        alignItems: { xs: "flex-start", sm: "center" },
        py: { xs: 2.5, sm: 4 },
        boxSizing: "border-box",
        // Layar pendek (HP landscape) -> mepet ke atas & padding dipangkas agar konten tetap terjangkau tanpa scroll berlebih
        "@media (orientation: landscape) and (max-height: 500px)": {
          alignItems: "flex-start",
          py: 1.5,
        },
      }}
    >
      <CssBaseline />
      <Container maxWidth="md">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HEADER SECTION */}
          <motion.div variants={itemVariants}>
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} mb={{ xs: 2.5, sm: 4 }}>
              <Box display="flex" alignItems="center" gap={{ xs: 1.25, sm: 2 }} sx={{ minWidth: 0 }}>
                <Avatar sx={{ bgcolor: COLORS.primary, width: { xs: 44, sm: 56 }, height: { xs: 44, sm: 56 }, boxShadow: "0 4px 15px rgba(211, 47, 47, 0.3)", flexShrink: 0 }}>
                  <Storefront sx={{ fontSize: { xs: 22, sm: 30 } }} />
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: { xs: "0.75rem", sm: "0.875rem" } }}>
                    <WavingHand fontSize="small" sx={{ color: "#fbc02d" }} /> Konnichiwa,
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight="900"
                    color={COLORS.textDark}
                    noWrap
                    sx={{ letterSpacing: -0.5, fontSize: { xs: "1.05rem", sm: "1.5rem" } }}
                  >
                    Admin IAN
                  </Typography>
                </Box>
              </Box>
              <motion.div whileTap={{ scale: 0.85 }}>
                <IconButton onClick={handleLogout} sx={{ bgcolor: "#ffebee", color: "error.main", borderRadius: 3, p: { xs: 1, sm: 1.5 }, flexShrink: 0 }}>
                  <Logout sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </IconButton>
              </motion.div>
            </Box>
          </motion.div>

          {/* JAM & STATUS KEDAI */}
          <motion.div variants={itemVariants}>
            <Card elevation={0} sx={{ borderRadius: 4, mb: { xs: 2.5, sm: 3 }, border: "1px solid #eee", overflow: "hidden" }}>
              <Box display="flex" flexDirection="column">
                <Box p={{ xs: 2, sm: 2.5 }} bgcolor="white" display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h4" fontWeight="900" color={COLORS.primary} noWrap sx={{ letterSpacing: 1, fontSize: { xs: "1.6rem", sm: "2.125rem" } }}>
                      {timeString}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold" noWrap sx={{ fontSize: { xs: "0.7rem", sm: "0.875rem" } }}>
                      {dateString}
                    </Typography>
                  </Box>
                  <AccessTime sx={{ fontSize: { xs: 30, sm: 40 }, color: COLORS.secondary, opacity: 0.2, flexShrink: 0 }} />
                </Box>
                
                <Divider />

                <Box p={{ xs: 1.5, sm: 2 }} bgcolor={isShopOpen ? "#e8f5e9" : "#ffebee"} display="flex" justifyContent="space-between" alignItems="center" gap={1} sx={{ transition: "all 0.3s ease" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight="900" color={isShopOpen ? "success.main" : "error.main"} sx={{ fontSize: { xs: "0.9rem", sm: "1rem" } }}>
                      Status Kedai
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: "block", fontSize: { xs: "0.68rem", sm: "0.75rem" } }}>
                      {isShopOpen ? "Menerima pesanan online & offline" : "Kedai sedang ditutup saat ini"}
                    </Typography>
                  </Box>
                  <Switch 
                    checked={isShopOpen} 
                    onChange={handleToggleShop} 
                    color={isShopOpen ? "success" : "error"}
                    sx={{ transform: "scale(1.2)", flexShrink: 0 }} 
                  />
                </Box>
              </Box>
            </Card>
          </motion.div>

          {/* MAIN MENU (BENTO GRID BUTTONS - RESPONSIF: 1 KOLOM DI HP PORTRAIT, 2 KOLOM DI LAYAR SEDANG/LANDSCAPE, 3 KOLOM DI TABLET/DESKTOP) */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
              gap: { xs: 2, sm: 2.5 },
              // Layar sangat pendek (HP landscape) -> paksa 3 kolom sekaligus supaya tidak perlu scroll panjang
              "@media (orientation: landscape) and (max-height: 500px)": {
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 1.5,
              },
            }}
          >
            
            {/* 1. HALAMAN KASIR */}
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} style={{ height: "100%" }}>
              <Card elevation={0} sx={{ borderRadius: 4, bgcolor: COLORS.primary, color: "white", height: "100%", border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(211, 47, 47, 0.2)" }}>
                <CardActionArea onClick={() => navigateTo("/cashier")} sx={{ p: { xs: 2.25, sm: 3 }, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", minHeight: { xs: 128, sm: 160 } }}>
                  <Box sx={{ p: { xs: 1.15, sm: 1.5 }, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 3, mb: { xs: 1.25, sm: 2 } }}>
                    <PointOfSale sx={{ fontSize: { xs: 28, sm: 36 } }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" fontWeight="900" lineHeight={1.2} mb={0.5} sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                      Halaman<br/>Kasir
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.8, fontSize: { xs: "0.68rem", sm: "0.75rem" } }}>
                      Input & Kelola Antrean
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </motion.div>

            {/* 2. REKAP PENJUALAN */}
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} style={{ height: "100%" }}>
              <Card elevation={0} sx={{ borderRadius: 4, bgcolor: COLORS.info, color: "white", height: "100%", border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(2, 136, 209, 0.2)" }}>
                <CardActionArea onClick={() => navigateTo("/recap")} sx={{ p: { xs: 2.25, sm: 3 }, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", minHeight: { xs: 128, sm: 160 } }}>
                  <Box sx={{ p: { xs: 1.15, sm: 1.5 }, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 3, mb: { xs: 1.25, sm: 2 } }}>
                    <InsertChartRounded sx={{ fontSize: { xs: 28, sm: 36 } }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" fontWeight="900" lineHeight={1.2} mb={0.5} sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                      Rekap<br/>Penjualan
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.8, fontSize: { xs: "0.68rem", sm: "0.75rem" } }}>
                      Laporan & Statistik
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </motion.div>

            {/* 3. HITUNG CEPAT */}
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} style={{ height: "100%" }}>
              <Card elevation={0} sx={{ borderRadius: 4, bgcolor: "#ffb300", color: "white", height: "100%", border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(255, 179, 0, 0.2)" }}>
                <CardActionArea onClick={() => navigateTo("/calculator")} sx={{ p: { xs: 2.25, sm: 3 }, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", minHeight: { xs: 128, sm: 160 } }}>
                  <Box sx={{ p: { xs: 1.15, sm: 1.5 }, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 3, mb: { xs: 1.25, sm: 2 } }}>
                    <Calculate sx={{ fontSize: { xs: 28, sm: 36 } }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h6" fontWeight="900" lineHeight={1.2} mb={0.5} sx={{ fontSize: { xs: "1rem", sm: "1.25rem" } }}>
                      Hitung<br/>Cepat
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.8, fontSize: { xs: "0.68rem", sm: "0.75rem" } }}>
                      Counter Manual
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </motion.div>

          </Box>

        </motion.div>
      </Container>
    </Box>
  );
}