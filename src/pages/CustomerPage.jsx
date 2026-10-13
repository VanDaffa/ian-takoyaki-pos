import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Box, Typography, Card, Button, IconButton, Chip, Divider, Paper,
  Checkbox, CssBaseline, Container, TextField, Snackbar, Alert, Switch,
  FormControlLabel, Drawer, Badge, LinearProgress, CircularProgress
} from "@mui/material";
import {
  Add, Remove, Restaurant, Delete, Send, Person, Storefront, LocalDrink,
  HourglassEmpty, CheckCircleOutline, CancelPresentation, NoFood, Stars,
  ContentCopy, Check, NotificationsActive, Instagram, AccessTime, ShoppingBag
} from "@mui/icons-material";
import { m, AnimatePresence, MotionConfig } from "framer-motion";
import { COLORS, VARIAN_ISIAN, SAUS_LIST } from "../utils/constants";
import { generateSmartName } from "../utils/helpers";
import { playTone } from "../utils/soundEngine";

import { db } from "../utils/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot, query, where } from "firebase/firestore";

// IMPORT GAMBAR QRIS
import qrisImage from "../assets/qris-ian.webp";

/* ============================================================
   KONSTANTA
   ============================================================ */

// Batas waktu pembayaran pesanan online (harus sama dengan worker auto-cancel di CashierPage)
const BATAS_BAYAR_DETIK = 15 * 60;

// Batas waktu tanpa sinyal dari kasir sebelum kedai dianggap tutup
const BATAS_HEARTBEAT_MENIT = 5;

const PAKET_CAMPUR = { sosis: 1, cumi: 1, kepiting: 1, keju: 1, kornet: 1, gurita: 0 };

const EMOJI_ISIAN = {
  sosis: "🌭", cumi: "🦑", kepiting: "🦀", keju: "🧀", kornet: "🥫", gurita: "🐙",
};

// Isi bagian ini kalau mau menampilkan tombol Instagram dan jam buka di layar "Kedai Tutup".
// Dibiarkan kosong = bagian tersebut tidak ditampilkan.
const INFO_KEDAI = {
  instagramUrl: "https://www.instagram.com/", // contoh: "https://instagram.com/akun_kamu"
  jamBuka: "Weekend, 16.00 - 22.00",      // contoh: "Setiap hari, 16.00 - 22.00"
};

const LANGKAH_STATUS = ["Bayar", "Antre", "Dimasak", "Siap"];

const TEKS_GELAP = "#212121";

/* ============================================================
   HELPER
   ============================================================ */

const formatRupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

const formatWaktu = (detik) => {
  const m = Math.floor(detik / 60);
  const s = detik % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const rapikanNama = (nama) => nama.trim().toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());

