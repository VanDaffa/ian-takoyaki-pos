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
  FormGroup,
  CssBaseline,
  useMediaQuery,
  useTheme,
  Collapse,
  CardActionArea,
  Tooltip,
  Snackbar,
  Alert,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import {
  Add,
  Remove,
  WaterDrop,
  Restaurant,
  CheckCircle,
  AttachMoney,
  DoneAll,
  Kitchen,
  Person,
  Delete,
  RestartAlt,
  ShoppingBasket,
  Timer,
} from "@mui/icons-material";

// --- KONFIGURASI WARNA (IAN TAKOYAKI) ---
const COLORS = {
  primary: "#d32f2f",
  secondary: "#f57c00",
  background: "#fff3e0",
  cardSelected: "#ffffff",
  textDark: "#0a0a0a",
  textGrey: "#424242",
  success: "#2e7d32",
  warning: "#ed6c02",
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

function App() {
  // --- STATE ---
  const [isian, setIsian] = useState({});
  const [sauses, setSauses] = useState({
    "Saus Sambel": false,
    "Saus Tomat": false,
    Mayonaise: false,
  });
  const [pakeKatsuobushi, setPakeKatsuobushi] = useState(false);
  const [isCampurMode, setIsCampurMode] = useState(false);
  const [qtyAir, setQtyAir] = useState(1);

  const [nomorAntrian, setNomorAntrian] = useState(1);
  const [namaPelanggan, setNamaPelanggan] = useState("");

  const [tempCart, setTempCart] = useState([]);
  const [masterQueue, setMasterQueue] = useState([]);

  // State Khusus Countdown Delete
  const [deletingId, setDeletingId] = useState(null); // ID Antrian yang sedang menghitung mundur
  const [countdown, setCountdown] = useState(3); // Angka hitung mundur

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

  // --- HELPER ---
  const getJamSekarang = () =>
    new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  const getNamaFinal = () =>
    namaPelanggan.trim() === "" ? `Pelanggan #${nomorAntrian}` : namaPelanggan;

  // --- EFFECT: COUNTDOWN LOGIC ---
  useEffect(() => {
    let timer;
    if (deletingId !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (deletingId !== null && countdown === 0) {
      // Waktu habis, hapus data!
      setMasterQueue((prev) => prev.filter((p) => p.noAntrian !== deletingId));
      setDeletingId(null);
      setSnackbar({
        open: true,
        message: "Pesanan Selesai & Dihapus!",
        severity: "success",
      });
    }
    return () => clearTimeout(timer);
  }, [countdown, deletingId]);

  // --- LOGIC FORM ---
  const handleGantiIsian = (id, delta) => {
    if (isCampurMode) setIsCampurMode(false);
    const currentQty = isian[id] || 0;
    if (currentQty + delta < 0) return;
    if (delta > 0 && totalButir >= 5) return;
    setIsian({ ...isian, [id]: currentQty + delta });
  };

  const handleSetMax = (id) => {
    setIsian({ [id]: 5 });
    setIsCampurMode(false);
  };

  const setPaketCampur = () => {
    setIsian({ sosis: 1, cumi: 1, kepiting: 1, keju: 1, kornet: 1, gurita: 0 });
    setIsCampurMode(true);
  };

  const handleSausChange = (saus) =>
    setSauses({ ...sauses, [saus]: !sauses[saus] });
  const toggleSemuaSaus = () => {
    const allSelected = Object.values(sauses).every((val) => val === true);
    setSauses({
      "Saus Sambel": !allSelected,
      "Saus Tomat": !allSelected,
      Mayonaise: !allSelected,
    });
  };

  const resetFormTakoyaki = () => {
    setIsian({});
    setSauses({ "Saus Sambel": false, "Saus Tomat": false, Mayonaise: false });
    setPakeKatsuobushi(false);
    setIsCampurMode(false);
  };

  const hitungHargaPorsi = () => {
    if (totalButir === 0) return 0;
    return isian["gurita"] === 5 ? 20000 : 15000;
  };

  // --- LOGIC DRAFT & FINAL ---
  const tambahKeTemp = () => {
    if (totalButir === 0) return;
    let namaMenu = "Takoyaki Custom";
    if (isCampurMode) namaMenu = "Takoyaki Campur";
    else if (isian["gurita"] === 5) namaMenu = "Takoyaki Full Gurita";

    const itemDraft = {
      id: Date.now(),
      nama: namaMenu,
      type: "food",
      qty: 1,
      detail: isian,
      sauses: Object.keys(sauses).filter((key) => sauses[key]),
      katsuobushi: pakeKatsuobushi,
      harga: hitungHargaPorsi(),
    };

    setTempCart([...tempCart, itemDraft]);
    resetFormTakoyaki();
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const tambahAirKeTemp = () => {
    const itemDraft = {
      id: Date.now(),
      nama: `Air Mineral (${qtyAir}x)`,
      type: "drink",
      qty: qtyAir,
      detail: {},
      sauses: [],
      harga: 5000 * qtyAir,
    };
    setTempCart([...tempCart, itemDraft]);
    setQtyAir(1);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  const hapusDariTemp = (id) => {
    setTempCart(tempCart.filter((item) => item.id !== id));
  };

  const prosesPesananFinal = () => {
    if (tempCart.length === 0) return;
    const finalItems = tempCart.map((draft) => ({
      ...draft,
      noAntrian: nomorAntrian,
      namaPemesan: getNamaFinal(),
      jamMasuk: getJamSekarang(),
      statusMasak: "dibuat", // Default belum masak
      statusBayar: "belum",
    }));

    setMasterQueue([...finalItems, ...masterQueue]);
    setSnackbar({
      open: true,
      message: `Pesanan Antrian #${nomorAntrian} Masuk Dapur!`,
      severity: "success",
    });
    setTempCart([]);
    setNomorAntrian((prev) => prev + 1);
    setNamaPelanggan("");
    setExpandedAntrian(nomorAntrian);
  };

  // --- LOGIC DAPUR ---
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
    (a, b) => b.noAntrian - a.noAntrian,
  );

  // Toggle Checklist (Hanya Visual)
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
  };

  const hapusDariMaster = (itemId) => {
    setMasterQueue((prev) => prev.filter((p) => p.id !== itemId));
  };

  const handleBayarLunasGroup = (noAntrian) => {
    setMasterQueue((prev) =>
      prev.map((p) =>
        p.noAntrian === noAntrian ? { ...p, statusBayar: "lunas" } : p,
      ),
    );
    setSnackbar({
      open: true,
      message: "Pembayaran LUNAS! ✅",
      severity: "success",
    });
  };

  // Trigger Countdown Delete
  const startDeleteSequence = (noAntrian) => {
    const groupItems = masterQueue.filter((p) => p.noAntrian === noAntrian);
    const isLunas = groupItems.every((p) => p.statusBayar === "lunas");

    if (!isLunas) {
      setSnackbar({
        open: true,
        message: "⚠️ Pesanan belum LUNAS! Tagih dulu ya.",
        severity: "warning",
      });
      return;
    }

    setCountdown(3); // Reset timer ke 3 detik
    setDeletingId(noAntrian); // Mulai sequence
  };

  // Batalkan Countdown (Opsional, jika kasir panik salah pencet)
  const cancelDelete = () => {
    setDeletingId(null);
    setCountdown(3);
  };

  // --- RENDER ---
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
        {/* === KOLOM KIRI: DAFTAR PESANAN (DAPUR) === */}
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
                  Belum ada pesanan masuk nih
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  Yuk siap-siap masak! 🐙
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {sortedGroups.map((group) => {
                  const isAllLunas = group.items.every(
                    (i) => i.statusBayar === "lunas",
                  );
                  const isAllSelesai = group.items.every(
                    (i) => i.statusMasak === "selesai",
                  ); // Semua item terchecklist
                  const isDeleting = deletingId === group.noAntrian; // Sedang menghitung mundur

                  return (
                    <Card
                      key={group.noAntrian}
                      elevation={3}
                      sx={{
                        borderRadius: 3,
                        border: isDeleting
                          ? `4px solid ${COLORS.warning}`
                          : isAllLunas
                            ? `2px solid ${COLORS.success}`
                            : `2px solid ${COLORS.primary}`,
                        bgcolor: isDeleting
                          ? "#fff3e0"
                          : isAllLunas
                            ? "#c8e6c9"
                            : "white",
                        transition: "all 0.3s",
                        transform: isDeleting ? "scale(0.98)" : "scale(1)",
                        opacity: isDeleting ? 0.8 : 1,
                      }}
                    >
                      <CardActionArea
                        onClick={() =>
                          setExpandedAntrian(
                            expandedAntrian === group.noAntrian
                              ? null
                              : group.noAntrian,
                          )
                        }
                        sx={{
                          p: 2.5,
                          bgcolor:
                            isAllLunas && !isDeleting ? "#e8f5e9" : "inherit",
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
                      </CardActionArea>
                      <Collapse
                        in={expandedAntrian === group.noAntrian}
                        unmountOnExit
                      >
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
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      color: COLORS.textGrey,
                                      fontSize: "1.05rem",
                                      mt: 0.5,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    {Object.entries(item.detail)
                                      .map(([k, v]) =>
                                        v > 0 ? `${k}(${v})` : "",
                                      )
                                      .filter(Boolean)
                                      .join(", ")}
                                    <br />
                                    <span
                                      style={{
                                        color: COLORS.primary,
                                        fontWeight: 500,
                                      }}
                                    >
                                      {item.sauses.join(", ")}
                                      {item.katsuobushi ? ", Katsuobushi" : ""}
                                    </span>
                                  </Typography>
                                )}
                              </Box>
                              <Box display="flex" gap={1} alignItems="center">
                                {/* CHECKLIST: Toggle Saja */}
                                <IconButton
                                  onClick={() => toggleStatusMasakItem(item)}
                                  color={
                                    item.statusMasak === "selesai"
                                      ? "success"
                                      : "default"
                                  }
                                >
                                  <CheckCircle sx={{ fontSize: 32 }} />
                                </IconButton>
                                <IconButton
                                  color="error"
                                  onClick={() => hapusDariMaster(item.id)}
                                >
                                  <Delete sx={{ fontSize: 32 }} />
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
                            <Button
                              fullWidth
                              variant="contained"
                              size="large"
                              color={isAllLunas ? "success" : "error"}
                              onClick={() =>
                                handleBayarLunasGroup(group.noAntrian)
                              }
                              startIcon={<AttachMoney />}
                              disabled={isAllLunas}
                              sx={{ fontSize: "1rem", fontWeight: "bold" }}
                            >
                              {isAllLunas ? "LUNAS" : "BAYAR SEMUA"}
                            </Button>

                            {/* TOMBOL DELETE DENGAN COUNTDOWN */}
                            {isDeleting ? (
                              <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                sx={{
                                  bgcolor: COLORS.warning,
                                  color: "white",
                                  fontSize: "1rem",
                                  fontWeight: "bold",
                                }}
                                onClick={cancelDelete}
                                startIcon={<Timer />}
                              >
                                BATALKAN ({countdown})
                              </Button>
                            ) : (
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
                                  startDeleteSequence(group.noAntrian)
                                }
                                startIcon={<Kitchen />}
                              >
                                SELESAI SAJIKAN
                              </Button>
                            )}
                          </Box>
                        </Box>
                      </Collapse>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Box>

        {/* === KOLOM KANAN: INPUT & DRAFT === */}
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
            🐙 Buat Pesanan Baru
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
              value={namaPelanggan}
              onChange={(e) => setNamaPelanggan(e.target.value)}
              placeholder={`Pelanggan #${nomorAntrian}`}
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
              *Mengisi untuk Antrian #{nomorAntrian}
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{ p: 2, mb: 2, borderRadius: 4, bgcolor: "white" }}
          >
            <Grid container spacing={2} mb={3}>
              <Grid item xs={6}>
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
                    onClick={() => setQtyAir(Math.max(1, qtyAir - 1))}
                    sx={{ width: "50px", height: "100%" }}
                  >
                    <Remove />
                  </IconButton>
                  <Button
                    fullWidth
                    onClick={tambahAirKeTemp}
                    startIcon={<WaterDrop />}
                    sx={{
                      color: COLORS.secondary,
                      fontSize: "1.1rem",
                      fontWeight: "bold",
                    }}
                  >
                    AIR ({qtyAir})
                  </Button>
                  <IconButton
                    onClick={() => setQtyAir(qtyAir + 1)}
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
              {/* RESTORED: Counter Isian (X/5) */}
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
                  <Tooltip title="Klik 2x = Max">
                    <Card
                      elevation={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGantiIsian(item.id, 1);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleSetMax(item.id);
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
                          onDoubleClick={(e) => e.stopPropagation()}
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
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleSetMax(item.id);
                          }}
                          sx={{ bgcolor: "#ffebee" }}
                        >
                          <Add />
                        </IconButton>
                      </Box>
                    </Card>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>

            <Box mb={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={pakeKatsuobushi}
                    onChange={(e) => setPakeKatsuobushi(e.target.checked)}
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
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={sauses[saus]}
                          onChange={() => handleSausChange(saus)}
                          sx={{
                            color: COLORS.secondary,
                            "&.Mui-checked": { color: COLORS.primary },
                            transform: "scale(1.1)",
                          }}
                        />
                      }
                      label={
                        <Typography
                          variant="body2"
                          fontWeight="bold"
                          sx={{ fontSize: "0.95rem", lineHeight: 1.1 }}
                        >
                          {saus}
                        </Typography>
                      }
                      sx={{
                        m: 0,
                        width: "100%",
                        border: sauses[saus]
                          ? `2px solid ${COLORS.primary}`
                          : "1px solid #ddd",
                        borderRadius: 2,
                        p: 1,
                        bgcolor: sauses[saus] ? "#ffebee" : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            <Button
              fullWidth
              variant="contained"
              onClick={tambahKeTemp}
              disabled={totalButir === 0}
              sx={{
                bgcolor: COLORS.primary,
                borderRadius: 3,
                height: "60px",
                fontSize: "1.1rem",
                fontWeight: "bold",
              }}
            >
              MASUK KERANJANG SEMENTARA (RP{" "}
              {hitungHargaPorsi().toLocaleString()})
            </Button>
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
                📝 Keranjang Sementara
              </Typography>
              <List dense sx={{ bgcolor: "white", borderRadius: 2, mb: 2 }}>
                {tempCart.map((item) => (
                  <ListItem key={item.id} divider>
                    <ListItemText
                      primary={
                        <Typography fontWeight="bold" fontSize="1.2rem">
                          {item.nama}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="body1"
                          sx={{ fontSize: "1.05rem", color: COLORS.textGrey }}
                        >
                          {item.type === "food"
                            ? `Isi: ${Object.entries(item.detail)
                                .map(([k, v]) => (v > 0 ? `${k}(${v})` : ""))
                                .filter(Boolean)
                                .join(
                                  ", ",
                                )} | ${item.katsuobushi ? "Katsuobushi, " : ""}${item.sauses.join(", ")}`
                            : "Dingin Segar"}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        color="error"
                        onClick={() => hapusDariTemp(item.id)}
                      >
                        <Delete fontSize="large" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
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

              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={prosesPesananFinal}
                startIcon={<ShoppingBasket sx={{ fontSize: 30 }} />}
                sx={{
                  height: "70px",
                  borderRadius: 3,
                  bgcolor: COLORS.textDark,
                  fontSize: "1.3rem",
                  fontWeight: "bold",
                  "&:hover": { bgcolor: "black" },
                }}
              >
                PROSES SEMUA & NEXT (#{nomorAntrian + 1})
              </Button>
              <div ref={bottomRef} />
            </Paper>
          )}
        </Box>
      </Box>
    </>
  );
}

export default App;
