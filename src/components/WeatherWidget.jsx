import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Chip, IconButton, Skeleton } from "@mui/material";
import {
  WbSunny,
  Cloud,
  WaterDrop,
  Thunderstorm,
  Refresh,
  LocationOn,
  ExpandMore
} from "@mui/icons-material";
import { m, AnimatePresence } from "framer-motion";
import { COLORS } from "../utils/constants";
import { playTone } from "../utils/soundEngine";

// Koordinat default lokasi kedai (Semarang). Sesuaikan jika titik jualan berpindah.
const LOKASI_KEDAI = {
  nama: "Semarang",
  latitude: -6.9932,
  longitude: 110.4203
};

const CACHE_KEY = "ian_takoyaki_weather_9h_v1";
const CACHE_TTL_MS = 30 * 60 * 1000; // Cache 30 menit
const FORECAST_HOURS = 9; // Cakupan 9 jam operasional (berangkat hingga pulang)

function parseWeatherCode(code) {
  if (code === 0) return { label: "Cerah", type: "clear" };
  if (code >= 1 && code <= 3) return { label: "Berawan", type: "cloudy" };
  if (code === 45 || code === 48) return { label: "Berkabut", type: "cloudy" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: "Hujan", type: "rain" };
  }
  if (code >= 95 && code <= 99) return { label: "Badai Petir", type: "storm" };
  return { label: "Berawan", type: "cloudy" };
}

function WeatherIcon({ type, sxSize = 20, color }) {
  if (type === "clear") return <WbSunny sx={{ fontSize: sxSize, color: color || "#F59E0B" }} />;
  if (type === "rain") return <WaterDrop sx={{ fontSize: sxSize, color: color || COLORS.info }} />;
  if (type === "storm") return <Thunderstorm sx={{ fontSize: sxSize, color: color || COLORS.primary }} />;
  return <Cloud sx={{ fontSize: sxSize, color: color || "#8D7B70" }} />;
}

function getOperationalStatus(maxRainProb) {
  if (maxRainProb >= 60) {
    return {
      label: "Peluang Hujan Tinggi",
      shortLabel: "Hujan Tinggi",
      bgcolor: "#ffebee",
      color: COLORS.primary,
      borderColor: "rgba(211, 47, 47, 0.35)"
    };
  }
  if (maxRainProb >= 30) {
    return {
      label: "Waspada Mendung",
      shortLabel: "Waspada",
      bgcolor: "#fff3e0",
      color: "#E65100",
      borderColor: "rgba(230, 81, 0, 0.35)"
    };
  }
  return {
    label: "Cuaca Aman",
    shortLabel: "Aman",
    bgcolor: "#FFF8F0",
    color: "#3B302A",
    borderColor: "#eadfd5"
  };
}

export function useWeatherForecast() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchWeather = useCallback(async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cachedRaw = localStorage.getItem(CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (Date.now() - cached.timestamp < CACHE_TTL_MS && cached.payload) {
            setWeatherData(cached.payload);
            setLoading(false);
            setError(false);
            return;
          }
        }
      }

      setIsRefreshing(true);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LOKASI_KEDAI.latitude}&longitude=${LOKASI_KEDAI.longitude}&current=temperature_2m,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Asia%2FJakarta&forecast_days=2`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal mengambil data cuaca");
      const json = await res.json();

      const now = new Date();
      const currentHourPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}`;
      let startIndex = json.hourly.time.findIndex((t) => t.startsWith(currentHourPrefix));
      if (startIndex === -1) startIndex = 0;

      // Ambil prakiraan 9 jam operasional (jam sekarang + 8 jam ke depan)
      const nextHours = [];
      for (let i = 0; i < FORECAST_HOURS; i++) {
        const idx = startIndex + i;
        if (json.hourly.time[idx]) {
          const hourLabel = json.hourly.time[idx].slice(11, 16).replace(":", ".");
          const prob = json.hourly.precipitation_probability[idx] ?? 0;
          const code = json.hourly.weather_code[idx] ?? 0;
          const tempHour = Math.round(json.hourly.temperature_2m?.[idx] ?? json.current.temperature_2m);
          const parsed = parseWeatherCode(code);

          nextHours.push({
            jam: i === 0 ? "Skrg" : hourLabel,
            temp: tempHour,
            prob,
            type: prob >= 50 && parsed.type === "cloudy" ? "rain" : parsed.type
          });
        }
      }

      const payload = {
        temp: Math.round(json.current.temperature_2m),
        currentInfo: parseWeatherCode(json.current.weather_code),
        nextHours,
        updatedAt: now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), payload }));
      setWeatherData(payload);
      setError(false);
    } catch (err) {
      console.error("WeatherWidget error:", err);
      setError(true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(false);
  }, [fetchWeather]);

  return { weatherData, loading, isRefreshing, error, fetchWeather };
}

