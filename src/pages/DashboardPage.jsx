import React, { useState, useEffect } from "react";
import { 
  Box, Typography, Card, CardActionArea, Container, IconButton, 
  CssBaseline, Switch, Divider, Avatar 
} from "@mui/material";
import { 
  PointOfSale, InsertChartRounded, Storefront, 
  Logout, AccessTime, WavingHand, Calculate 
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Firebase & Utils
import { auth, db } from "../utils/firebase";
import { signOut } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
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

  // Heartbeat untuk menandai kedai masih aktif
  useEffect(() => {
    let interval = null;
    if (isShopOpen) {
      interval = setInterval(async () => {
        try {
          await setDoc(doc(db, "settings", "shop"), { lastActive: serverTimestamp() }, { merge: true });
        } catch (error) {
          console.error("Gagal mengirim heartbeat:", error);
        }
      }, 60000); // Setiap 60 detik (1 menit)
    }
    return () => clearInterval(interval);
  }, [isShopOpen]);

  const handleToggleShop = async () => {
    playTone("click");
    // Saat dinyalakan, langsung catat lastActive terbaru
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

  // Konfigurasi Animasi Framer Motion (Bouncy iOS Style)
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

  // Format Waktu & Tanggal
  const timeString = currentTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateString = currentTime.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, display: "flex", alignItems: "center", py: 4 }}>
      <CssBaseline />
      <Container maxWidth="sm">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HEADER SECTION */}
          <motion.div variants={itemVariants}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: COLORS.primary, width: 56, height: 56, boxShadow: "0 4px 15px rgba(211, 47, 47, 0.3)" }}>
                  <Storefront fontSize="large" />
                </Avatar>
                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <WavingHand fontSize="small" sx={{ color: "#fbc02d" }} /> Konnichiwa,
                  </Typography>
                  <Typography variant="h5" fontWeight="900" color={COLORS.textDark} sx={{ letterSpacing: -0.5 }}>
                    Admin IAN
                  </Typography>
                </Box>
              </Box>
              <motion.div whileTap={{ scale: 0.85 }}>
                <IconButton onClick={handleLogout} sx={{ bgcolor: "#ffebee", color: "error.main", borderRadius: 3, p: 1.5 }}>
                  <Logout />
                </IconButton>
              </motion.div>
            </Box>
          </motion.div>

          {/* JAM & STATUS KEDAI (BENTO WIDE CARD) */}
          <motion.div variants={itemVariants}>
            <Card elevation={0} sx={{ borderRadius: 4, mb: 2.5, border: "1px solid #eee", overflow: "hidden" }}>
              <Box display="flex" flexDirection="column">
                
                {/* Waktu Aktif */}
                <Box p={2.5} bgcolor="white" display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h4" fontWeight="900" color={COLORS.primary} sx={{ letterSpacing: 1 }}>
                      {timeString}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      {dateString}
                    </Typography>
                  </Box>
                  <AccessTime sx={{ fontSize: 40, color: COLORS.secondary, opacity: 0.2 }} />
                </Box>
                
                <Divider />

                {/* Toggle Status Kedai */}
                <Box p={2} bgcolor={isShopOpen ? "#e8f5e9" : "#ffebee"} display="flex" justifyContent="space-between" alignItems="center" sx={{ transition: "all 0.3s ease" }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="900" color={isShopOpen ? "success.main" : "error.main"}>
                      Status Kedai
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                      {isShopOpen ? "Menerima pesanan online & offline" : "Kedai sedang ditutup saat ini"}
                    </Typography>
                  </Box>
                  <Switch 
                    checked={isShopOpen} 
                    onChange={handleToggleShop} 
                    color={isShopOpen ? "success" : "error"}
                    sx={{ transform: "scale(1.2)" }} 
                  />
                </Box>
              </Box>
            </Card>
          </motion.div>

          {/* MAIN MENU (BENTO GRID BUTTONS) */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2.5 }}>
            
            {/* TOMBOL HALAMAN KASIR */}
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}>
              <Card elevation={0} sx={{ borderRadius: 4, bgcolor: COLORS.primary, color: "white", height: "100%", border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(211, 47, 47, 0.2)" }}>
                <CardActionArea onClick={() => navigateTo("/cashier")} sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", minHeight: "160px" }}>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 3, mb: 2 }}>
                    <PointOfSale sx={{ fontSize: 40 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="900" lineHeight={1.2} mb={0.5}>
                      Halaman<br/>Kasir
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.8 }}>
                      Input & Kelola Antrean
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </motion.div>

            {/* TOMBOL HALAMAN REKAP */}
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}>
              <Card elevation={0} sx={{ borderRadius: 4, bgcolor: COLORS.info, color: "white", height: "100%", border: "2px solid rgba(255,255,255,0.1)", boxShadow: "0 10px 30px rgba(2, 136, 209, 0.2)" }}>
                <CardActionArea onClick={() => navigateTo("/recap")} sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", minHeight: "160px" }}>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 3, mb: 2 }}>
                    <InsertChartRounded sx={{ fontSize: 40 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="900" lineHeight={1.2} mb={0.5}>
                      Rekap<br/>Penjualan
                    </Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.8 }}>
                      Laporan & Statistik
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </motion.div>

            {/* TOMBOL HITUNG MANUAL (KALKULATOR) */}
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}>
              <Card elevation={0} sx={{ borderRadius: 4, bgcolor: "#ffb300", color: "white", height: "100%", boxShadow: "0 10px 30px rgba(255, 179, 0, 0.2)" }}>
                <CardActionArea onClick={() => navigateTo("/calculator")} sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", minHeight: "150px" }}>
                  <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.2)", borderRadius: 3, mb: 2 }}>
                    <Calculate fontSize="large" />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="900" lineHeight={1.2} mb={0.5}>Hitung Cepat</Typography>
                    <Typography variant="caption" fontWeight="bold" sx={{ opacity: 0.8 }}>Counter Manual</Typography>
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