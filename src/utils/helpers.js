// --- src/utils/helpers.js ---

export const formatName = (name) => {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
};

export const getSauceColor = (saus) => {
  switch (saus) {
    case "Saus Sambel": return "error";
    case "Saus Tomat": return "warning";
    case "Mayonaise": return "info";
    default: return "default";
  }
};

export const generateSmartName = (isian) => {
  const activeKeys = Object.keys(isian).filter((key) => isian[key] > 0);
  const total = activeKeys.length;

  if (total === 0) return "Takoyaki Kosong";

  const nameMapping = {
    sosis: "Sosis",
    cumi: "Cumi",
    kepiting: "Kepiting",
    keju: "Keju",
    kornet: "Kornet",
    gurita: "Gurita"
  };

  const formattedNames = activeKeys.map(k => nameMapping[k] || k);

  // 1. Isian Gurita Saja (20K)
  if (total === 1 && activeKeys.includes("gurita")) {
    return "Takoyaki Gurita";
  }

  // 2. 1 Isian Selain Gurita (15K)
  if (total === 1) {
    return `Takoyaki ${formattedNames[0]}`;
  }

  // 3. 2 Isian (15K)
  if (total === 2) {
    return `Takoyaki ${formattedNames[0]} & ${formattedNames[1]}`;
  }

  // 4. PERBAIKAN: 3 Isian Berbeda -> Sebutkan ketiganya secara eksplisit
  if (total === 3) {
    return `Takoyaki Campur ${formattedNames.join(", ")}`;
  }

  // 5. Paket Campur Standar Penuh (5 Isian Tanpa Gurita - 15K)
  const standard5 = ["sosis", "cumi", "kepiting", "keju", "kornet"];
  const hasAllStandard5 = standard5.every(k => activeKeys.includes(k));
  if (total === 5 && hasAllStandard5) {
    return "Takoyaki Campur";
  }

  // 6. SARAN BARU: Gurita + 4 Isian Lainnya (Total 5 Isian - 15K)
  if (total === 5 && activeKeys.includes("gurita")) {
    const missingFromStandard = standard5.filter(k => !activeKeys.includes(k));
    const missingName = nameMapping[missingFromStandard[0]];
    return `Takoyaki Campur + Gurita (Tanpa ${missingName})`;
  }

  // 7. Paket Campur Maksimal Penuh (Semua 6 Isian Terpilih - 15K)
  if (total === 6) {
    return "Takoyaki Campur + Gurita";
  }

  // 8. 4 Isian Tanpa Gurita -> Gunakan kata "Tanpa" agar nama draf tidak kepanjangan
  if (total === 4 && !activeKeys.includes("gurita")) {
    const missingFromStandard = standard5.filter(k => !activeKeys.includes(k));
    const missingNames = missingFromStandard.map(k => nameMapping[k]);
    return `Takoyaki Campur Tanpa ${missingNames.join(" & ")}`;
  }

  return "Takoyaki Kustom";
};