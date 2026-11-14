import React, { useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  CssBaseline,
  InputAdornment,
  IconButton,
  CircularProgress
} from "@mui/material";
import { Storefront, Visibility, VisibilityOff } from "@mui/icons-material";
import { m } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    setError("");
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      playTone("success");
    } catch (err) {
      setError("Email atau Password salah, akses ditolak! ❌");
      playTone("delete");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleShowPassword = () => {
    playTone("click");
    setShowPassword((prev) => !prev);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: COLORS.background,
        display: "flex",
        alignItems: "center",
        py: 4
      }}
    >
      <CssBaseline />
      <Container maxWidth="xs">
        <m.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3.5, sm: 4 },
              borderRadius: 4,
              textAlign: "center",
              bgcolor: "white",
              border: "1px solid #e6ddd6",
              boxShadow: "0 12px 32px rgba(45, 36, 32, 0.08)"
            }}
          >
            {/* IKON HEADER */}
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 3.5,
                bgcolor: "rgba(211, 47, 47, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2
              }}
            >
              <Storefront sx={{ fontSize: 42, color: COLORS.primary }} />
            </Box>

            <Typography
              variant="h5"
              fontWeight={900}
              color={COLORS.primary}
              sx={{ letterSpacing: "-0.3px", mb: 0.5 }}
            >
              LOGIN KASIR IAN
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: "#6E5D54", fontWeight: 700, mb: 3 }}
            >
              Sistem POS & Antrean Internal
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2.5,
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  borderRadius: 2.5,
                  textAlign: "left",
                  alignItems: "center"
                }}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Email Kasir"
                type="email"
                autoComplete="email"
                variant="outlined"
                margin="normal"
                value={email}
                disabled={isLoading}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError("");
                }}
                required
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    fontWeight: 600,
                    color: "#2D2420"
                  }
                }}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                variant="outlined"
                margin="normal"
                value={password}
                disabled={isLoading}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                required
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 3,
                    fontWeight: 600,
                    color: "#2D2420"
                  }
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                        onClick={toggleShowPassword}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        disabled={isLoading}
                        sx={{
                          color: showPassword ? COLORS.primary : "#6E5D54",
                          width: 44,
                          height: 44
                        }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <m.div whileTap={{ scale: 0.98 }} style={{ width: "100%" }}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                  sx={{
                    mt: 3,
                    height: "52px",
                    borderRadius: 3,
                    bgcolor: COLORS.primary,
                    fontWeight: 800,
                    fontSize: "1rem",
                    letterSpacing: "0.3px",
                    boxShadow: "0 6px 18px rgba(211, 47, 47, 0.25)",
                    "&:hover": { bgcolor: "#b71c1c" }
                  }}
                >
                  {isLoading ? "MEMVERIFIKASI..." : "MASUK SISTEM"}
                </Button>
              </m.div>
            </form>
          </Paper>
        </m.div>
      </Container>
    </Box>
  );
}