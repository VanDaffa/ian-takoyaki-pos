import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Grid,
  Typography,
  Card,
  Button,
  IconButton,
  Chip,
  Stack,
  Divider,
  Paper,
  Checkbox,
  FormControlLabel,
  CssBaseline,
  useMediaQuery,
  useTheme,
  Collapse,
  CardActionArea,
  Snackbar,
  Alert,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
  Switch,
} from "@mui/material";
import {
  Add,
  Remove,
  Restaurant,
  CheckCircle,
  AttachMoney,
  DoneAll,
  Kitchen,
  Person,
  Delete,
  RestartAlt,
  ShoppingBasket,
  ContentCopy,
  Edit,
  MoneyOff,
  SaveAs,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

// --- SOUND ENGINE ---
const playTone = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "success") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === "delete") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(50, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (e) {
    console.error("Audio Error:", e);
  }
};

const COLORS = {
  primary: "#d32f2f",
  secondary: "#f57c00",
  background: "#fff3e0",
  cardSelected: "#ffffff",
  textDark: "#0a0a0a",
  textGrey: "#424242",
  success: "#2e7d32",
  warning: "#ed6c02",
  info: "#0288d1",
};

const VARIAN_ISIAN = [
  { id: "sosis", label: "SOSIS", color: "error" },
  { id: "cumi", label: "CUMI", color: "info" },
  { id: "kepiting", label: "KEPITING", color: "warning" },
  { id: "keju", label: "KEJU", color: "warning" },
  { id: "kornet", label: "KORNET", color: "error" },
  { id: "gurita", label: "GURITA", color: "secondary" },
];

const SAUS_LIST = ["Saus Sambel", "Saus Tomat", "Mayonaise"];

const getSauceColor = (sausName) => {
  if (sausName === "Saus Sambel") return "error";
  if (sausName === "Saus Tomat") return "warning";
  return "default";
};

// HELPER: Auto Capitalize Name
const formatName = (str) => {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
};

// HELPER: Generate String Detail (Misal: "Sosis(2), Keju(3)")
const getDetailString = (detail) => {
  if (!detail) return "";
  return Object.entries(detail)
    .filter(([_, qty]) => qty > 0)
    .map(([key, qty]) => {
      const label = VARIAN_ISIAN.find((v) => v.id === key)?.label || key;
      // Format jadi: SOSIS(2)
      return `${label}(${qty})`;
    })
    .join(", ");
};

