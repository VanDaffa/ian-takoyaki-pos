import React, { useState, useEffect, useMemo } from "react";
import { 
  Box, Typography, Card, Container, IconButton, 
  CssBaseline, Button, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Chip, List,
  Snackbar, Alert
} from "@mui/material";
import { 
  ArrowBack, InsertChartRounded,
  Receipt, WarningAmber, PointOfSale, Close, Visibility,
  Delete, DeleteSweep, Clear, CalendarMonth,
  ChevronLeft, ChevronRight, ExpandMore, DateRange
} from "@mui/icons-material";
import { m, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { db } from "../utils/firebase";
import { 
  collection, onSnapshot, query, orderBy, getDocs, 
  writeBatch, addDoc, deleteDoc, doc, serverTimestamp 
} from "firebase/firestore";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

const BULAN_ID = {
  januari: "01", februari: "02", maret: "03", april: "04",
  mei: "05", juni: "06", juli: "07", agustus: "08",
  september: "09", oktober: "10", november: "11", desember: "12"
};

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const NAMA_HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// Format Date lokal menjadi YYYY-MM-DD tanpa pergeseran zona waktu UTC
function toLocalIsoDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Mengubah timestamp / tanggalSesi menjadi format YYYY-MM-DD
function getRecapDateKey(recap) {
  if (recap?.createdAt && typeof recap.createdAt.toDate === "function") {
    return toLocalIsoDate(recap.createdAt.toDate());
  }

  if (typeof recap?.tanggalSesi === "string") {
    const datePart = recap.tanggalSesi.split(",")[0]?.trim();
    const parts = datePart?.split(" ");
    if (parts?.length === 3) {
      const day = String(parts[0]).padStart(2, "0");
      const month = BULAN_ID[parts[1].toLowerCase()];
      const year = parts[2];
      if (month && year) return `${year}-${month}-${day}`;
    }
  }
  return "";
}

function formatSingleDateLabel(isoDate, shortMonth = false) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "numeric",
    month: shortMonth ? "short" : "long",
    year: "numeric"
  });
}

function formatRangeSummary(startDate, endDate) {
  if (!startDate) return "Semua Riwayat Penjualan";
  if (!endDate || startDate === endDate) {
    return formatSingleDateLabel(startDate, false);
  }
  return `${formatSingleDateLabel(startDate, true)} – ${formatSingleDateLabel(endDate, true)}`;
}

