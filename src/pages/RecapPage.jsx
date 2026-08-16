import React, { useState, useEffect } from "react";
import { 
  Box, Typography, Card, Container, IconButton, 
  CssBaseline, Button, Divider, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Chip
} from "@mui/material";
import { 
  ArrowBack, InsertChartRounded, MonetizationOn,
  Receipt, WarningAmber, PointOfSale
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { db } from "../utils/firebase";
import { collection, onSnapshot, query, orderBy, getDocs, writeBatch, addDoc, serverTimestamp } from "firebase/firestore";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

export default function RecapPage() {
  const navigate = useNavigate();
  
  // States
  const [liveOrders, setLiveOrders] = useState([]);
  const [historyRecaps, setHistoryRecaps] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch Pesanan Sesi Berjalan (Live)
  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsub = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLiveOrders(orders);
    });
    return () => unsub();
  }, []);

  // Fetch Riwayat Rekap (History)
  useEffect(() => {
    const q = query(collection(db, "recaps"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const recaps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryRecaps(recaps);
    });
    return () => unsub();
  }, []);

  // Kalkulasi Pendapatan Berjalan (Hanya pesanan yang sudah 'selesai')
  const completedOrders = liveOrders.filter(order => order.statusPesanan === "selesai");
  const uncompletedOrders = liveOrders.filter(order => order.statusPesanan !== "selesai" && order.statusPesanan !== "batal");
  
  const currentTotalRevenue = completedOrders.reduce((sum, order) => sum + (order.totalTagihan || 0), 0);
  const currentTotalItems = completedOrders.reduce((sum, order) => sum + (order.items?.length || 0), 0);

  // Handle Akhiri Sesi
  const requestEndSession = () => {
    playTone("click");
    if (uncompletedOrders.length > 0) {
      alert("⚠️ DITOLAK: Masih ada pesanan yang belum diselesaikan atau dibatalkan. Bersihkan antrean terlebih dahulu!");
      return;
    }
    if (completedOrders.length === 0) {
      alert("⚠️ Kedai belum memproses pesanan apapun yang selesai di sesi ini.");
      return;
    }
    setIsConfirmOpen(true);
  };

  const executeEndSession = async () => {
    setIsProcessing(true);
    try {
      // 1. Catat Waktu Saat Ini
      const now = new Date();
      const dateString = now.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
      const timeString = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
      const sessionName = `${dateString}, ${timeString} WIB`;

      // 2. Simpan 1 Dokumen ke koleksi 'recaps'
      await addDoc(collection(db, "recaps"), {
        tanggalSesi: sessionName,
        totalRevenue: currentTotalRevenue,
        totalItems: currentTotalItems,
        totalOrders: completedOrders.length,
        createdAt: serverTimestamp()
      });

      // 3. Hapus SEMUA dokumen di koleksi 'orders' (Sapu Bersih)
      const snapshot = await getDocs(collection(db, "orders"));
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      playTone("success");
      setIsConfirmOpen(false);
    } catch (error) {
      console.error("Gagal mengakhiri sesi:", error);
      alert("Gagal menyimpan rekap. Periksa koneksi internet.");
    } finally {
      setIsProcessing(false);
    }
  };

  const navigateTo = (path) => {
    playTone("click");
    navigate(path);
  };

  // Framer Motion Variants
  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300 } } };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4 }}>
      <CssBaseline />
      
      {/* DIALOG KONFIRMASI AKHIRI SESI */}
      <Dialog open={isConfirmOpen} onClose={() => !isProcessing && setIsConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: "900", textAlign: "center", color: "error.main", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <WarningAmber sx={{ fontSize: 60 }} />
          TUTUP BUKU SESI INI?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: "center", fontWeight: "bold", mb: 2 }}>
            Tindakan ini akan mencatat total pendapatan sebesar <span style={{ color: COLORS.primary }}>Rp {currentTotalRevenue.toLocaleString()}</span> ke Riwayat Rekap.
          </DialogContentText>
          <Box sx={{ bgcolor: "#ffebee", p: 2, borderRadius: 2 }}>
            <Typography variant="body2" color="error.main" fontWeight="bold" textAlign="center">
              ⚠️ Seluruh data antrean dan pesanan saat ini akan dihapus secara permanen untuk mengosongkan memori. Pastikan kedai memang sudah tutup.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, mb: 1, pb: 2 }}>
          <Button disabled={isProcessing} onClick={() => setIsConfirmOpen(false)} color="inherit" variant="outlined" sx={{ borderRadius: 3, px: 3, fontWeight: "bold" }}>Batal</Button>
          <Button disabled={isProcessing} onClick={executeEndSession} variant="contained" color="error" sx={{ borderRadius: 3, px: 3, fontWeight: "bold" }}>
            {isProcessing ? "Menyimpan..." : "Ya, Akhiri Sesi"}
          </Button>
        </DialogActions>
      </Dialog>

      <Container maxWidth="sm">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <IconButton onClick={() => navigateTo("/dashboard")} sx={{ bgcolor: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" fontWeight="900" color={COLORS.textDark}>
                Rekap Penjualan
              </Typography>
            </Box>
          </motion.div>

          {/* KARTU SESI BERJALAN (LIVE) */}
          <motion.div variants={itemVariants}>
            <Card elevation={0} sx={{ borderRadius: 4, bgcolor: COLORS.primary, color: "white", mb: 4, p: 3, position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(211, 47, 47, 0.2)" }}>
              <PointOfSale sx={{ position: "absolute", right: -20, bottom: -20, fontSize: 150, opacity: 0.1 }} />
              
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Chip label="SESI SAAT INI" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", fontWeight: "bold" }} />
                <Typography variant="caption" fontWeight="bold">Belum Ditutup</Typography>
              </Box>

              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: "bold" }}>Total Pendapatan Sesi Ini</Typography>
              <Typography variant="h3" fontWeight="900" sx={{ mb: 3, letterSpacing: -1 }}>
                Rp {currentTotalRevenue.toLocaleString()}
              </Typography>

              <Box display="flex" gap={3} mb={4}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Item Terjual</Typography>
                  <Typography variant="h6" fontWeight="bold">{currentTotalItems} Porsi</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Total Transaksi</Typography>
                  <Typography variant="h6" fontWeight="bold">{completedOrders.length} Nota</Typography>
                </Box>
              </Box>

              <Button 
                fullWidth 
                variant="contained" 
                onClick={requestEndSession}
                sx={{ bgcolor: "white", color: COLORS.primary, fontWeight: "900", height: "55px", borderRadius: 3, fontSize: "1rem", '&:hover': { bgcolor: "#f5f5f5" } }}
              >
                AKHIRI SESI & SIMPAN REKAP
              </Button>
            </Card>
          </motion.div>

          {/* RIWAYAT REKAP */}
          <motion.div variants={itemVariants}>
            <Typography variant="h6" fontWeight="900" color={COLORS.textDark} mb={2} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <InsertChartRounded color="info" /> Riwayat Penjualan
            </Typography>

            {historyRecaps.length === 0 ? (
              <Box p={4} textAlign="center" bgcolor="white" borderRadius={4} border="1px dashed #ccc">
                <Receipt sx={{ fontSize: 50, color: "#ccc", mb: 1 }} />
                <Typography variant="body1" color="text.secondary" fontWeight="bold">
                  Belum ada riwayat rekap tersimpan.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <AnimatePresence>
                  {historyRecaps.map((recap) => (
                    <motion.div key={recap.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                      <Card elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "white" }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mb={0.5}>
                            {recap.tanggalSesi}
                          </Typography>
                          <Typography variant="h6" fontWeight="900" color={COLORS.textDark}>
                            Rp {recap.totalRevenue?.toLocaleString()}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.5}>
                            <Typography variant="body2" color="text.secondary" fontWeight="bold">
                              {recap.totalItems} Porsi
                            </Typography>
                            <Typography variant="body2" color="text.secondary">•</Typography>
                            <Typography variant="body2" color="text.secondary" fontWeight="bold">
                              {recap.totalOrders} Transaksi
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ p: 1.5, bgcolor: "#e8f5e9", borderRadius: 3, color: "success.main" }}>
                          <MonetizationOn sx={{ fontSize: 30 }} />
                        </Box>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>
            )}
          </motion.div>

        </motion.div>
      </Container>
    </Box>
  );
}