import React, { useState } from "react";
import { Box, Paper, TextField, Button, Typography, Container, Alert, CssBaseline } from "@mui/material";
import { Storefront } from "@mui/icons-material";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      playTone("success");
    } catch (err) {
      setError("Email atau Password salah, akses ditolak! ❌");
      playTone("delete");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: COLORS.background, display: "flex", alignItems: "center" }}>
      <CssBaseline />
      <Container maxWidth="xs">
        <Paper elevation={4} sx={{ p: 4, borderRadius: 4, textAlign: "center" }}>
          <Storefront sx={{ fontSize: 50, color: COLORS.primary, mb: 1 }} />
          <Typography variant="h5" fontWeight="900" color="primary" gutterBottom>LOGIN KASIR IAN</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Sistem POS & Antrean Internal</Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2, fontWeight: "bold" }}>{error}</Alert>}
          
          <form onSubmit={handleLogin}>
            <TextField fullWidth label="Email Kasir" variant="outlined" margin="normal" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <TextField fullWidth label="Password" type="password" variant="outlined" margin="normal" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Button type="submit" fullWidth variant="contained" size="large" sx={{ mt: 3, height: "50px", bgcolor: COLORS.primary, fontWeight: "bold", fontSize: "1rem" }}>MASUK SISTEM</Button>
          </form>
        </Paper>
      </Container>
    </Box>
  );
}