export default function RecapPage() {
  const navigate = useNavigate();
  
  const [liveOrders, setLiveOrders] = useState([]);
  const [historyRecaps, setHistoryRecaps] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State Filter Tanggal & Rentang Tanggal
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [monthSlideDir, setMonthSlideDir] = useState(1);

  // State Hapus Riwayat & Notifikasi
  const [deleteDialog, setDeleteDialog] = useState({ open: false, mode: "single", target: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  // State untuk Pop-up Detail Riwayat
  const [detailDialog, setDetailDialog] = useState({ open: false, data: null });

  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsub = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setLiveOrders(orders);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "recaps"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const recaps = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setHistoryRecaps(recaps);
    });
    return () => unsub();
  }, []);

  const completedOrders = liveOrders.filter(order => order.statusPesanan === "selesai");
  const uncompletedOrders = liveOrders.filter(order => order.statusPesanan !== "selesai" && order.statusPesanan !== "batal");
  
  const currentTotalRevenue = completedOrders.reduce((sum, order) => sum + (order.totalTagihan || 0), 0);
  const currentTotalItems = completedOrders.reduce((sum, order) => sum + (order.items?.length || 0), 0);

  // Kumpulan tanggal yang memiliki data rekap (untuk tanda titik pada kalender)
  const datesWithRecaps = useMemo(() => {
    const set = new Set();
    historyRecaps.forEach((recap) => {
      const key = getRecapDateKey(recap);
      if (key) set.add(key);
    });
    return set;
  }, [historyRecaps]);

  const isRangeMode = Boolean(startDate && endDate && startDate !== endDate);

  // Daftar riwayat yang sudah difilter sesuai 1 tanggal atau rentang tanggal
  const filteredRecaps = useMemo(() => {
    if (!startDate) return historyRecaps;
    return historyRecaps.filter((recap) => {
      const key = getRecapDateKey(recap);
      if (!key) return false;
      if (!endDate || startDate === endDate) {
        return key === startDate;
      }
      return key >= startDate && key <= endDate;
    });
  }, [historyRecaps, startDate, endDate]);

  const filteredRevenue = useMemo(() => {
    return filteredRecaps.reduce((sum, recap) => sum + (recap.totalRevenue || 0), 0);
  }, [filteredRecaps]);

  // Susunan sel hari untuk bulan yang sedang dilihat di kalender kustom
  const calendarDays = useMemo(() => {
    const { year, month } = viewMonth;
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, iso });
    }
    return cells;
  }, [viewMonth]);

  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);

  // Handler Navigasi Bulan Kalender
  const changeMonth = (offset) => {
    playTone("click");
    setMonthSlideDir(offset);
    setViewMonth((prev) => {
      const next = new Date(prev.year, prev.month + offset, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  // Handler Pemilihan 1 Tanggal & Rentang Tanggal
  const handleSelectCalendarDate = (iso) => {
    playTone("click");
    if (!startDate || (startDate && endDate)) {
      // Klik pertama: pilih 1 tanggal dulu (sekaligus awal rentang)
      setStartDate(iso);
      setEndDate("");
    } else if (iso === startDate) {
      // Klik tanggal yang sama: pertahankan sebagai 1 tanggal dan tutup dropdown
      setEndDate("");
      setIsCalendarOpen(false);
    } else if (iso < startDate) {
      // Jika tanggal kedua lebih awal, tukar otomatis agar rentang tetap valid
      setEndDate(startDate);
      setStartDate(iso);
    } else {
      // Klik kedua: lengkapi rentang tanggal
      setEndDate(iso);
    }
  };

  // Pintasan Filter Cepat
  const applyQuickPreset = (preset) => {
    playTone("click");
    const now = new Date();
    const endIso = toLocalIsoDate(now);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
      setIsCalendarOpen(false);
    } else if (preset === "today") {
      setStartDate(endIso);
      setEndDate("");
      setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
      setIsCalendarOpen(false);
    } else if (preset === "last7") {
      const startObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setStartDate(toLocalIsoDate(startObj));
      setEndDate(endIso);
      setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
    } else if (preset === "thisMonth") {
      const startObj = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toLocalIsoDate(startObj));
      setEndDate(endIso);
      setViewMonth({ year: now.getFullYear(), month: now.getMonth() });
    }
  };

  const resetDateFilter = (e) => {
    if (e) e.stopPropagation();
    playTone("click");
    setStartDate("");
    setEndDate("");
  };

  const requestEndSession = () => {
    playTone("click");
    if (uncompletedOrders.length > 0) {
      setSnackbar({ open: true, message: "⚠️ Masih ada pesanan yang belum diselesaikan atau dibatalkan!", severity: "warning" });
      return;
    }
    if (completedOrders.length === 0) {
      setSnackbar({ open: true, message: "⚠️ Belum ada pesanan selesai di sesi ini.", severity: "warning" });
      return;
    }
    setIsConfirmOpen(true);
  };

  const executeEndSession = async () => {
    setIsProcessing(true);
    try {
      const now = new Date();
      const dateString = now.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
      const timeString = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
      const sessionName = `${dateString}, ${timeString} WIB`;

      const rincianPesanan = completedOrders.map(order => ({
        idTransaksi: order.id,
        namaPemesan: order.namaPemesan,
        noAntrian: order.noAntrian,
        waktuMasuk: order.jamMasuk,
        totalTagihan: order.totalTagihan,
        items: order.items.map(item => ({
          nama: item.nama,
          qty: item.qty,
          type: item.type,
          harga: item.harga,
          katsuobushi: item.katsuobushi || false,
          sauses: item.sauses || [],
          sausesPisah: item.sausesPisah || []
        }))
      }));

      await addDoc(collection(db, "recaps"), {
        tanggalSesi: sessionName,
        totalRevenue: currentTotalRevenue,
        totalItems: currentTotalItems,
        totalOrders: completedOrders.length,
        rincianPesanan: rincianPesanan,
        createdAt: serverTimestamp()
      });

      const snapshot = await getDocs(collection(db, "orders"));
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      playTone("success");
      setIsConfirmOpen(false);
      setSnackbar({ open: true, message: "Rekap sesi berhasil disimpan! ✅", severity: "success" });
    } catch (error) {
      console.error("Gagal mengakhiri sesi:", error);
      setSnackbar({ open: true, message: "Gagal menyimpan rekap. Periksa koneksi internet.", severity: "error" });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- FUNGSI HAPUS RIWAYAT (SATUAN & MASSAL TERFILTER) ---
  const requestDeleteSingle = (recap) => {
    playTone("delete");
    setDeleteDialog({ open: true, mode: "single", target: recap });
  };

  const requestDeleteFiltered = () => {
    if (filteredRecaps.length === 0) return;
    playTone("delete");
    setDeleteDialog({ open: true, mode: "bulk", target: null });
  };

  const executeDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      if (deleteDialog.mode === "single" && deleteDialog.target?.id) {
        await deleteDoc(doc(db, "recaps", deleteDialog.target.id));
        if (detailDialog.data?.id === deleteDialog.target.id) {
          setDetailDialog({ open: false, data: null });
        }
        playTone("delete");
        setSnackbar({ open: true, message: "Riwayat penjualan berhasil dihapus dari database.", severity: "success" });
      } else if (deleteDialog.mode === "bulk" && filteredRecaps.length > 0) {
        const targets = [...filteredRecaps];
        for (let i = 0; i < targets.length; i += 450) {
          const chunk = targets.slice(i, i + 450);
          const batch = writeBatch(db);
          chunk.forEach((recap) => {
            batch.delete(doc(db, "recaps", recap.id));
          });
          await batch.commit();
        }
        playTone("delete");
        setSnackbar({
          open: true,
          message: `${targets.length} riwayat (${formatRangeSummary(startDate, endDate)}) berhasil dihapus.`,
          severity: "success"
        });
      }
      setDeleteDialog({ open: false, mode: "single", target: null });
    } catch (error) {
      console.error("Gagal menghapus riwayat:", error);
      setSnackbar({ open: true, message: "Gagal menghapus riwayat. Periksa koneksi internet.", severity: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  const navigateTo = (path) => {
    playTone("click");
    navigate(path);
  };

  const openDetail = (recapData) => {
    playTone("click");
    setDetailDialog({ open: true, data: recapData });
  };

  const closeDetail = () => {
    playTone("delete");
    setDetailDialog({ open: false, data: null });
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300 } } };

  const bulkDeleteLabel = !startDate
    ? `Hapus Semua (${filteredRecaps.length})`
    : isRangeMode
      ? `Hapus Rentang Ini (${filteredRecaps.length})`
      : `Hapus Tanggal Ini (${filteredRecaps.length})`;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, py: 4 }}>
      <CssBaseline />

      {/* NOTIFIKASI SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%", fontWeight: 700, fontSize: "0.95rem", borderRadius: 3, alignItems: "center" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      
      {/* DIALOG KONFIRMASI AKHIRI SESI */}
      <Dialog open={isConfirmOpen} onClose={() => !isProcessing && setIsConfirmOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1.5 } }}>
        <DialogTitle sx={{ fontWeight: 800, textAlign: "center", color: "error.main", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <WarningAmber sx={{ fontSize: 56 }} />
          TUTUP BUKU SESI INI?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ textAlign: "center", fontWeight: 600, color: "#3B302A", mb: 2 }}>
            Tindakan ini akan mencatat rincian transaksi dan pendapatan{" "}
            <Box component="span" sx={{ color: COLORS.primary, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              Rp {currentTotalRevenue.toLocaleString()}
            </Box>{" "}
            ke Riwayat Rekap.
          </DialogContentText>
          <Box sx={{ bgcolor: "#ffebee", p: 2, borderRadius: 2.5 }}>
            <Typography variant="body2" color="error.main" fontWeight={700} textAlign="center">
              ⚠️ Seluruh data antrean di Halaman Kasir akan di-reset (dihapus). Pastikan kedai memang sudah tutup.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 1.5, mb: 1, pb: 1.5 }}>
          <Button disabled={isProcessing} onClick={() => setIsConfirmOpen(false)} variant="outlined" sx={{ borderRadius: 2.5, px: 3, color: "#3B302A", borderColor: "#d7ccc8", fontWeight: 800, textTransform: "none" }}>
            Batal
          </Button>
          <Button disabled={isProcessing} onClick={executeEndSession} variant="contained" color="error" sx={{ borderRadius: 2.5, px: 3, fontWeight: 800, textTransform: "none" }}>
            {isProcessing ? "Menyimpan..." : "Ya, Akhiri Sesi"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG KONFIRMASI HAPUS RIWAYAT (SATUAN / MASSAL) */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => !isDeleting && setDeleteDialog({ open: false, mode: "single", target: null })}
        PaperProps={{ sx: { borderRadius: 4, p: 1.5, minWidth: { xs: "310px", sm: "370px" } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, textAlign: "center", fontSize: "1.25rem", color: "error.main", letterSpacing: "-0.3px", pb: 1 }}>
          {deleteDialog.mode === "bulk"
            ? `Hapus ${filteredRecaps.length} Riwayat Penjualan?`
            : "Hapus Riwayat Sesi Ini?"}
        </DialogTitle>
        <DialogContent>
          {deleteDialog.mode === "bulk" ? (
            <DialogContentText sx={{ textAlign: "center", fontWeight: 600, fontSize: "0.95rem", color: "#3B302A", lineHeight: 1.5 }}>
              Seluruh <Box component="span" sx={{ fontWeight: 800, color: "#2D2420" }}>{filteredRecaps.length} riwayat rekap</Box> pada filter{" "}
              <Box component="span" sx={{ fontWeight: 800, color: COLORS.primary }}>{formatRangeSummary(startDate, endDate)}</Box>{" "}
              (senilai <Box component="span" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>Rp {filteredRevenue.toLocaleString()}</Box>) akan dihapus permanen dari database.
            </DialogContentText>
          ) : (
            <DialogContentText sx={{ textAlign: "center", fontWeight: 600, fontSize: "0.95rem", color: "#3B302A", lineHeight: 1.5 }}>
              Riwayat sesi{" "}
              <Box component="span" sx={{ fontWeight: 800, color: "#2D2420" }}>{deleteDialog.target?.tanggalSesi}</Box>{" "}
              sebesar{" "}
              <Box component="span" sx={{ fontWeight: 800, color: COLORS.primary, fontVariantNumeric: "tabular-nums" }}>
                Rp {deleteDialog.target?.totalRevenue?.toLocaleString()}
              </Box>{" "}
              akan dihapus permanen dari database.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", gap: 1.5, mb: 1, px: 2 }}>
          <Button
            disabled={isDeleting}
            onClick={() => setDeleteDialog({ open: false, mode: "single", target: null })}
            variant="outlined"
            sx={{ borderRadius: 2.5, px: 3, py: 1, color: "#3B302A", borderColor: "#d7ccc8", fontWeight: 800, fontSize: "0.95rem", textTransform: "none" }}
          >
            Batal
          </Button>
          <Button
            disabled={isDeleting}
            onClick={executeDeleteHistory}
            variant="contained"
            color="error"
            autoFocus
            sx={{ borderRadius: 2.5, px: 3.5, py: 1, fontWeight: 800, fontSize: "0.95rem", textTransform: "none" }}
          >
            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG DETAIL REKAP */}
      <Dialog open={detailDialog.open} onClose={closeDetail} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, bgcolor: "#f8f9fa" } }}>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", bgcolor: "white", borderBottom: "1px solid #eee", pb: 2 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: "#6E5D54", fontWeight: 700 }}>Rincian Penjualan</Typography>
            <Typography variant="h6" fontWeight={800} color="#2D2420">{detailDialog.data?.tanggalSesi}</Typography>
          </Box>
          <IconButton onClick={closeDetail} sx={{ bgcolor: "#ffebee", color: "error.main" }}><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 3, bgcolor: COLORS.primary, color: "white", textAlign: "center" }}>
            <Typography variant="caption" fontWeight={700} sx={{ opacity: 0.85 }}>Total Pendapatan</Typography>
            <Typography variant="h3" fontWeight={900} sx={{ fontVariantNumeric: "tabular-nums" }}>
              Rp {detailDialog.data?.totalRevenue?.toLocaleString()}
            </Typography>
            <Typography variant="body2" fontWeight={700} mt={1}>
              {detailDialog.data?.totalItems} Item terjual dari {detailDialog.data?.totalOrders} Transaksi
            </Typography>
          </Box>
          
          <Box sx={{ p: 2 }}>
            {detailDialog.data?.rincianPesanan?.length > 0 ? (
              <List sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {detailDialog.data.rincianPesanan.map((trx, idx) => (
                  <Card key={idx} elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px dashed #ccc", bgcolor: "white" }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} pb={1.5} borderBottom="1px solid #eee">
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800} color="#2D2420">
                          {trx.noAntrian === "Online" ? "Online" : `#${trx.noAntrian}`} - {trx.namaPemesan}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 600 }}>{trx.waktuMasuk}</Typography>
                      </Box>
                      <Typography variant="subtitle1" fontWeight={800} color={COLORS.success} sx={{ fontVariantNumeric: "tabular-nums" }}>
                        Rp {trx.totalTagihan?.toLocaleString()}
                      </Typography>
                    </Box>
                    
                    {trx.items.map((item, i) => (
                      <Box key={i} sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={800} color="#3B302A">• {item.qty}x {item.nama}</Typography>
                        {item.type === "food" && (
                          <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5} pl={1.5}>
                            {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={{ height: "20px", fontSize: "0.68rem", bgcolor: COLORS.warning, color: "white", fontWeight: 700 }} />}
                            {(!item.sauses || item.sauses.length === 0) && <Chip label="Tanpa Saus" size="small" variant="outlined" sx={{ height: "20px", fontSize: "0.68rem" }} />}
                            {item.sauses?.map(s => <Chip key={s} label={`${s}${item.sausesPisah?.includes(s) ? " (PISAH)" : ""}`} size="small" sx={{ height: "20px", fontSize: "0.68rem", bgcolor: "#e0e0e0", fontWeight: 700 }} />)}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Card>
                ))}
              </List>
            ) : (
              <Typography variant="body2" sx={{ color: "#6E5D54", py: 4, fontWeight: 700 }} align="center">
                Tidak ada rincian data tersimpan pada sesi ini.
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Container maxWidth="sm">
        <m.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HEADER */}
          <m.div variants={itemVariants}>
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <IconButton onClick={() => navigateTo("/dashboard")} sx={{ bgcolor: "white", color: "#2D2420", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
                <ArrowBack />
              </IconButton>
              <Typography variant="h5" fontWeight={800} color="#2D2420" sx={{ letterSpacing: "-0.3px" }}>
                Rekap Penjualan
              </Typography>
            </Box>
          </m.div>

          {/* KARTU SESI BERJALAN (LIVE) */}
          <m.div variants={itemVariants}>
            <Card elevation={0} sx={{ borderRadius: 4, bgcolor: COLORS.primary, color: "white", mb: 4, p: 3, position: "relative", overflow: "hidden", boxShadow: "0 10px 30px rgba(211, 47, 47, 0.2)" }}>
              <PointOfSale sx={{ position: "absolute", right: -20, bottom: -20, fontSize: 150, opacity: 0.1 }} />
              
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Chip label="SESI SAAT INI" size="small" sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "white", fontWeight: 800 }} />
                <Typography variant="caption" fontWeight={700}>Belum Ditutup</Typography>
              </Box>

              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700 }}>Total Pendapatan Sementara</Typography>
              <Typography variant="h3" fontWeight={900} sx={{ mb: 3, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
                Rp {currentTotalRevenue.toLocaleString()}
              </Typography>

              <Box display="flex" gap={3} mb={4}>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>Item Terjual</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: "tabular-nums" }}>{currentTotalItems} Porsi</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ opacity: 0.85, fontWeight: 600 }}>Total Transaksi</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ fontVariantNumeric: "tabular-nums" }}>{completedOrders.length} Nota</Typography>
                </Box>
              </Box>

              <Button 
                fullWidth 
                variant="contained" 
                onClick={requestEndSession}
                sx={{ bgcolor: "white", color: COLORS.primary, fontWeight: 800, height: "55px", borderRadius: 3, fontSize: "1rem", "&:hover": { bgcolor: "#f5f5f5" } }}
              >
                AKHIRI SESI & SIMPAN REKAP
              </Button>
            </Card>
          </m.div>

          {/* RIWAYAT REKAP */}
          <m.div variants={itemVariants}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5} gap={1} flexWrap="wrap">
              <Typography variant="h6" fontWeight={800} color="#2D2420" sx={{ display: "flex", alignItems: "center", gap: 1, letterSpacing: "-0.3px" }}>
                <InsertChartRounded color="info" /> Riwayat Penjualan
              </Typography>

              {filteredRecaps.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteSweep />}
                  onClick={requestDeleteFiltered}
                  sx={{ borderRadius: 2.5, fontWeight: 800, textTransform: "none", fontSize: "0.82rem", bgcolor: "white" }}
                >
                  {bulkDeleteLabel}
                </Button>
              )}
            </Box>

            {/* CUSTOM DATE & RANGE PICKER DENGAN ANIMASI DROPDOWN */}
            <Card
              elevation={0}
              sx={{
                mb: 2.5,
                borderRadius: 3.5,
                bgcolor: "white",
                border: isCalendarOpen || startDate ? `1.5px solid ${COLORS.primary}` : "1px solid #e6ddd6",
                boxShadow: isCalendarOpen ? "0 10px 28px rgba(45, 36, 32, 0.08)" : "0 2px 8px rgba(45, 36, 32, 0.03)",
                transition: "border-color 0.25s ease, box-shadow 0.25s ease",
                overflow: "hidden"
              }}
            >
              {/* Trigger Utama */}
              <m.div whileTap={{ scale: 0.995 }}>
                <Box
                  onClick={() => {
                    playTone("click");
                    setIsCalendarOpen((prev) => !prev);
                  }}
                  sx={{
                    p: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    cursor: "pointer",
                    userSelect: "none",
                    bgcolor: isCalendarOpen ? "rgba(211, 47, 47, 0.03)" : "transparent",
                    transition: "background-color 0.2s ease"
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 2.5,
                        bgcolor: startDate ? COLORS.primary : "rgba(211, 47, 47, 0.1)",
                        color: startDate ? "white" : COLORS.primary,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "all 0.25s ease"
                      }}
                    >
                      {isRangeMode ? <DateRange /> : <CalendarMonth />}
                    </Box>

                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 700, display: "block", lineHeight: 1.2 }}>
                        {isRangeMode ? "Filter Rentang Tanggal" : "Filter Tanggal & Rentang"}
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={800}
                        color="#2D2420"
                        sx={{
                          fontSize: "0.98rem",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {formatRangeSummary(startDate, endDate)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" alignItems="center" gap={0.5} sx={{ flexShrink: 0 }}>
                    {startDate && (
                      <IconButton
                        size="small"
                        aria-label="Hapus filter tanggal"
                        onClick={resetDateFilter}
                        sx={{ bgcolor: "#ffebee", color: "error.main", width: 34, height: 34 }}
                      >
                        <Clear fontSize="small" />
                      </IconButton>
                    )}
                    <m.div
                      animate={{ rotate: isCalendarOpen ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      style={{ display: "flex", alignItems: "center" }}
                    >
                      <IconButton size="small" aria-label="Buka kalender" sx={{ color: "#2D2420" }}>
                        <ExpandMore />
                      </IconButton>
                    </m.div>
                  </Box>
                </Box>
              </m.div>

              {/* Dropdown Kalender Kustom */}
              <AnimatePresence initial={false}>
                {isCalendarOpen && (
                  <m.div
                    key="custom-calendar-dropdown"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ overflow: "hidden" }}
                  >
                    <Box sx={{ px: 2, pb: 2, pt: 1.5, borderTop: "1px dashed #e6ddd6", bgcolor: "#FFFDF9" }}>
                      
                      {/* Pintasan Cepat */}
                      <Box display="flex" flexWrap="wrap" gap={0.75} mb={2}>
                        {[
                          { id: "all", label: "Semua", active: !startDate },
                          { id: "today", label: "Hari Ini", active: startDate === todayIso && !endDate },
                          { id: "last7", label: "7 Hari Terakhir", active: false },
                          { id: "thisMonth", label: "Bulan Ini", active: false }
                        ].map((preset) => (
                          <Chip
                            key={preset.id}
                            label={preset.label}
                            size="small"
                            onClick={() => applyQuickPreset(preset.id)}
                            sx={{
                              fontWeight: 800,
                              fontSize: "0.78rem",
                              height: "30px",
                              borderRadius: 2,
                              bgcolor: preset.active ? COLORS.primary : "rgba(45, 36, 32, 0.06)",
                              color: preset.active ? "white" : "#3B302A",
                              "&:hover": {
                                bgcolor: preset.active ? COLORS.primary : "rgba(211, 47, 47, 0.14)"
                              }
                            }}
                          />
                        ))}
                      </Box>

                      {/* Header Navigasi Bulan */}
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                        <IconButton
                          onClick={() => changeMonth(-1)}
                          sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: "rgba(45, 36, 32, 0.05)", color: "#2D2420" }}
                        >
                          <ChevronLeft />
                        </IconButton>

                        <Box sx={{ overflow: "hidden", textAlign: "center", minWidth: 160 }}>
                          <AnimatePresence mode="wait" initial={false}>
                            <m.div
                              key={`${viewMonth.year}-${viewMonth.month}`}
                              initial={{ opacity: 0, x: monthSlideDir * 18 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: monthSlideDir * -18 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                              <Typography variant="subtitle1" fontWeight={800} color="#2D2420">
                                {NAMA_BULAN[viewMonth.month]} {viewMonth.year}
                              </Typography>
                            </m.div>
                          </AnimatePresence>
                        </Box>

                        <IconButton
                          onClick={() => changeMonth(1)}
                          sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: "rgba(45, 36, 32, 0.05)", color: "#2D2420" }}
                        >
                          <ChevronRight />
                        </IconButton>
                      </Box>

                      {/* Nama Hari (Min - Sab) */}
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 0.75 }}>
                        {NAMA_HARI.map((hari, idx) => (
                          <Typography
                            key={hari}
                            variant="caption"
                            align="center"
                            sx={{
                              fontWeight: 800,
                              fontSize: "0.75rem",
                              color: idx === 0 ? COLORS.primary : "#6E5D54"
                            }}
                          >
                            {hari}
                          </Typography>
                        ))}
                      </Box>

                      {/* Grid Tanggal */}
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
                        {calendarDays.map((cell, idx) => {
                          if (!cell) {
                            return <Box key={`empty-${idx}`} sx={{ height: 42 }} />;
                          }

                          const isStart = cell.iso === startDate;
                          const isEnd = Boolean(endDate && cell.iso === endDate);
                          const isSelectedEdge = isStart || isEnd;
                          const isInRange = Boolean(startDate && endDate && cell.iso > startDate && cell.iso < endDate);
                          const isToday = cell.iso === todayIso;
                          const hasRecapData = datesWithRecaps.has(cell.iso);

                          return (
                            <m.div key={cell.iso} whileTap={{ scale: 0.9 }}>
                              <Box
                                onClick={() => handleSelectCalendarDate(cell.iso)}
                                sx={{
                                  height: 42,
                                  borderRadius: isSelectedEdge ? 2.5 : isInRange ? 1.5 : 2.5,
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: "pointer",
                                  position: "relative",
                                  bgcolor: isSelectedEdge
                                    ? COLORS.primary
                                    : isInRange
                                      ? "rgba(211, 47, 47, 0.12)"
                                      : "transparent",
                                  color: isSelectedEdge ? "white" : "#2D2420",
                                  border: isToday && !isSelectedEdge ? `1.5px solid ${COLORS.secondary}` : "1.5px solid transparent",
                                  boxShadow: isSelectedEdge ? "0 3px 10px rgba(211, 47, 47, 0.25)" : "none",
                                  transition: "background-color 0.15s ease, color 0.15s ease",
                                  "&:hover": {
                                    bgcolor: isSelectedEdge ? COLORS.primary : "rgba(211, 47, 47, 0.08)"
                                  }
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{
                                    fontWeight: isSelectedEdge || isInRange || isToday ? 800 : 600,
                                    fontSize: "0.88rem",
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums"
                                  }}
                                >
                                  {cell.day}
                                </Typography>

                                {/* Titik indikator jika tanggal memiliki riwayat penjualan */}
                                <Box
                                  sx={{
                                    width: 4.5,
                                    height: 4.5,
                                    borderRadius: "50%",
                                    mt: 0.4,
                                    bgcolor: hasRecapData
                                      ? (isSelectedEdge ? "white" : COLORS.secondary)
                                      : "transparent"
                                  }}
                                />
                              </Box>
                            </m.div>
                          );
                        })}
                      </Box>

                      {/* Footer Panduan & Aksi Kalender */}
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        gap={1}
                        mt={2}
                        pt={1.5}
                        borderTop="1px dashed #e6ddd6"
                      >
                        <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 700, lineHeight: 1.3 }}>
                          {!startDate
                            ? "Pilih tanggal mulai"
                            : !endDate
                              ? "1 tanggal dipilih • klik tanggal lain untuk rentang"
                              : "Rentang tanggal aktif"}
                        </Typography>

                        <Box display="flex" gap={1} sx={{ flexShrink: 0 }}>
                          {startDate && (
                            <Button
                              size="small"
                              onClick={resetDateFilter}
                              sx={{ fontWeight: 800, textTransform: "none", color: "#6E5D54", borderRadius: 2 }}
                            >
                              Reset
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => {
                              playTone("click");
                              setIsCalendarOpen(false);
                            }}
                            sx={{
                              bgcolor: "#2D2420",
                              fontWeight: 800,
                              textTransform: "none",
                              borderRadius: 2,
                              px: 2,
                              "&:hover": { bgcolor: "#1C1613" }
                            }}
                          >
                            Selesai
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </m.div>
                )}
              </AnimatePresence>

              {/* Ringkasan Filter Aktif */}
              {historyRecaps.length > 0 && (
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  px={2}
                  py={1.25}
                  bgcolor="rgba(45, 36, 32, 0.03)"
                  borderTop="1px solid #f0e8e2"
                >
                  <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 700 }}>
                    Menampilkan {filteredRecaps.length} Sesi
                  </Typography>
                  <Typography variant="body2" fontWeight={800} color={COLORS.primary} sx={{ fontVariantNumeric: "tabular-nums" }}>
                    Total: Rp {filteredRevenue.toLocaleString()}
                  </Typography>
                </Box>
              )}
            </Card>

            {filteredRecaps.length === 0 ? (
              <Box p={4} textAlign="center" bgcolor="white" borderRadius={4} border="1px dashed #ccc">
                <Receipt sx={{ fontSize: 50, color: "#ccc", mb: 1 }} />
                <Typography variant="body1" sx={{ color: "#6E5D54", fontWeight: 700 }}>
                  {startDate
                    ? `Tidak ada riwayat penjualan pada ${formatRangeSummary(startDate, endDate)}.`
                    : "Belum ada riwayat rekap tersimpan."}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <AnimatePresence>
                  {filteredRecaps.map((recap) => (
                    <m.div key={recap.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
                      <Card elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, bgcolor: "white" }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 700 }} display="block" mb={0.5}>
                            {recap.tanggalSesi}
                          </Typography>
                          <Typography variant="h6" fontWeight={900} color="#2D2420" sx={{ fontVariantNumeric: "tabular-nums" }}>
                            Rp {recap.totalRevenue?.toLocaleString()}
                          </Typography>
                          <Box display="flex" gap={1} mt={0.5}>
                            <Typography variant="body2" sx={{ color: "#6E5D54", fontWeight: 700 }}>
                              {recap.totalItems} Porsi
                            </Typography>
                            <Typography variant="body2" sx={{ color: "#6E5D54" }}>•</Typography>
                            <Typography variant="body2" sx={{ color: "#6E5D54", fontWeight: 700 }}>
                              {recap.totalOrders} Transaksi
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box display="flex" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
                          <Button 
                            variant="outlined" 
                            color="info" 
                            aria-label="Lihat rincian penjualan"
                            onClick={() => openDetail(recap)}
                            sx={{ minWidth: "44px", width: "44px", height: "44px", p: 0, borderRadius: 3 }}
                          >
                            <Visibility />
                          </Button>
                          <Button 
                            variant="outlined" 
                            color="error" 
                            aria-label="Hapus riwayat penjualan"
                            onClick={() => requestDeleteSingle(recap)}
                            sx={{ minWidth: "44px", width: "44px", height: "44px", p: 0, borderRadius: 3 }}
                          >
                            <Delete />
                          </Button>
                        </Box>
                      </Card>
                    </m.div>
                  ))}
                </AnimatePresence>
              </Box>
            )}
          </m.div>

        </m.div>
      </Container>
    </Box>
  );
}