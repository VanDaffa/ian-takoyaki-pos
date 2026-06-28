import React, { useState, useRef, useEffect } from "react";
import {
  Box, Grid, Typography, Card, Button, IconButton, Chip, Divider, Paper,
  Checkbox, CssBaseline, Container, TextField,
  List, Snackbar, Alert, Switch, FormControlLabel
} from "@mui/material";
import { Add, Remove, Restaurant, Delete, RestartAlt, Send, Person, Storefront, LocalDrink, HourglassEmpty, CheckCircleOutline, CancelPresentation } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { COLORS, VARIAN_ISIAN, SAUS_LIST } from "../utils/constants";
import { generateSmartName, getSauceColor } from "../utils/helpers";
import { playTone } from "../utils/soundEngine";

import { db } from "../utils/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, orderBy } from "firebase/firestore";

export default function CustomerPage() {
  const [isian, setIsian] = useState({});
  const [sauses, setSauses] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [sausesPisah, setSausesPisah] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [pakeKatsuobushi, setPakeKatsuobushi] = useState(false);
  const [qtyAir, setQtyAir] = useState(0);
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [cart, setCart] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const bottomRef = useRef(null);

  const [activeOrderId, setActiveOrderId] = useState(localStorage.getItem("ian_takoyaki_active_order_id") || null);
  const [activeOrderData, setActiveOrderData] = useState(null);
  const [antreanDiDepan, setAntreanDiDepan] = useState(0);
  const [editingCartId, setEditingCartId] = useState(null);

  const totalPilihan = Object.values(isian).filter((val) => val > 0).length;

  useEffect(() => {
    if (!activeOrderId) {
      setActiveOrderData(null);
      return;
    }
    const unsubDoc = onSnapshot(doc(db, "orders", activeOrderId), (docSnap) => {
      if (!docSnap.exists()) {
        // Fallback jika data terhapus manual tanpa status di Firestore
        localStorage.removeItem("ian_takoyaki_active_order_id");
        setActiveOrderId(null);
        setActiveOrderData(null);
      } else {
        setActiveOrderData(docSnap.data());
      }
    });
    return () => unsubDoc();
  }, [activeOrderId]);

  useEffect(() => {
    if (!activeOrderId) return;
    const q = query(collection(db, "orders"), orderBy("createdAt", "asc"));
    const unsubList = onSnapshot(q, (snapshot) => {
      // Hanya menghitung antrean aktif yang belum selesai/batal
      const activeDocs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.statusPesanan !== "selesai" && d.statusPesanan !== "batal");
        
      const indeksSaya = activeDocs.findIndex(d => d.id === activeOrderId);
      if (indeksSaya !== -1) {
        setAntreanDiDepan(indeksSaya);
      }
    });
    return () => unsubList();
  }, [activeOrderId]);

  const toggleIsian = (id) => {
    const isSelected = isian[id] > 0;
    if (isSelected) {
      setIsian({ ...isian, [id]: 0 });
      playTone("click");
    } else {
      if (totalPilihan >= 5) { setSnackbar({ open: true, message: "Maksimal pilih 5 isian ya kak!", severity: "warning" }); return; }
      setIsian({ ...isian, [id]: 1 }); playTone("click");
    }
  };

  const clearTakoyakiForm = () => {
    setIsian({}); setSauses({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setSausesPisah({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setPakeKatsuobushi(false); playTone("delete");
  };

  const cancelEditMode = () => {
    clearTakoyakiForm();
    setEditingCartId(null);
    setQtyAir(0);
  };

  const toggleSemuaSaus = () => {
    const allSelected = Object.values(sauses).every((val) => val === true);
    setSauses({ "Saus Sambel": !allSelected, "Saus Tomat": !allSelected, Mayonaise: !allSelected });
    if (allSelected) setSausesPisah({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    playTone("click");
  };

  const hitungHargaPorsi = () => {
    const activeKeys = Object.keys(isian).filter(key => isian[key] > 0);
    if (activeKeys.length === 0) return 0;
    if (activeKeys.length === 1 && activeKeys.includes("gurita")) return 20000;
    return 15000;
  };

  const loadCartItemToForm = (item) => {
    clearTakoyakiForm(); setQtyAir(0); setEditingCartId(item.id);
    if (item.type === "drink") { setQtyAir(item.qty); } 
    else {
      setIsian(item.detail); setPakeKatsuobushi(item.katsuobushi);
      const newSauses = { "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false }; item.sauses.forEach((s) => (newSauses[s] = true)); setSauses(newSauses);
      const newSausesPisah = { "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false }; if (item.sausesPisah) item.sausesPisah.forEach((s) => (newSausesPisah[s] = true)); setSausesPisah(newSausesPisah);
    }
    setSnackbar({ open: true, message: "Rincian dimuat ke form.", severity: "info" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addTakoyakiToCart = () => {
    if (totalPilihan === 0) return;

    if (editingCartId && cart.find(i => i.id === editingCartId)?.type === "food") {
      setCart(cart.map(item => item.id === editingCartId ? { ...item, nama: generateSmartName(isian), detail: isian, sauses: Object.keys(sauses).filter(k => sauses[k]), sausesPisah: Object.keys(sausesPisah).filter(k => sausesPisah[k]), katsuobushi: pakeKatsuobushi, harga: hitungHargaPorsi() } : item));
      cancelEditMode(); setSnackbar({ open: true, message: "Takoyaki berhasil diperbarui!", severity: "success" }); playTone("success"); return;
    }

    const newItem = {
      id: Date.now(), nama: generateSmartName(isian), type: "food", qty: 1, detail: isian,
      sauses: Object.keys(sauses).filter((key) => sauses[key]),
      sausesPisah: Object.keys(sausesPisah).filter((key) => sausesPisah[key]),
      katsuobushi: pakeKatsuobushi, harga: hitungHargaPorsi()
    };
    setCart([...cart, newItem]); clearTakoyakiForm(); playTone("success");
    setSnackbar({ open: true, message: "Takoyaki masuk ke keranjang!", severity: "success" });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const addDrinkToCart = () => {
    if (qtyAir === 0) return;

    if (editingCartId && cart.find(i => i.id === editingCartId)?.type === "drink") {
      setCart(cart.map(item => item.id === editingCartId ? { ...item, qty: qtyAir, nama: `Air Mineral (${qtyAir}x)`, harga: 5000 * qtyAir } : item));
      cancelEditMode(); setSnackbar({ open: true, message: "Minuman berhasil diperbarui!", severity: "success" }); playTone("success"); return;
    }

    const existingWaterIndex = cart.findIndex((item) => item.type === "drink");
    if (existingWaterIndex !== -1) {
      const updatedCart = [...cart];
      const oldItem = updatedCart[existingWaterIndex];
      const newQty = oldItem.qty + qtyAir;
      updatedCart[existingWaterIndex] = { ...oldItem, qty: newQty, nama: `Air Mineral (${newQty}x)`, harga: 5000 * newQty };
      setCart(updatedCart);
    } else {
      const newDrink = { id: Date.now(), nama: `Air Mineral (${qtyAir}x)`, type: "drink", qty: qtyAir, harga: 5000 * qtyAir, detail: {}, sauses: [], sausesPisah: [] };
      setCart([...cart, newDrink]);
    }
    setQtyAir(0); playTone("success");
    setSnackbar({ open: true, message: "Air Mineral masuk ke keranjang!", severity: "success" });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const removeFromCart = (id) => { 
    setCart(cart.filter(item => item.id !== id)); 
    if (editingCartId === id) { cancelEditMode(); }
    playTone("delete"); 
  };

  const resetSesiPelanggan = () => {
    localStorage.removeItem("ian_takoyaki_active_order_id");
    setActiveOrderId(null);
    setActiveOrderData(null);
    playTone("click");
  };

  const kirimPesanan = async () => {
    if (namaPelanggan.trim() === "") { setSnackbar({ open: true, message: "Tolong isi nama kamu dulu ya!", severity: "warning" }); return; }
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        noAntrian: "Online", namaPemesan: namaPelanggan.trim().toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase()),
        jamMasuk: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        statusBayar: "belum", statusPesanan: "antre", items: cart.map(item => ({ ...item, statusMasak: "dibuat" })),
        totalTagihan: cart.reduce((a, b) => a + b.harga, 0), createdAt: serverTimestamp()
      });
      
      const infoId = docRef.id;
      localStorage.setItem("ian_takoyaki_active_order_id", infoId);
      setCart([]); setNamaPelanggan(""); cancelEditMode();
      setActiveOrderId(infoId);
      playTone("success");
    } catch (error) {
      console.error("Firebase Error: ", error); setSnackbar({ open: true, message: "Waduh, koneksi drop. Coba klik lagi, Ian!", severity: "error" });
    }
  };

  const renderSauceChips = (sauses, sausesPisah) => {
    if (!sauses || sauses.length === 0) return null;
    const isFullTeam = sauses.length === SAUS_LIST.length;
    const allSeparated = sauses.every((s) => sausesPisah && sausesPisah.includes(s));
    if (isFullTeam && allSeparated) return <Chip key="all-pisah" label="SEMUA SAUS DIPISAH" size="small" sx={{ bgcolor: COLORS.info, color: "white", fontWeight: "bold", fontSize: "0.75rem", height: "24px" }} />;
    return sauses.map((saus) => {
      const isPisah = sausesPisah && sausesPisah.includes(saus);
      return <Chip key={saus} label={`${saus}${isPisah ? " (PISAH)" : ""}`} size="small" color={getSauceColor(saus)} variant={isPisah ? "outlined" : "filled"} sx={{ fontWeight: "bold", fontSize: "0.7rem", height: "24px" }} />;
    });
  };

  const isEditingFood = editingCartId && cart.find(i => i.id === editingCartId)?.type === "food";
  const isEditingDrink = editingCartId && cart.find(i => i.id === editingCartId)?.type === "drink";

  // --- RENDERING HALAMAN JIKA MEMILIKI SESI PESANAN AKTIF ---
  if (activeOrderId && activeOrderData) {
    const isWaitingConfirm = activeOrderData.noAntrian === "Online";

    // KONDISI A: PESANAN SELESAI DISAJIKAN (Kasir Klik Selesai)
    if (activeOrderData.statusPesanan === "selesai") {
      return (
        <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4, display: "flex", alignItems: "center" }}>
          <CssBaseline />
          <Container maxWidth="sm">
            <Paper elevation={4} sx={{ p: 4, borderRadius: 4, bgcolor: "white", textAlign: "center", borderTop: `6px solid ${COLORS.success}` }}>
              <CheckCircleOutline sx={{ fontSize: 80, color: COLORS.success, mb: 2 }} />
              <Typography variant="h4" fontWeight="900" color="success.main" gutterBottom>SIAP DINIKMATI! 🎉</Typography>
              <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ mb: 2 }}>
                Halo {activeOrderData.namaPemesan}, pesanan takoyaki hangatmu sudah siap disajikan!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Silakan ambil pesananmu langsung di meja kasir tenda Ian Takoyaki ya. Selamat menikmati makanan hangatmu! 🐙
              </Typography>
              <Button fullWidth variant="contained" onClick={resetSesiPelanggan} sx={{ height: "55px", bgcolor: COLORS.textDark, borderRadius: 3, fontWeight: "bold", fontSize: "1.1rem" }}>PESAN LAGI</Button>
            </Paper>
          </Container>
        </Box>
      );
    }

    // KONDISI B: PESANAN DIBATALKAN KASIR (Kasir Klik Batalkan / Tolak)
    if (activeOrderData.statusPesanan === "batal") {
      return (
        <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4, display: "flex", alignItems: "center" }}>
          <CssBaseline />
          <Container maxWidth="sm">
            <Paper elevation={4} sx={{ p: 4, borderRadius: 4, bgcolor: "white", textAlign: "center", borderTop: `6px solid ${COLORS.primary}` }}>
              <CancelPresentation sx={{ fontSize: 80, color: "error.main", mb: 2 }} />
              <Typography variant="h4" fontWeight="900" color="error.main" gutterBottom>PESANAN DIBATALKAN</Typography>
              <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ mb: 2 }}>
                Pesanan atas nama "{activeOrderData.namaPemesan}" telah dibatalkan di sistem.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, bgcolor: "#ffebee", p: 2, borderRadius: 2, fontWeight: "bold" }}>
                ⚠️ Harap lakukan konfirmasi atau berbicara langsung dengan kasir di tenda untuk rincian pembatalan pesanan kamu.
              </Typography>
              <Button fullWidth variant="outlined" color="inherit" onClick={resetSesiPelanggan} sx={{ height: "55px", borderRadius: 3, fontWeight: "bold", fontSize: "1.1rem" }}>KEMBALI KE MENU KEDAI</Button>
            </Paper>
          </Container>
        </Box>
      );
    }

    // KONDISI C: SEDANG ANTRE JALAN (Tampilan Sisa Antrean)
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4 }}>
        <CssBaseline />
        <Container maxWidth="sm">
          <Paper elevation={3} sx={{ p: 4, borderRadius: 4, bgcolor: "white", textAlign: "center", borderTop: `6px solid ${COLORS.primary}` }}>
            <Box sx={{ mb: 2 }}>
              <HourglassEmpty sx={{ fontSize: 70, color: COLORS.secondary, animation: "spin 4s linear infinite" }} />
            </Box>
            
            <Typography variant="h5" fontWeight="900" color="primary" gutterBottom>PESANAN TERKIRIM!</Typography>
            <Typography variant="body1" fontWeight="bold" color="text.secondary" sx={{ mb: 3 }}>
              Halo <b>{activeOrderData.namaPemesan}</b>, pesananmu sudah masuk ke dapur Ian Takoyaki.
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ bgcolor: isWaitingConfirm ? "#e3f2fd" : (antreanDiDepan === 0 ? "#e8f5e9" : "#fff8e1"), p: 3, borderRadius: 3, mb: 3, border: `2px dashed ${isWaitingConfirm ? COLORS.info : (antreanDiDepan === 0 ? COLORS.success : "orange")}` }}>
              <Typography variant="body2" fontWeight="bold" color="text.secondary">SISA ANTREAN SAAT INI:</Typography>
              
              {isWaitingConfirm ? (
                <>
                  <Typography variant="h5" fontWeight="900" color={COLORS.info} sx={{ my: 1.5 }}>MENUNGGU KONFIRMASI...</Typography>
                  <Chip label="Kasir sedang mengecek pesananmu" color="info" sx={{ fontWeight: "bold" }} />
                </>
              ) : antreanDiDepan === 0 ? (
                <>
                  <Typography variant="h4" fontWeight="900" color={COLORS.success} sx={{ my: 1.5 }}>GILIRANMU! 🍳</Typography>
                  <Chip label="Pesanan sedang dimasak kasir" color="success" sx={{ fontWeight: "bold" }} />
                </>
              ) : (
                <>
                  <Typography variant="h2" fontWeight="900" color={COLORS.primary} sx={{ my: 0.5 }}>{antreanDiDepan}</Typography>
                  <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">Pesanan lagi di depanmu</Typography>
                </>
              )}
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {isWaitingConfirm 
                ? "Pesanan kamu akan segera diproses setelah diterima oleh kasir kami."
                : "Boleh jalan-jalan santai dulu, nanti tinggal ambil di tenda ya!"}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" align="left" fontWeight="bold" color="text.primary" gutterBottom>Rincian Pesanan Kamu:</Typography>
            <List dense>
              {activeOrderData.items?.map((item, idx) => (
                <Box key={idx} sx={{ p: 1.5, border: "1px solid #eee", borderRadius: 2, mb: 1, bgcolor: "#fafafa", textAlign: "left" }}>
                  <Typography fontWeight="bold">• {item.qty}x {item.nama}</Typography>
                  {item.type === "food" && (
                    <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                      {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={{ height: "20px", fontSize: "0.65rem", bgcolor: COLORS.warning, color: "white" }} />}
                      {item.sauses?.map(s => (
                        <Chip key={s} label={`${s}${item.sausesPisah?.includes(s) ? " (PISAH)" : ""}`} size="small" color={getSauceColor(s)} sx={{ height: "20px", fontSize: "0.65rem" }} />
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </List>
            
            <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 2, p: 1.5, bgcolor: "#f5f5f5", borderRadius: 2 }}>
              <Typography fontWeight="bold">Total Pembayaran:</Typography>
              <Typography variant="h6" fontWeight="bold" color="primary">Rp {activeOrderData.totalTagihan?.toLocaleString()}</Typography>
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  // TAMPILAN STANDAR FORM BELANJA
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4 }}>
      <CssBaseline />
      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%", fontWeight: "bold" }}>{snackbar.message}</Alert>
      </Snackbar>

      <Container maxWidth="sm">
        <Box textAlign="center" mb={4}>
          <Storefront sx={{ fontSize: 60, color: COLORS.primary, mb: 1 }} />
          <Typography variant="h4" fontWeight="900" color="primary">IAN TAKOYAKI</Typography>
          <Typography variant="body1" fontWeight="bold" color="text.secondary">Pesan langsung dari HP Kamu!</Typography>
        </Box>

        <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, borderTop: `4px solid ${COLORS.success}`, bgcolor: "white" }}>
          <Typography variant="h6" fontWeight="bold" color={COLORS.success} sx={{ display: "flex", alignItems: "center", mb: 2 }}><Person sx={{ mr: 1 }} /> Data Pelanggan</Typography>
          <TextField fullWidth label="Nama Kamu" variant="outlined" value={namaPelanggan} onChange={(e) => setNamaPelanggan(e.target.value)} placeholder="Misal: Budi" InputLabelProps={{ style: { fontSize: "1.2rem" } }} InputProps={{ style: { fontSize: "1.3rem" } }} />
        </Paper>

        {editingCartId && <Alert severity="info" sx={{ mb: 2, fontWeight: "bold" }} onClose={cancelEditMode}>Sedang mengubah rincian dari Keranjang... (Klik X untuk Batal)</Alert>}

        <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 4, bgcolor: "white", borderTop: `4px solid ${COLORS.primary}`, opacity: isEditingDrink ? 0.5 : 1, pointerEvents: isEditingDrink ? "none" : "auto" }}>
          <Typography variant="h6" fontWeight="bold" color={COLORS.textDark} sx={{ display: "flex", alignItems: "center", mb: 2 }}><Restaurant sx={{ mr: 1 }} /> Menu Takoyaki</Typography>
          
          <motion.div whileTap={{ scale: 0.95 }} style={{ marginBottom: "16px", width: "100%" }}>
            <Button fullWidth variant="contained" onClick={() => { setIsian({ sosis: 1, cumi: 1, kepiting: 1, keju: 1, kornet: 1, gurita: 0 }); playTone("click"); }} startIcon={<Restaurant />} sx={{ height: "50px", bgcolor: COLORS.secondary, fontSize: "1rem", fontWeight: "bold" }}>PAKET CAMPUR (15K)</Button>
          </motion.div>
          
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}><Box display="flex" alignItems="center" gap={1}><Typography variant="subtitle1" fontWeight="bold">Atau Racik Isian:</Typography><Chip label={`${totalPilihan}/5`} color={totalPilihan >= 5 ? "error" : "default"} size="small" sx={{ fontWeight: "bold" }} /></Box><Button size="small" color="error" startIcon={<RestartAlt />} onClick={clearTakoyakiForm} sx={{ textTransform: "none", fontWeight: "bold" }}>Kosongkan</Button></Box>
          
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mb: 3 }}>
            {VARIAN_ISIAN.map((item) => (
              <motion.div key={item.id} whileTap={{ scale: 0.95 }} style={{ width: "100%", height: "100%" }}>
                <Card elevation={0} onClick={(e) => { e.stopPropagation(); toggleIsian(item.id); }} sx={{ bgcolor: isian[item.id] > 0 ? COLORS.cardSelected : "#f5f5f5", border: isian[item.id] > 0 ? `3px solid ${COLORS.primary}` : "1px solid #eee", boxShadow: isian[item.id] > 0 ? "0 4px 12px rgba(211, 47, 47, 0.3)" : "none", borderRadius: 2, cursor: "pointer", height: "60px", width: "100%", display: "flex", justifyContent: "center", alignItems: "center", transition: "0.1s", userSelect: "none", boxSizing: "border-box", px: 1 }}>
                  <Typography variant="body1" fontWeight="900" align="center" sx={{ color: isian[item.id] > 0 ? COLORS.primary : "#757575", letterSpacing: 0.5, fontSize: "0.85rem", lineHeight: 1.1 }}>{item.label}</Typography>
                </Card>
              </motion.div>
            ))}
          </Box>

          <Box mb={2}>
            <FormControlLabel control={<Checkbox checked={pakeKatsuobushi} onChange={(e) => { setPakeKatsuobushi(e.target.checked); playTone("click"); }} color="warning" sx={{ transform: "scale(1.2)", mr: 1 }} />} label={<Typography sx={{ fontSize: "0.9rem", fontWeight: "bold" }}>Topping Katsuobushi</Typography>} sx={{ p: 1, border: "1px solid #ddd", borderRadius: 2, width: "100%", mb: 2, mx: 0 }} />
            
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
              <Box>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Pilih Saus:</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -0.5 }}>Bisa pilih lebih dari satu</Typography>
              </Box>
              <Button size="small" variant="text" color="primary" onClick={toggleSemuaSaus} sx={{ fontWeight: "bold", fontSize: "0.8rem", textTransform: "none", p: 0 }}>
                {Object.values(sauses).every((val) => val === true) ? "Hapus Semua" : "Pilih Semua"}
              </Button>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
              {SAUS_LIST.map((saus) => (
                <Box key={saus} sx={{ border: sauses[saus] ? `2px solid ${COLORS.primary}` : "1px solid #ddd", borderRadius: 2, p: 0.5, bgcolor: sauses[saus] ? "#ffebee" : "transparent", minHeight: "85px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease", width: "100%", boxSizing: "border-box" }}>
                  <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                    <Checkbox size="small" checked={sauses[saus]} onChange={() => { setSauses({ ...sauses, [saus]: !sauses[saus] }); playTone("click"); }} sx={{ p: 0, color: COLORS.secondary, "&.Mui-checked": { color: COLORS.primary } }} />
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: "900", lineHeight: 1.1, textAlign: "center" }}>{saus}</Typography>
                  </Box>
                  <AnimatePresence>
                    {sauses[saus] && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", width: "100%", display: "flex", justifyContent: "center" }}>
                        <FormControlLabel control={<Switch size="small" checked={sausesPisah[saus]} onChange={() => { setSausesPisah({ ...sausesPisah, [saus]: !sausesPisah[saus] }); playTone("click"); }} color="error" />} label={<Typography variant="caption" color="error" fontWeight="bold">Pisah</Typography>} sx={{ m: 0, ml: 1 }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Box>
              ))}
            </Box>
          </Box>
          <motion.div whileTap={{ scale: 0.98 }} style={{ width: "100%" }}>
            <Button fullWidth variant="contained" onClick={addTakoyakiToCart} disabled={totalPilihan === 0 && !isEditingFood} sx={{ bgcolor: isEditingFood ? COLORS.info : COLORS.primary, borderRadius: 2, height: "55px", fontSize: "1rem", fontWeight: "bold" }}>{isEditingFood ? "PERBARUI TAKOYAKI INI" : `+ TAMBAH TAKOYAKI ${totalPilihan > 0 ? `(Rp ${hitungHargaPorsi().toLocaleString()})` : ""}`}</Button>
          </motion.div>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mb: 4, borderRadius: 4, bgcolor: "#e3f2fd", borderTop: `4px solid ${COLORS.info}`, opacity: isEditingFood ? 0.5 : 1, pointerEvents: isEditingFood ? "none" : "auto" }}>
          <Typography variant="h6" fontWeight="bold" color={COLORS.info} sx={{ display: "flex", alignItems: "center", mb: 2 }}><LocalDrink sx={{ mr: 1 }} /> Menu Minuman</Typography>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">Air Mineral (Dingin / Biasa)</Typography>
              <Typography variant="body2" color="text.secondary" fontWeight="bold">Rp 5.000 / botol</Typography>
            </Box>
            <Box display="flex" alignItems="center" sx={{ bgcolor: "white", borderRadius: 2, border: `1px solid ${COLORS.info}` }}>
              <IconButton onClick={() => { setQtyAir(Math.max(0, qtyAir - 1)); playTone("click"); }} disabled={qtyAir === 0}><Remove color="info" /></IconButton>
              <Typography fontWeight="bold" fontSize="1.2rem" sx={{ mx: 2, width: "20px", textAlign: "center" }}>{qtyAir}</Typography>
              <IconButton onClick={() => { if (qtyAir < 10) { setQtyAir(qtyAir + 1); playTone("click"); } }} disabled={qtyAir >= 10}><Add color="info" /></IconButton>
            </Box>
          </Box>
          <motion.div whileTap={{ scale: 0.98 }} style={{ width: "100%" }}>
            <Button fullWidth variant="contained" color="info" onClick={addDrinkToCart} disabled={qtyAir === 0 && !isEditingDrink} sx={{ borderRadius: 2, height: "55px", fontSize: "1rem", fontWeight: "bold" }}>{isEditingDrink ? "PERBARUI MINUMAN INI" : `+ TAMBAH MINUMAN ${qtyAir > 0 ? `(Rp ${(qtyAir * 5000).toLocaleString()})` : ""}`}</Button>
          </motion.div>
        </Paper>

        {cart.length > 0 && (
          <Paper elevation={3} sx={{ p: 2, borderRadius: 3, bgcolor: "#fffde7", border: "2px dashed orange", mb: 4 }}>
            <Typography variant="h6" fontWeight="bold" color={COLORS.textDark} gutterBottom>🛒 Keranjang Pesanan</Typography>
            <List dense sx={{ p: 0, mb: 2 }}>
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} style={{ marginBottom: "12px" }}>
                    <Box sx={{ border: `1px solid ${editingCartId === item.id ? COLORS.info : '#ddd'}`, borderRadius: 2, p: 1.5, bgcolor: editingCartId === item.id ? "#e3f2fd" : "white", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Typography fontWeight="bold" fontSize="1.1rem" sx={{ pr: 2, lineHeight: 1.2 }}>{item.nama}</Typography>
                        <Typography variant="subtitle1" fontWeight="bold" color={COLORS.primary} sx={{ whiteSpace: "nowrap" }}>Rp {item.harga.toLocaleString()}</Typography>
                      </Box>
                      
                      {item.type === "food" && (
                        <Box sx={{ mt: 0.5 }}>
                          <Box display="flex" flexWrap="wrap" gap={0.75}>
                            {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={{ bgcolor: COLORS.warning, color: "white", fontWeight: "bold", fontSize: "0.7rem", height: "24px" }} />}
                            {(!item.sauses || item.sauses.length === 0) && <Chip label="Tanpa Saus" size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: "24px", color: "text.secondary", borderColor: "#ddd" }} />}
                            {renderSauceChips(item.sauses, item.sausesPisah)}
                          </Box>
                        </Box>
                      )}

                      <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />
                      
                      <Box display="flex" justifyContent="flex-end" gap={1.5} alignItems="center">
                        <Button size="small" variant="outlined" color="primary" onClick={() => loadCartItemToForm(item)} sx={{ textTransform: "none", fontWeight: "bold", borderRadius: 1.5, px: 2 }}>Ubah</Button>
                        <IconButton size="small" color="error" onClick={() => removeFromCart(item.id)} sx={{ bgcolor: "#ffebee", borderRadius: 2 }}><Delete fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                  </motion.div>
                ))}
              </AnimatePresence>
            </List>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}><Typography variant="subtitle1" fontWeight="bold">Total Pembayaran:</Typography><Typography variant="h5" fontWeight="bold" color={COLORS.primary}>Rp {cart.reduce((a, b) => a + b.harga, 0).toLocaleString()}</Typography></Box>
            <motion.div whileTap={{ scale: 0.98 }} style={{ width: "100%" }}>
              <Button fullWidth variant="contained" onClick={kirimPesanan} startIcon={<Send />} disabled={!!editingCartId} sx={{ height: "60px", borderRadius: 3, bgcolor: COLORS.textDark, fontSize: "1.2rem", fontWeight: "bold", "&:hover": { bgcolor: "black" } }}>KIRIM KE KASIR SEKARANG</Button>
            </motion.div>
            <div ref={bottomRef} />
          </Paper>
        )}
      </Container>
    </Box>
  );
}