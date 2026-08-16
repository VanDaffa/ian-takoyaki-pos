import React, { useState, useRef, useEffect } from "react";
import {
  Box, Typography, Card, Button, IconButton, Chip, Divider, Paper,
  Checkbox, CssBaseline, Container, TextField, List, Snackbar, Alert, Switch, FormControlLabel
} from "@mui/material";
import { 
  Add, Remove, Restaurant, Delete, Send, Person, Storefront, LocalDrink, 
  HourglassEmpty, CheckCircleOutline, CancelPresentation, NoFood, Stars
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { COLORS, VARIAN_ISIAN, SAUS_LIST } from "../utils/constants";
import { generateSmartName } from "../utils/helpers";
import { playTone } from "../utils/soundEngine";

import { db } from "../utils/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, orderBy } from "firebase/firestore";

// IMPORT GAMBAR QRIS
import qrisImage from "../assets/qris-ian.jpg";

export default function CustomerPage() {
  const [modeRacik, setModeRacik] = useState("campur");

  const [isian, setIsian] = useState({});
  const [sauses, setSauses] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [sausesPisah, setSausesPisah] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [pakeKatsuobushi, setPakeKatsuobushi] = useState(false);
  const [qtyAir, setQtyAir] = useState(0);
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [cart, setCart] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  
  const [activeOrderId, setActiveOrderId] = useState(localStorage.getItem("ian_takoyaki_active_order_id") || null);
  const [activeOrderData, setActiveOrderData] = useState(null);
  const [antreanDiDepan, setAntreanDiDepan] = useState(0);

  const [isShopOpen, setIsShopOpen] = useState(true);

  const totalPilihan = Object.values(isian).filter((val) => val > 0).length;

  useEffect(() => {
    if (modeRacik === "campur") {
      setIsian({ sosis: 1, cumi: 1, kepiting: 1, keju: 1, kornet: 1, gurita: 0 });
    } else {
      setIsian({}); 
    }
  }, [modeRacik]);

  useEffect(() => {
    const unsubShop = onSnapshot(doc(db, "settings", "shop"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.isOpen) {
          setIsShopOpen(false);
        } else if (data.lastActive) {
          const lastActiveTime = data.lastActive.toDate().getTime();
          const now = new Date().getTime();
          const selisihMenit = (now - lastActiveTime) / 1000 / 60;
          
          // Jika kedai buka, tapi dashboard tidak mengirim sinyal selama > 5 menit (artinya kasir lupa nutup / tutup laptop)
          if (selisihMenit > 5) {
            setIsShopOpen(false); // Otomatis tutup pengaman!
          } else {
            setIsShopOpen(true);
          }
        } else {
          setIsShopOpen(true);
        }
      } else {
        setIsShopOpen(false);
      }
    });
    return () => unsubShop();
  }, []);

  useEffect(() => {
    if (!activeOrderId) {
      setActiveOrderData(null);
      return;
    }
    const unsubDoc = onSnapshot(doc(db, "orders", activeOrderId), (docSnap) => {
      if (!docSnap.exists()) {
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

  const hitungHargaPorsi = () => {
    const activeKeys = Object.keys(isian).filter(key => isian[key] > 0);
    if (activeKeys.length === 0) return 15000;
    if (activeKeys.length === 1 && activeKeys.includes("gurita")) return 20000;
    return 15000;
  };

  const isGuritaOnly = () => {
    const activeKeys = Object.keys(isian).filter(key => isian[key] > 0);
    return activeKeys.length === 1 && activeKeys.includes("gurita");
  };

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

  const addTakoyakiToCart = () => {
    if (totalPilihan === 0) {
      setSnackbar({ open: true, message: "Pilih minimal 1 isian dulu ya!", severity: "warning" });
      return;
    }
    const newItem = {
      id: Date.now(), nama: generateSmartName(isian), type: "food", qty: 1, detail: isian,
      sauses: Object.keys(sauses).filter((key) => sauses[key]),
      sausesPisah: Object.keys(sausesPisah).filter((key) => sausesPisah[key]),
      katsuobushi: pakeKatsuobushi, harga: hitungHargaPorsi()
    };
    setCart([...cart, newItem]); 
    if (modeRacik === "custom") setIsian({}); 
    setSauses({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setSausesPisah({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setPakeKatsuobushi(false);
    playTone("success");
    setSnackbar({ open: true, message: "Takoyaki berhasil ditambahkan!", severity: "success" });
  };

  const addDrinkToCart = () => {
    if (qtyAir === 0) return;
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
    setSnackbar({ open: true, message: "Air Mineral ditambahkan!", severity: "success" });
  };

  const removeFromCart = (id) => { 
    setCart(cart.filter(item => item.id !== id)); 
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
      setCart([]); 
      setActiveOrderId(infoId);
      playTone("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Firebase Error: ", error); setSnackbar({ open: true, message: "Waduh, koneksi drop. Coba klik lagi, Ian!", severity: "error" });
    }
  };

  const getOldStyleColor = (saus) => {
    if (saus === "Katsuobushi") return "#e65100";
    if (saus.includes("Sambel")) return "#c62828";
    if (saus.includes("Tomat")) return "#ef6c00";
    if (saus.includes("Mayonaise")) return "#0277bd";
    return "#757575";
  };

  if (activeOrderId && activeOrderData) {
    const isWaitingConfirm = activeOrderData.noAntrian === "Online";

    if (activeOrderData.statusPesanan === "selesai") {
      return (
        <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4, display: "flex", alignItems: "center" }}>
          <CssBaseline />
          <Container maxWidth="sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
              <Paper elevation={4} sx={{ p: 4, borderRadius: 6, bgcolor: "white", textAlign: "center", borderTop: `8px solid ${COLORS.success}` }}>
                <CheckCircleOutline sx={{ fontSize: 90, color: COLORS.success, mb: 2 }} />
                <Typography variant="h4" fontWeight="900" color="success.main" gutterBottom>SIAP DINIKMATI! 🎉</Typography>
                <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ mb: 2 }}>
                  Halo {activeOrderData.namaPemesan}, pesanan takoyaki hangatmu sudah siap disajikan!
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
                  Silakan ambil pesananmu langsung di meja kasir tenda ya. Selamat menikmati makanan hangatmu! 🐙
                </Typography>
                <Button fullWidth variant="contained" onClick={resetSesiPelanggan} sx={{ height: "60px", bgcolor: "black", color: "white", borderRadius: 3, fontWeight: "bold", fontSize: "1.1rem" }}>PESAN LAGI NANTI</Button>
              </Paper>
            </motion.div>
          </Container>
        </Box>
      );
    }

    if (activeOrderData.statusPesanan === "batal") {
      return (
        <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4, display: "flex", alignItems: "center" }}>
          <CssBaseline />
          <Container maxWidth="sm">
             <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
              <Paper elevation={2} sx={{ p: 4, borderRadius: 4, bgcolor: "white", textAlign: "center", borderTop: `6px solid #d32f2f` }}>
                <Box sx={{ mb: 2 }}>
                   <CancelPresentation sx={{ fontSize: 80, color: "#d32f2f", display: "inline-block" }} />
                </Box>
                <Typography variant="h4" fontWeight="900" sx={{ color: "#d32f2f", letterSpacing: 1, mb: 2 }}>PESANAN<br/>DIBATALKAN</Typography>
                <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ mb: 3, lineHeight: 1.4 }}>
                  Maaf, pesanan atas nama "{activeOrderData.namaPemesan}" telah dibatalkan.
                </Typography>
                <Box sx={{ bgcolor: "#fce4e4", p: 2, borderRadius: 2, mb: 4 }}>
                  <Typography variant="body2" sx={{ color: "#c62828", fontWeight: "bold" }}>
                    ⚠️ Pembatalan bisa terjadi karena melewati batas waktu pembayaran atau ditolak oleh kasir.
                  </Typography>
                </Box>
                <Button fullWidth variant="outlined" color="inherit" onClick={resetSesiPelanggan} sx={{ height: "55px", borderRadius: 3, fontWeight: "bold", fontSize: "1rem", borderWidth: 2, borderColor: "#333", color: "#333" }}>KEMBALI KE MENU KEDAI</Button>
              </Paper>
            </motion.div>
          </Container>
        </Box>
      );
    }

    return (
      <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4 }}>
        <CssBaseline />
        <Container maxWidth="sm">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Paper elevation={2} sx={{ p: 4, borderRadius: 4, bgcolor: "white", textAlign: "center", borderTop: `6px solid ${COLORS.primary}` }}>
              
              <Box sx={{ mb: 2, mt: 1 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} style={{ display: "inline-block" }}>
                  <HourglassEmpty sx={{ fontSize: 70, color: COLORS.secondary }} />
                </motion.div>
              </Box>
              
              <Typography variant="h5" fontWeight="900" color="primary" sx={{ letterSpacing: 1 }}>PESANAN<br/>TERKIRIM!</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 3 }}>Halo <b>{activeOrderData.namaPemesan}</b>, rincian pesananmu sudah masuk ke sistem.</Typography>
              
              <Divider sx={{ my: 3, borderStyle: "dashed" }} />
              
              <Box sx={{ bgcolor: isWaitingConfirm ? "#f0f8ff" : (antreanDiDepan === 0 ? "#e8f5e9" : "#fffde7"), p: 3, borderRadius: 3, mb: 3, border: `2px solid ${isWaitingConfirm ? COLORS.info : (antreanDiDepan === 0 ? COLORS.success : "#ffd54f")}` }}>
                <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ letterSpacing: 1, mb: 2 }}>SISA ANTREAN SAAT INI:</Typography>
                
                {isWaitingConfirm ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Typography fontWeight="900" color={COLORS.info} sx={{ my: 1.5, fontSize: { xs: "1.8rem", sm: "2.2rem" } }}>MENUNGGU PEMBAYARAN</Typography>
                    <Chip label="Kasir menunggu konfirmasi bayar" color="info" sx={{ fontWeight: "bold", borderRadius: 2 }} />
                    
                    <Box sx={{ mt: 3, p: 2.5, bgcolor: "white", borderRadius: 3, border: "1px solid #ddd" }}>
                       <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" gutterBottom>LAKUKAN PEMBAYARAN VIA QRIS:</Typography>
                       <Box display="flex" justifyContent="center" my={2}>
                          <img src={qrisImage} alt="QRIS IAN Takoyaki" style={{ width: "175px", height: "auto", borderRadius: "8px", boxShadow: "0px 4px 10px rgba(0,0,0,0.1)" }} />
                       </Box>
                       <Typography variant="body2" fontWeight="bold" sx={{ mb: 0.5, color: COLORS.textDark }}>Scan QRIS atau Bayar Tunai ke Kasir</Typography>
                       <Typography variant="caption" color="text.secondary" display="block">Tunjukkan bukti transfer ke kasir agar pesanan segera dimasak.</Typography>
                    </Box>

                    <Alert severity="warning" icon={<HourglassEmpty />} sx={{ mt: 3, textAlign: "left", borderRadius: 2, alignItems: "center" }}>
                       <Typography variant="caption" fontWeight="bold">
                          Batas konfirmasi: 15 Menit. Pesanan otomatis dibatalkan sistem jika dibiarkan.
                       </Typography>
                    </Alert>
                  </motion.div>
                ) : antreanDiDepan === 0 ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                    <Typography fontWeight="900" color={COLORS.success} sx={{ my: 1.5, fontSize: { xs: "2rem", sm: "2.8rem" }, wordBreak: "break-word", lineHeight: 1 }}>GILIRANMU!</Typography>
                    <Chip label="Pesanan sedang dimasak kasir" color="success" sx={{ fontWeight: "bold", fontSize: "0.95rem", py: 1.5, px: 1, height: "auto", borderRadius: 2, '& .MuiChip-label': { whiteSpace: 'normal', display: 'block', textAlign: 'center' } }} />
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Typography variant="h1" fontWeight="900" color={COLORS.primary} sx={{ my: 1 }}>{antreanDiDepan}</Typography>
                    <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">Pesanan lagi di depanmu</Typography>
                  </motion.div>
                )}
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, px: 2 }}>
                {isWaitingConfirm ? "Pesanan belum masuk antrean masak. Silakan selesaikan pembayaran dulu ya!" : "Boleh jalan-jalan santai di area aloon-aloon dulu, nanti tinggal ambil di tenda ya!"}
              </Typography>

              <Divider sx={{ my: 3, borderStyle: "dashed" }} />
              <Box textAlign="left" bgcolor="#fafafa" p={2.5} borderRadius={3} border="1px solid #eee">
                <Typography variant="subtitle1" fontWeight="bold" color="text.primary" gutterBottom>🧾 Rincian Pesanan:</Typography>
                <List dense disablePadding>
                  {activeOrderData.items?.map((item, idx) => (
                    <Box key={idx} sx={{ py: 1.5, borderBottom: idx !== activeOrderData.items.length - 1 ? "1px dashed #ddd" : "none" }}>
                      <Typography fontWeight="800" sx={{ fontSize: "1.05rem", color: COLORS.textDark }}>{item.qty}x {item.nama}</Typography>
                      {item.type === "food" && (
                        <Box display="flex" flexWrap="wrap" gap={0.75} mt={1}>
                          {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={{ height: "20px", fontSize: "0.65rem", bgcolor: getOldStyleColor("Katsuobushi"), color: "white", fontWeight: "bold" }} />}
                          {item.sauses?.map(s => <Chip key={s} label={`${s}${item.sausesPisah?.includes(s) ? " (PISAH)" : ""}`} size="small" sx={{ height: "20px", fontSize: "0.65rem", bgcolor: getOldStyleColor(s), color: "white", fontWeight: "bold" }} />)}
                        </Box>
                      )}
                    </Box>
                  ))}
                </List>
                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mt: 2, pt: 2, borderTop: "2px solid #ddd", gap: 1.5 }}>
                  <Typography fontWeight="bold" fontSize="1.1rem">Total Tagihan:</Typography>
                  <Typography variant="h5" fontWeight="900" sx={{ color: "#d32f2f", whiteSpace: "nowrap" }}>Rp {activeOrderData.totalTagihan?.toLocaleString()}</Typography>
                </Box>
              </Box>

            </Paper>
          </motion.div>
        </Container>
      </Box>
    );
  }

  if (!isShopOpen) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 8, display: "flex", alignItems: "center" }}>
        <CssBaseline />
        <Container maxWidth="sm">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Paper elevation={3} sx={{ p: 5, borderRadius: 6, bgcolor: "white", textAlign: "center", borderTop: `8px solid ${COLORS.primary}` }}>
              <NoFood sx={{ fontSize: 90, color: COLORS.primary, mb: 2 }} />
              <Typography variant="h4" fontWeight="900" color="primary" gutterBottom>KEDAI TUTUP</Typography>
              <Typography variant="h6" fontWeight="bold" color="text.secondary" sx={{ mb: 2 }}>🐙 IAN Takoyaki 🐙</Typography>
              <Divider sx={{ my: 3, borderStyle: "dashed" }} />
              <Typography variant="body1" color="text.primary" sx={{ lineHeight: 1.6, mb: 4, fontSize: "1.1rem" }}>
                Maaf ya kak, saat ini kami sedang beristirahat atau adonan sudah habis terjual hari ini.
              </Typography>
            </Paper>
          </motion.div>
        </Container>
      </Box>
    );
  }

  const totalCartPrice = cart.reduce((a, b) => a + b.harga, 0);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, pt: 4, pb: cart.length > 0 ? 12 : 6 }}>
      <CssBaseline />
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "top", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%", fontWeight: "bold", borderRadius: 3 }}>{snackbar.message}</Alert>
      </Snackbar>

      <Container maxWidth="sm">
        <Box textAlign="center" mb={4} component={motion.div} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Storefront sx={{ fontSize: 50, color: COLORS.primary, mb: 1 }} />
          <Typography variant="h4" fontWeight="900" color="primary" sx={{ letterSpacing: -0.5 }}>IAN TAKOYAKI</Typography>
          <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ letterSpacing: 1, textTransform: "uppercase" }}>Aloon-Aloon Masjid Agung Kauman</Typography>
        </Box>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 5, bgcolor: "white", borderTop: `4px solid ${COLORS.success}` }}>
            <Typography variant="subtitle1" fontWeight="800" color={COLORS.success} sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Person sx={{ mr: 1 }} /> Siapa Namamu Kak?
            </Typography>
            <TextField 
              fullWidth 
              variant="outlined" 
              value={namaPelanggan} 
              onChange={(e) => setNamaPelanggan(e.target.value)} 
              placeholder="Misal: Kak Budi" 
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: "#fafafa" } }}
            />
          </Paper>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          {/* PERBAIKAN 1: Paper dibungkus sebagai motion.div dengan layout agar bisa melentur mulus */}
          <Paper component={motion.div} layout transition={{ type: "spring", stiffness: 300, damping: 30 }} elevation={0} sx={{ p: 3, mb: 3, borderRadius: 5, bgcolor: "white", borderTop: `4px solid ${COLORS.primary}` }}>
            
            <motion.div layout>
              <Typography variant="h6" fontWeight="900" color={COLORS.textDark} sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Restaurant sx={{ mr: 1, color: COLORS.primary }} /> Menu Takoyaki
              </Typography>
            </motion.div>
            
            <Box component={motion.div} layout sx={{ display: 'flex', bgcolor: '#f5f5f5', p: 0.5, borderRadius: 3, mb: 3, border: "1px solid #ddd", position: "relative" }}>
              {["campur", "custom"].map((mode) => {
                const isSelected = modeRacik === mode;
                return (
                  <Box
                    key={mode}
                    onClick={() => { setModeRacik(mode); playTone('click'); }}
                    sx={{ flex: 1, position: 'relative', py: { xs: 1.2, sm: 1.5 }, px: 0.5, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}
                  >
                    {isSelected && (
                      <motion.div layoutId="activeTabMode" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: mode === 'campur' ? COLORS.secondary : COLORS.primary, borderRadius: '8px', zIndex: 0 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                    <Typography sx={{ position: "relative", zIndex: 1, fontWeight: '900', fontSize: { xs: '0.75rem', sm: '0.95rem' }, lineHeight: 1.2, color: isSelected ? 'white' : 'text.secondary' }}>
                      {mode === 'campur' ? 'PAKET CAMPUR' : 'RACIK SENDIRI'}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* PERBAIKAN 2: Container khusus popLayout agar tinggi Parent langsung menyesuaikan tinggi Child baru */}
            <Box component={motion.div} layout sx={{ position: "relative", width: "100%" }}>
              <AnimatePresence mode="popLayout">
                {modeRacik === "campur" ? (
                  <motion.div key="tab-campur" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25, ease: "easeInOut" }} style={{ width: "100%" }}>
                    <Box sx={{ textAlign: 'center', p: 3, bgcolor: '#fffde7', borderRadius: 4, border: `2px dashed ${COLORS.secondary}` }}>
                      <Stars sx={{ fontSize: 40, color: COLORS.secondary, mb: 1 }} />
                      <Typography variant="h6" fontWeight="900" color={COLORS.secondary}>Paket Anti Pusing!</Typography>
                      <Typography variant="body2" color="text.secondary" fontWeight="bold" mt={1}>
                        Isian sudah dimix otomatis:<br/><b>Sosis, Cumi, Kepiting, Keju, & Kornet.</b>
                      </Typography>
                    </Box>
                  </motion.div>
                ) : (
                  <motion.div key="tab-custom" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25, ease: "easeInOut" }} style={{ width: "100%" }}>
                    <Box>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="subtitle2" fontWeight="900" color={COLORS.textDark}>Pilih Maksimal 5 Isian:</Typography>
                        <Chip label={`${totalPilihan}/5`} color={totalPilihan >= 5 ? "error" : "primary"} size="small" sx={{ fontWeight: "bold", borderRadius: 2 }} />
                      </Box>
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
                        {VARIAN_ISIAN.map((item) => {
                          const isSelected = isian[item.id] > 0;
                          const isPremium = item.id === "gurita";
                          return (
                            <motion.div key={item.id} whileTap={{ scale: 0.95 }}>
                              <Card 
                                elevation={0} 
                                onClick={(e) => { e.stopPropagation(); toggleIsian(item.id); }} 
                                sx={{ bgcolor: isSelected ? (isPremium ? "#fffde7" : "#e8f5e9") : "#f8f9fa", border: isSelected ? `2px solid ${isPremium ? "#ffb300" : COLORS.success}` : "1px solid #ddd", borderRadius: 4, cursor: "pointer", p: 1.5, display: "flex", flexDirection: "column", alignItems: "center", transition: "all 0.2s" }}
                              >
                                <Typography variant="body1" fontWeight="900" sx={{ color: isSelected ? COLORS.textDark : "#757575", mb: 0.5 }}>{item.label}</Typography>
                                {isPremium ? <Chip label="Premium" size="small" sx={{ height: "18px", fontSize: "0.6rem", bgcolor: "#ffb300", color: "white", fontWeight: "bold" }} /> : <Typography variant="caption" color="text.secondary" fontWeight="bold">Biasa</Typography>}
                              </Card>
                            </motion.div>
                          );
                        })}
                      </Box>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            {/* PERBAIKAN 3: Semua elemen di bawahnya dibungkus motion.div layout agar meluncur elegan */}
            <motion.div layout transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <AnimatePresence>
                {isGuritaOnly() && (
                  <motion.div layout initial={{ height: 0, opacity: 0, marginTop: 0 }} animate={{ height: "auto", opacity: 1, marginTop: 24 }} exit={{ height: 0, opacity: 0, marginTop: 0 }} style={{ overflow: "hidden" }}>
                    <Alert icon={<Stars fontSize="inherit" />} severity="warning" sx={{ borderRadius: 3, bgcolor: "#fff8e1", border: "1px solid #ffe082", alignItems: "center" }}>
                      <Typography variant="caption" fontWeight="bold" color="warning.dark">Mantap! Pilihan <b>Khusus Gurita</b> menjadikan harga porsi ini <b>Rp 20.000</b>. (Jika dicampur isian lain, harga kembali normal 15rb).</Typography>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div layout>
                <Divider sx={{ my: 3, borderStyle: "dashed" }} />
              </motion.div>

              <motion.div layout>
                <Typography variant="subtitle2" fontWeight="900" color={COLORS.textDark} mb={2}>Tambahan & Saus (Gratis):</Typography>
              </motion.div>
              
              <Paper component={motion.div} layout elevation={0} sx={{ p: 2, border: "1px solid #ddd", borderRadius: 4, mb: 3, bgcolor: "#fafafa" }}>
                <FormControlLabel 
                  control={<Checkbox checked={pakeKatsuobushi} onChange={(e) => { setPakeKatsuobushi(e.target.checked); playTone("click"); }} color="warning" sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }} />} 
                  label={<Typography sx={{ fontSize: "0.95rem", fontWeight: "800", color: COLORS.textDark }}>Topping Katsuobushi (Ikan Serut)</Typography>} 
                  sx={{ m: 0, width: "100%", mb: 1 }} 
                />
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" mb={1.5}>Pilihan Saus (Boleh lebih dari satu):</Typography>
                  <Box sx={{ display: "flex", flexDirection: "column" }}>
                    {SAUS_LIST.map((saus) => (
                      <Box key={saus} sx={{ display: "flex", alignItems: "center", minHeight: "48px", borderBottom: "1px solid #eee" }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <FormControlLabel control={<Checkbox checked={sauses[saus]} onChange={() => { setSauses({ ...sauses, [saus]: !sauses[saus] }); playTone("click"); }} sx={{ color: COLORS.secondary, "&.Mui-checked": { color: COLORS.primary } }} />} label={<Typography sx={{ fontSize: "0.9rem", fontWeight: "700" }}>{saus}</Typography>} sx={{ m: 0 }} />
                        </Box>
                        <Box sx={{ minWidth: "110px", textAlign: "right" }}>
                          <AnimatePresence>
                            {sauses[saus] && (
                              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                                <FormControlLabel control={<Switch size="small" checked={sausesPisah[saus]} onChange={() => { setSausesPisah({ ...sausesPisah, [saus]: !sausesPisah[saus] }); playTone("click"); }} color="error" />} label={<Typography variant="caption" color="error" fontWeight="bold">Pisah Saus</Typography>} sx={{ m: 0 }} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Paper>

              <Box component={motion.div} layout sx={{ mt: 2, mb: 3, p: 2, bgcolor: COLORS.background, borderRadius: 3, border: `1px solid ${COLORS.primary}`, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold">Preview Nama Pesanan:</Typography>
                <Typography variant="h6" fontWeight="900" color={COLORS.primary}>{totalPilihan === 0 ? "Pilih isian di atas..." : generateSmartName(isian)}</Typography>
              </Box>

              <Box component={motion.div} layout display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={1.5}>
                 <Typography variant="body2" color="text.secondary" fontWeight="bold">Harga Porsi Ini:</Typography>
                 <Typography variant="h5" fontWeight="900" sx={{ color: "#d32f2f", whiteSpace: "nowrap" }}>Rp {hitungHargaPorsi().toLocaleString()}</Typography>
              </Box>

              <motion.div layout whileTap={{ scale: 0.97 }}>
                <Button fullWidth variant="contained" onClick={addTakoyakiToCart} disabled={totalPilihan === 0} sx={{ height: "60px", borderRadius: 4, bgcolor: COLORS.primary, fontSize: "1.1rem", fontWeight: "900", boxShadow: "0 8px 20px rgba(211, 47, 47, 0.25)" }}>
                  + MASUKKAN KE KERANJANG
                </Button>
              </motion.div>
            </motion.div>
          </Paper>
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
          <Paper elevation={0} sx={{ p: 3, mb: 4, borderRadius: 5, bgcolor: "white", borderTop: `4px solid ${COLORS.info}` }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} gap={1.5}>
              <Box>
                <Typography variant="subtitle1" fontWeight="900" color={COLORS.info} sx={{ display: "flex", alignItems: "center" }}>
                  <LocalDrink sx={{ mr: 1 }} /> Air Mineral
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Dingin / Biasa - Rp 5.000</Typography>
              </Box>
              <Box display="flex" alignItems="center" sx={{ bgcolor: "#f8f9fa", borderRadius: 3, border: `1px solid #ddd` }}>
                <IconButton onClick={() => { setQtyAir(Math.max(0, qtyAir - 1)); playTone("click"); }} disabled={qtyAir === 0}><Remove color="info" /></IconButton>
                <Typography fontWeight="900" fontSize="1.2rem" sx={{ mx: 1, width: "20px", textAlign: "center" }}>{qtyAir}</Typography>
                <IconButton onClick={() => { if (qtyAir < 10) { setQtyAir(qtyAir + 1); playTone("click"); } }} disabled={qtyAir >= 10}><Add color="info" /></IconButton>
              </Box>
            </Box>
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button fullWidth variant="contained" color="info" onClick={addDrinkToCart} disabled={qtyAir === 0} sx={{ height: "55px", borderRadius: 4, fontSize: "1rem", fontWeight: "900", boxShadow: "none" }}>
                + TAMBAH MINUMAN {qtyAir > 0 ? `(Rp ${(qtyAir * 5000).toLocaleString()})` : ""}
              </Button>
            </motion.div>
          </Paper>
        </motion.div>
        
        {cart.length > 0 && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
            <Box sx={{ p: 2.5, bgcolor: "#fffde7", borderRadius: 4, border: `2px dashed #ffd54f`, mb: 2 }}>
              <Typography variant="h6" fontWeight="900" color="text.primary" mb={2} display="flex" alignItems="center">
                🛒 Keranjang Pesanan
              </Typography>
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} style={{ marginBottom: "12px" }}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid #ddd", bgcolor: "white" }}>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1} gap={1.5}>
                        <Typography fontWeight="900" fontSize="1.05rem" color={COLORS.textDark} sx={{ lineHeight: 1.3 }}>{item.nama}</Typography>
                        <Typography fontWeight="900" sx={{ color: "#d32f2f", whiteSpace: "nowrap" }}>Rp {item.harga.toLocaleString()}</Typography>
                      </Box>
                      
                      {item.type === "food" && (
                        <Box display="flex" flexWrap="wrap" gap={0.75} mb={1}>
                          {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={{ height: "22px", fontSize: "0.7rem", bgcolor: getOldStyleColor("Katsuobushi"), color: "white", fontWeight: "bold" }} />}
                          {item.sauses?.map(s => <Chip key={s} label={`${s}${item.sausesPisah?.includes(s) ? " (PISAH)" : ""}`} size="small" sx={{ height: "22px", fontSize: "0.7rem", bgcolor: getOldStyleColor(s), color: "white", fontWeight: "bold" }} />)}
                        </Box>
                      )}
                      
                      <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />
                      
                      <Box display="flex" justifyContent="flex-end">
                        <IconButton onClick={() => removeFromCart(item.id)} sx={{ bgcolor: "#ffebee", borderRadius: 2, p: 1, color: "#d32f2f" }}>
                          <Delete />
                        </IconButton>
                      </Box>

                    </Paper>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              <Box textAlign="center" mt={2} px={1}>
                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1.4, display: "block" }}>
                   💡 Setelah menekan tombol pesan, kamu akan diarahkan ke halaman QRIS untuk pembayaran dan bisa melihat posisi antreanmu.
                </Typography>
              </Box>
            </Box>
          </motion.div>
        )}
      </Container>

      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
            <Box sx={{ bgcolor: "white", p: 2, borderTop: "1px solid #eee", boxShadow: "0px -4px 20px rgba(0,0,0,0.08)", pb: "env(safe-area-inset-bottom, 16px)" }}>
              <Container maxWidth="sm" sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 0, gap: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">Total Bayar</Typography>
                  <Typography variant="h5" fontWeight="900" sx={{ color: "#d32f2f", whiteSpace: "nowrap" }}>Rp {totalCartPrice.toLocaleString()}</Typography>
                </Box>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button variant="contained" onClick={kirimPesanan} endIcon={<Send />} sx={{ height: "55px", px: 4, borderRadius: 3, bgcolor: "black", color: "white", fontSize: "1.1rem", fontWeight: "900", '&:hover': { bgcolor: "#333" } }}>
                    PESAN
                  </Button>
                </motion.div>
              </Container>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
      
    </Box>
  );
}