function App() {
  // --- STATE ---
  const [isian, setIsian] = useState({});
  const [sauses, setSauses] = useState({
    "Saus Sambel": false,
    "Saus Tomat": false,
    Mayonaise: false,
  });
  const [sausesPisah, setSausesPisah] = useState({
    "Saus Sambel": false,
    "Saus Tomat": false,
    Mayonaise: false,
  });

  const [pakeKatsuobushi, setPakeKatsuobushi] = useState(false);
  const [isCampurMode, setIsCampurMode] = useState(false);
  const [qtyAir, setQtyAir] = useState(0);
  const [nomorAntrian, setNomorAntrian] = useState(1);
  const [namaPelanggan, setNamaPelanggan] = useState("");

  const [tempCart, setTempCart] = useState([]);
  const [masterQueue, setMasterQueue] = useState([]);
  const [editingCartId, setEditingCartId] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    noAntrian: null,
  });
  const [expandedAntrian, setExpandedAntrian] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const totalButir = Object.values(isian).reduce((a, b) => a + b, 0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const bottomRef = useRef(null);

  // --- LOGIC SMART NAMING (FINAL) ---
  const generateSmartName = (detailIsian) => {
    const activeKeys = Object.keys(detailIsian).filter(
      (k) => detailIsian[k] > 0,
    );
    const activeLabels = activeKeys.map(
      (k) => VARIAN_ISIAN.find((v) => v.id === k).label,
    );
    const totalVariant = activeKeys.length;

    // DEFINISI "CAMPUR" (5 Sekawan Standar - TANPA GURITA)
    const standardSet = ["sosis", "cumi", "kepiting", "keju", "kornet"];

    // Logic 0: Polos
    if (totalVariant === 0) return "Takoyaki Polos";

    // Logic 1: Ada Gurita? -> Langsung sebut manual karena ini menu Tambahan/Premium
    if (activeKeys.includes("gurita")) {
      if (totalVariant === 1) return "Takoyaki Full Gurita";
      return `Takoyaki Isi ${activeLabels.join(", ")}`;
    }

    // Logic 2: Cek apakah item yang dipilih HANYA dari Standard Set?
    const isAllStandard = activeKeys.every((k) => standardSet.includes(k));

    if (isAllStandard) {
      if (totalVariant === 5) return "Takoyaki Campur"; // Full Team
      // 3 atau 4 Item -> "Takoyaki Campur Tanpa X"
      if (totalVariant >= 3) {
        const missingItems = standardSet
          .filter((k) => !activeKeys.includes(k))
          .map((k) => VARIAN_ISIAN.find((v) => v.id === k).label);
        return `Takoyaki Campur Tanpa ${missingItems.join(", ")}`;
      }
    }

    // Logic 3: Sisanya (1 atau 2 item) -> Sebut manual
    return `Takoyaki Isi ${activeLabels.join(", ")}`;
  };

  const getJamSekarang = () =>
    new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const isGlobalEditMode = tempCart.some((item) => item.targetAntrian);
  const getTargetQueueNumber = () =>
    isGlobalEditMode
      ? tempCart.find((item) => item.targetAntrian).targetAntrian
      : nomorAntrian;

  const getDisplayNama = () => {
    if (isGlobalEditMode) {
      return tempCart.find((item) => item.targetAntrian).targetNama;
    }
    return namaPelanggan.trim() === ""
      ? `Pelanggan #${nomorAntrian}`
      : namaPelanggan;
  };

  // --- LOGIC FORM ---
  const handleGantiIsian = (id, delta) => {
    if (isCampurMode) setIsCampurMode(false);
    const currentQty = isian[id] || 0;
    if (currentQty + delta < 0) return;
    if (delta > 0 && totalButir >= 5) return;
    setIsian({ ...isian, [id]: currentQty + delta });
    if (delta > 0) playTone("click");
  };

  const setPaketCampur = () => {
    setIsian({ sosis: 1, cumi: 1, kepiting: 1, keju: 1, kornet: 1, gurita: 0 });
    setIsCampurMode(true);
    playTone("click");
  };

  const handleSausChange = (saus) => {
    const newState = !sauses[saus];
    setSauses({ ...sauses, [saus]: newState });
    if (!newState) setSausesPisah({ ...sausesPisah, [saus]: false });
    playTone("click");
  };

  const handleSausPisahChange = (saus) => {
    setSausesPisah({ ...sausesPisah, [saus]: !sausesPisah[saus] });
    playTone("click");
  };

  const toggleSemuaSaus = () => {
    const allSelected = Object.values(sauses).every((val) => val === true);
    setSauses({
      "Saus Sambel": !allSelected,
      "Saus Tomat": !allSelected,
      Mayonaise: !allSelected,
    });
    if (allSelected)
      setSausesPisah({
        "Saus Sambel": false,
        "Saus Tomat": false,
        Mayonaise: false,
      });
    playTone("click");
  };

  const resetFormTakoyaki = () => {
    setIsian({});
    setSauses({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setSausesPisah({
      "Saus Sambel": false,
      "Saus Tomat": false,
      Mayonaise: false,
    });
    setPakeKatsuobushi(false);
    setIsCampurMode(false);
    setQtyAir(0);
    setEditingCartId(null);
    playTone("delete");
  };

  const hitungHargaPorsi = () => {
    if (totalButir === 0) return 0;
    return isian["gurita"] === 5 ? 20000 : 15000;
  };

  const loadCartItemToForm = (item) => {
    resetFormTakoyaki();
    setEditingCartId(item.id);

    if (item.type === "drink") {
      setQtyAir(item.qty);
    } else {
      setIsian(item.detail);
      setPakeKatsuobushi(item.katsuobushi);
      const newSauses = {
        "Saus Sambel": false,
        "Saus Tomat": false,
        Mayonaise: false,
      };
      item.sauses.forEach((s) => (newSauses[s] = true));
      setSauses(newSauses);
      const newSausesPisah = {
        "Saus Sambel": false,
        "Saus Tomat": false,
        Mayonaise: false,
      };
      if (item.sausesPisah)
        item.sausesPisah.forEach((s) => (newSausesPisah[s] = true));
      setSausesPisah(newSausesPisah);
    }
    setSnackbar({
      open: true,
      message: "Item dimuat ke Form. Silakan ubah & Update.",
      severity: "info",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCartAction = () => {
    if (editingCartId) {
      const updatedCart = tempCart.map((item) => {
        if (item.id === editingCartId) {
          if (qtyAir > 0) {
            return {
              ...item,
              nama: `Air Mineral (${qtyAir}x)`,
              type: "drink",
              qty: qtyAir,
              harga: 5000 * qtyAir,
              detail: {},
              sauses: [],
              katsuobushi: false,
            };
          } else if (totalButir > 0) {
            const smartName = generateSmartName(isian);
            return {
              ...item,
              nama: smartName,
              type: "food",
              qty: 1,
              detail: isian,
              sauses: Object.keys(sauses).filter((key) => sauses[key]),
              sausesPisah: Object.keys(sausesPisah).filter(
                (key) => sausesPisah[key],
              ),
              katsuobushi: pakeKatsuobushi,
              harga: hitungHargaPorsi(),
            };
          }
        }
        return item;
      });
      setTempCart(updatedCart);
      resetFormTakoyaki();
      setSnackbar({
        open: true,
        message: "Item Keranjang Berhasil Di-Update!",
        severity: "success",
      });
      playTone("success");
      return;
    }

    let itemsAdded = false;
    const existingEditContext = tempCart.find((t) => t.targetAntrian);
    const contextAntrian = existingEditContext
      ? existingEditContext.targetAntrian
      : null;
    const contextNama = existingEditContext
      ? existingEditContext.targetNama
      : null;

    if (qtyAir > 0) {
      const existingWaterIndex = tempCart.findIndex(
        (item) => item.type === "drink",
      );
      if (existingWaterIndex !== -1 && !editingCartId) {
        const updatedCart = [...tempCart];
        const oldItem = updatedCart[existingWaterIndex];
        const newQty = oldItem.qty + qtyAir;
        updatedCart[existingWaterIndex] = {
          ...oldItem,
          qty: newQty,
          nama: `Air Mineral (${newQty}x)`,
          harga: 5000 * newQty,
        };
        setTempCart(updatedCart);
      } else {
        const itemAir = {
          id: Date.now() + 1,
          nama: `Air Mineral (${qtyAir}x)`,
          type: "drink",
          qty: qtyAir,
          detail: {},
          sauses: [],
          sausesPisah: [],
          harga: 5000 * qtyAir,
          targetAntrian: contextAntrian,
          targetNama: contextNama,
        };
        setTempCart((prev) => [...prev, itemAir]);
      }
      itemsAdded = true;
    }

    if (totalButir > 0) {
      const smartName = generateSmartName(isian);
      const itemTako = {
        id: Date.now(),
        nama: smartName,
        type: "food",
        qty: 1,
        detail: isian,
        sauses: Object.keys(sauses).filter((key) => sauses[key]),
        sausesPisah: Object.keys(sausesPisah).filter((key) => sausesPisah[key]),
        katsuobushi: pakeKatsuobushi,
        harga: hitungHargaPorsi(),
        targetAntrian: contextAntrian,
        targetNama: contextNama,
      };
      setTempCart((prev) => [...prev, itemTako]);
      itemsAdded = true;
    }

    if (itemsAdded) {
      resetFormTakoyaki();
      playTone("success");
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
    } else {
      setSnackbar({
        open: true,
        message: "Isi pesanan dulu ya!",
        severity: "warning",
      });
    }
  };

  const duplicateItem = (originalItem) => {
    const newItem = { ...originalItem, id: Date.now() };
    if (originalItem.type === "drink") {
      const existingWaterIndex = tempCart.findIndex(
        (item) => item.type === "drink",
      );
      const updatedCart = [...tempCart];
      const oldItem = updatedCart[existingWaterIndex];
      const newQty = oldItem.qty + originalItem.qty;
      updatedCart[existingWaterIndex] = {
        ...oldItem,
        qty: newQty,
        nama: `Air Mineral (${newQty}x)`,
        harga: 5000 * newQty,
      };
      setTempCart(updatedCart);
    } else {
      setTempCart([...tempCart, newItem]);
    }
    playTone("success");
  };

  const hapusDariTemp = (id) => {
    setTempCart(tempCart.filter((item) => item.id !== id));
    if (editingCartId === id) resetFormTakoyaki();
    playTone("delete");
  };

  const prosesPesananFinal = () => {
    if (tempCart.length === 0) return;
    const isEditMode = tempCart.some((item) => item.targetAntrian);
    const finalNoAntrian = isEditMode
      ? tempCart.find((item) => item.targetAntrian).targetAntrian
      : nomorAntrian;

    // FORMAT NAMA: Auto Capitalize
    let rawNama = isEditMode
      ? tempCart.find((item) => item.targetAntrian).targetNama
      : namaPelanggan;
    if (!isEditMode && rawNama.trim() === "")
      rawNama = `Pelanggan #${nomorAntrian}`;
    const finalNamaPemesan = formatName(rawNama);

    const finalItems = tempCart.map((draft) => ({
      ...draft,
      noAntrian: finalNoAntrian,
      namaPemesan: finalNamaPemesan,
      jamMasuk: getJamSekarang(),
      statusMasak: "dibuat",
      statusBayar: "belum",
      targetAntrian: undefined,
      targetNama: undefined,
    }));

    setMasterQueue([...masterQueue, ...finalItems]);

    if (isEditMode) {
      setSnackbar({
        open: true,
        message: `Pesanan #${finalNoAntrian} Berhasil Di-Update Lengkap!`,
        severity: "success",
      });
    } else {
      setSnackbar({
        open: true,
        message: `Pesanan Baru #${finalNoAntrian} Masuk Dapur!`,
        severity: "success",
      });
      setNomorAntrian((prev) => prev + 1);
      setNamaPelanggan("");
    }
    setTempCart([]);
    playTone("success");
  };

  const groupedOrders = masterQueue.reduce((acc, item) => {
    if (!acc[item.noAntrian]) {
      acc[item.noAntrian] = {
        noAntrian: item.noAntrian,
        namaPemesan: item.namaPemesan,
        jamMasuk: item.jamMasuk,
        items: [],
        totalTagihan: 0,
      };
    }
    acc[item.noAntrian].items.push(item);
    acc[item.noAntrian].totalTagihan += item.harga;
    return acc;
  }, {});
  const sortedGroups = Object.values(groupedOrders).sort(
    (a, b) => a.noAntrian - b.noAntrian,
  );

  const toggleStatusMasakItem = (item) => {
    setMasterQueue((prev) =>
      prev.map((p) =>
        p.id === item.id
          ? {
              ...p,
              statusMasak: p.statusMasak === "selesai" ? "dibuat" : "selesai",
            }
          : p,
      ),
    );
    playTone("click");
  };

  const handleBayarLunasGroup = (noAntrian) => {
    const groupItems = masterQueue.filter((p) => p.noAntrian === noAntrian);
    const isCurrentlyLunas = groupItems.every((p) => p.statusBayar === "lunas");
    const newStatus = isCurrentlyLunas ? "belum" : "lunas";
    setMasterQueue((prev) =>
      prev.map((p) =>
        p.noAntrian === noAntrian ? { ...p, statusBayar: newStatus } : p,
      ),
    );

    if (newStatus === "lunas") {
      setSnackbar({
        open: true,
        message: "Pembayaran LUNAS! ✅",
        severity: "success",
      });
      playTone("success");
    } else {
      setSnackbar({
        open: true,
        message: "Status Pembayaran Dibatalkan ❌",
        severity: "info",
      });
      playTone("click");
    }
  };

  const editPesananFullBatch = (noAntrian, namaPemesan) => {
    const itemsToEdit = masterQueue.filter(
      (item) => item.noAntrian === noAntrian,
    );
    const draftItems = itemsToEdit.map((item) => ({
      id: Date.now() + Math.random(),
      nama: item.nama,
      type: item.type,
      qty: item.qty,
      detail: item.detail,
      sauses: item.sauses,
      sausesPisah: item.sausesPisah || [],
      katsuobushi: item.katsuobushi,
      harga: item.harga,
      targetAntrian: noAntrian,
      targetNama: namaPemesan,
    }));
    setTempCart((prev) => [...prev, ...draftItems]);
    setMasterQueue((prev) =>
      prev.filter((item) => item.noAntrian !== noAntrian),
    );
    setSnackbar({
      open: true,
      message: `Semua pesanan #${noAntrian} ditarik ke Keranjang!`,
      severity: "info",
    });
  };

  const requestFinishOrder = (noAntrian) => {
    const groupItems = masterQueue.filter((p) => p.noAntrian === noAntrian);
    const isLunas = groupItems.every((p) => p.statusBayar === "lunas");
    if (!isLunas) {
      setSnackbar({
        open: true,
        message: "⚠️ Tagih dulu bos! Belum Lunas.",
        severity: "warning",
      });
      playTone("delete");
      return;
    }
    setConfirmDialog({ open: true, noAntrian: noAntrian });
  };

  const executeFinishOrder = () => {
    if (confirmDialog.noAntrian) {
      setMasterQueue((prev) =>
        prev.filter((p) => p.noAntrian !== confirmDialog.noAntrian),
      );
      playTone("success");
      setSnackbar({
        open: true,
        message: "Pesanan Selesai Disajikan!",
        severity: "success",
      });
    }
    setConfirmDialog({ open: false, noAntrian: null });
  };

  const renderSauceChips = (sauses, sausesPisah) => {
    if (!sauses || sauses.length === 0)
      return (
        <Typography variant="caption" color="text.secondary">
          Tanpa Saus
        </Typography>
      );
    const allSeparated = sauses.every(
      (s) => sausesPisah && sausesPisah.includes(s),
    );
    if (allSeparated) {
      return (
        <Chip
          label="SEMUA SAUS DIPISAH"
          size="small"
          sx={{
            bgcolor: COLORS.info,
            color: "white",
            fontWeight: "bold",
            fontSize: "0.75rem",
          }}
        />
      );
    }
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
        {sauses.map((saus) => {
          const isPisah = sausesPisah && sausesPisah.includes(saus);
          const color = getSauceColor(saus);
          return (
            <Chip
              key={saus}
              label={`${saus}${isPisah ? " (PISAH)" : ""}`}
              size="small"
              color={color}
              variant={isPisah ? "outlined" : "filled"}
              sx={{ fontWeight: "bold", fontSize: "0.7rem", height: "24px" }}
            />
          );
        })}
      </Box>
    );
  };

  return (
    <>
      <CssBaseline />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%", fontWeight: "bold" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, noAntrian: null })}
        PaperProps={{ sx: { borderRadius: 4, p: 1, minWidth: "300px" } }}
      >
        <DialogTitle
          sx={{
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "1.2rem",
            color: COLORS.primary,
          }}
        >
          Selesaikan Pesanan #{confirmDialog.noAntrian}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: "center", fontWeight: "bold" }}>
            Pastikan pesanan sudah diberikan ke pelanggan.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 2, mb: 1 }}>
          <Button
            onClick={() => setConfirmDialog({ open: false, noAntrian: null })}
            color="inherit"
            variant="outlined"
            sx={{
              borderRadius: 3,
              px: 3,
              fontWeight: "bold",
              textTransform: "none",
            }}
          >
            Batal
          </Button>
          <Button
            onClick={executeFinishOrder}
            variant="contained"
            autoFocus
            sx={{
              borderRadius: 3,
              px: 4,
              bgcolor: COLORS.secondary,
              fontWeight: "bold",
              textTransform: "none",
            }}
          >
            Ya, Selesai
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
          bgcolor: COLORS.background,
        }}
      >
        {/* === KOLOM KIRI: DAFTAR PESANAN === */}
        <Box
          sx={{
            width: isMobile ? "100%" : "45%",
            minWidth: isMobile ? "100%" : "480px",
            height: isMobile ? "40%" : "100%",
            bgcolor: "white",
            borderRight: "2px solid #ffccbc",
            display: "flex",
            flexDirection: "column",
            zIndex: 2,
            boxShadow: "4px 0 15px rgba(211, 47, 47, 0.1)",
          }}
        >
          <Box
            sx={{
              p: 2.5,
              bgcolor: COLORS.primary,
              color: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h5" fontWeight="bold">
              Daftar Pesanan
            </Typography>
            <Typography
              variant="body1"
              sx={{
                bgcolor: "rgba(0,0,0,0.2)",
                px: 2,
                py: 0.5,
                borderRadius: 2,
                fontWeight: "bold",
              }}
            >
              Antrian: {sortedGroups.length}
            </Typography>
          </Box>
          <Box
            sx={{ flexGrow: 1, overflowY: "auto", p: 2, bgcolor: "#fff3e0" }}
          >
            {sortedGroups.length === 0 ? (
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                height="100%"
                opacity={0.6}
              >
                <Restaurant
                  sx={{ fontSize: 100, mb: 2, color: COLORS.secondary }}
                />
                <Typography
                  variant="h5"
                  color={COLORS.primary}
                  fontWeight="bold"
                >
                  Dapur Kosong
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  Siap menerima pesanan baru!
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2} component={motion.div} layout>
                <AnimatePresence>
                  {sortedGroups.map((group) => {
                    const isAllLunas = group.items.every(
                      (i) => i.statusBayar === "lunas",
                    );
                    const isExpanded = expandedAntrian === group.noAntrian;

                    return (
                      <motion.div
                        key={group.noAntrian}
                        layout
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                      >
                        <Card
                          elevation={3}
                          sx={{
                            borderRadius: 3,
                            border: isAllLunas
                              ? `2px solid ${COLORS.success}`
                              : `2px solid ${COLORS.primary}`,
                            bgcolor: isAllLunas ? "#c8e6c9" : "white",
                            transition: "all 0.3s",
                          }}
                        >
                          <CardActionArea
                            onClick={() =>
                              setExpandedAntrian(
                                isExpanded ? null : group.noAntrian,
                              )
                            }
                            sx={{
                              p: 2.5,
                              bgcolor: isAllLunas ? "#e8f5e9" : "inherit",
                            }}
                          >
                            <Box
                              display="flex"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Box>
                                <Box
                                  display="flex"
                                  alignItems="center"
                                  gap={1.5}
                                  mb={0.5}
                                >
                                  <Chip
                                    label={"#" + group.noAntrian}
                                    sx={{
                                      bgcolor: COLORS.primary,
                                      color: "white",
                                      fontWeight: "bold",
                                      fontSize: "1.1rem",
                                      height: "32px",
                                    }}
                                  />
                                  <Typography
                                    variant="h5"
                                    fontWeight="bold"
                                    color={COLORS.textDark}
                                  >
                                    {group.namaPemesan}
                                  </Typography>
                                </Box>
                                <Typography
                                  variant="body1"
                                  color={COLORS.textGrey}
                                  fontWeight="bold"
                                >
                                  {group.items.length} Item • {group.jamMasuk}
                                </Typography>
                              </Box>
                              <Box textAlign="right">
                                <Typography
                                  variant="h5"
                                  fontWeight="bold"
                                  color={COLORS.primary}
                                >
                                  Rp {group.totalTagihan.toLocaleString()}
                                </Typography>
                                {isAllLunas && (
                                  <Typography
                                    variant="body2"
                                    fontWeight="bold"
                                    color={COLORS.success}
                                  >
                                    LUNAS ✅
                                  </Typography>
                                )}
                              </Box>
                            </Box>

                            {/* PREVIEW AREA (MINI RECEIPT DENGAN DETAIL) */}
                            {!isExpanded && (
                              <Box
                                sx={{
                                  mt: 1.5,
                                  bgcolor: "rgba(0,0,0,0.04)",
                                  p: 1,
                                  borderRadius: 2,
                                }}
                              >
                                {group.items.map((item, idx) => (
                                  <Box key={idx} sx={{ mb: 0.5 }}>
                                    <Typography
                                      variant="body2"
                                      color="text.primary"
                                      sx={{
                                        fontWeight: 600,
                                        fontSize: "0.9rem",
                                        lineHeight: 1.3,
                                      }}
                                    >
                                      • <b>{item.qty}x</b> {item.nama}
                                    </Typography>
                                    {/* Tampilkan Detail jika Food */}
                                    {item.type === "food" && (
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                          display: "block",
                                          ml: 2,
                                          fontStyle: "italic",
                                        }}
                                      >
                                        {getDetailString(item.detail)}
                                      </Typography>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </CardActionArea>
                          <Collapse in={isExpanded} unmountOnExit>
                            <Box sx={{ bgcolor: "#fff" }}>
                              {group.items.map((item) => (
                                <Box
                                  key={item.id}
                                  sx={{
                                    p: 2,
                                    borderTop: "1px solid #eee",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    bgcolor:
                                      item.statusMasak === "selesai"
                                        ? "#f1f8e9"
                                        : "white",
                                  }}
                                >
                                  <Box sx={{ flexGrow: 1 }}>
                                    <Typography
                                      variant="h6"
                                      fontWeight="bold"
                                      sx={{
                                        fontSize: "1.15rem",
                                        textDecoration:
                                          item.statusMasak === "selesai"
                                            ? "line-through"
                                            : "none",
                                        color:
                                          item.statusMasak === "selesai"
                                            ? "grey"
                                            : "black",
                                      }}
                                    >
                                      {item.nama}
                                    </Typography>
                                    {item.type === "food" && (
                                      <Box mt={0.5}>
                                        {/* RINCIAN JUMLAH ISIAN (PENTING BUAT KOKI) */}
                                        <Typography
                                          variant="body2"
                                          color="primary"
                                          sx={{ fontWeight: "bold", mb: 0.5 }}
                                        >
                                          {getDetailString(item.detail)}
                                        </Typography>

                                        {item.katsuobushi && (
                                          <Chip
                                            label="Pake Katsuobushi"
                                            size="small"
                                            sx={{
                                              bgcolor: COLORS.warning,
                                              color: "white",
                                              fontWeight: "bold",
                                              mb: 0.5,
                                              mr: 1,
                                            }}
                                          />
                                        )}
                                        {renderSauceChips(
                                          item.sauses,
                                          item.sausesPisah,
                                        )}
                                      </Box>
                                    )}
                                  </Box>
                                  <Box
                                    display="flex"
                                    gap={1}
                                    alignItems="center"
                                  >
                                    <IconButton
                                      onClick={() =>
                                        toggleStatusMasakItem(item)
                                      }
                                      color={
                                        item.statusMasak === "selesai"
                                          ? "success"
                                          : "default"
                                      }
                                    >
                                      <CheckCircle sx={{ fontSize: 32 }} />
                                    </IconButton>
                                  </Box>
                                </Box>
                              ))}
                              <Box
                                sx={{
                                  p: 2,
                                  bgcolor: "#fafafa",
                                  borderTop: "2px dashed #eee",
                                  display: "flex",
                                  gap: 1,
                                }}
                              >
                                {!isAllLunas && (
                                  <Button
                                    fullWidth
                                    variant="outlined"
                                    size="large"
                                    onClick={() =>
                                      editPesananFullBatch(
                                        group.noAntrian,
                                        group.namaPemesan,
                                      )
                                    }
                                    startIcon={<Edit />}
                                    sx={{
                                      color: COLORS.textDark,
                                      borderColor: COLORS.textDark,
                                      fontWeight: "bold",
                                    }}
                                  >
                                    EDIT SEMUA
                                  </Button>
                                )}
                                <Button
                                  fullWidth
                                  variant="contained"
                                  size="large"
                                  color={isAllLunas ? "success" : "error"}
                                  onClick={() =>
                                    handleBayarLunasGroup(group.noAntrian)
                                  }
                                  startIcon={
                                    isAllLunas ? <MoneyOff /> : <AttachMoney />
                                  }
                                  sx={{ fontSize: "1rem", fontWeight: "bold" }}
                                >
                                  {isAllLunas ? "BATAL LUNAS" : "BAYAR SEMUA"}
                                </Button>
                                <Button
                                  fullWidth
                                  variant="contained"
                                  size="large"
                                  sx={{
                                    bgcolor: COLORS.secondary,
                                    color: "white",
                                    fontSize: "1rem",
                                    fontWeight: "bold",
                                  }}
                                  onClick={() =>
                                    requestFinishOrder(group.noAntrian)
                                  }
                                  startIcon={<Kitchen />}
                                >
                                  SELESAI
                                </Button>
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

        {/* === KOLOM KANAN: INPUT & KERANJANG === */}
        <Box
          sx={{
            flexGrow: 1,
            height: isMobile ? "60%" : "100%",
            overflowY: "auto",
            p: isMobile ? 2 : 4,
            bgcolor: COLORS.background,
          }}
        >
          <Typography
            variant="h5"
            fontWeight="bold"
            color={COLORS.textDark}
            sx={{ mb: 2, display: "flex", alignItems: "center" }}
          >
            🐙{" "}
            {isGlobalEditMode
              ? `Edit Pesanan #${getTargetQueueNumber()}`
              : "Buat Pesanan Baru"}
          </Typography>

          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              mb: 2,
              borderRadius: 3,
              border: `1px solid ${COLORS.secondary}`,
              bgcolor: "white",
            }}
          >
            <TextField
              fullWidth
              label="Nama Pelanggan (Opsional)"
              variant="outlined"
              value={isGlobalEditMode ? getDisplayNama() : namaPelanggan}
              onChange={(e) => setNamaPelanggan(e.target.value)}
              placeholder={`Pelanggan #${getTargetQueueNumber()}`}
              disabled={isGlobalEditMode}
              InputLabelProps={{ style: { fontSize: "1.2rem" } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person sx={{ color: COLORS.primary, fontSize: 34 }} />
                  </InputAdornment>
                ),
                style: { fontSize: "1.3rem", padding: "5px" },
              }}
            />
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                display: "block",
                color: COLORS.primary,
                fontWeight: "bold",
              }}
            >
              *Mengisi untuk Antrian #{getTargetQueueNumber()}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 4,
              bgcolor: "white",
              border: editingCartId ? `3px solid ${COLORS.info}` : "none",
            }}
          >
            {editingCartId && (
              <Alert
                severity="info"
                sx={{ mb: 2, fontWeight: "bold" }}
                onClose={() => {
                  resetFormTakoyaki();
                }}
              >
                Sedang mengedit item dari Keranjang... (Klik X untuk Batal)
              </Alert>
            )}
            <Grid container spacing={2} mb={3}>
              <Grid item xs={6}>
                <motion.div whileTap={{ scale: 0.95 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={setPaketCampur}
                    startIcon={<Restaurant />}
                    sx={{
                      height: "60px",
                      bgcolor: COLORS.secondary,
                      fontSize: "1.1rem",
                      fontWeight: "bold",
                    }}
                  >
                    CAMPUR (15K)
                  </Button>
                </motion.div>
              </Grid>
              <Grid item xs={6}>
                <Box
                  display="flex"
                  alignItems="center"
                  sx={{
                    border: `1px solid ${COLORS.secondary}`,
                    borderRadius: 1,
                    height: "60px",
                  }}
                >
                  <IconButton
                    onClick={() => {
                      setQtyAir(Math.max(0, qtyAir - 1));
                      playTone("click");
                    }}
                    sx={{ width: "50px", height: "100%" }}
                    disabled={qtyAir === 0}
                  >
                    <Remove />
                  </IconButton>
                  <Box sx={{ flexGrow: 1, textAlign: "center" }}>
                    <Typography
                      fontWeight="bold"
                      fontSize="1.1rem"
                      color={COLORS.secondary}
                    >
                      AIR ({qtyAir})
                    </Typography>
                  </Box>
                  <IconButton
                    onClick={() => {
                      setQtyAir(qtyAir + 1);
                      playTone("click");
                    }}
                    sx={{ width: "50px", height: "100%" }}
                  >
                    <Add />
                  </IconButton>
                </Box>
              </Grid>
            </Grid>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={1}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6" fontWeight="bold">
                  Racik Isian:
                </Typography>
                <Chip
                  label={`${totalButir}/5`}
                  color={totalButir >= 5 ? "error" : "default"}
                  size="small"
                  sx={{ fontWeight: "bold" }}
                />
              </Box>
              <Button
                size="medium"
                color="error"
                startIcon={<RestartAlt />}
                onClick={resetFormTakoyaki}
                sx={{ textTransform: "none", fontSize: "1rem" }}
              >
                Reset Pilihan
              </Button>
            </Box>
            <Grid container spacing={1} mb={3}>
              {VARIAN_ISIAN.map((item) => (
                <Grid item xs={4} key={item.id}>
                  <motion.div whileTap={{ scale: 0.95 }}>
                    <Card
                      elevation={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGantiIsian(item.id, 1);
                      }}
                      sx={{
                        bgcolor:
                          isian[item.id] > 0 ? COLORS.cardSelected : "#f5f5f5",
                        border:
                          isian[item.id] > 0
                            ? `3px solid ${COLORS.primary}`
                            : "1px solid transparent",
                        boxShadow:
                          isian[item.id] > 0
                            ? "0 4px 12px rgba(211, 47, 47, 0.3)"
                            : "none",
                        borderRadius: 3,
                        cursor: "pointer",
                        height: "120px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        transition: "0.1s",
                        userSelect: "none",
                        p: 1.5,
                      }}
                    >
                      <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                        flexGrow={1}
                      >
                        <Typography
                          variant="body1"
                          fontWeight="900"
                          align="center"
                          sx={{
                            color:
                              isian[item.id] > 0 ? COLORS.primary : "#757575",
                            letterSpacing: 0.5,
                            fontSize: "1.2rem",
                          }}
                        >
                          {item.label}
                        </Typography>
                      </Box>
                      <Box
                        height="30px"
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                        sx={{
                          visibility: isian[item.id] > 0 ? "visible" : "hidden",
                          gap: 1,
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGantiIsian(item.id, -1);
                          }}
                          sx={{ bgcolor: "#ffebee" }}
                        >
                          <Remove />
                        </IconButton>
                        <Typography
                          sx={{
                            fontWeight: "bold",
                            color: COLORS.primary,
                            fontSize: "1.4rem",
                            minWidth: "20px",
                            textAlign: "center",
                          }}
                        >
                          {isian[item.id]}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGantiIsian(item.id, 1);
                          }}
                          sx={{ bgcolor: "#ffebee" }}
                        >
                          <Add />
                        </IconButton>
                      </Box>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
            <Box mb={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={pakeKatsuobushi}
                    onChange={(e) => {
                      setPakeKatsuobushi(e.target.checked);
                      playTone("click");
                    }}
                    color="warning"
                    sx={{ transform: "scale(1.3)", mr: 1 }}
                  />
                }
                label={
                  <Typography variant="h6" fontWeight="bold" fontSize="1.1rem">
                    Topping Katsuobushi
                  </Typography>
                }
                sx={{
                  p: 1,
                  border: "1px solid #ddd",
                  borderRadius: 2,
                  width: "100%",
                  mb: 2,
                  mx: 0,
                }}
              />
              <Divider sx={{ my: 2 }} />
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={1}
              >
                <Typography
                  variant="body1"
                  color="text.secondary"
                  fontWeight="bold"
                >
                  Pilih Saus:
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={toggleSemuaSaus}
                  startIcon={<DoneAll fontSize="small" />}
                  sx={{
                    fontWeight: "bold",
                    fontSize: "0.9rem",
                    height: "36px",
                  }}
                >
                  Pilih Semua
                </Button>
              </Box>
              <Grid container spacing={1}>
                {SAUS_LIST.map((saus) => (
                  <Grid item xs={4} key={saus}>
                    <Box
                      sx={{
                        border: sauses[saus]
                          ? `2px solid ${COLORS.primary}`
                          : "1px solid #ddd",
                        borderRadius: 2,
                        p: 0.5,
                        bgcolor: sauses[saus] ? "#ffebee" : "transparent",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={sauses[saus]}
                            onChange={() => handleSausChange(saus)}
                            sx={{
                              p: 0.5,
                              color: COLORS.secondary,
                              "&.Mui-checked": { color: COLORS.primary },
                            }}
                          />
                        }
                        label={
                          <Typography
                            variant="body2"
                            fontWeight="bold"
                            sx={{ fontSize: "0.85rem", lineHeight: 1 }}
                          >
                            {saus}
                          </Typography>
                        }
                        sx={{ m: 0, width: "100%", justifyContent: "center" }}
                      />
                      {sauses[saus] && (
                        <FormControlLabel
                          control={
                            <Switch
                              size="small"
                              checked={sausesPisah[saus]}
                              onChange={() => handleSausPisahChange(saus)}
                              color="error"
                            />
                          }
                          label={
                            <Typography
                              variant="caption"
                              color="error"
                              fontWeight="bold"
                            >
                              Pisah
                            </Typography>
                          }
                          sx={{ m: 0 }}
                        />
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleCartAction}
                disabled={totalButir === 0 && qtyAir === 0}
                sx={{
                  bgcolor: editingCartId ? COLORS.info : COLORS.primary,
                  borderRadius: 3,
                  height: "60px",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                }}
              >
                {editingCartId
                  ? "UPDATE ITEM INI (SIMPAN)"
                  : `MASUK KERANJANG PESANAN (RP ${(hitungHargaPorsi() + qtyAir * 5000).toLocaleString()})`}
              </Button>
            </motion.div>
          </Paper>

          {tempCart.length > 0 && (
            <Paper
              elevation={3}
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: "#fffde7",
                border: "2px dashed orange",
              }}
            >
              <Typography
                variant="h6"
                fontWeight="bold"
                color={COLORS.textDark}
                gutterBottom
              >
                📝{" "}
                {isGlobalEditMode
                  ? `Edit Pesanan #${getTargetQueueNumber()}`
                  : "Keranjang Pesanan"}
              </Typography>
              <List dense sx={{ bgcolor: "white", borderRadius: 2, mb: 2 }}>
                <AnimatePresence>
                  {tempCart.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                    >
                      <ListItem
                        divider
                        sx={{
                          bgcolor:
                            editingCartId === item.id
                              ? "#e3f2fd"
                              : "transparent",
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography fontWeight="bold" fontSize="1.2rem">
                              {item.nama}
                            </Typography>
                          }
                          secondary={
                            <Typography
                              variant="body1"
                              sx={{
                                fontSize: "1.05rem",
                                color: COLORS.textGrey,
                              }}
                            >
                              {item.type === "food" ? (
                                <>
                                  {/* DETAIL ISIAN DITAMPILKAN DI SINI */}
                                  <span
                                    style={{
                                      color: COLORS.primary,
                                      fontWeight: "bold",
                                      display: "block",
                                      marginBottom: "2px",
                                    }}
                                  >
                                    {getDetailString(item.detail)}
                                  </span>
                                  {item.katsuobushi && (
                                    <Chip
                                      label="Katsuobushi"
                                      size="small"
                                      sx={{
                                        bgcolor: COLORS.warning,
                                        color: "white",
                                        mr: 1,
                                      }}
                                    />
                                  )}
                                  {renderSauceChips(
                                    item.sauses,
                                    item.sausesPisah,
                                  )}
                                </>
                              ) : (
                                "Dingin Segar"
                              )}
                            </Typography>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            onClick={() => loadCartItemToForm(item)}
                            color="primary"
                            sx={{ mr: 1 }}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            onClick={() => duplicateItem(item)}
                            color="default"
                            sx={{ mr: 1 }}
                          >
                            <ContentCopy />
                          </IconButton>
                          <IconButton
                            edge="end"
                            color="error"
                            onClick={() => hapusDariTemp(item.id)}
                          >
                            <Delete fontSize="large" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </List>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Typography variant="h6">Total Draft:</Typography>
                <Typography
                  variant="h4"
                  fontWeight="bold"
                  color={COLORS.primary}
                >
                  Rp{" "}
                  {tempCart.reduce((a, b) => a + b.harga, 0).toLocaleString()}
                </Typography>
              </Box>
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={prosesPesananFinal}
                  startIcon={
                    editingCartId ? (
                      <SaveAs sx={{ fontSize: 30 }} />
                    ) : (
                      <ShoppingBasket sx={{ fontSize: 30 }} />
                    )
                  }
                  disabled={!!editingCartId}
                  sx={{
                    height: "70px",
                    borderRadius: 3,
                    bgcolor: COLORS.textDark,
                    fontSize: "1.3rem",
                    fontWeight: "bold",
                    "&:hover": { bgcolor: "black" },
                  }}
                >
                  {isGlobalEditMode
                    ? `SIMPAN PERUBAHAN #${getTargetQueueNumber()}`
                    : `PROSES SEMUA & NEXT (#${nomorAntrian})`}
                </Button>
                {editingCartId && (
                  <Typography
                    variant="caption"
                    color="error"
                    align="center"
                    display="block"
                  >
                    Selesaikan edit item dulu sebelum proses.
                  </Typography>
                )}
              </motion.div>
              <div ref={bottomRef} />
            </Paper>
          )}
        </Box>
      </Box>
    </>
  );
}

export default App;