const nomorAntrian = (v) => {
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

// Warna chip (kontras putih di atas warna ini minimal 4,5:1)
const warnaChip = (nama) => {
  if (nama.includes("Sambel")) return "#c62828";
  if (nama.includes("Tomat")) return "#bf360c";
  if (nama.includes("Mayonaise")) return "#0277bd";
  if (nama === "Katsuobushi") return "#6d4c41";
  return "#616161";
};

const sxChip = (nama) => ({
  height: 24, fontSize: "0.75rem", fontWeight: 700, color: "white", bgcolor: warnaChip(nama),
});

/* ============================================================
   KOMPONEN KECIL
   ============================================================ */

function Shell({ children, centered = false, pt = 4, pb = 6 }) {
  return (
    <MotionConfig reducedMotion="user">
      <Box
        sx={{
          minHeight: "100vh", "@supports (height: 100dvh)": { minHeight: "100dvh" }, bgcolor: COLORS.background, pt, pb,
          ...(centered ? { display: "flex", alignItems: "center" } : {}),
        }}
      >
        <CssBaseline />
        {children}
      </Box>
    </MotionConfig>
  );
}

function StatusStepper({ aktif }) {
  return (
    <Box role="list" aria-label="Tahap pesanan" sx={{ display: "flex", alignItems: "flex-start", my: 3 }}>
      {LANGKAH_STATUS.map((label, i) => {
        const selesai = i < aktif;
        const sekarang = i === aktif;
        return (
          <React.Fragment key={label}>
            <Box role="listitem" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, minWidth: 56 }}>
              <Box
                component={m.div}
                animate={{ scale: sekarang ? 1.12 : 1 }}
                sx={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "0.8rem", fontWeight: 700,
                  bgcolor: selesai ? COLORS.success : sekarang ? "#fff" : "#f5f5f5",
                  color: selesai ? "#fff" : sekarang ? COLORS.primary : "#616161",
                  border: sekarang ? `2px solid ${COLORS.primary}` : selesai ? "none" : "1px solid #cfcfcf",
                }}
              >
                {selesai ? <Check sx={{ fontSize: 18 }} /> : i + 1}
              </Box>
              <Typography variant="caption" sx={{ fontWeight: sekarang ? 800 : 600, color: sekarang ? COLORS.textDark : "#616161" }}>
                {label}
              </Typography>
            </Box>
            {i < LANGKAH_STATUS.length - 1 && (
              <Box sx={{ flex: 1, height: 2, mt: "13px", bgcolor: i < aktif ? COLORS.success : "#e0e0e0" }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

function ChipTambahan({ item }) {
  if (item.type !== "food") return null;
  const sausPisah = item.sausesPisah || [];
  return (
    <Box display="flex" flexWrap="wrap" gap={0.75} mt={1}>
      {item.katsuobushi && <Chip label="Katsuobushi" size="small" sx={sxChip("Katsuobushi")} />}
      {(item.sauses || []).map((s) => (
        <Chip key={s} size="small" label={sausPisah.includes(s) ? `${s} (Pisah)` : s} sx={sxChip(s)} />
      ))}
    </Box>
  );
}

function RincianPesanan({ items = [], total }) {
  return (
    <Box sx={{ textAlign: "left", bgcolor: "#fafafa", p: 2.5, borderRadius: 3, border: "1px solid #eee" }}>
      <Typography variant="subtitle1" fontWeight={800} gutterBottom>🧾 Rincian pesanan</Typography>
      {items.map((item, idx) => (
        <Box key={idx} sx={{ py: 1.5, borderBottom: idx !== items.length - 1 ? "1px dashed #ddd" : "none" }}>
          <Box display="flex" justifyContent="space-between" gap={1}>
            <Typography fontWeight={700}>
              {item.type === "drink" ? item.nama : `${item.qty}x ${item.nama}`}
            </Typography>
            <Typography fontWeight={700} sx={{ whiteSpace: "nowrap" }}>{formatRupiah(item.harga)}</Typography>
          </Box>
          <ChipTambahan item={item} />
        </Box>
      ))}
      <Divider sx={{ my: 1.5 }} />
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography fontWeight={800}>Total</Typography>
        <Typography variant="h6" fontWeight={900} color={COLORS.primary}>{formatRupiah(total)}</Typography>
      </Box>
    </Box>
  );
}

function CountdownBar({ sisa }) {
  if (sisa === null) return null;
  const persen = Math.max(0, Math.min(100, (sisa / BATAS_BAYAR_DETIK) * 100));
  const warna = sisa > 300 ? COLORS.info : sisa > 120 ? "#b26a00" : "#c62828";
  const pesan =
    sisa > 300
      ? "Pesanan batal otomatis kalau waktu habis."
      : sisa > 120
        ? "Waktu tinggal sedikit. Segera selesaikan pembayaran."
        : "Hampir habis. Bayar sekarang atau pesanan dibatalkan.";
  return (
    <Box sx={{ mt: 2.5, textAlign: "left" }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
        <Box display="flex" alignItems="center" gap={0.75} color="text.secondary">
          <AccessTime sx={{ fontSize: 18 }} />
          <Typography variant="body2" fontWeight={600}>Sisa waktu konfirmasi</Typography>
        </Box>
        <Typography fontWeight={800} sx={{ color: sisa > 300 ? COLORS.textDark : warna, fontVariantNumeric: "tabular-nums" }}>
          {formatWaktu(sisa)}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={persen}
        sx={{ height: 8, borderRadius: 4, bgcolor: "#e0e0e0", "& .MuiLinearProgress-bar": { bgcolor: warna, borderRadius: 4 } }}
      />
      <Typography variant="caption" sx={{ display: "block", mt: 0.75, color: sisa > 120 ? "text.secondary" : "#c62828", fontWeight: 600 }}>
        {pesan}
      </Typography>
    </Box>
  );
}

function LangkahBayar() {
  const langkah = [
    "Scan QRIS dan ketik nominal sesuai angka di atas, atau bayar tunai langsung ke kasir.",
    "Tunjukkan bukti bayar ke kasir.",
    "Tunggu kasir mengonfirmasi, lalu pesananmu masuk antrean masak.",
  ];
  return (
    <Box sx={{ mt: 3, display: "flex", flexDirection: "column", gap: 1.5, textAlign: "left" }}>
      {langkah.map((teks, i) => (
        <Box key={i} display="flex" gap={1.5} alignItems="flex-start">
          <Box
            sx={{
              flex: "none", width: 24, height: 24, borderRadius: "50%", bgcolor: "#fff3e0",
              color: "#bf360c", fontWeight: 800, fontSize: "0.8rem", display: "flex",
              alignItems: "center", justifyContent: "center", border: "1px solid #ffcc80",
            }}
          >
            {i + 1}
          </Box>
          <Typography variant="body2" sx={{ pt: 0.25, lineHeight: 1.5 }}>{teks}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/* ============================================================
   HALAMAN PELANGGAN
   ============================================================ */

export default function CustomerPage() {
  const [modeRacik, setModeRacik] = useState("campur");

  const [isian, setIsian] = useState(PAKET_CAMPUR);
  const [sauses, setSauses] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [sausesPisah, setSausesPisah] = useState({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
  const [pakeKatsuobushi, setPakeKatsuobushi] = useState(false);
  const [qtyAir, setQtyAir] = useState(0);
  const [namaPelanggan, setNamaPelanggan] = useState("");
  const [namaError, setNamaError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [cart, setCart] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [flash, setFlash] = useState({ food: false, drink: false });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [activeOrderId, setActiveOrderId] = useState(localStorage.getItem("ian_takoyaki_active_order_id") || null);
  const [orderSnapshot, setOrderSnapshot] = useState(null);
  const [activeQueue, setActiveQueue] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // null = status kedai belum diketahui (belum ada data dari Firestore)
  const [shopData, setShopData] = useState(null);
  const [nowShop, setNowShop] = useState(() => Date.now());

  const namaRef = useRef(null);
  const flashTimer = useRef({});
  const prevStatus = useRef(null);
  const titleAsli = useRef(document.title);

  // Kedai dianggap buka kalau isOpen = true DAN kasir mengirim sinyal dalam 5 menit terakhir
  const isShopOpen =
    shopData === null
      ? null
      : !shopData.isOpen
        ? false
        : typeof shopData.lastActive?.toMillis !== "function"
          ? true
          : (nowShop - shopData.lastActive.toMillis()) / 60000 <= BATAS_HEARTBEAT_MENIT;

  const totalPilihan = Object.values(isian).filter((val) => val > 0).length;

  // Data pesanan aktif hanya berlaku selama ada activeOrderId
  const activeOrderData = activeOrderId ? orderSnapshot : null;

  /* ---------- Listener Firestore ---------- */

  // Status buka/tutup kedai. Data disimpan apa adanya; keputusan buka/tutup dihitung ulang
  // tiap 30 detik, jadi halaman yang dibiarkan terbuka ikut menutup saat kasir berhenti aktif.
  useEffect(() => {
    const unsubShop = onSnapshot(
      doc(db, "settings", "shop"),
      (docSnap) => setShopData(docSnap.exists() ? docSnap.data() : { isOpen: false }),
      (err) => {
        console.error("Gagal memuat status kedai:", err);
        setShopData({ isOpen: false }); // status tidak diketahui: jangan terima pesanan
      }
    );
    const id = setInterval(() => setNowShop(Date.now()), 30000);
    return () => { unsubShop(); clearInterval(id); };
  }, []);

  // Dokumen pesanan milik pelanggan ini
  useEffect(() => {
    if (!activeOrderId) return;
    const unsubDoc = onSnapshot(doc(db, "orders", activeOrderId), (docSnap) => {
      if (!docSnap.exists()) {
        localStorage.removeItem("ian_takoyaki_active_order_id");
        setActiveOrderId(null);
        setOrderSnapshot(null);
      } else {
        setOrderSnapshot(docSnap.data());
      }
    });
    return () => unsubDoc();
  }, [activeOrderId]);

  // Antrean aktif. Hanya membaca pesanan yang belum selesai/batal,
  // jadi jumlah baca Firestore tidak ikut membengkak seiring riwayat pesanan bertambah.
  useEffect(() => {
    const q = query(collection(db, "orders"), where("statusPesanan", "not-in", ["selesai", "batal"]));
    const unsubList = onSnapshot(
      q,
      (snapshot) => {
        setActiveQueue(snapshot.docs.map((d) => ({ id: d.id, noAntrian: d.data().noAntrian })));
      },
      (err) => {
        console.error("Gagal memuat antrean: ", err);
        setActiveQueue(null);
      }
    );
    return () => unsubList();
  }, []);

  // Pesanan yang sudah diterima kasir, diurutkan sesuai nomor antrean (urutan masak)
  const diterima = useMemo(
    () =>
      (activeQueue || [])
        .filter((o) => nomorAntrian(o.noAntrian) !== null)
        .sort((a, b) => nomorAntrian(a.noAntrian) - nomorAntrian(b.noAntrian)),
    [activeQueue]
  );
  const jumlahDiproses = activeQueue === null ? null : diterima.length;

  const antreanDiDepan = useMemo(() => {
    if (!activeOrderId || activeQueue === null) return null;
    const idx = diterima.findIndex((o) => o.id === activeOrderId);
    return idx === -1 ? null : idx;
  }, [diterima, activeOrderId, activeQueue]);

  /* ---------- Fase pesanan ---------- */

  const fase = !activeOrderData
    ? null
    : activeOrderData.statusPesanan === "selesai"
      ? "siap"
      : activeOrderData.statusPesanan === "batal"
        ? "batal"
        : activeOrderData.noAntrian === "Online"
          ? "bayar"
          : antreanDiDepan === 0
            ? "masak"
            : "antre";

  // Hitung mundur batas bayar (hanya tampilan; pembatalan sungguhan tetap oleh worker di kasir)
  const createdMs =
    typeof activeOrderData?.createdAt?.toMillis === "function" ? activeOrderData.createdAt.toMillis() : null;

  useEffect(() => {
    if (fase !== "bayar") return;
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(t0); clearInterval(id); };
  }, [fase]);

  const sisaDetik =
    fase === "bayar" && createdMs
      ? Math.max(0, Math.min(BATAS_BAYAR_DETIK, Math.round((createdMs + BATAS_BAYAR_DETIK * 1000 - now) / 1000)))
      : null;

  // Getar + bunyi saat status penting berubah (pembayaran diterima, giliran tiba, pesanan siap)
  useEffect(() => {
    if (!activeOrderData) { prevStatus.current = null; return; }
    const sekarang = {
      noAntrian: activeOrderData.noAntrian,
      ahead: antreanDiDepan,
      status: activeOrderData.statusPesanan,
    };
    const sebelum = prevStatus.current;
    if (sebelum) {
      const diterimaKasir = sebelum.noAntrian === "Online" && sekarang.noAntrian !== "Online" && sekarang.status === "antre";
      const giliranTiba = sebelum.ahead !== null && sebelum.ahead > 0 && sekarang.ahead === 0 && sekarang.status === "antre";
      const pesananSiap = sebelum.status !== "selesai" && sekarang.status === "selesai";
      if (diterimaKasir || giliranTiba || pesananSiap) {
        playTone("success");
        if (navigator.vibrate) navigator.vibrate(diterimaKasir ? 120 : [200, 100, 200, 100, 200]);
      }
    }
    prevStatus.current = sekarang;
  }, [activeOrderData, antreanDiDepan]);

  // Judul tab ikut berubah supaya terlihat di daftar tab
  useEffect(() => {
    const asli = titleAsli.current;
    if (fase === "masak") document.title = "Giliranmu! - Ian Takoyaki";
    else if (fase === "siap") document.title = "Pesananmu siap - Ian Takoyaki";
    return () => { document.title = asli; };
  }, [fase]);

  // Jaga layar tetap menyala selama menunggu, supaya pembaruan antrean tidak terhenti saat HP terkunci
  useEffect(() => {
    if (!(fase === "bayar" || fase === "antre" || fase === "masak")) return;
    if (!("wakeLock" in navigator)) return;
    let lock = null;
    let dibatalkan = false;
    const minta = async () => {
      try { lock = await navigator.wakeLock.request("screen"); } catch { /* ditolak browser, abaikan */ }
    };
    minta();
    const onVisible = () => { if (document.visibilityState === "visible" && !dibatalkan) minta(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      dibatalkan = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) lock.release().catch(() => {});
    };
  }, [fase]);

  useEffect(() => {
    const timers = flashTimer.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  /* ---------- Logika pemesanan ---------- */

  const hitungHargaPorsi = () => {
    const activeKeys = Object.keys(isian).filter((key) => isian[key] > 0);
    if (activeKeys.length === 0) return 15000;
    if (activeKeys.length === 1 && activeKeys.includes("gurita")) return 20000;
    return 15000;
  };

  const isGuritaOnly = () => {
    const activeKeys = Object.keys(isian).filter((key) => isian[key] > 0);
    return activeKeys.length === 1 && activeKeys.includes("gurita");
  };

  const gantiMode = (mode) => {
    if (mode === modeRacik) return;
    setModeRacik(mode);
    setIsian(mode === "campur" ? PAKET_CAMPUR : {});
    playTone("click");
  };

  const toggleIsian = (id) => {
    const isSelected = isian[id] > 0;
    if (isSelected) {
      setIsian({ ...isian, [id]: 0 });
      playTone("click");
    } else {
      if (totalPilihan >= 5) {
        setSnackbar({ open: true, message: "Maksimal pilih 5 isian ya kak!", severity: "warning" });
        return;
      }
      setIsian({ ...isian, [id]: 1 });
      playTone("click");
    }
  };

  const kilatkan = (jenis) => {
    setFlash((f) => ({ ...f, [jenis]: true }));
    clearTimeout(flashTimer.current[jenis]);
    flashTimer.current[jenis] = setTimeout(() => setFlash((f) => ({ ...f, [jenis]: false })), 1300);
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
      katsuobushi: pakeKatsuobushi, harga: hitungHargaPorsi(),
    };
    setCart([...cart, newItem]);
    if (modeRacik === "custom") setIsian({});
    setSauses({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setSausesPisah({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setPakeKatsuobushi(false);
    playTone("success");
    kilatkan("food");
  };

  const addDrinkToCart = () => {
    if (qtyAir === 0) {
      setSnackbar({ open: true, message: "Atur jumlah air mineral dulu ya!", severity: "warning" });
      return;
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
    setQtyAir(0);
    playTone("success");
    kilatkan("drink");
  };

  const duplicateItem = (item) => {
    setCart((prev) => [...prev, { ...item, id: Date.now() * 1000 + Math.floor(Math.random() * 1000) }]);
    playTone("click");
  };

  const removeFromCart = (id) => {
    setCart(cart.filter((item) => item.id !== id));
    playTone("delete");
  };

  const resetSesiPelanggan = () => {
    localStorage.removeItem("ian_takoyaki_active_order_id");
    setActiveOrderId(null);
    setOrderSnapshot(null);
    playTone("click");
  };

  // Buka layar "Cek pesananmu". Nama divalidasi di sini, bukan di akhir.
  const bukaReview = () => {
    if (namaPelanggan.trim() === "") {
      setNamaError(true);
      setShakeKey((k) => k + 1);
      namaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => namaRef.current?.querySelector("input")?.focus({ preventScroll: true }), 350);
      return;
    }
    setConfirmOpen(true);
    playTone("click");
  };

  const kirimPesanan = async () => {
    if (isSending) return;
    if (namaPelanggan.trim() === "") { setConfirmOpen(false); bukaReview(); return; }
    setIsSending(true);
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        noAntrian: "Online", namaPemesan: rapikanNama(namaPelanggan),
        jamMasuk: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        statusBayar: "belum", statusPesanan: "antre", items: cart.map((item) => ({ ...item, statusMasak: "dibuat" })),
        totalTagihan: cart.reduce((a, b) => a + b.harga, 0), createdAt: serverTimestamp(),
      });

      const infoId = docRef.id;
      localStorage.setItem("ian_takoyaki_active_order_id", infoId);
      setCart([]);
      setConfirmOpen(false);
      setActiveOrderId(infoId);
      playTone("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Firebase Error: ", error);
      setSnackbar({ open: true, message: "Waduh, koneksi drop. Coba kirim lagi ya!", severity: "error" });
    } finally {
      setIsSending(false);
    }
  };

  const salinNominal = async () => {
    try {
      await navigator.clipboard.writeText(String(activeOrderData.totalTagihan));
      setSnackbar({ open: true, message: "Nominal disalin. Tinggal tempel di aplikasi pembayaran.", severity: "success" });
    } catch {
      setSnackbar({ open: true, message: "Gagal menyalin. Ketik nominalnya manual ya.", severity: "warning" });
    }
  };

  const totalCartPrice = cart.reduce((a, b) => a + b.harga, 0);
  const jumlahItem = cart.reduce((a, b) => a + (b.qty || 1), 0);

  const snackbarEl = (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={2500}
      onClose={() => setSnackbar({ ...snackbar, open: false })}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      sx={{ mb: cart.length > 0 && !fase ? 10 : 2 }}
    >
      <Alert severity={snackbar.severity} variant="filled" sx={{ width: "100%", fontWeight: 700 }}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  );

  /* ============================================================
     LAYAR: PESANAN SIAP
     ============================================================ */
  if (fase === "siap") {
    return (
      <Shell centered pt={4} pb={4}>
        <Container maxWidth="sm">
          <m initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 6, bgcolor: "white", textAlign: "center", borderTop: `8px solid ${COLORS.success}` }}>
              <StatusStepper aktif={3} />
              <CheckCircleOutline sx={{ fontSize: 72, color: COLORS.success, mb: 1 }} />
              <Typography variant="h4" fontWeight={800} color="success.main" gutterBottom>
                SIAP DINIKMATI! 🎉
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Ambil di tenda dan sebut namamu.
              </Typography>
              <Box sx={{ bgcolor: "#e8f5e9", borderRadius: 4, p: 3, mb: 3 }}>
                <Typography variant="caption" sx={{ color: "#1b5e20", fontWeight: 700 }}>Atas nama</Typography>
                <Typography variant="h3" fontWeight={900} sx={{ color: "#1b5e20", lineHeight: 1.2, wordBreak: "break-word" }}>
                  {activeOrderData.namaPemesan}
                </Typography>
                {nomorAntrian(activeOrderData.noAntrian) !== null && (
                  <Typography variant="h6" fontWeight={800} sx={{ color: "#1b5e20", mt: 0.5 }}>
                    Antrean {nomorAntrian(activeOrderData.noAntrian)}
                  </Typography>
                )}
              </Box>
              <Button
                fullWidth variant="contained" size="large" onClick={resetSesiPelanggan}
                sx={{ py: 2, borderRadius: 4, fontWeight: 800, bgcolor: COLORS.success, "&:hover": { bgcolor: "#1b5e20" } }}
              >
                PESAN LAGI
              </Button>
            </Paper>
          </m>
        </Container>
      </Shell>
    );
  }

  /* ============================================================
     LAYAR: PESANAN DIBATALKAN
     ============================================================ */
  if (fase === "batal") {
    const alasan =
      activeOrderData.alasanBatal === "timeout"
        ? "Batas waktu pembayaran 15 menit terlewati."
        : activeOrderData.alasanBatal === "kasir" || activeOrderData.alasanBatal === "ditolak"
          ? "Pesanan dibatalkan oleh kasir. Tanyakan langsung ke kasir kalau ada yang kurang jelas."
          : "Pesanan dibatalkan karena melewati batas waktu pembayaran atau ditolak kasir.";
    return (
      <Shell centered pt={4} pb={4}>
        <Container maxWidth="sm">
          <m.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 6, bgcolor: "white", textAlign: "center", borderTop: "8px solid #c62828" }}>
              <CancelPresentation sx={{ fontSize: 72, color: "#c62828", mb: 1 }} />
              <Typography variant="h5" fontWeight={800} sx={{ color: "#c62828" }} gutterBottom>
                PESANAN DIBATALKAN
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Pesanan atas nama {activeOrderData.namaPemesan} tidak dilanjutkan.
              </Typography>
              <Alert severity="error" icon={false} sx={{ textAlign: "left", mb: 3, borderRadius: 3, fontWeight: 600 }}>
                <Typography variant="body2" fontWeight={800}>Alasan</Typography>
                {alasan}
              </Alert>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Kamu bisa memesan lagi kapan saja.
              </Typography>
              <Button
                fullWidth variant="contained" size="large" onClick={resetSesiPelanggan}
                sx={{ py: 2, borderRadius: 4, fontWeight: 800, bgcolor: COLORS.primary, "&:hover": { bgcolor: "#b71c1c" } }}
              >
                KEMBALI KE MENU
              </Button>
            </Paper>
          </m.div>
        </Container>
      </Shell>
    );
  }

  /* ============================================================
     LAYAR: MENUNGGU PEMBAYARAN, ANTRE, DIMASAK
     ============================================================ */
  if (fase === "bayar" || fase === "antre" || fase === "masak") {
    const indeksFase = { bayar: 0, antre: 1, masak: 2 }[fase];
    const judul = { bayar: "Menunggu pembayaran", antre: "Pembayaran diterima", masak: "Giliranmu!" }[fase];
    const subjudul = {
      bayar: `Halo ${activeOrderData.namaPemesan}, pesananmu sudah masuk. Bayar dulu supaya masuk antrean masak.`,
      antre: "Pesananmu sudah masuk antrean masak.",
      masak: "Pesananmu sedang dimasak, sebentar lagi siap.",
    }[fase];
    const warnaAtas = fase === "bayar" ? COLORS.info : fase === "masak" ? COLORS.success : COLORS.secondary;

    return (
      <Shell pt={4} pb={4}>
        <Container maxWidth="sm">
          <m.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
            <Paper elevation={4} sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: 6, bgcolor: "white", textAlign: "center", borderTop: `8px solid ${warnaAtas}` }}>
              <Typography variant="h5" fontWeight={800} gutterBottom>{judul}</Typography>
              <Typography variant="body2" color="text.secondary">{subjudul}</Typography>

              <StatusStepper aktif={indeksFase} />

              {fase === "bayar" && (
                <>
                  <Box sx={{ bgcolor: "#f5f5f5", borderRadius: 3, p: 2, mb: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">Bayar sesuai nominal ini</Typography>
                    <Typography sx={{ fontSize: "2.1rem", fontWeight: 900, color: COLORS.primary, lineHeight: 1.2 }}>
                      {formatRupiah(activeOrderData.totalTagihan)}
                    </Typography>
                    <Button size="small" startIcon={<ContentCopy />} onClick={salinNominal} sx={{ mt: 0.5, fontWeight: 700 }}>
                      Salin nominal
                    </Button>
                    <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.5 }}>
                      QRIS ini meminta kamu mengetik nominalnya sendiri.
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Box
                      component="img" src={qrisImage} alt="Kode QRIS Ian Takoyaki"
                      sx={{ width: "100%", maxWidth: 240, borderRadius: 3, border: "1px solid #e0e0e0" }}
                    />
                  </Box>

                  <CountdownBar sisa={sisaDetik} />
                  <LangkahBayar />
                </>
              )}

              {fase === "antre" && (
                <>
                  <Box sx={{ bgcolor: "#f5f5f5", borderRadius: 3, p: 3 }}>
                    {antreanDiDepan === null ? (
                      <Typography variant="body1" fontWeight={700} color="text.secondary">Menghitung antrean...</Typography>
                    ) : (
                      <>
                        <m.div key={antreanDiDepan} initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
                          <Typography sx={{ fontSize: "3.5rem", fontWeight: 900, lineHeight: 1.1, color: COLORS.primary }}>
                            {antreanDiDepan}
                          </Typography>
                        </m.div>
                        <Typography variant="body1" fontWeight={700} color="text.secondary">pesanan di depanmu</Typography>
                      </>
                    )}
                    {nomorAntrian(activeOrderData.noAntrian) !== null && (
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>
                        Nomor antreanmu: {nomorAntrian(activeOrderData.noAntrian)}
                      </Typography>
                    )}
                  </Box>
                  <Box display="flex" gap={1.5} alignItems="flex-start" textAlign="left" sx={{ mt: 2 }}>
                    <NotificationsActive sx={{ color: COLORS.info }} />
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                      Boleh jalan-jalan dulu. HP akan bergetar dan berbunyi saat giliranmu. Biarkan halaman ini tetap terbuka.
                    </Typography>
                  </Box>
                </>
              )}

              {fase === "masak" && (
                <>
                  <Box sx={{ bgcolor: "#e8f5e9", borderRadius: 3, p: 3, color: "#1b5e20" }}>
                    <m.div animate={{ opacity: [1, 0.45, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                      <HourglassEmpty sx={{ fontSize: 44 }} />
                    </m.div>
                    <Typography variant="h6" fontWeight={800}>Sedang dimasak</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 1.5 }}>
                    HP sudah bergetar. Tetap dekat tenda ya.
                  </Typography>
                </>
              )}

              <Box sx={{ mt: 3 }}>
                <RincianPesanan items={activeOrderData.items} total={activeOrderData.totalTagihan} />
              </Box>
            </Paper>
          </m.div>
        </Container>
        {snackbarEl}
      </Shell>
    );
  }

  /* ============================================================
     LAYAR: KEDAI TUTUP
     ============================================================ */
  if (isShopOpen === null) {
    return (
      <Shell centered pt={8} pb={8}>
        <Container maxWidth="sm" sx={{ textAlign: "center" }}>
          <CircularProgress sx={{ color: COLORS.primary }} />
          <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ mt: 2 }}>
            Memuat status kedai...
          </Typography>
        </Container>
      </Shell>
    );
  }

  if (isShopOpen === false) {
    return (
      <Shell centered pt={8} pb={8}>
        <Container maxWidth="sm">
          <m.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring" }}>
            <Paper elevation={4} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 6, bgcolor: "white", textAlign: "center", borderTop: "8px solid #757575" }}>
              <NoFood sx={{ fontSize: 72, color: "#757575", mb: 1 }} />
              <Typography variant="h5" fontWeight={800} gutterBottom>Kedai sedang tutup</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Maaf ya, pesanan online belum bisa diterima saat ini.
              </Typography>
              {INFO_KEDAI.jamBuka && (
                <Box display="flex" justifyContent="center" alignItems="center" gap={1} sx={{ mb: 2 }}>
                  <AccessTime sx={{ fontSize: 20, color: "text.secondary" }} />
                  <Typography variant="body2" fontWeight={700}>{INFO_KEDAI.jamBuka}</Typography>
                </Box>
              )}
              {INFO_KEDAI.instagramUrl && (
                <Button
                  variant="outlined" startIcon={<Instagram />} href={INFO_KEDAI.instagramUrl}
                  target="_blank" rel="noopener noreferrer"
                  sx={{ borderRadius: 3, fontWeight: 700, color: COLORS.textDark, borderColor: "#bdbdbd" }}
                >
                  Lihat info terbaru di Instagram
                </Button>
              )}
            </Paper>
          </m.div>
        </Container>
      </Shell>
    );
  }

  /* ============================================================
     LAYAR UTAMA: MEMESAN
     ============================================================ */
  return (
    <Shell pt={4} pb={cart.length > 0 ? 16 : 6}>
      <Container maxWidth="sm">
        {/* HEADER */}
        <m.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Storefront sx={{ fontSize: 56, color: COLORS.primary }} />
            <Typography variant="h4" fontWeight={900} color={COLORS.info} sx={{ fontSize: { xs: "1.8rem", sm: "2.125rem" } }}>IAN TAKOYAKI</Typography>
            <Typography variant="body2" fontWeight={700} color="text.secondary">Pesan langsung dari HP kamu!</Typography>
            <Chip
              size="small" icon={<AccessTime />}
              label={
                jumlahDiproses === null
                  ? "Memuat antrean..."
                  : jumlahDiproses === 0
                    ? "Antrean kosong, langsung dimasak"
                    : `${jumlahDiproses} pesanan sedang diproses`
              }
              sx={{ mt: 1.5, fontWeight: 700, bgcolor: "white", border: "1px solid #ddd" }}
            />
          </Box>
        </m.div>

        {/* NAMA */}
        <Box ref={namaRef}>
          <m.div key={shakeKey} animate={shakeKey ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
            <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 4, borderTop: `6px solid ${COLORS.success}`, bgcolor: "white" }}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Person sx={{ color: COLORS.success }} />
                <Typography variant="h6" fontWeight={800} color={COLORS.success}>Data pelanggan</Typography>
              </Box>
              <TextField
                fullWidth label="Siapa namamu, Kak? (wajib)" placeholder="Misal: Kak Budi"
                value={namaPelanggan} error={namaError}
                onChange={(e) => { setNamaPelanggan(e.target.value); if (namaError) setNamaError(false); }}
                helperText={namaError ? "Isi nama dulu ya, biar kasir tahu siapa yang dipanggil." : "Nama ini dipanggil saat pesananmu siap."}
                slotProps={{ htmlInput: { autoComplete: "given-name", maxLength: 30 }, formHelperText: { sx: { ml: 0.5 } } }}
              />
            </Paper>
          </m.div>
        </Box>

        {/* MENU TAKOYAKI */}
        <Paper
          component={m.div} layout elevation={2}
          sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 4, borderTop: `6px solid ${COLORS.primary}`, bgcolor: "white", overflow: "hidden" }}
        >
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Restaurant sx={{ color: COLORS.primary }} />
            <Typography variant="h6" fontWeight={800}>Menu takoyaki</Typography>
          </Box>

          {/* PILIH MODE */}
          <Box role="tablist" aria-label="Cara memesan" sx={{ display: "flex", bgcolor: "#eeeeee", p: 0.5, borderRadius: 4, mb: 3, position: "relative" }}>
            {[
              { id: "campur", label: "PAKET CAMPUR", warna: COLORS.secondary, teks: TEKS_GELAP },
              { id: "custom", label: "RACIK SENDIRI", warna: COLORS.primary, teks: "#fff" },
            ].map((tab) => {
              const aktif = modeRacik === tab.id;
              return (
                <Box
                  key={tab.id} role="tab" aria-selected={aktif} tabIndex={0}
                  onClick={() => gantiMode(tab.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); gantiMode(tab.id); } }}
                  sx={{
                    flex: 1, textAlign: "center", py: 1.5, cursor: "pointer", position: "relative", zIndex: 1,
                    borderRadius: 3.5, px: 1, lineHeight: 1.3, fontWeight: 800, fontSize: { xs: "0.78rem", sm: "0.9rem" },
                    color: aktif ? tab.teks : "#616161", transition: "color 0.2s",
                  }}
                >
                  {aktif && (
                    <m.div
                      layoutId="activeTabMode"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      style={{ position: "absolute", inset: 0, background: tab.warna, borderRadius: 14, zIndex: -1 }}
                    />
                  )}
                  {tab.label}
                </Box>
              );
            })}
          </Box>

          <AnimatePresence mode="wait">
            {modeRacik === "campur" ? (
              <m.div key="campur" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <Box sx={{ textAlign: "center", p: 2.5, bgcolor: "#fff3e0", borderRadius: 3, border: "1px dashed #ffb74d" }}>
                  <Typography variant="subtitle1" fontWeight={800} color="#bf360c" gutterBottom>Paket anti pusing!</Typography>
                  <Typography sx={{ fontSize: "1.6rem", letterSpacing: 4 }} aria-hidden="true">🌭🦑🦀🧀🥫</Typography>
                  <Typography variant="body2" sx={{ color: "#424242", mt: 0.5 }}>
                    Isi: sosis, cumi, kepiting, keju, kornet.
                  </Typography>
                  <Typography variant="h6" fontWeight={900} color={COLORS.primary} sx={{ mt: 1 }}>Rp 15.000</Typography>
                </Box>
              </m.div>
            ) : (
              <m.div key="custom" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle1" fontWeight={800}>Pilih isian</Typography>
                  <Chip
                    label={`${totalPilihan}/5`} size="small"
                    sx={{ fontWeight: 800, bgcolor: totalPilihan === 5 ? COLORS.primary : "#e0e0e0", color: totalPilihan === 5 ? "white" : COLORS.textDark }}
                  />
                </Box>
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1.5 }}>
                  Pilih hingga 5 isian, boleh campur beberapa jenis.
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5, mb: 1.5 }}>
                  {VARIAN_ISIAN.map((item) => {
                    const isSelected = isian[item.id] > 0;
                    const isPremium = item.id === "gurita";
                    return (
                      <Card
                        key={item.id} component={m.div} whileTap={{ scale: 0.95 }}
                        role="checkbox" aria-checked={isSelected} tabIndex={0}
                        onClick={() => toggleIsian(item.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleIsian(item.id); } }}
                        elevation={0}
                        sx={{
                          position: "relative", cursor: "pointer", textAlign: "center", py: 1.5, px: 0.5,
                          borderRadius: 3, transition: "all 0.2s",
                          border: isSelected ? `2px solid ${COLORS.primary}` : "2px solid #e0e0e0",
                          bgcolor: isSelected ? "#ffebee" : "#fafafa",
                        }}
                      >
                        <Typography sx={{ fontSize: "1.6rem", lineHeight: 1.2 }} aria-hidden="true">{EMOJI_ISIAN[item.id]}</Typography>
                        <Typography sx={{ fontSize: "0.8rem", fontWeight: 800, color: isSelected ? COLORS.primary : "#424242" }}>
                          {item.label}
                        </Typography>
                        {isPremium && (
                          <Chip
                            icon={<Stars sx={{ fontSize: 14, color: `${TEKS_GELAP} !important` }} />} label="Premium" size="small"
                            sx={{ mt: 0.5, height: 22, fontSize: "0.75rem", fontWeight: 800, bgcolor: "#ffb300", color: TEKS_GELAP }}
                          />
                        )}
                        <AnimatePresence>
                          {isSelected && (
                            <m.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                              style={{ position: "absolute", top: 6, right: 6, display: "flex" }}
                            >
                              <Check sx={{ fontSize: 18, color: COLORS.primary }} />
                            </m.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    );
                  })}
                </Box>

                <AnimatePresence>
                  {isGuritaOnly() && (
                    <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <Alert severity="warning" sx={{ mb: 1.5, borderRadius: 2, fontWeight: 700 }}>
                        Gurita sendirian harganya Rp 20.000. Digabung isian lain, tetap Rp 15.000.
                      </Alert>
                    </m.div>
                  )}
                </AnimatePresence>
              </m.div>
            )}
          </AnimatePresence>

          <Divider sx={{ my: 3 }} />

          {/* TAMBAHAN & SAUS */}
          <m.div layout="position">
            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Tambahan dan saus (gratis)</Typography>
            <FormControlLabel
              control={<Checkbox checked={pakeKatsuobushi} onChange={(e) => setPakeKatsuobushi(e.target.checked)} sx={{ "&.Mui-checked": { color: COLORS.secondary } }} />}
              label={<Typography fontWeight={700}>Topping katsuobushi</Typography>}
              sx={{ mb: 1 }}
            />

            <Typography variant="subtitle2" fontWeight={800} sx={{ mt: 1 }}>Pilihan saus</Typography>
            <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mb: 1 }}>
              Boleh lebih dari satu. Centang saus, lalu aktifkan "Pisah saus" kalau mau saus dipisah dari takoyaki.
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {SAUS_LIST.map((saus) => (
                <Box key={saus}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={sauses[saus]}
                        onChange={(e) => {
                          setSauses({ ...sauses, [saus]: e.target.checked });
                          if (!e.target.checked) setSausesPisah({ ...sausesPisah, [saus]: false });
                        }}
                        sx={{ "&.Mui-checked": { color: COLORS.secondary } }}
                      />
                    }
                    label={<Typography fontWeight={700}>{saus}</Typography>}
                  />
                  <AnimatePresence>
                    {sauses[saus] && (
                      <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
                        <FormControlLabel
                          sx={{ ml: 4 }}
                          control={
                            <Switch
                              size="small" checked={sausesPisah[saus]}
                              onChange={(e) => setSausesPisah({ ...sausesPisah, [saus]: e.target.checked })}
                            />
                          }
                          label={<Typography variant="body2" fontWeight={600}>Pisah saus</Typography>}
                        />
                      </m.div>
                    )}
                  </AnimatePresence>
                </Box>
              ))}
            </Box>
          </m.div>

          <Divider sx={{ my: 3 }} />

          {/* PRATINJAU + TOMBOL */}
          <m.div layout="position">
            <Box sx={{ bgcolor: "#f5f5f5", borderRadius: 3, p: 2, mb: 2 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">Racikanmu</Typography>
              <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography fontWeight={800}>
                  {totalPilihan === 0 ? "Pilih isian di atas, yuk" : generateSmartName(isian)}
                </Typography>
                {totalPilihan > 0 && (
                  <m.span key={hitungHargaPorsi()} initial={{ scale: 1.2 }} animate={{ scale: 1 }} style={{ fontWeight: 900, color: COLORS.primary, whiteSpace: "nowrap" }}>
                    {formatRupiah(hitungHargaPorsi())}
                  </m.span>
                )}
              </Box>
            </Box>
            <Button
              fullWidth variant="contained" onClick={addTakoyakiToCart}
              startIcon={flash.food ? <Check /> : <Add />}
              sx={{
                py: 1.8, borderRadius: 3, fontWeight: 800, fontSize: "1rem",
                bgcolor: flash.food ? COLORS.success : COLORS.primary,
                "&:hover": { bgcolor: flash.food ? COLORS.success : "#b71c1c" },
              }}
            >
              {flash.food ? "MASUK KERANJANG" : "MASUKKAN KE KERANJANG"}
            </Button>
          </m.div>
        </Paper>

        {/* MENU MINUMAN */}
        <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 4, borderTop: `6px solid ${COLORS.info}`, bgcolor: "white" }}>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <LocalDrink sx={{ color: COLORS.info }} />
            <Typography variant="h6" fontWeight={800} color={COLORS.info}>Menu minuman</Typography>
          </Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography fontWeight={800}>Air mineral</Typography>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>Dingin atau biasa, Rp 5.000 per botol</Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1} sx={{ border: `1px solid ${COLORS.info}`, borderRadius: 3, p: 0.5 }}>
              <IconButton aria-label="Kurangi jumlah" size="small" onClick={() => { setQtyAir(Math.max(0, qtyAir - 1)); playTone("click"); }} sx={{ color: COLORS.info }}>
                <Remove />
              </IconButton>
              <Typography fontWeight={800} sx={{ minWidth: 24, textAlign: "center" }}>{qtyAir}</Typography>
              <IconButton aria-label="Tambah jumlah" size="small" onClick={() => { setQtyAir(qtyAir + 1); playTone("click"); }} sx={{ color: COLORS.info }}>
                <Add />
              </IconButton>
            </Box>
          </Box>
          <Button
            fullWidth variant="contained" onClick={addDrinkToCart}
            startIcon={flash.drink ? <Check /> : <Add />}
            sx={{
              py: 1.5, borderRadius: 3, fontWeight: 800,
              bgcolor: flash.drink ? COLORS.success : "#01579b",
              "&:hover": { bgcolor: flash.drink ? COLORS.success : "#014377" },
            }}
          >
            {flash.drink ? "MASUK KERANJANG" : `TAMBAH MINUMAN${qtyAir > 0 ? ` (${formatRupiah(qtyAir * 5000)})` : ""}`}
          </Button>
        </Paper>

        {/* KERANJANG */}
        <AnimatePresence>
          {cart.length > 0 && (
            <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Paper elevation={2} sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 4, bgcolor: "white" }}>
                <Typography variant="h6" fontWeight={800} gutterBottom>🛒 Keranjang pesanan</Typography>
                <AnimatePresence initial={false}>
                  {cart.map((item) => (
                    <m.div
                      key={item.id} layout="position"
                      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
                    >
                      <Box sx={{ py: 1.5, borderBottom: "1px dashed #ddd" }}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" columnGap={1}>
                          <Typography fontWeight={800} sx={{ flex: "1 1 130px", minWidth: 0, pt: 0.5, overflowWrap: "break-word" }}>{item.nama}</Typography>
                          <Box display="flex" alignItems="center" gap={0.25} sx={{ flexShrink: 0, ml: "auto" }}>
                            <Typography fontWeight={800} sx={{ whiteSpace: "nowrap", mr: 0.5 }}>{formatRupiah(item.harga)}</Typography>
                            {item.type === "food" ? (
                              <IconButton aria-label="Tambah porsi yang sama" onClick={() => duplicateItem(item)} sx={{ color: COLORS.info, p: 1 }}>
                                <ContentCopy fontSize="small" />
                              </IconButton>
                            ) : (
                              <Box sx={{ width: 36, flexShrink: 0 }} aria-hidden="true" />
                            )}
                            <IconButton aria-label="Hapus dari keranjang" onClick={() => removeFromCart(item.id)} sx={{ color: "#c62828", p: 1 }}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        <ChipTambahan item={item} />
                      </Box>
                    </m.div>
                  ))}
                </AnimatePresence>
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                  <Typography fontWeight={800}>Total</Typography>
                  <Typography variant="h6" fontWeight={900} color={COLORS.primary}>{formatRupiah(totalCartPrice)}</Typography>
                </Box>
                <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 1.5 }}>
                  Setelah dikirim, kamu akan diminta membayar lewat QRIS atau tunai ke kasir. Kamu juga bisa memantau antrean langsung dari HP.
                </Typography>
              </Paper>
            </m.div>
          )}
        </AnimatePresence>
      </Container>

      {/* BAR TOTAL (NEMPEL DI BAWAH) */}
      <AnimatePresence>
        {cart.length > 0 && (
          <m.div
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1100 }}
          >
            <Paper
              elevation={10}
              sx={{ px: 2, pt: 2, pb: "calc(16px + env(safe-area-inset-bottom))", borderTopLeftRadius: 24, borderTopRightRadius: 24, bgcolor: "white" }}
            >
              <Container maxWidth="sm" disableGutters sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                <Box display="flex" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
                  <Badge
                    color="error"
                    sx={{ display: "none", "@media (min-width:400px)": { display: "inline-flex" } }}
                    badgeContent={
                      <m.span key={jumlahItem} initial={{ scale: 1.6 }} animate={{ scale: 1 }} style={{ display: "inline-block" }}>
                        {jumlahItem}
                      </m.span>
                    }
                  >
                    <ShoppingBag sx={{ fontSize: 30, color: COLORS.textDark }} />
                  </Badge>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: "block", lineHeight: 1.2 }}>
                      Total
                      <Box component="span" sx={{ "@media (min-width:400px)": { display: "none" } }}> · {jumlahItem} item</Box>
                    </Typography>
                    <m.span
                      key={totalCartPrice} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
                      style={{ display: "inline-block", fontWeight: 900, fontSize: "clamp(1.05rem, 5vw, 1.4rem)", color: COLORS.primary, whiteSpace: "nowrap" }}
                    >
                      {formatRupiah(totalCartPrice)}
                    </m.span>
                  </Box>
                </Box>
                <Button
                  variant="contained" onClick={bukaReview} endIcon={<Send />}
                  sx={{
                    flexShrink: 0, whiteSpace: "nowrap", py: 1.5, px: { xs: 2, sm: 3 }, borderRadius: 4, fontWeight: 800,
                    fontSize: { xs: "0.85rem", sm: "0.95rem" }, bgcolor: COLORS.textDark, "&:hover": { bgcolor: "#000" },
                    "& .MuiButton-endIcon": { ml: 0.75 },
                  }}
                >
                  CEK PESANAN
                </Button>
              </Container>
            </Paper>
          </m.div>
        )}
      </AnimatePresence>

      {/* LAYAR CEK PESANAN SEBELUM DIKIRIM */}
      <Drawer
        anchor="bottom" open={confirmOpen}
        onClose={() => { if (!isSending) setConfirmOpen(false); }}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88vh" } } }}
      >
        <Container maxWidth="sm" sx={{ py: 3 }}>
          <Typography variant="h6" fontWeight={800}>Cek pesananmu dulu ya</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pastikan nama dan isinya sudah benar sebelum dikirim.
          </Typography>
          <Box sx={{ bgcolor: "#e8f5e9", borderRadius: 3, p: 2, mb: 2 }}>
            <Typography variant="caption" fontWeight={700} sx={{ color: "#1b5e20" }}>Atas nama</Typography>
            <Typography variant="h6" fontWeight={900} sx={{ color: "#1b5e20" }}>{rapikanNama(namaPelanggan)}</Typography>
          </Box>
          <RincianPesanan items={cart} total={totalCartPrice} />
          <Box display="flex" gap={1.5} sx={{ mt: 3 }}>
            <Button fullWidth variant="outlined" onClick={() => setConfirmOpen(false)} disabled={isSending} sx={{ py: 1.5, borderRadius: 3, fontWeight: 800 }}>
              KEMBALI
            </Button>
            <Button
              fullWidth variant="contained" onClick={kirimPesanan} disabled={isSending}
              startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <Send />}
              sx={{ py: 1.5, borderRadius: 3, fontWeight: 800, bgcolor: COLORS.primary, "&:hover": { bgcolor: "#b71c1c" } }}
            >
              {isSending ? "MENGIRIM..." : "KIRIM PESANAN"}
            </Button>
          </Box>
        </Container>
      </Drawer>

      {snackbarEl}
    </Shell>
  );
}