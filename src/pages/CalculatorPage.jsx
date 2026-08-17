import React, { useState, useEffect } from "react";
import { 
  Box, Typography, Card, Container, IconButton, 
  CssBaseline, Button, Grid, Paper, Snackbar, Alert
} from "@mui/material";
import { 
  ArrowBack, Add, Remove, RestartAlt, Calculate, MonetizationOn, QrCode2 
} from "@mui/icons-material";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

export default function CalculatorPage() {
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  const [counts, setCounts] = useState(() => {
    const saved = localStorage.getItem("ian_calculator_counts");
    return saved ? JSON.parse(saved) : {
      "tako20-tunai": 0,
      "tako20-qris": 0,
      "tako15-tunai": 0,
      "tako15-qris": 0,
      "air-tunai": 0,
      "air-qris": 0,
    };
  });

  useEffect(() => {
    localStorage.setItem("ian_calculator_counts", JSON.stringify(counts));
  }, [counts]);

  const updateCount = (key, delta) => {
    playTone("click");
    setCounts(prev => {
      const current = prev[key] || 0;
      const updated = current + delta;
      return { ...prev, [key]: updated < 0 ? 0 : updated };
    });
  };

  const resetAll = () => {
    playTone("delete");
    if (window.confirm("Apakah kamu yakin ingin mereset semua hitungan menjadi 0?")) {
      setCounts({
        "tako20-tunai": 0,
        "tako20-qris": 0,
        "tako15-tunai": 0,
        "tako15-qris": 0,
        "air-tunai": 0,
        "air-qris": 0,
      });
      setSnackbar({ open: true, message: "Semua data berhasil direset!" });
    }
  };

  const totalPendapatan = 
    (counts["tako20-tunai"] + counts["tako20-qris"]) * 20000 +
    (counts["tako15-tunai"] + counts["tako15-qris"]) * 15000 +
    (counts["air-tunai"] + counts["air-qris"]) * 5000;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300 } } };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLORS.background,
        py: { xs: 2.5, sm: 4 },
        pb: { xs: 6, sm: 10 },
        boxSizing: "border-box",
        // Layar pendek (HP landscape) -> padding vertikal dipangkas
        "@media (orientation: landscape) and (max-height: 500px)": {
          py: 1.5,
          pb: 3,
        },
      }}
    >
      <CssBaseline />

      <Snackbar open={snackbar.open} autoHideDuration={2000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" variant="filled" sx={{ fontWeight: "bold", borderRadius: 3 }}>{snackbar.message}</Alert>
      </Snackbar>

      <Container maxWidth="lg">
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          
          {/* HEADER */}
          <motion.div variants={itemVariants}>
            <Box display="flex" flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={1.5} rowGap={1} mb={{ xs: 2.5, sm: 4 }}>
              <Box display="flex" alignItems="center" gap={{ xs: 1.25, sm: 2 }} sx={{ minWidth: 0 }}>
                <IconButton onClick={() => { playTone("click"); navigate("/dashboard"); }} sx={{ bgcolor: "white", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", p: { xs: 1, sm: 1.5 }, flexShrink: 0 }}>
                  <ArrowBack sx={{ fontSize: { xs: 20, sm: 24 } }} />
                </IconButton>
                <Typography variant="h5" fontWeight="900" color={COLORS.textDark} noWrap sx={{ fontSize: { xs: "1.05rem", sm: "1.5rem" } }}>
                  Hitung Manual
                </Typography>
              </Box>
              <Button 
                variant="outlined" 
                color="error" 
                startIcon={<RestartAlt />} 
                onClick={resetAll}
                sx={{ fontWeight: "bold", borderRadius: 3, textTransform: "none", flexShrink: 0, px: { xs: 1.5, sm: 2 }, fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
              >
                Reset
              </Button>
            </Box>
          </motion.div>

          {/* KARTU ESTIMASI PENDAPATAN SEMENTARA */}
          <motion.div variants={itemVariants}>
            <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 3 }, mb: { xs: 2.5, sm: 4 }, borderRadius: 4, bgcolor: COLORS.primary, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, boxShadow: "0 10px 25px rgba(211, 47, 47, 0.2)" }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ opacity: 0.9, fontSize: { xs: "0.75rem", sm: "0.875rem" } }}>Estimasi Total Pendapatan</Typography>
                <Typography variant="h4" fontWeight="900" sx={{ fontSize: { xs: "1.5rem", sm: "2.125rem" }, overflowWrap: "anywhere" }}>Rp {totalPendapatan.toLocaleString()}</Typography>
              </Box>
              <Calculate sx={{ fontSize: { xs: 34, sm: 50 }, opacity: 0.2, flexShrink: 0 }} />
            </Paper>
          </motion.div>

          {/* GRID MENU COUNTER (DIPERBAIKI DENGAN JUSTIFY-CONTENT CENTER) */}
          <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent="center" alignItems="stretch">
            
            {/* 1. Takoyaki 20k */}
            <Grid item xs={12} sm={6} md={4}>
              <motion.div variants={itemVariants} style={{ height: "100%" }}>
                <Card elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, bgcolor: "white", height: "100%", border: "1px solid #eee", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <Typography variant="h6" fontWeight="900" color={COLORS.textDark} align="center" gutterBottom sx={{ borderBottom: "2px dashed #eee", pb: 1.5, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
                    🐙 Takoyaki 20k
                  </Typography>

                  <Box sx={{ bgcolor: "#f9f9f9", p: { xs: 1.5, sm: 2 }, borderRadius: 3, my: 1.5 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <MonetizationOn fontSize="small" color="success" />
                      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">Tunai</Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
                      <Button onClick={() => updateCount("tako20-tunai", -1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.primary, color: "white", '&:hover': { bgcolor: COLORS.secondary } }}><Remove /></Button>
                      <Typography variant="h4" fontWeight="900" sx={{ minWidth: 50, textAlign: "center", fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{counts["tako20-tunai"]}</Typography>
                      <Button onClick={() => updateCount("tako20-tunai", 1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.primary, color: "white", '&:hover': { bgcolor: COLORS.secondary } }}><Add /></Button>
                    </Box>
                  </Box>

                  <Box sx={{ bgcolor: "#f9f9f9", p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <QrCode2 fontSize="small" color="info" />
                      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">QRIS</Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
                      <Button onClick={() => updateCount("tako20-qris", -1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.info, color: "white" }}><Remove /></Button>
                      <Typography variant="h4" fontWeight="900" sx={{ minWidth: 50, textAlign: "center", fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{counts["tako20-qris"]}</Typography>
                      <Button onClick={() => updateCount("tako20-qris", 1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.info, color: "white" }}><Add /></Button>
                    </Box>
                  </Box>
                </Card>
              </motion.div>
            </Grid>

            {/* 2. Takoyaki 15k */}
            <Grid item xs={12} sm={6} md={4}>
              <motion.div variants={itemVariants} style={{ height: "100%" }}>
                <Card elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, bgcolor: "white", height: "100%", border: "1px solid #eee", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <Typography variant="h6" fontWeight="900" color={COLORS.textDark} align="center" gutterBottom sx={{ borderBottom: "2px dashed #eee", pb: 1.5, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
                    🐙 Takoyaki 15k
                  </Typography>

                  <Box sx={{ bgcolor: "#f9f9f9", p: { xs: 1.5, sm: 2 }, borderRadius: 3, my: 1.5 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <MonetizationOn fontSize="small" color="success" />
                      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">Tunai</Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
                      <Button onClick={() => updateCount("tako15-tunai", -1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.primary, color: "white", '&:hover': { bgcolor: COLORS.secondary } }}><Remove /></Button>
                      <Typography variant="h4" fontWeight="900" sx={{ minWidth: 50, textAlign: "center", fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{counts["tako15-tunai"]}</Typography>
                      <Button onClick={() => updateCount("tako15-tunai", 1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.primary, color: "white", '&:hover': { bgcolor: COLORS.secondary } }}><Add /></Button>
                    </Box>
                  </Box>

                  <Box sx={{ bgcolor: "#f9f9f9", p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <QrCode2 fontSize="small" color="info" />
                      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">QRIS</Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
                      <Button onClick={() => updateCount("tako15-qris", -1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.info, color: "white" }}><Remove /></Button>
                      <Typography variant="h4" fontWeight="900" sx={{ minWidth: 50, textAlign: "center", fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{counts["tako15-qris"]}</Typography>
                      <Button onClick={() => updateCount("tako15-qris", 1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.info, color: "white" }}><Add /></Button>
                    </Box>
                  </Box>
                </Card>
              </motion.div>
            </Grid>

            {/* 3. Air Mineral */}
            <Grid item xs={12} sm={6} md={4}>
              <motion.div variants={itemVariants} style={{ height: "100%" }}>
                <Card elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 4, bgcolor: "white", height: "100%", border: "1px solid #eee", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <Typography variant="h6" fontWeight="900" color={COLORS.textDark} align="center" gutterBottom sx={{ borderBottom: "2px dashed #eee", pb: 1.5, fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
                    💧 Air Mineral
                  </Typography>

                  <Box sx={{ bgcolor: "#f9f9f9", p: { xs: 1.5, sm: 2 }, borderRadius: 3, my: 1.5 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <MonetizationOn fontSize="small" color="success" />
                      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">Tunai</Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
                      <Button onClick={() => updateCount("air-tunai", -1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.primary, color: "white", '&:hover': { bgcolor: COLORS.secondary } }}><Remove /></Button>
                      <Typography variant="h4" fontWeight="900" sx={{ minWidth: 50, textAlign: "center", fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{counts["air-tunai"]}</Typography>
                      <Button onClick={() => updateCount("air-tunai", 1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.primary, color: "white", '&:hover': { bgcolor: COLORS.secondary } }}><Add /></Button>
                    </Box>
                  </Box>

                  <Box sx={{ bgcolor: "#f9f9f9", p: { xs: 1.5, sm: 2 }, borderRadius: 3 }}>
                    <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                      <QrCode2 fontSize="small" color="info" />
                      <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">QRIS</Typography>
                    </Box>
                    <Box display="flex" justifyContent="center" alignItems="center" gap={2}>
                      <Button onClick={() => updateCount("air-qris", -1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.info, color: "white" }}><Remove /></Button>
                      <Typography variant="h4" fontWeight="900" sx={{ minWidth: 50, textAlign: "center", fontSize: { xs: "1.75rem", sm: "2.125rem" } }}>{counts["air-qris"]}</Typography>
                      <Button onClick={() => updateCount("air-qris", 1)} sx={{ minWidth: 40, height: 40, borderRadius: "50%", bgcolor: COLORS.info, color: "white" }}><Add /></Button>
                    </Box>
                  </Box>
                </Card>
              </motion.div>
            </Grid>

          </Grid>
        </motion.div>
      </Container>
    </Box>
  );
}