// Pil indikator ringkas di samping jam (responsif terhadap lebar & orientasi layar)
export function WeatherCompactTrigger({ weather, isExpanded, onToggle }) {
  const { weatherData, loading, error, fetchWeather } = weather;

  if (loading) {
    return (
      <Skeleton
        variant="rounded"
        sx={{
          width: { xs: 112, sm: 165, md: 195 },
          height: { xs: 48, sm: 54 },
          borderRadius: 3,
          flexShrink: 0
        }}
      />
    );
  }

  if (error || !weatherData) {
    return (
      <Box
        onClick={() => {
          playTone("click");
          fetchWeather(true);
        }}
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: 1,
          minHeight: "48px",
          borderRadius: 3,
          bgcolor: "rgba(45, 36, 32, 0.04)",
          border: "1px dashed #d7ccc8",
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          cursor: "pointer",
          flexShrink: 0
        }}
      >
        <Cloud sx={{ fontSize: 18, color: "#8D7B70" }} />
        <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 800 }}>
          Muat Cuaca
        </Typography>
      </Box>
    );
  }

  const maxRainProb = Math.max(...weatherData.nextHours.map((h) => h.prob), 0);
  const status = getOperationalStatus(maxRainProb);

  return (
    <m.div whileTap={{ scale: 0.96 }} style={{ flexShrink: 0 }}>
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label="Lihat prakiraan cuaca 9 jam ke depan"
        onClick={() => {
          playTone("click");
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            playTone("click");
            onToggle();
          }
        }}
        sx={{
          px: { xs: 1.35, sm: 1.85, md: 2.25 },
          py: { xs: 0.9, sm: 1.15, md: 1.3 },
          minHeight: { xs: "48px", sm: "54px" },
          borderRadius: 3,
          bgcolor: isExpanded ? "rgba(211, 47, 47, 0.05)" : status.bgcolor,
          border: `1.5px solid ${isExpanded ? COLORS.primary : status.borderColor}`,
          display: "flex",
          alignItems: "center",
          gap: { xs: 0.9, sm: 1.25 },
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s ease",
          "&:hover": {
            borderColor: COLORS.primary
          }
        }}
      >
        <WeatherIcon
          type={weatherData.currentInfo.type}
          sxSize={{ xs: 22, sm: 26, md: 28 }}
        />

        <Box sx={{ textAlign: "left" }}>
          <Box display="flex" alignItems="baseline" gap={0.6}>
            <Typography
              variant="body1"
              fontWeight={900}
              color="#2D2420"
              sx={{
                lineHeight: 1.1,
                fontSize: { xs: "0.98rem", sm: "1.1rem", md: "1.2rem" },
                fontVariantNumeric: "tabular-nums"
              }}
            >
              {weatherData.temp}°C
            </Typography>

            {/* Muncul pada tablet portrait & landscape (sm ke atas) */}
            <Box
              component="span"
              sx={{
                display: { xs: "none", sm: "inline" },
                fontSize: { sm: "0.82rem", md: "0.88rem" },
                fontWeight: 800,
                color: "#3B302A"
              }}
            >
              • {weatherData.currentInfo.label}
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={0.35} mt={0.25}>
            <WaterDrop
              sx={{
                fontSize: { xs: 12, sm: 13 },
                color: maxRainProb >= 60 ? COLORS.primary : maxRainProb >= 30 ? "#E65100" : COLORS.info
              }}
            />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "0.72rem", sm: "0.78rem" },
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: maxRainProb >= 60 ? COLORS.primary : maxRainProb >= 30 ? "#E65100" : "#6E5D54"
              }}
            >
              Maks {maxRainProb}%
              <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                {" "}({status.shortLabel})
              </Box>
            </Typography>
          </Box>
        </Box>

        <m.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "flex", alignItems: "center" }}
        >
          <ExpandMore sx={{ fontSize: { xs: 20, sm: 22 }, color: "#6E5D54" }} />
        </m.div>
      </Box>
    </m.div>
  );
}

