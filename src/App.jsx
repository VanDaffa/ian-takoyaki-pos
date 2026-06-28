import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { CssBaseline } from "@mui/material";

// Impor komponen halaman dari folder pages
import CashierPage from "./pages/CashierPage";
import CustomerPage from "./pages/CustomerPage";

export default function App() {
  return (
    <Router>
      <CssBaseline />
      <Routes>
        {/* Rute Kasir Utama */}
        <Route path="/" element={<CashierPage />} />
        
        {/* Rute Pelanggan (QR Code) */}
        <Route path="/menu" element={<CustomerPage />} />
      </Routes>
    </Router>
  );
}