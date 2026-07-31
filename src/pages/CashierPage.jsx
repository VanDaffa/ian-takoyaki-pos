import React, { useState, useRef, useEffect } from "react";
import {
  Box, Typography, Card, Button, IconButton, Chip, Stack, Divider, Paper,
  Checkbox, FormControlLabel, Collapse, CardActionArea, Snackbar, Alert, TextField,
  List, Dialog, DialogTitle, DialogActions, DialogContent, DialogContentText, Switch, useMediaQuery, useTheme,
  Menu, MenuItem, ListItemIcon, ListItemText, CssBaseline
} from "@mui/material";
import {
  Add, Remove, Restaurant, CheckCircle, AttachMoney, Kitchen,
  Person, Delete, RestartAlt, ShoppingBasket, ContentCopy, Edit, MoneyOff, SaveAs, LocalDrink, Logout, Store, MoreVert
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import { COLORS, VARIAN_ISIAN, SAUS_LIST } from "../utils/constants";
import { formatName, generateSmartName, getSauceColor } from "../utils/helpers";
import { playTone } from "../utils/soundEngine";

import { db, auth } from "../utils/firebase";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, setDoc, doc, serverTimestamp } from "firebase/firestore";

export default function CashierPage() {
  const [isian, setIsian] = useState({});
  const [sauses, setSauses] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [sausesPisah, setSausesPisah] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [pakeKatsuobushi, setPakeKatsuobushi] = useState(false);
  const [isCampurMode, setIsCampurMode] = useState(false);
  const [qtyAir, setQtyAir] = useState(0);
  const [nomorAntrian, setNomorAntrian] = useState(1);
  const [namaPelanggan, setNamaPelanggan] = useState("");

  const [tempCart, setTempCart] = useState([]);
  const [masterQueue, setMasterQueue] = useState([]);
  const [editingCartId, setEditingCartId] = useState(null);

  const [isShopOpen, setIsShopOpen] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({ open: false, noAntrian: null, docId: null });
  const [cancelDialog, setCancelDialog] = useState({ open: false, noAntrian: null, docId: null, hasCookedItems: false });
  
  const [expandedAntrian, setExpandedAntrian] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  const totalPilihan = Object.values(isian).filter((val) => val > 0).length;
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const bottomRef = useRef(null);

  const getJamSekarang = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  
  const isGlobalEditMode = tempCart.some((item) => item.targetAntrian);
  const getTargetQueueNumber = () => isGlobalEditMode ? tempCart.find((item) => item.targetAntrian).targetAntrian : nomorAntrian;
  const globalEditingDocId = tempCart.find((item) => item.docId)?.docId || null;

  const getDisplayNama = () => {
    if (isGlobalEditMode) return tempCart.find((item) => item.targetAntrian).targetNama;
    return namaPelanggan.trim() === "" ? `Pelanggan #${nomorAntrian}` : namaPelanggan;
  };

  useEffect(() => {
    if (!isShopOpen) return;
    const interval = setInterval(async () => {
      await setDoc(doc(db, "settings", "shop"), { 
        isOpen: true,
        lastActive: serverTimestamp() 
      }, { merge: true });
    }, 60000); 
    return () => clearInterval(interval);
  }, [isShopOpen]);

  useEffect(() => {
    const unsubShop = onSnapshot(doc(db, "settings", "shop"), (docSnap) => {
      if (docSnap.exists()) {
        setIsShopOpen(docSnap.data().isOpen);
      }
    });
    return () => unsubShop();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flatItems = [];
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.statusPesanan === "selesai" || data.statusPesanan === "batal") return;
        
        data.items.forEach((item) => {
          flatItems.push({
            ...item, docId: doc.id, noAntrian: data.noAntrian, namaPemesan: data.namaPemesan, jamMasuk: data.jamMasuk, statusBayar: data.statusBayar, createdAt: data.createdAt
          });
        });
      });
      setMasterQueue(flatItems);
    });
    return () => unsubscribe();
  }, []);

  const masterQueueRef = useRef([]);
  useEffect(() => {
    masterQueueRef.current = masterQueue;
  }, [masterQueue]);

  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = new Date();
      const currentQueue = masterQueueRef.current;
      const onlineGroups = {};
      
      currentQueue.forEach(item => {
        if (item.noAntrian === "Online" && item.createdAt && typeof item.createdAt.toDate === 'function') {
          onlineGroups[item.docId] = item.createdAt.toDate();
        }
      });

      Object.keys(onlineGroups).forEach(async (docId) => {
        const orderTime = onlineGroups[docId];
        const diffMins = (now - orderTime) / 1000 / 60;
        if (diffMins >= 15) {
          try {
            await updateDoc(doc(db, "orders", docId), { statusPesanan: "batal" });
          } catch (error) {
            console.error("Gagal membatalkan pesanan expired:", error);
          }
        }
      });
    }, 60000); 

    return () => clearInterval(cleanupInterval);
  }, []);

  const handleToggleShop = async () => {
    playTone("click");
    await setDoc(doc(db, "settings", "shop"), { isOpen: !isShopOpen }, { merge: true });
    setSnackbar({ open: true, message: `Status Kedai diubah menjadi: ${!isShopOpen ? "BUKA 🟢" : "TUTUP 🔴"}`, severity: "info" });
  };

  const toggleIsian = (id) => {
    if (isCampurMode) setIsCampurMode(false);
    const isSelected = isian[id] > 0;
    if (isSelected) {
      setIsian({ ...isian, [id]: 0 }); playTone("click");
    } else {
      if (totalPilihan >= 5) { setSnackbar({ open: true, message: "Maksimal 5 isian berbeda!", severity: "warning" }); return; }
      setIsian({ ...isian, [id]: 1 }); playTone("click");
    }
  };

  const setPaketCampur = () => {
    setIsian({ sosis: 1, cumi: 1, kepiting: 1, keju: 1, kornet: 1, gurita: 0 });
    setIsCampurMode(true); playTone("click");
  };

  const handleSausChange = (saus) => {
    const newState = !sauses[saus]; setSauses({ ...sauses, [saus]: newState });
    if (!newState) setSausesPisah({ ...sausesPisah, [saus]: false }); playTone("click");
  };

  const handleSausPisahChange = (saus) => { setSausesPisah({ ...sausesPisah, [saus]: !sausesPisah[saus] }); playTone("click"); };

  const toggleSemuaSaus = () => {
    const allSelected = Object.values(sauses).every((val) => val === true);
    setSauses({ "Saus Sambel": !allSelected, "Saus Tomat": !allSelected, Mayonaise: !allSelected });
    if (allSelected) setSausesPisah({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    playTone("click");
  };

  const clearTakoyakiForm = () => {
    setIsian({}); setSauses({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setSausesPisah({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setPakeKatsuobushi(false); setIsCampurMode(false); playTone("delete");
  };

  const cancelEditMode = () => {
    clearTakoyakiForm();
    setEditingCartId(null);
    setQtyAir(0);
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

  const handleTakoyakiCartAction = () => {
    const targetAntrian = tempCart.find(t => t.targetAntrian)?.targetAntrian || null;
    const targetNama = tempCart.find(t => t.targetAntrian)?.targetNama || null;
    const targetDocId = tempCart.find(t => t.docId)?.docId || null;

    if (editingCartId && tempCart.find(i => i.id === editingCartId)?.type === "food") {
      setTempCart(tempCart.map(item => item.id === editingCartId ? { ...item, nama: generateSmartName(isian), detail: isian, sauses: Object.keys(sauses).filter(k => sauses[k]), sausesPisah: Object.keys(sausesPisah).filter(k => sausesPisah[k]), katsuobushi: pakeKatsuobushi, harga: hitungHargaPorsi() } : item));
      cancelEditMode(); setSnackbar({ open: true, message: "Takoyaki berhasil diperbarui!", severity: "success" }); playTone("success"); return;
    }

    if (totalPilihan > 0) {
      setTempCart([...tempCart, { id: Date.now(), nama: generateSmartName(isian), type: "food", qty: 1, detail: isian, sauses: Object.keys(sauses).filter(k => sauses[k]), sausesPisah: Object.keys(sausesPisah).filter(k => sausesPisah[k]), katsuobushi: pakeKatsuobushi, harga: hitungHargaPorsi(), targetAntrian, targetNama, docId: targetDocId }]);
      cancelEditMode(); playTone("success"); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const handleDrinkCartAction = () => {
    const targetAntrian = tempCart.find(t => t.targetAntrian)?.targetAntrian || null;
    const targetNama = tempCart.find(t => t.targetAntrian)?.targetNama || null;
    const targetDocId = tempCart.find(t => t.docId)?.docId || null;

    if (editingCartId && tempCart.find(i => i.id === editingCartId)?.type === "drink") {
      setTempCart(tempCart.map(item => item.id === editingCartId ? { ...item, qty: qtyAir, nama: `Air Mineral (${qtyAir}x)`, harga: 5000 * qtyAir } : item));
      cancelEditMode(); setSnackbar({ open: true, message: "Minuman berhasil diperbarui!", severity: "success" }); playTone("success"); return;
    }

    if (qtyAir > 0) {
      const existingIdx = tempCart.findIndex(item => item.type === "drink" && !editingCartId);
      if (existingIdx !== -1) {
        const updated = [...tempCart]; updated[existingIdx].qty += qtyAir;
        updated[existingIdx].nama = `Air Mineral (${updated[existingIdx].qty}x)`; updated[existingIdx].harga = 5000 * updated[existingIdx].qty; setTempCart(updated);
      } else {
        setTempCart([...tempCart, { id: Date.now(), nama: `Air Mineral (${qtyAir}x)`, type: "drink", qty: qtyAir, harga: 5000 * qtyAir, detail: {}, sauses: [], sausesPisah: [], targetAntrian, targetNama, docId: targetDocId }]);
      }
      cancelEditMode(); playTone("success"); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const duplicateItem = (originalItem) => {
    const newItem = { ...originalItem, id: Date.now() };
    if (originalItem.type === "drink") {
      const existingIdx = tempCart.findIndex((item) => item.type === "drink");
      const updatedCart = [...tempCart]; updatedCart[existingIdx].qty += originalItem.qty;
      updatedCart[existingIdx].nama = `Air Mineral (${updatedCart[existingIdx].qty}x)`; updatedCart[existingIdx].harga = 5000 * updatedCart[existingIdx].qty; setTempCart(updatedCart);
    } else { setTempCart([...tempCart, newItem]); }
    playTone("success");
  };

  const hapusDariTemp = (id) => {
    if (isGlobalEditMode && tempCart.length === 1) {
      setSnackbar({ open: true, message: "⚠️ Ditolak: Pesanan yang diubah tidak boleh kosong. Batalkan dari antrean kiri jika ingin menghapus total.", severity: "error" });
      playTone("delete");
      return;
    }
    setTempCart(tempCart.filter((item) => item.id !== id));
    if (editingCartId === id) { cancelEditMode(); } playTone("delete");
  };

  const prosesPesananFinal = async () => {
    if (tempCart.length === 0) return;
    const isEditMode = tempCart.some((item) => item.targetAntrian);
    const finalNoAntrian = isEditMode ? tempCart.find((item) => item.targetAntrian).targetAntrian : nomorAntrian;

    let rawNama = isEditMode ? tempCart.find((item) => item.targetAntrian).targetNama : namaPelanggan;
    if (!isEditMode && rawNama.trim() === "") rawNama = `Pelanggan #${nomorAntrian}`;
    const finalNamaPemesan = formatName(rawNama);

    const cleanItems = tempCart.map((draft) => ({
      id: draft.id, nama: draft.nama, type: draft.type, qty: draft.qty,
      detail: draft.detail || {}, sauses: draft.sauses || [], sausesPisah: draft.sausesPisah || [],
      katsuobushi: draft.katsuobushi || false, harga: draft.harga, statusMasak: "dibuat"
    }));

    if (isEditMode) {
      const targetDocId = tempCart.find((item) => item.docId)?.docId;
      if (targetDocId) {
        await updateDoc(doc(db, "orders", targetDocId), { 
          namaPemesan: finalNamaPemesan, 
          items: cleanItems, 
          totalTagihan: tempCart.reduce((a, b) => a + b.harga, 0) 
        });
      }
    } else {
      await addDoc(collection(db, "orders"), {
        noAntrian: finalNoAntrian, namaPemesan: finalNamaPemesan, jamMasuk: getJamSekarang(),
        statusBayar: "belum", statusPesanan: "antre", items: cleanItems, totalTagihan: tempCart.reduce((a, b) => a + b.harga, 0), createdAt: serverTimestamp()
      });
      setNomorAntrian((prev) => prev + 1); setNamaPelanggan("");
    }
    setTempCart([]); setExpandedAntrian(null); cancelEditMode(); playTone("success");
  };

  const groupedOrders = masterQueue.reduce((acc, item) => {
    if (!acc[item.docId]) { acc[item.docId] = { docId: item.docId, noAntrian: item.noAntrian, namaPemesan: item.namaPemesan, jamMasuk: item.jamMasuk, statusBayar: item.statusBayar, createdAt: item.createdAt, items: [], totalTagihan: 0 }; }
    acc[item.docId].items.push(item); acc[item.docId].totalTagihan += item.harga; return acc;
  }, {});
  
  const sortedGroups = Object.values(groupedOrders).sort((a, b) => { 
    if (a.noAntrian === "Online" && b.noAntrian !== "Online") return -1; 
    if (b.noAntrian === "Online" && a.noAntrian !== "Online") return 1; 
    if (a.noAntrian === "Online" && b.noAntrian === "Online") return 0;
    return a.noAntrian - b.noAntrian; 
  });

  const toggleStatusMasakItem = async (item) => {
    playTone("click");
    const orderGroup = masterQueue.filter(p => p.docId === item.docId);
    const updatedItems = orderGroup.map(p => { const isTarget = p.id === item.id; return { ...p, statusMasak: isTarget ? (p.statusMasak === "selesai" ? "dibuat" : "selesai") : p.statusMasak }; });
    await updateDoc(doc(db, "orders", item.docId), { items: updatedItems });
  };

  const handleBayarLunasGroup = async (noAntrian, docId) => {
    const groupItems = masterQueue.filter((p) => p.docId === docId);
    const isCurrentlyLunas = groupItems.every((p) => p.statusBayar === "lunas");
    const newStatus = isCurrentlyLunas ? "belum" : "lunas";
    await updateDoc(doc(db, "orders", docId), { statusBayar: newStatus });
    if (newStatus === "lunas") { setSnackbar({ open: true, message: "Pembayaran LUNAS! ✅", severity: "success" }); playTone("success");
    } else { setSnackbar({ open: true, message: "Status Pembayaran Dibatalkan ❌", severity: "info" }); playTone("click"); }
  };

  const editPesananFullBatch = async (noAntrian, namaPemesan, docId) => {
    if (tempCart.length > 0) {
      setSnackbar({ open: true, message: "Selesaikan perubahan pesanan yang ada di keranjang dulu!", severity: "warning" });
      playTone("delete"); return;
    }
    const itemsToEdit = masterQueue.filter((item) => item.docId === docId);
    const draftItems = itemsToEdit.map((item) => ({ ...item, targetAntrian: noAntrian, targetNama: namaPemesan, docId: docId }));
    setTempCart(draftItems);
    setExpandedAntrian(docId);
    setSnackbar({ open: true, message: `Pesanan #${noAntrian} siap diubah!`, severity: "info" });
  };

  const requestFinishOrder = (noAntrian, docId) => {
    const groupItems = masterQueue.filter((p) => p.docId === docId);
    const isLunas = groupItems.every((p) => p.statusBayar === "lunas");
    if (!isLunas) { setSnackbar({ open: true, message: "⚠️ Tagih dulu bos! Belum Lunas.", severity: "warning" }); playTone("delete"); return; }
    setConfirmDialog({ open: true, noAntrian: noAntrian, docId: docId });
  };

  const executeFinishOrder = async () => {
    if (confirmDialog.docId) { 
      await updateDoc(doc(db, "orders", confirmDialog.docId), { statusPesanan: "selesai" }); 
      playTone("success"); 
      setSnackbar({ open: true, message: "Pesanan Selesai Disajikan!", severity: "success" }); 
    }
    setConfirmDialog({ open: false, noAntrian: null, docId: null });
  };

  const requestCancelOrder = (noAntrian, docId) => {
    const groupItems = masterQueue.filter((p) => p.docId === docId);
    const hasCookedItems = groupItems.some((p) => p.statusMasak === "selesai");
    setCancelDialog({ open: true, noAntrian, docId, hasCookedItems });
    playTone("delete");
  };

  const executeCancelOrder = async () => {
    if (cancelDialog.docId) { 
      await updateDoc(doc(db, "orders", cancelDialog.docId), { statusPesanan: "batal" }); 
      playTone("delete"); 
      setSnackbar({ open: true, message: `Pesanan dari ${cancelDialog.noAntrian === "Online" ? "Online" : "#" + cancelDialog.noAntrian} Dibatalkan!`, severity: "error" }); 
    }
    setCancelDialog({ open: false, noAntrian: null, docId: null, hasCookedItems: false });
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

  const isEditingFood = editingCartId && tempCart.find(i => i.id === editingCartId)?.type === "food";
  const isEditingDrink = editingCartId && tempCart.find(i => i.id === editingCartId)?.type === "drink";

  return (
    <Box sx={{ display: "flex", flexDirection: isMobile ? "column" : "row", height: "100vh", width: "100vw", overflow: "hidden", bgcolor: COLORS.background }}>
      <CssBaseline />

      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%", fontWeight: "bold" }}>{snackbar.message}</Alert>
      </Snackbar>

      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, noAntrian: null, docId: null })} PaperProps={{ sx: { borderRadius: 4, p: 1, minWidth: "300px" } }}>
        <DialogTitle sx={{ fontWeight: "bold", textAlign: "center", fontSize: "1.2rem", color: COLORS.primary }}>Selesaikan Pesanan #{confirmDialog.noAntrian}?</DialogTitle>
        <DialogContent><DialogContentText sx={{ textAlign: "center", fontWeight: "bold" }}>Pastikan pesanan sudah diberikan ke pelanggan.</DialogContentText></DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, mb: 1 }}>
          <Button onClick={() => setConfirmDialog({ open: false, noAntrian: null, docId: null })} color="inherit" variant="outlined" sx={{ borderRadius: 3, px: 3, fontWeight: "bold", textTransform: "none" }}>Batal</Button>
          <Button onClick={executeFinishOrder} variant="contained" autoFocus sx={{ borderRadius: 3, px: 4, bgcolor: COLORS.secondary, fontWeight: "bold", textTransform: "none" }}>Ya, Selesai</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelDialog.open} onClose={() => setCancelDialog({ open: false, noAntrian: null, docId: null, hasCookedItems: false })} PaperProps={{ sx: { borderRadius: 4, p: 1, minWidth: "300px" } }}>
        <DialogTitle sx={{ fontWeight: "bold", textAlign: "center", fontSize: "1.2rem", color: "error.main" }}>Batalkan Pesanan {cancelDialog.noAntrian === "Online" ? "Online" : "#" + cancelDialog.noAntrian}?</DialogTitle>
        <DialogContent>
          {cancelDialog.hasCookedItems ? (
            <DialogContentText sx={{ textAlign: "center", fontWeight: "bold", color: "error.main" }}>
              ⚠️ PERINGATAN: Beberapa item sudah dimasak! Makanan berpotensi terbuang. Tetap batalkan transaksi?
            </DialogContentText>
          ) : (
            <DialogContentText sx={{ textAlign: "center", fontWeight: "bold" }}>
              Apakah Anda yakin ingin membatalkan dan menghapus pesanan ini dari antrean?
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, mb: 1 }}>
          <Button onClick={() => setCancelDialog({ open: false, noAntrian: null, docId: null, hasCookedItems: false })} color="inherit" variant="outlined" sx={{ borderRadius: 3, px: 3, fontWeight: "bold", textTransform: "none" }}>Kembali</Button>
          <Button onClick={executeCancelOrder} variant="contained" color="error" autoFocus sx={{ borderRadius: 3, px: 4, fontWeight: "bold", textTransform: "none" }}>Ya, Batalkan</Button>
        </DialogActions>
      </Dialog>

      {/* --- KIRI: KDS --- */}
      <Box sx={{ width: isMobile ? "100%" : "45%", minWidth: isMobile ? "100%" : "480px", flexShrink: 0, height: isMobile ? "40%" : "100%", bgcolor: "white", borderRight: "2px solid #ffccbc", display: "flex", flexDirection: "column", zIndex: 2, boxShadow: "4px 0 15px rgba(211, 47, 47, 0.1)" }}>
        <Box sx={{ p: 2.5, bgcolor: COLORS.primary, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <Typography variant="h5" fontWeight="bold">Daftar Pesanan</Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body1" sx={{ bgcolor: "rgba(0,0,0,0.2)", px: 2, py: 0.5, borderRadius: 2, fontWeight: "bold" }}>
              Antrean: {sortedGroups.length}
            </Typography>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} color="inherit" size="small" sx={{ bgcolor: "rgba(255,255,255,0.15)" }}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)} PaperProps={{ sx: { borderRadius: 3, minWidth: 220, mt: 1, boxShadow: "0px 4px 20px rgba(0,0,0,0.1)" } }}>
          <MenuItem onClick={() => { handleToggleShop(); setMenuAnchor(null); }} sx={{ py: 1.5 }}>
            <ListItemIcon><Store fontSize="small" color={isShopOpen ? "success" : "error"} /></ListItemIcon>
            <ListItemText primary={`Status Kedai: ${isShopOpen ? "BUKA" : "TUTUP"}`} primaryTypographyProps={{ fontWeight: "bold", color: isShopOpen ? "success.main" : "error.main" }} />
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem onClick={async () => { 
            await setDoc(doc(db, "settings", "shop"), { isOpen: false }, { merge: true });
            signOut(auth); 
            setMenuAnchor(null); 
          }} sx={{ py: 1.5 }}>
            <ListItemIcon><Logout fontSize="small" color="error" /></ListItemIcon>
            <ListItemText primary="Logout Kasir" primaryTypographyProps={{ fontWeight: "bold", color: "error.main" }} />
          </MenuItem>
        </Menu>
        
        <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2, bgcolor: "#fff3e0" }}>
          {sortedGroups.length === 0 ? (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100%" opacity={0.6}>
              <Restaurant sx={{ fontSize: 100, mb: 2, color: COLORS.secondary }} />
              <Typography variant="h5" color={COLORS.primary} fontWeight="bold">Dapur Kosong</Typography>
              <Typography variant="h6" color="text.secondary">Siap menerima pesanan baru!</Typography>
            </Box>
          ) : (
            <Stack spacing={2} component={motion.div} layout>
              <AnimatePresence>
                {sortedGroups.map((group) => {
                  const isAllLunas = group.items.every((i) => i.statusBayar === "lunas");
                  const isAllCooked = group.items.length > 0 && group.items.every((i) => i.statusMasak === "selesai");
                  
                  const showEditBtn = !isAllLunas && isShopOpen && !isAllCooked;
                  const showSelesaiBtn = isAllLunas;

                  const isExpanded = expandedAntrian === group.docId;
                  const isOnlineOrder = group.noAntrian === "Online";
                  
                  // Hitung Sisa Waktu untuk Peringatan di UI Kasir
                  let diffMins = 0;
                  if (isOnlineOrder && group.createdAt && typeof group.createdAt.toDate === 'function') {
                    diffMins = Math.floor((new Date() - group.createdAt.toDate()) / 1000 / 60);
                  }
                  const minsLeft = 15 - diffMins;
                  const isWarningTime = minsLeft <= 5;
                  
                  const isThisGroupBeingEdited = globalEditingDocId === group.docId;
                  const isAnotherGroupBeingEdited = globalEditingDocId && globalEditingDocId !== group.docId;

                  return (
                    <motion.div key={group.docId} layout initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -50 }}>
                      <Card elevation={3} sx={{ 
                        borderRadius: 3, 
                        border: isThisGroupBeingEdited ? `3px dashed orange` : isOnlineOrder ? `2px dashed ${COLORS.info}` : isAllLunas ? `2px solid ${COLORS.success}` : `2px solid ${COLORS.primary}`, 
                        bgcolor: isThisGroupBeingEdited ? "#fff8e1" : isOnlineOrder ? "#e3f2fd" : isAllLunas ? "#e8f5e9" : "white", 
                        transition: "all 0.3s",
                        opacity: isAnotherGroupBeingEdited ? 0.4 : 1, 
                        pointerEvents: isAnotherGroupBeingEdited ? "none" : "auto"
                      }}>
                        <CardActionArea onClick={() => setExpandedAntrian(isExpanded ? null : group.docId)} sx={{ p: 2.5 }}>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Box display="flex" alignItems="center" gap={1.5} mb={0.5}>
                                <Chip label={isOnlineOrder ? "ONLINE" : "#" + group.noAntrian} color={isOnlineOrder ? "info" : "primary"} sx={{ fontWeight: "bold", fontSize: "1.1rem", height: "32px" }} />
                                <Typography variant="h5" fontWeight="bold" color={COLORS.textDark}>{group.namaPemesan}</Typography>
                                {isThisGroupBeingEdited && <Chip label="SEDANG DIUBAH ✏️" size="small" sx={{ bgcolor: "orange", color: "white", fontWeight: "bold" }} />}
                              </Box>
                              
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body1" color={COLORS.textGrey} fontWeight="bold">{group.items.length} Item • {group.jamMasuk}</Typography>
                                {isOnlineOrder && (
                                  <Chip 
                                    label={minsLeft > 0 ? `Sisa: ${minsLeft} mnt` : "Kedaluwarsa"} 
                                    size="small" 
                                    color={isWarningTime ? "error" : "warning"} 
                                    sx={{ fontWeight: "bold", height: "20px", fontSize: "0.7rem" }} 
                                  />
                                )}
                              </Box>
                            </Box>
                            <Box textAlign="right">
                              <Typography variant="h5" fontWeight="bold" color={COLORS.primary}>Rp {group.totalTagihan.toLocaleString()}</Typography>
                              {isAllLunas && !isOnlineOrder && <Typography variant="body2" fontWeight="bold" color={COLORS.success}>LUNAS ✅</Typography>}
                              {isOnlineOrder && <Typography variant="body2" fontWeight="bold" color={COLORS.info}>Menunggu Konfirmasi</Typography>}
                            </Box>
                          </Box>
                          {!isExpanded && (
                            <Box sx={{ mt: 1.5, bgcolor: "rgba(0,0,0,0.04)", p: 1, borderRadius: 2 }}>
                              {group.items.map((item, idx) => (
                                <Box key={idx} sx={{ mb: 0.5 }}>
                                  <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.3 }}>• <b>{item.qty}x</b> {item.nama}</Typography>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </CardActionArea>
                        
                        <Collapse in={isExpanded} unmountOnExit>
                          <Box sx={{ bgcolor: "#fff" }}>
                            {group.items.map((item) => (
                              <Box key={item.id} sx={{ p: 2, borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", bgcolor: item.statusMasak === "selesai" ? "#f1f8e9" : "white" }}>
                                <Box sx={{ flexGrow: 1 }}>
                                  <Typography variant="h6" fontWeight="bold" sx={{ fontSize: "1.15rem", textDecoration: item.statusMasak === "selesai" ? "line-through" : "none", color: item.statusMasak === "selesai" ? "grey" : "black", mb: 0.5 }}>{item.nama}</Typography>
                                  {item.type === "food" && (
                                    <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                                      {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={{ bgcolor: COLORS.warning, color: "white", fontWeight: "bold", fontSize: "0.7rem", height: "24px" }} />}
                                      {(!item.sauses || item.sauses.length === 0) && <Chip label="Tanpa Saus" size="small" variant="outlined" sx={{ fontSize: "0.7rem", height: "24px", color: "text.secondary", borderColor: "#ddd" }} />}
                                      {renderSauceChips(item.sauses, item.sausesPisah)}
                                    </Box>
                                  )}
                                </Box>
                                <Box display="flex" gap={1} alignItems="center">
                                  <IconButton onClick={() => toggleStatusMasakItem(item)} color={item.statusMasak === "selesai" ? "success" : "default"}><CheckCircle sx={{ fontSize: 32 }} /></IconButton>
                                </Box>
                              </Box>
                            ))}
                            
                            <Box sx={{ p: 2, bgcolor: "#fafafa", borderTop: "2px dashed #eee", display: "flex", flexDirection: "column", gap: 1 }}>
                              {isThisGroupBeingEdited ? (
                                <Typography variant="subtitle1" color="warning.main" fontWeight="bold" sx={{ width: "100%", textAlign: "center", py: 1.5, bgcolor: "#fff3e0", borderRadius: 2 }}>
                                  ✏️ Selesaikan perubahan pesanan ini di Keranjang Kanan 👉
                                </Typography>
                              ) : isOnlineOrder ? (
                                <Box display="flex" gap={1}>
                                  <Button fullWidth variant="outlined" color="error" size="large" onClick={() => requestCancelOrder(group.noAntrian, group.docId)} startIcon={<Delete />} sx={{ fontWeight: "bold" }}>TOLAK PESANAN</Button>
                                  <Button fullWidth variant="contained" size="large" color="info" onClick={async () => { playTone("success"); await updateDoc(doc(db, "orders", group.docId), { noAntrian: nomorAntrian }); setNomorAntrian(prev => prev + 1); setSnackbar({ open: true, message: `Pesanan diterima sebagai Antrean #${nomorAntrian}! 🐙`, severity: "success" }); }} sx={{ fontWeight: "bold" }}>TERIMA PESANAN</Button>
                                </Box>
                              ) : (
                                <Box display="flex" flexDirection="column" gap={1} width="100%" component={motion.div} layout>
                                  <Box display="flex" gap={1} width="100%" component={motion.div} layout>
                                    <AnimatePresence>
                                      {showEditBtn && (
                                        <motion.div key="btn-ubah" layout initial={{ opacity: 0, flex: 0 }} animate={{ opacity: 1, flex: 1 }} exit={{ opacity: 0, flex: 0 }} style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                                          <Button fullWidth variant="outlined" size="large" onClick={() => editPesananFullBatch(group.noAntrian, group.namaPemesan, group.docId)} startIcon={<Edit />} sx={{ color: COLORS.textDark, borderColor: COLORS.textDark, fontWeight: "bold" }}>UBAH SEMUA</Button>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                    <motion.div layout style={{ flex: 1 }}>
                                      <Button fullWidth variant="outlined" color="error" size="large" onClick={() => requestCancelOrder(group.noAntrian, group.docId)} startIcon={<Delete />} sx={{ fontWeight: "bold" }}>BATALKAN</Button>
                                    </motion.div>
                                  </Box>
                                  
                                  <Box display="flex" gap={1} width="100%" component={motion.div} layout>
                                    <motion.div layout style={{ flex: 1 }}>
                                      <Button fullWidth variant="contained" size="large" color={isAllLunas ? "success" : "error"} onClick={() => handleBayarLunasGroup(group.noAntrian, group.docId)} startIcon={isAllLunas ? <MoneyOff /> : <AttachMoney />} sx={{ fontSize: "1rem", fontWeight: "bold" }}>{isAllLunas ? "BATAL LUNAS" : "BAYAR SEMUA"}</Button>
                                    </motion.div>
                                    <AnimatePresence>
                                      {showSelesaiBtn && (
                                        <motion.div key="btn-selesai" layout initial={{ opacity: 0, flex: 0 }} animate={{ opacity: 1, flex: 1 }} exit={{ opacity: 0, flex: 0 }} style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                                          <Button fullWidth variant="contained" size="large" sx={{ bgcolor: COLORS.secondary, color: "white", fontSize: "1rem", fontWeight: "bold" }} onClick={() => requestFinishOrder(group.noAntrian, group.docId)} startIcon={<Kitchen />}>SELESAI</Button>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </Collapse>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </Stack>
          )}
        </Box>
      </Box>

      {/* --- KANAN: INPUT & KERANJANG KASIR --- */}
      <Box sx={{ flexGrow: 1, height: isMobile ? "60%" : "100%", overflowY: "auto", p: isMobile ? 2 : 4, bgcolor: COLORS.background }}>
        <Typography variant="h5" fontWeight="bold" color={COLORS.textDark} sx={{ mb: 2, display: "flex", alignItems: "center" }}>🐙 {isGlobalEditMode ? `Ubah Pesanan #${getTargetQueueNumber()}` : "Buat Pesanan Baru"}</Typography>
        
        {!isShopOpen && (
          <Alert severity="warning" variant="filled" sx={{ mb: 3, fontWeight: "bold", borderRadius: 3, boxShadow: "0px 4px 10px rgba(0,0,0,0.05)" }}>
            ⚠️ KEDAI SEDANG TUTUP! Buka status kedai melalui menu titik tiga di pojok kiri atas untuk dapat menginput pesanan secara langsung di kasir.
          </Alert>
        )}

        <Box sx={{ opacity: isShopOpen ? 1 : 0.4, pointerEvents: isShopOpen ? "auto" : "none", transition: "all 0.3s ease" }}>
          
          <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, borderTop: `4px solid ${COLORS.success}`, bgcolor: "white" }}>
            <Typography variant="h6" fontWeight="bold" color={COLORS.success} sx={{ display: "flex", alignItems: "center", mb: 2 }}><Person sx={{ mr: 1 }} /> Data Pelanggan</Typography>
            <TextField fullWidth label="Nama Pelanggan (Opsional)" variant="outlined" value={isGlobalEditMode ? getDisplayNama() : namaPelanggan} onChange={(e) => setNamaPelanggan(e.target.value)} placeholder={`Pelanggan #${getTargetQueueNumber()}`} disabled={isGlobalEditMode} InputLabelProps={{ style: { fontSize: "1.2rem" } }} InputProps={{ style: { fontSize: "1.3rem" } }} />
            <Typography variant="body2" sx={{ mt: 1, display: "block", color: COLORS.success, fontWeight: "bold" }}>*Mengisi untuk Antrean #{getTargetQueueNumber()}</Typography>
          </Paper>

          {editingCartId && <Alert severity="info" sx={{ mb: 2, fontWeight: "bold" }} onClose={cancelEditMode}>Sedang mengubah rincian dari Keranjang... (Klik X untuk Batal)</Alert>}

          <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 4, bgcolor: "white", borderTop: `4px solid ${COLORS.primary}`, opacity: isEditingDrink ? 0.5 : 1, pointerEvents: isEditingDrink ? "none" : "auto" }}>
            <Typography variant="h6" fontWeight="bold" color={COLORS.textDark} sx={{ display: "flex", alignItems: "center", mb: 2 }}><Restaurant sx={{ mr: 1 }} /> Menu Takoyaki</Typography>
            
            {/* PERBAIKAN: Memindahkan tombol Paket Campur ke sebaris dengan Kosongkan untuk UX yang lebih ringkas */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="subtitle1" fontWeight="bold">Racik Isian:</Typography>
                <Chip label={`${totalPilihan}/5`} color={totalPilihan >= 5 ? "error" : "default"} size="small" sx={{ fontWeight: "bold" }} />
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button size="small" variant="contained" onClick={setPaketCampur} sx={{ bgcolor: COLORS.secondary, color: "white", fontWeight: "bold", borderRadius: 1.5, px: 2, boxShadow: "none" }}>
                    PILIH CAMPUR
                  </Button>
                </motion.div>
                <Button size="small" color="error" startIcon={<RestartAlt />} onClick={clearTakoyakiForm} sx={{ textTransform: "none", fontWeight: "bold" }}>Kosongkan</Button>
              </Box>
            </Box>
            
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
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">Pilih Saus:</Typography>
                <Button size="small" variant="outlined" onClick={toggleSemuaSaus} sx={{ fontWeight: "bold", fontSize: "0.8rem", height: "30px", textTransform: "none" }}>
                  {Object.values(sauses).every((val) => val === true) ? "Hapus Semua" : "Pilih Semua"}
                </Button>
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1 }}>
                {SAUS_LIST.map((saus) => (
                  <Box key={saus} sx={{ border: sauses[saus] ? `2px solid ${COLORS.primary}` : "1px solid #ddd", borderRadius: 2, p: 0.5, bgcolor: sauses[saus] ? "#ffebee" : "transparent", minHeight: "85px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease", width: "100%", boxSizing: "border-box" }}>
                    <Box display="flex" alignItems="center" justifyContent="center" width="100%">
                      <Checkbox size="small" checked={sauses[saus]} onChange={() => handleSausChange(saus)} sx={{ p: 0, color: COLORS.secondary, "&.Mui-checked": { color: COLORS.primary } }} />
                      <Typography sx={{ fontSize: "0.8rem", fontWeight: "900", lineHeight: 1.1, textAlign: "center" }}>{saus}</Typography>
                    </Box>
                    <AnimatePresence>
                      {sauses[saus] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", width: "100%", display: "flex", justifyContent: "center" }}>
                          <FormControlLabel control={<Switch size="small" checked={sausesPisah[saus]} onChange={(e) => handleSausPisahChange(saus)} color="error" />} label={<Typography variant="caption" color="error" fontWeight="bold">Pisah</Typography>} sx={{ m: 0, ml: 1 }} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Box>
                ))}
              </Box>
            </Box>
            <motion.div whileTap={{ scale: 0.98 }} style={{ width: "100%" }}>
              <Button fullWidth variant="contained" onClick={handleTakoyakiCartAction} disabled={totalPilihan === 0 && !isEditingFood} sx={{ bgcolor: isEditingFood ? COLORS.info : COLORS.primary, borderRadius: 2, height: "55px", fontSize: "1rem", fontWeight: "bold" }}>{isEditingFood ? "PERBARUI TAKOYAKI INI" : `+ TAMBAH TAKOYAKI ${totalPilihan > 0 ? `(Rp ${hitungHargaPorsi().toLocaleString()})` : ""}`}</Button>
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
              <Button fullWidth variant="contained" color="info" onClick={handleDrinkCartAction} disabled={qtyAir === 0 && !isEditingDrink} sx={{ borderRadius: 2, height: "55px", fontSize: "1rem", fontWeight: "bold" }}>{isEditingDrink ? "PERBARUI MINUMAN INI" : `+ TAMBAH MINUMAN ${qtyAir > 0 ? `(Rp ${(qtyAir * 5000).toLocaleString()})` : ""}`}</Button>
            </motion.div>
          </Paper>

          {tempCart.length > 0 && (
            <Paper elevation={3} sx={{ p: 2, borderRadius: 3, bgcolor: "#fffde7", border: "2px dashed orange" }}>
              <Typography variant="h6" fontWeight="bold" color={COLORS.textDark} gutterBottom>📝 {isGlobalEditMode ? `Ubah Pesanan #${getTargetQueueNumber()}` : "Keranjang Pesanan"}</Typography>
              <List dense sx={{ p: 0, mb: 2 }}>
                <AnimatePresence>
                  {tempCart.map((item) => (
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
                        <Box display="flex" justifyContent="flex-end" gap={1.5}>
                          <IconButton onClick={() => loadCartItemToForm(item)} color="primary" sx={{ bgcolor: "#e3f2fd", borderRadius: 2 }}><Edit /></IconButton>
                          <IconButton onClick={() => duplicateItem(item)} color="default" sx={{ bgcolor: "#f5f5f5", borderRadius: 2 }}><ContentCopy /></IconButton>
                          <IconButton color="error" onClick={() => hapusDariTemp(item.id)} sx={{ bgcolor: "#ffebee", borderRadius: 2 }}><Delete /></IconButton>
                        </Box>
                      </Box>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </List>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}><Typography variant="h6">Total Draf:</Typography><Typography variant="h4" fontWeight="bold" color={COLORS.primary}>Rp {tempCart.reduce((a, b) => a + b.harga, 0).toLocaleString()}</Typography></Box>
              <motion.div whileTap={{ scale: 0.98 }} style={{ width: "100%" }}>
                <Button fullWidth variant="contained" size="large" onClick={prosesPesananFinal} startIcon={editingCartId ? <SaveAs sx={{ fontSize: 30 }} /> : <ShoppingBasket sx={{ fontSize: 30 }} />} disabled={!!editingCartId} sx={{ height: "70px", borderRadius: 3, bgcolor: COLORS.textDark, fontSize: "1.3rem", fontWeight: "bold", "&:hover": { bgcolor: "black" } }}>{isGlobalEditMode ? `SIMPAN PERUBAHAN #${getTargetQueueNumber()}` : `PROSES SEMUA & NEXT (#${nomorAntrian})`}</Button>
                {editingCartId && <Typography variant="caption" color="error" align="center" display="block">Selesaikan perubahan rincian dulu sebelum lanjut.</Typography>}
              </motion.div>
              <div ref={bottomRef} />
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  );
}