// Panel detail 9 jam ke depan: 3x3 di HP/Tablet Portrait, 1 baris linimasa (9 kolom) di Tablet Landscape
export function WeatherExpandedPanel({ weather, isExpanded }) {
  const { weatherData, isRefreshing, fetchWeather } = weather;

  if (!weatherData) return null;

  const maxRainProb = Math.max(...weatherData.nextHours.map((h) => h.prob), 0);
  const status = getOperationalStatus(maxRainProb);

  return (
    <AnimatePresence initial={false}>
      {isExpanded && (
        <m.div
          key="weather-9h-drawer"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          style={{ overflow: "hidden" }}
        >
          <Box
            sx={{
              px: { xs: 2, sm: 2.5, md: 3 },
              pb: { xs: 2, sm: 2.25 },
              pt: 1.5,
              bgcolor: "#FFFDF9",
              borderTop: "1px dashed #e6ddd6"
            }}
          >
            {/* Header Info & Status 9 Jam */}
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={1} mb={1.5} flexWrap="wrap">
              <Box display="flex" alignItems="center" gap={0.75}>
                <Chip
                  label={status.label}
                  size="small"
                  sx={{
                    bgcolor: maxRainProb < 30 ? "#e8f5e9" : status.bgcolor,
                    color: maxRainProb < 30 ? COLORS.success : status.color,
                    fontWeight: 800,
                    fontSize: "0.75rem",
                    height: "25px"
                  }}
                />
                <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 700 }}>
                  • 9 Jam ke Depan
                </Typography>
              </Box>

              <Box display="flex" alignItems="center" gap={0.5}>
                <LocationOn sx={{ fontSize: 13, color: "#6E5D54" }} />
                <Typography variant="caption" sx={{ color: "#6E5D54", fontWeight: 700 }}>
                  {LOKASI_KEDAI.nama} ({weatherData.updatedAt})
                </Typography>
                <IconButton
                  size="small"
                  aria-label="Perbarui prakiraan cuaca"
                  disabled={isRefreshing}
                  onClick={() => {
                    playTone("click");
                    fetchWeather(true);
                  }}
                  sx={{ color: "#6E5D54", width: 28, height: 28 }}
                >
                  <Refresh
                    sx={{
                      fontSize: 16,
                      animation: isRefreshing ? "spin 0.8s linear infinite" : "none",
                      "@keyframes spin": { "100%": { transform: "rotate(360deg)" } }
                    }}
                  />
                </IconButton>
              </Box>
            </Box>

            {/* Grid Adaptif: 3 kolom x 3 baris di Portrait (xs/sm), 9 kolom x 1 baris linimasa di Landscape (md+) */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(3, 1fr)", md: "repeat(9, 1fr)" },
                gap: { xs: 1, sm: 1.25, md: 0.85 }
              }}
            >
              {weatherData.nextHours.map((slot, idx) => {
                const isHighRisk = slot.prob >= 60;
                const isMedRisk = slot.prob >= 30 && slot.prob < 60;

                return (
                  <Box
                    key={idx}
                    sx={{
                      py: { xs: 0.9, sm: 1.1, md: 1.15 },
                      px: { xs: 1.25, sm: 1.5, md: 0.6 },
                      borderRadius: 2.5,
                      bgcolor: isHighRisk
                        ? "rgba(211, 47, 47, 0.08)"
                        : isMedRisk
                          ? "rgba(230, 81, 0, 0.07)"
                          : "rgba(45, 36, 32, 0.03)",
                      border: isHighRisk
                        ? "1px solid rgba(211, 47, 47, 0.25)"
                        : isMedRisk
                          ? "1px solid rgba(230, 81, 0, 0.2)"
                          : "1px solid transparent",
                      display: "flex",
                      flexDirection: { xs: "row", md: "column" },
                      alignItems: "center",
                      justifyContent: { xs: "space-between", md: "center" },
                      textAlign: { xs: "left", md: "center" },
                      gap: { xs: 0.5, md: 0.55 }
                    }}
                  >
                    {/* Jam & Suhu pada mode Portrait (xs/sm) */}
                    <Box sx={{ display: { xs: "block", md: "none" } }}>
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{
                          color: idx === 0 ? "#2D2420" : "#6E5D54",
                          fontWeight: idx === 0 ? 800 : 700,
                          fontSize: { xs: "0.74rem", sm: "0.8rem" },
                          lineHeight: 1.15,
                          fontVariantNumeric: "tabular-nums"
                        }}
                      >
                        {slot.jam}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#3B302A",
                          fontWeight: 700,
                          fontSize: { xs: "0.72rem", sm: "0.78rem" },
                          fontVariantNumeric: "tabular-nums"
                        }}
                      >
                        {slot.temp}°
                      </Typography>
                    </Box>

                    {/* Jam pada mode Landscape (md+) */}
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: "none", md: "block" },
                        color: idx === 0 ? "#2D2420" : "#6E5D54",
                        fontWeight: idx === 0 ? 800 : 700,
                        fontSize: "0.75rem",
                        lineHeight: 1.1,
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      {slot.jam}
                    </Typography>

                    {/* Ikon & Peluang Hujan */}
                    <Box
                      display="flex"
                      flexDirection={{ xs: "row", md: "column" }}
                      alignItems="center"
                      gap={{ xs: 0.45, md: 0.4 }}
                    >
                      <WeatherIcon type={slot.type} sxSize={{ xs: 18, sm: 20, md: 22 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: "0.82rem", sm: "0.88rem", md: "0.85rem" },
                          lineHeight: 1.1,
                          fontVariantNumeric: "tabular-nums",
                          color: isHighRisk ? COLORS.primary : isMedRisk ? "#E65100" : "#2D2420"
                        }}
                      >
                        {slot.prob}%
                      </Typography>
                    </Box>

                    {/* Suhu pada mode Landscape (md+) */}
                    <Typography
                      variant="caption"
                      sx={{
                        display: { xs: "none", md: "block" },
                        color: "#6E5D54",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums"
                      }}
                    >
                      {slot.temp}°
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </m.div>
      )}
    </AnimatePresence>
  );
}