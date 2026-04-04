import { useState, useEffect } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "ma_cave_v2";
const ONBOARDED_KEY = "ma_cave_onboarded";

// ── Persistence ───────────────────────────────────────────────────────────────
// Sync path (localStorage + sessionStorage) — used for the instant initial render
function loadCellarSync() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveCellarSync(cellar) {
  const json = JSON.stringify(cellar);
  try { localStorage.setItem(STORAGE_KEY, json); } catch {}
  try { sessionStorage.setItem(STORAGE_KEY, json); } catch {}
}

// Async path (IndexedDB) — more persistent on iOS Safari (survives ITP clearing)
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ma_cave", 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore("data");
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbLoad() {
  try {
    const db = await idbOpen();
    return await new Promise(resolve => {
      const tx = db.transaction("data", "readonly");
      const req = tx.objectStore("data").get(STORAGE_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbSave(cellar) {
  try {
    const db = await idbOpen();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("data", "readwrite");
      tx.objectStore("data").put(cellar, STORAGE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
  } catch {}
}

// Combined save — sync localStorage immediately, IDB async in background
function saveCellar(cellar) {
  saveCellarSync(cellar);
  idbSave(cellar);
}

// Keep loadCellar as an alias used by share-mode reset
function loadCellar() { return loadCellarSync(); }

// ── Wishlist persistence (localStorage only — lower priority than cellar) ──────
const WISHLIST_KEY = "ma_cave_wishlist";
function loadWishlist() {
  try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]"); } catch { return []; }
}
function saveWishlist(list) {
  try { localStorage.setItem(WISHLIST_KEY, JSON.stringify(list)); } catch {}
}

// ── Sample data ───────────────────────────────────────────────────────────────
const SAMPLE_CELLAR = [
  { id: 1, name: "Château Margaux", year: 2015, region: "Bordeaux", appellation: "Médoc", type: "Rouge", grape: "Cabernet Sauvignon", quantity: 6, drinkFrom: 2022, drinkUntil: 2045, rating: 98, notes: "Grand Cru Classé" },
  { id: 2, name: "Puligny-Montrachet", year: 2019, region: "Bourgogne", appellation: "Côte de Beaune", type: "Blanc", grape: "Chardonnay", quantity: 3, drinkFrom: 2021, drinkUntil: 2030, rating: 94, notes: "1er Cru Les Pucelles" },
  { id: 3, name: "Hermitage", year: 2017, region: "Rhône", appellation: "Hermitage", type: "Rouge", grape: "Syrah", quantity: 12, drinkFrom: 2025, drinkUntil: 2040, rating: 96, notes: "Chapoutier" },
  { id: 4, name: "Sancerre", year: 2022, region: "Loire", appellation: "Sancerre", type: "Blanc", grape: "Sauvignon Blanc", quantity: 6, drinkFrom: 2023, drinkUntil: 2028, rating: 91, notes: "Henri Bourgeois" },
  { id: 5, name: "Dom Pérignon", year: 2013, region: "Champagne", appellation: "Champagne", type: "Champagne", grape: "Chardonnay / Pinot Noir", quantity: 3, drinkFrom: 2023, drinkUntil: 2035, rating: 97, notes: "Millésimé" },
  { id: 6, name: "Condrieu", year: 2021, region: "Rhône", appellation: "Condrieu", type: "Blanc", grape: "Viognier", quantity: 4, drinkFrom: 2022, drinkUntil: 2028, rating: 93, notes: "E. Guigal" },
  { id: 7, name: "Pommard Rugiens", year: 2018, region: "Bourgogne", appellation: "Côte de Beaune", type: "Rouge", grape: "Pinot Noir", quantity: 8, drinkFrom: 2024, drinkUntil: 2038, rating: 95, notes: "1er Cru" },
  { id: 8, name: "Château d'Yquem", year: 2016, region: "Bordeaux", appellation: "Sauternes", type: "Liquoreux", grape: "Sémillon / Sauvignon", quantity: 2, drinkFrom: 2026, drinkUntil: 2060, rating: 99, notes: "Premier Grand Cru Classé Supérieur" },
  { id: 9, name: "Gigondas", year: 2020, region: "Rhône", appellation: "Gigondas", type: "Rouge", grape: "Grenache", quantity: 6, drinkFrom: 2023, drinkUntil: 2032, rating: 90, notes: "Domaine Santa Duc" },
  { id: 10, name: "Chablis Grand Cru", year: 2020, region: "Bourgogne", appellation: "Chablis", type: "Blanc", grape: "Chardonnay", quantity: 4, drinkFrom: 2023, drinkUntil: 2033, rating: 93, notes: "Les Clos" },
];

const TYPE_CONFIG = {
  Rouge:     { color: "#8B2635", pill: "#FADADD", accent: "#C0394A" },
  Blanc:     { color: "#7A6A1E", pill: "#F5EFC0", accent: "#A89228" },
  Champagne: { color: "#9A7A10", pill: "#F5EAA0", accent: "#C8A020" },
  Liquoreux: { color: "#B07020", pill: "#F5DFA0", accent: "#D4900A" },
  Rosé:      { color: "#C05070", pill: "#FAD0E0", accent: "#E06080" },
  Porto:     { color: "#7A1A3A", pill: "#F0D0E0", accent: "#A02050" },
  Saké:      { color: "#3A6A5A", pill: "#D5EEE8", accent: "#2A7A6A" },
};

const ALL_TYPES = ["Rouge","Blanc","Rosé","Champagne","Liquoreux","Porto","Saké"];

const CY = new Date().getFullYear();

// Normalize accents so "Chateau" matches "Château", "Cotes" matches "Côtes", etc.
function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function drinkingStatus(wine) {
  if (CY < wine.drinkFrom) return { label: "Trop tôt", color: "#5B8DD9", bg: "#EEF4FD", icon: "⏳" };
  if (CY > wine.drinkUntil) return { label: "Passé", color: "#AAA", bg: "#F5F5F5", icon: "⚠️" };
  const p = (CY - wine.drinkFrom) / (wine.drinkUntil - wine.drinkFrom);
  if (p < 0.35) return { label: "Jeune", color: "#2E8B57", bg: "#EEF8F2", icon: "🌱" };
  if (p < 0.70) return { label: "Apogée", color: "#D4820A", bg: "#FDF4E0", icon: "✨" };
  return { label: "À boire vite", color: "#C0392B", bg: "#FDF0EE", icon: "🍷" };
}

// ── Gemini API helpers (proxied through /api/gemini) ─────────────────────────

// Standard (non-streaming) call — used for pairing and vision
async function askGemini(systemPrompt, userPrompt, maxOutputTokens = 1200) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ type: "text", system: systemPrompt, prompt: userPrompt, maxOutputTokens }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur API (${res.status})`);
    }
    const data = await res.json();
    return data.text;
  } finally {
    clearTimeout(timeout);
  }
}

// Streaming call — calls onChunk(partialText) as tokens arrive, returns full text
async function askGeminiStream(systemPrompt, userPrompt, onChunk, maxOutputTokens = 1200) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ type: "text", system: systemPrompt, prompt: userPrompt, maxOutputTokens, stream: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur API (${res.status})`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop(); // keep incomplete line
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        try {
          const { text } = JSON.parse(raw);
          if (text) { full += text; onChunk(full); }
        } catch {}
      }
    }
    return full;
  } finally {
    clearTimeout(timeout);
  }
}

// Parse sommelier text into structured sections
// Expected headings: MOMENT IDÉAL, ACCORDS METS-VINS, SERVICE, ANECDOTE
const SECTION_DEFS = [
  { key: "moment",  label: "MOMENT IDÉAL",      icon: "⏳" },
  { key: "accords", label: "ACCORDS METS-VINS",  icon: "🍽️" },
  { key: "service", label: "SERVICE",             icon: "🌡️" },
  { key: "anecdote",label: "ANECDOTE",            icon: "📖" },
];

function parseSommelierText(text) {
  const sections = {};
  const headingRe = /^(MOMENT\s+ID[EÉ]AL|ACCORDS?\s+METS?[-–]VINS?|SERVICE|ANECDOTE)\s*[:\-–]/im;
  // Split on any known heading
  const parts = text.split(/(?=(?:MOMENT\s+ID[EÉ]AL|ACCORDS?\s+METS?[-–]VINS?|SERVICE|ANECDOTE)\s*[:\-–])/im);
  for (const part of parts) {
    const m = part.match(headingRe);
    if (!m) continue;
    const heading = m[1].toUpperCase();
    const body = part.slice(m[0].length).trim();
    if (heading.includes("MOMENT")) sections.moment = body;
    else if (heading.includes("ACCORD")) sections.accords = body;
    else if (heading.includes("SERVICE")) sections.service = body;
    else if (heading.includes("ANECDOTE")) sections.anecdote = body;
  }
  return sections;
}

// Compress + resize image to JPEG max 1200px, keeping base64 under API limits.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier image."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Impossible de décoder l'image."));
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const base64 = dataUrl.split(",")[1];
        if (!base64) return reject(new Error("Erreur de compression de l'image."));
        resolve({ base64, mediaType: "image/jpeg", previewUrl: dataUrl });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Compress image to a data URL (for label photo storage — smaller than scan quality)
function compressToDataURL(file, maxPx = 600, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.onload = e => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format d'image non supporté."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Robust JSON extraction — handles preamble text, code fences, and partial wrapping
function extractJSON(raw) {
  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Aucun tableau JSON trouvé dans la réponse.");
  }
  return JSON.parse(clean.slice(start, end + 1));
}

async function analyzeBottlePhoto(base64Data, mediaType = "image/jpeg") {
  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "vision",
      base64: base64Data,
      mediaType,
      prompt: `Tu es un expert en vins qui analyse des photos de bouteilles ou d'étiquettes de vin.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans backticks, sans commentaires.
Le JSON doit être un tableau d'objets avec exactement ces clés :
name, year, region, appellation, type, grape, quantity, drinkFrom, drinkUntil, rating, notes
- type doit être l'un de: Rouge, Blanc, Rosé, Champagne, Liquoreux, Porto, Saké
- year, quantity, drinkFrom, drinkUntil doivent être des entiers
- rating peut être null si inconnu
- Pour drinkFrom et drinkUntil, estime une fenêtre réaliste : les sakés se boivent généralement dans les 2 ans, les portos vintage peuvent vieillir 20-40 ans
- Pour les sakés: utilise grape "Riz" et région "Japon" si non précisées
- Pour les portos: utilise région "Porto / Douro" si non précisée
- quantity vaut 1 par défaut (sauf si plusieurs bouteilles visibles)
- notes peut être vide ""
Identifie toutes les bouteilles visibles sur cette photo. Retourne uniquement le tableau JSON.`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur API (${res.status})`);
  }
  const data = await res.json();
  return extractJSON(data.text);
}

const SYS = `Tu es un expert en boissons premium — vins, champagnes, portos, sakés et spiritueux — de renommée mondiale. Tu réponds uniquement en français, avec précision et élégance. Sois concis mais complet. Pour les sakés, adapte tes conseils à leur nature (umami, température de service, accords japonais et fusion). Pour les portos, précise le style (ruby, tawny, vintage) et les accords fromages/desserts. Structure ta réponse avec des titres en majuscules suivis de deux-points.`;

// ── OnboardingModal ───────────────────────────────────────────────────────────
function OnboardingModal({ onStartFresh, onKeepSamples }) {
  const [step, setStep] = useState(0); // 0 = welcome, 1 = choice made
  const card = { background: "#fff", border: "1px solid #EAE5DF", borderRadius: 14, padding: "20px 22px" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,10,5,0.70)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="fade-in" style={{ background: "#F8F5F1", borderRadius: 20, width: "100%", maxWidth: 500, boxShadow: "0 32px 80px rgba(0,0,0,0.28)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#8B2635", padding: "28px 28px 22px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🍷</div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600, letterSpacing: 3, color: "#fff", marginBottom: 6 }}>MA CAVE</div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontStyle: "italic" }}>Votre sommelier personnel propulsé par l'IA</div>
        </div>

        <div style={{ padding: "24px 28px 28px" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 2, color: "#8B2635", marginBottom: 8 }}>✦ BIENVENUE</div>
          <p style={{ color: "#4A3A2A", fontSize: 16, lineHeight: 1.7, marginBottom: 20 }}>
            Gérez votre cave, scannez vos étiquettes par photo et obtenez des conseils de dégustation personnalisés.
          </p>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
            {[
              ["📷","Scan IA d'étiquettes"],
              ["🤖","Conseils du sommelier"],
              ["📊","Statistiques de cave"],
              ["🛒","Liste d'achat"],
              ["🔗","Partage & export"],
            ].map(([icon, label]) => (
              <div key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #EAE5DF", borderRadius: 20, padding: "5px 12px", fontSize: 13, color: "#4A3A2A" }}>
                <span>{icon}</span><span style={{ fontFamily: "'Cormorant Garamond',serif" }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>COMMENT COMMENCER ?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={onStartFresh}
              style={{ background: "#8B2635", color: "#fff", border: "none", borderRadius: 10, padding: "16px 20px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, transition: "background 0.15s" }}
              onMouseOver={e => e.currentTarget.style.background = "#A02A3F"}
              onMouseOut={e => e.currentTarget.style.background = "#8B2635"}>
              <span style={{ fontSize: 28 }}>🍾</span>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5, marginBottom: 3 }}>COMMENCER MA CAVE</div>
                <div style={{ fontSize: 13, opacity: 0.85, fontStyle: "italic" }}>Partir d'une cave vide et ajouter vos propres bouteilles</div>
              </div>
            </button>
            <button
              onClick={onKeepSamples}
              style={{ background: "#fff", color: "#4A3A2A", border: "1.5px solid #DDD8D0", borderRadius: 10, padding: "16px 20px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, transition: "all 0.15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "#FAF7F3"; e.currentTarget.style.borderColor = "#C5A090"; }}
              onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#DDD8D0"; }}>
              <span style={{ fontSize: 28 }}>🔍</span>
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5, marginBottom: 3, color: "#6A5A4A" }}>EXPLORER AVEC DES EXEMPLES</div>
                <div style={{ fontSize: 13, color: "#9A8A7A", fontStyle: "italic" }}>Découvrir l'application avec une cave de démonstration</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FilterDropdown ────────────────────────────────────────────────────────────
function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const handleBlur = () => setTimeout(() => setOpen(false), 150);
  const active = value !== "Tous";
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onBlur={handleBlur} onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 5, background: active ? "#FDF0F0" : "#fff", border: `1.5px solid ${active ? "#8B2635" : "#DDD8D0"}`, borderRadius: 8, padding: "8px 13px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 15, color: active ? "#8B2635" : "#6A5A4A", whiteSpace: "nowrap", transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <span>{label}{active ? `: ${value}` : ""}</span>
        <span style={{ fontSize: 9, marginLeft: 2, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, background: "#fff", border: "1px solid #E5E0DA", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", minWidth: 170, overflow: "hidden" }}>
          {options.map(opt => (
            <div key={opt} onMouseDown={() => { onChange(opt); setOpen(false); }}
              style={{ padding: "10px 16px", cursor: "pointer", fontSize: 15, fontFamily: "'Cormorant Garamond',serif", background: opt === value ? "#FDF0F0" : "transparent", color: opt === value ? "#8B2635" : "#3A2A1A", borderBottom: "1px solid #F5F0EC" }}
              onMouseOver={e => { if (opt !== value) e.currentTarget.style.background = "#FAF5F0"; }}
              onMouseOut={e => { if (opt !== value) e.currentTarget.style.background = "transparent"; }}>
              {opt === value ? "✓ " : ""}{opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── LoadingSkeleton ───────────────────────────────────────────────────────────
function LoadingSkeleton({ message = "Le sommelier consulte votre cave…" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
      <style>{`@keyframes sk{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}`}</style>
      {[88, 72, 95, 60, 78, 50, 82].map((w, i) => (
        <div key={i} style={{ height: 14, width: `${w}%`, borderRadius: 4, background: "#EDE8E2", animation: `sk 1.4s ease ${i * 0.12}s infinite` }} />
      ))}
      <div style={{ marginTop: 8, color: "#B0A090", fontSize: 14, fontStyle: "italic", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ animation: "sk 1s ease infinite", display: "inline-block" }}>🍷</span> {message}
      </div>
    </div>
  );
}

// ── Statistics Dashboard ──────────────────────────────────────────────────────
// Rough value estimate: rating-based price proxy (purely indicative)
function estimateValue(wine) {
  if (!wine.rating || wine.quantity <= 0) return 0;
  const r = wine.rating;
  // Base price per bottle from rating (more realistic market brackets)
  let base;
  if      (r >= 99) base = 800;
  else if (r >= 97) base = 350;
  else if (r >= 95) base = 160;
  else if (r >= 93) base = 80;
  else if (r >= 91) base = 40;
  else if (r >= 89) base = 22;
  else if (r >= 86) base = 14;
  else              base = 8;
  // Region multiplier (prestigious appellations command higher prices)
  const regionMult = { "Bourgogne": 2.0, "Bordeaux": 1.5, "Champagne": 1.6, "Rhône": 1.1, "Alsace": 0.9 };
  const rm = regionMult[wine.region] || 1.0;
  // Type multiplier
  const typeMult = { "Champagne": 1.4, "Liquoreux": 1.3, "Porto": 0.85, "Saké": 1.0, "Rosé": 0.8 };
  const tm = typeMult[wine.type] || 1.0;
  return Math.round(base * rm * tm) * wine.quantity;
}

// ── Drinking Window Timeline ──────────────────────────────────────────────────
function DrinkingWindowTimeline({ wine }) {
  const { drinkFrom, drinkUntil, year } = wine;
  if (!drinkFrom || !drinkUntil || drinkUntil <= drinkFrom) return null;

  // Display range: from vintage year (or drinkFrom-2) to drinkUntil+3
  const start = Math.min(year || drinkFrom, drinkFrom - 2);
  const end = drinkUntil + 3;
  const span = end - start;

  const pct = v => Math.max(0, Math.min(100, (v - start) / span * 100));
  const fromPct  = pct(drinkFrom);
  const untilPct = pct(drinkUntil);
  const nowPct   = pct(CY);

  // Zone colours
  const zones = [
    { from: fromPct, to: Math.min(fromPct + (untilPct - fromPct) * 0.35, untilPct), color: "#2E8B57", label: "Jeune" },
    { from: fromPct + (untilPct - fromPct) * 0.35, to: fromPct + (untilPct - fromPct) * 0.70, color: "#D4820A", label: "Apogée" },
    { from: fromPct + (untilPct - fromPct) * 0.70, to: untilPct, color: "#C0392B", label: "À boire" },
  ];

  const nowInWindow = CY >= drinkFrom && CY <= drinkUntil;
  const nowPassed   = CY > drinkUntil;
  const nowTooEarly = CY < drinkFrom;

  const labelYear = y => (
    <text x={`${pct(y)}%`} y={28} textAnchor="middle" fontSize={9} fill="#9A8A7A">{y}</text>
  );

  return (
    <div style={{ margin: "14px 0 4px" }}>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 2, color: "#9A8A7A", marginBottom: 8 }}>
        FENÊTRE DE DÉGUSTATION · {drinkFrom}–{drinkUntil}
        {nowInWindow && <span style={{ marginLeft: 8, color: "#2E8B57", fontSize: 10 }}>● EN COURS</span>}
        {nowTooEarly && <span style={{ marginLeft: 8, color: "#5B8DD9", fontSize: 10 }}>● TROP TÔT</span>}
        {nowPassed   && <span style={{ marginLeft: 8, color: "#AAA",    fontSize: 10 }}>● PASSÉE</span>}
      </div>
      <svg viewBox="0 0 100 34" preserveAspectRatio="none" style={{ width: "100%", height: 34, display: "block", overflow: "visible" }}>
        {/* Background track */}
        <rect x="0" y="8" width="100" height="10" rx="5" fill="#F0EBE5" />
        {/* Pre-window (grey) */}
        <rect x="0" y="8" width={`${fromPct}`} height="10" rx="0" fill="#E0DBD5" />
        {/* Drinking window zones */}
        {zones.map((z, i) => (
          <rect key={i}
            x={`${z.from}`} y="8"
            width={`${Math.max(0, z.to - z.from)}`} height="10"
            fill={z.color} opacity="0.75"
            rx={i === 0 ? "5 0 0 5" : i === zones.length - 1 ? "0 5 5 0" : "0"} />
        ))}
        {/* Post-window (grey) */}
        <rect x={`${untilPct}`} y="8" width={`${100 - untilPct}`} height="10" fill="#E0DBD5" />
        {/* Vintage year tick */}
        {year && year >= start && year <= end && (
          <g>
            <line x1={`${pct(year)}`} y1="6" x2={`${pct(year)}`} y2="20" stroke="#9A8A7A" strokeWidth="0.8" strokeDasharray="2,1" />
            <text x={`${pct(year)}`} y="5" textAnchor="middle" fontSize={7} fill="#9A8A7A">{year}</text>
          </g>
        )}
        {/* drinkFrom label */}
        <text x={`${fromPct}`} y="28" textAnchor="middle" fontSize={8} fill="#6A5A4A" fontWeight="600">{drinkFrom}</text>
        {/* drinkUntil label */}
        <text x={`${untilPct}`} y="28" textAnchor="middle" fontSize={8} fill="#6A5A4A" fontWeight="600">{drinkUntil}</text>
        {/* Today marker */}
        {CY >= start && CY <= end && (
          <g>
            <line x1={`${nowPct}`} y1="5" x2={`${nowPct}`} y2="21" stroke="#2A1F15" strokeWidth="1.5" />
            <polygon points={`${nowPct - 2.5},3 ${nowPct + 2.5},3 ${nowPct},7`} fill="#2A1F15" />
            <text x={`${nowPct}`} y="31" textAnchor="middle" fontSize={7.5} fill="#2A1F15" fontWeight="700">{CY}</text>
          </g>
        )}
      </svg>
      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
        {[["#2E8B57","Jeune"],["#D4820A","Apogée"],["#C0392B","À boire vite"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9A8A7A" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: c, opacity: 0.8 }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function VintageChart({ years, byYear }) {
  const [hov, setHov] = useState(null);
  if (!years.length) return <div style={{ color: "#B0A090", fontSize: 14, fontStyle: "italic" }}>Aucun millésime enregistré.</div>;
  const maxQty = Math.max(...years.map(y => byYear[y]), 1);
  const BAR = 26, GAP = 5, CH = 90;
  const W = Math.max(years.length * (BAR + GAP) - GAP, 1);
  const short = years.length > 12;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`-4 0 ${W + 8} ${CH + 28}`} style={{ display: "block", width: "100%", minWidth: Math.min(W, 160) }}>
        {years.map((yr, i) => {
          const qty = byYear[yr];
          const bH = Math.max(4, Math.round(qty / maxQty * CH));
          const x = i * (BAR + GAP);
          const isHov = hov === yr;
          const midX = x + BAR / 2;
          return (
            <g key={yr} style={{ cursor: "default" }}
               onMouseEnter={() => setHov(yr)} onMouseLeave={() => setHov(null)}>
              <rect x={x} y={CH - bH} width={BAR} height={bH} rx={3}
                fill={isHov ? "#8B2635" : "#C5A090"} style={{ transition: "fill 0.15s" }} />
              {isHov && (
                <g>
                  <rect x={midX - 20} y={CH - bH - 22} width={40} height={17} rx={4} fill="#8B2635" />
                  <text x={midX} y={CH - bH - 9} textAnchor="middle" fontSize={10} fill="#fff" fontWeight="600">{qty} btl</text>
                </g>
              )}
              <text x={midX} y={CH + 18} textAnchor="middle" fontSize={9}
                fill={isHov ? "#8B2635" : "#9A8A7A"} fontWeight={isHov ? "600" : "400"}>
                {short ? `'${String(yr).slice(2)}` : yr}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StatsDashboard({ cellar }) {
  const totalBottles = cellar.reduce((s, w) => s + w.quantity, 0);
  const byType = {};
  cellar.forEach(w => { byType[w.type] = (byType[w.type] || 0) + w.quantity; });
  const statuses = { "Trop tôt": 0, "Jeune": 0, "Apogée": 0, "À boire vite": 0, "Passé": 0 };
  cellar.forEach(w => { const s = drinkingStatus(w); statuses[s.label] = (statuses[s.label] || 0) + w.quantity; });
  const statusColors = { "Trop tôt": "#5B8DD9", "Jeune": "#2E8B57", "Apogée": "#D4820A", "À boire vite": "#C0392B", "Passé": "#AAA" };
  const card = { background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "18px 20px" };

  const totalValue = cellar.reduce((s, w) => s + estimateValue(w), 0);
  const totalConsumed = cellar.reduce((s, w) => s + (w.log?.length || 0), 0);
  const avgRating = (() => {
    const rated = cellar.filter(w => w.rating);
    return rated.length ? Math.round(rated.reduce((s, w) => s + w.rating, 0) / rated.length) : null;
  })();
  const totalCostPaid = cellar.reduce((s, w) =>
    s + (w.pricePaid ? parseFloat(w.pricePaid) * w.quantity : 0), 0
  );
  const gainLoss = totalCostPaid > 0 && totalValue > 0 ? totalValue - totalCostPaid : null;

  // Vintage distribution
  const byYear = {};
  cellar.forEach(w => { if (w.year) byYear[w.year] = (byYear[w.year] || 0) + w.quantity; });
  const sortedYears = Object.keys(byYear).map(Number).sort((a, b) => a - b);

  // Region with estimated value
  const byRegionFull = {};
  cellar.forEach(w => {
    if (!byRegionFull[w.region]) byRegionFull[w.region] = { qty: 0, value: 0 };
    byRegionFull[w.region].qty += w.quantity;
    byRegionFull[w.region].value += estimateValue(w);
  });
  const regionsSorted = Object.entries(byRegionFull).sort((a, b) => b[1].qty - a[1].qty);
  const maxRegionQty = Math.max(...regionsSorted.map(([, v]) => v.qty), 1);

  // Top 5 rated wines
  const top5 = [...cellar].filter(w => w.rating).sort((a, b) => b.rating - a.rating).slice(0, 5);

  return (
    <div className="fade-in">
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 16 }}>✦ TABLEAU DE BORD</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }} className="grid3">
        {[
          ["🍾", totalBottles, "bouteilles"],
          ["✨", cellar.filter(w => ["Apogée","À boire vite"].includes(drinkingStatus(w).label)).length, "à l'apogée"],
          ["🌱", cellar.filter(w => drinkingStatus(w).label === "Trop tôt").length, "en attente"],
        ].map(([icon, val, lbl], i) => (
          <div key={i} style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 600, color: "#2A1F15" }}>{val}</div>
            <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic" }}>{lbl}</div>
          </div>
        ))}
      </div>
      {/* Value + consumption row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }} className="grid3">
        {[
          ["💰", totalValue > 0 ? `~${totalValue.toLocaleString("fr-FR")} €` : "N/A", "valeur estimée", "#D4820A"],
          ["🥂", totalConsumed, "dégustations", "#8B2635"],
          ["⭐", avgRating ? `${avgRating}/100` : "N/A", "note moyenne", "#9A7A10"],
        ].map(([icon, val, lbl, color], i) => (
          <div key={i} style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600, color: color || "#2A1F15" }}>{val}</div>
            <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic" }}>{lbl}</div>
          </div>
        ))}
      </div>
      {/* Price paid + gain/loss row (only if some pricePaid data exists) */}
      {totalCostPaid > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }} className="grid2">
          <div style={{ ...card, textAlign: "center" }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>💸</div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 600, color: "#3A5A9A" }}>{totalCostPaid.toLocaleString("fr-FR")} €</div>
            <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic" }}>prix d'achat total</div>
          </div>
          {gainLoss !== null && (
            <div style={{ ...card, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{gainLoss >= 0 ? "📈" : "📉"}</div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 20, fontWeight: 600, color: gainLoss >= 0 ? "#2E8B57" : "#C0392B" }}>
                {gainLoss >= 0 ? "+" : ""}{Math.round(gainLoss).toLocaleString("fr-FR")} €
              </div>
              <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic" }}>plus-value estimée</div>
            </div>
          )}
        </div>
      )}

      {/* Type + maturity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }} className="grid2">
        <div style={card}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>PAR TYPE</div>
          {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, qty]) => {
            const tc = TYPE_CONFIG[type] || TYPE_CONFIG.Rouge;
            const pct = totalBottles > 0 ? Math.round(qty / totalBottles * 100) : 0;
            return (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: "#4A3A2A", fontFamily: "'Cormorant Garamond',serif" }}>{type}</span>
                  <span style={{ fontSize: 13, color: "#9A8A7A" }}>{qty} btl · {pct}%</span>
                </div>
                <div style={{ height: 6, background: "#F0EBE5", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: tc.color, borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={card}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>PAR MATURITÉ</div>
          {Object.entries(statuses).filter(([,v])=>v>0).map(([label, qty]) => {
            const pct = totalBottles > 0 ? Math.round(qty / totalBottles * 100) : 0;
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: "#4A3A2A", fontFamily: "'Cormorant Garamond',serif" }}>{label}</span>
                  <span style={{ fontSize: 13, color: "#9A8A7A" }}>{qty} btl</span>
                </div>
                <div style={{ height: 6, background: "#F0EBE5", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: statusColors[label], borderRadius: 3, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vintage distribution bar chart */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>MILLÉSIMES</div>
        <VintageChart years={sortedYears} byYear={byYear} />
      </div>

      {/* Region bars with value */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>PAR RÉGION</div>
        {regionsSorted.map(([region, { qty, value }]) => {
          const pct = Math.round(qty / maxRegionQty * 100);
          return (
            <div key={region} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "baseline" }}>
                <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1, color: "#4A3A2A" }}>{region}</span>
                <span style={{ fontSize: 13, color: "#9A8A7A" }}>
                  {qty} btl{value > 0 ? ` · ~${value.toLocaleString("fr-FR")} €` : ""}
                </span>
              </div>
              <div style={{ height: 8, background: "#F0EBE5", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#8B2635,#C5A090)", borderRadius: 4, transition: "width 0.6s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Grape variety breakdown */}
      {(() => {
        const byGrape = {};
        cellar.forEach(w => {
          if (!w.grape) return;
          // Split blends like "Cabernet Sauvignon / Merlot" and count each grape
          w.grape.split(/[/,+&]/).map(g => g.trim()).filter(Boolean).forEach(g => {
            byGrape[g] = (byGrape[g] || 0) + w.quantity;
          });
        });
        const grapesSorted = Object.entries(byGrape).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (!grapesSorted.length) return null;
        const maxGrape = grapesSorted[0][1];
        return (
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>CÉPAGES</div>
            {grapesSorted.map(([grape, qty]) => {
              const pct = Math.round(qty / maxGrape * 100);
              return (
                <div key={grape} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, color: "#4A3A2A", fontFamily: "'Cormorant Garamond',serif" }}>{grape}</span>
                    <span style={{ fontSize: 13, color: "#9A8A7A" }}>{qty} btl</span>
                  </div>
                  <div style={{ height: 6, background: "#F0EBE5", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#5B8DD9,#A0C0F0)", borderRadius: 3, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Top 5 wines by rating */}
      {top5.length > 0 && (
        <div style={card}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>TOP 5 VINS</div>
          {top5.map((wine, i) => (
            <div key={wine.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < top5.length - 1 ? 12 : 0, paddingBottom: i < top5.length - 1 ? 12 : 0, borderBottom: i < top5.length - 1 ? "1px solid #F5F0EB" : "none" }}>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 18, fontWeight: 600, color: i === 0 ? "#D4820A" : i === 1 ? "#9A8A7A" : i === 2 ? "#9A6A20" : "#C0B8B0", minWidth: 24, textAlign: "center" }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 16, color: "#2A1F15", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{wine.name} {wine.year}</div>
                <div style={{ fontSize: 13, color: "#9A8A7A" }}>{wine.appellation || wine.region}</div>
              </div>
              <div style={{ background: wine.rating >= 95 ? "#FDF4E0" : "#FAF7F3", border: `1.5px solid ${wine.rating >= 95 ? "#D4820A" : "#DDD8D0"}`, borderRadius: 8, padding: "4px 10px", fontFamily: "'Cinzel',serif", fontSize: 14, fontWeight: 600, color: wine.rating >= 95 ? "#D4820A" : "#6A5A4A", whiteSpace: "nowrap" }}>
                {wine.rating}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit Wine Modal ───────────────────────────────────────────────────────────
function EditModal({ wine, onSave, onClose }) {
  const [form, setForm] = useState({ ...wine });
  const inp = { background: "#FDFBF8", border: "1.5px solid #DDD8D0", borderRadius: 7, color: "#2A1F15", padding: "10px 13px", fontFamily: "'Cormorant Garamond',serif", fontSize: 16, width: "100%", outline: "none" };

  function handleSave() {
    onSave({
      ...form,
      year: parseInt(form.year) || CY,
      quantity: Math.max(0, parseInt(form.quantity) || 0),
      drinkFrom: parseInt(form.drinkFrom) || CY,
      drinkUntil: parseInt(form.drinkUntil) || CY + 10,
      rating: form.rating ? parseInt(form.rating) : null,
    });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EAE5DF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: 3, color: "#8B2635" }}>✏️ MODIFIER LA BOUTEILLE</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A8A7A", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {[["Nom du vin *", "name"], ["Millésime *", "year"], ["Région", "region"], ["Appellation", "appellation"], ["Cépage", "grape"], ["Note /100", "rating"]].map(([ph, key]) => (
              <input key={key} style={inp} placeholder={ph} value={form[key] || ""} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            ))}
            <select style={{ ...inp }} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {ALL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input style={inp} placeholder="Quantité" type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
            <input style={inp} placeholder="Boire à partir de" value={form.drinkFrom} onChange={e => setForm(p => ({ ...p, drinkFrom: e.target.value }))} />
            <input style={inp} placeholder="Boire avant" value={form.drinkUntil} onChange={e => setForm(p => ({ ...p, drinkUntil: e.target.value }))} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <input style={inp} placeholder="Notes" value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            <input style={inp} placeholder="Prix payé (€/btl)" type="number" min="0" step="0.01" value={form.pricePaid || ""} onChange={e => setForm(p => ({ ...p, pricePaid: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSave} style={{ flex: 1, background: "#8B2635", color: "#fff", border: "none", borderRadius: 7, padding: "12px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5 }}>
              Enregistrer
            </button>
            <button onClick={onClose} style={{ background: "#fff", color: "#7A6A5A", border: "1.5px solid #DDD8D0", borderRadius: 7, padding: "12px 16px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11 }}>
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scan Modal ────────────────────────────────────────────────────────────────
function ScanModal({ onClose, onAdd, cellar = [] }) {
  const [phase, setPhase] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [progress, setProgress] = useState("");
  const [detected, setDetected] = useState([]);
  const [selected, setSelected] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  async function processFile(file) {
    if (!file) return;
    setPhase("scanning"); setPreview(null); setPreviews([]); setErrorMsg("");
    setProgress("Analyse de l'étiquette…");
    try {
      const { base64, mediaType, previewUrl } = await compressImage(file);
      setPreview(previewUrl);
      const wines = await analyzeBottlePhoto(base64, mediaType);
      if (!wines || wines.length === 0) throw new Error("Aucune bouteille détectée. Essayez de photographier l'étiquette de plus près.");
      setDetected(wines);
      const sel = {}; wines.forEach((_, i) => { sel[i] = true; }); setSelected(sel);
      setPhase("confirm");
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'analyse.");
      setPhase("error");
    }
  }

  async function processMultiple(files) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    if (arr.length === 1) { processFile(arr[0]); return; }
    setPhase("scanning"); setPreview(null); setPreviews([]); setErrorMsg("");
    const allWines = [], allPreviews = [];
    let hadError = false;
    for (let i = 0; i < arr.length; i++) {
      setProgress(`Analyse photo ${i + 1} / ${arr.length}…`);
      try {
        const { base64, mediaType, previewUrl } = await compressImage(arr[i]);
        allPreviews.push(previewUrl);
        if (i === 0) setPreview(previewUrl);
        const wines = await analyzeBottlePhoto(base64, mediaType);
        if (wines?.length) allWines.push(...wines);
      } catch { hadError = true; }
    }
    setPreviews(allPreviews);
    if (allWines.length === 0) {
      setErrorMsg(hadError ? "Aucune bouteille détectée. Vérifiez la qualité des photos." : "Aucune bouteille détectée dans les photos sélectionnées.");
      setPhase("error"); return;
    }
    setDetected(allWines);
    const sel = {}; allWines.forEach((_, i) => { sel[i] = true; }); setSelected(sel);
    setPhase("confirm");
  }

  function confirmAdd() {
    const toAdd = detected.filter((_, i) => selected[i]).map(w => ({
      ...w, id: Date.now() + Math.random(),
      year: parseInt(w.year) || CY, quantity: parseInt(w.quantity) || 1,
      drinkFrom: parseInt(w.drinkFrom) || CY + 2, drinkUntil: parseInt(w.drinkUntil) || CY + 15,
    }));
    onAdd(toAdd); onClose();
  }

  function reset() { setPhase("idle"); setPreview(null); setPreviews([]); setDetected([]); setProgress(""); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EAE5DF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: 3, color: "#8B2635" }}>📷 SCANNER DES BOUTEILLES</div>
            <div style={{ color: "#9A8A7A", fontSize: 14, fontStyle: "italic", marginTop: 3 }}>Photo unique ou sélection multiple depuis la galerie</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A8A7A", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {phase === "idle" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <label style={{ background: "#FDF0F0", border: "2px solid #FADADD", borderRadius: 12, padding: "28px 16px", cursor: "pointer", textAlign: "center", display: "block", position: "relative", overflow: "hidden" }}>
                  <input type="file" accept="image/*" capture="environment"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 0 }}
                    onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) processFile(f); }} />
                  <div style={{ fontSize: 40, marginBottom: 10, pointerEvents: "none" }}>📸</div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1, color: "#8B2635", pointerEvents: "none" }}>Prendre une photo</div>
                  <div style={{ color: "#9A8A7A", fontSize: 13, marginTop: 4, fontStyle: "italic", pointerEvents: "none" }}>Appareil photo</div>
                </label>
                <label style={{ background: "#F5F8FD", border: "2px solid #C8D8F0", borderRadius: 12, padding: "28px 16px", cursor: "pointer", textAlign: "center", display: "block", position: "relative", overflow: "hidden" }}>
                  <input type="file" accept="image/*" multiple
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 0 }}
                    onChange={e => { const files = e.target.files; e.target.value = ""; if (files?.length) processMultiple(files); }} />
                  <div style={{ fontSize: 40, marginBottom: 10, pointerEvents: "none" }}>🖼️</div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1, color: "#5B8DD9", pointerEvents: "none" }}>Choisir des photos</div>
                  <div style={{ color: "#9A8A7A", fontSize: 13, marginTop: 4, fontStyle: "italic", pointerEvents: "none" }}>Sélection multiple</div>
                </label>
              </div>
              <div style={{ background: "#FAF7F3", borderRadius: 8, padding: "12px 16px", color: "#9A8A7A", fontSize: 14, fontStyle: "italic", textAlign: "center" }}>
                💡 Photographiez l'étiquette de face · Sélectionnez plusieurs photos pour scanner plusieurs bouteilles à la fois
              </div>
            </div>
          )}

          {phase === "scanning" && (
            <div>
              {preview && <img src={preview} alt="aperçu" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, marginBottom: 20, background: "#FAF7F3" }} />}
              <LoadingSkeleton message={progress || "L'IA analyse votre étiquette…"} />
            </div>
          )}

          {phase === "confirm" && (
            <div>
              {previews.length > 1 ? (
                <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
                  {previews.map((src, i) => (
                    <img key={i} src={src} alt={`photo ${i + 1}`} style={{ height: 72, width: 54, objectFit: "cover", borderRadius: 6, flexShrink: 0, border: "1px solid #EAE5DF" }} />
                  ))}
                </div>
              ) : preview ? (
                <img src={preview} alt="aperçu" style={{ width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 8, marginBottom: 16, background: "#FAF7F3" }} />
              ) : null}
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 2, color: "#2E8B57", marginBottom: 12 }}>
                ✓ {detected.length} bouteille{detected.length > 1 ? "s" : ""} identifiée{detected.length > 1 ? "s" : ""}
              </div>
              {detected.map((wine, i) => {
                const tc = TYPE_CONFIG[wine.type] || TYPE_CONFIG.Rouge;
                const isDupe = cellar.some(w =>
                  norm(w.name) === norm(String(wine.name || "")) && w.year === parseInt(wine.year)
                );
                return (
                  <div key={i} style={{ background: selected[i] ? "#FDFBF8" : "#F5F5F5", border: `1.5px solid ${isDupe ? "#E8D8A0" : selected[i] ? "#C5A090" : "#E0E0E0"}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}
                    onClick={() => setSelected(s => ({ ...s, [i]: !s[i] }))}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 17 }}>{wine.name}</span>
                          <span style={{ color: "#8A7A6A", fontStyle: "italic" }}>{wine.year}</span>
                          <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontFamily: "'Cinzel',serif", background: tc.pill, color: tc.color }}>{wine.type}</span>
                          {isDupe && <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontFamily: "'Cinzel',serif", background: "#FDF8EE", color: "#D4820A", border: "1px solid #E8D8A0" }}>⚠️ Déjà en cave → quantité +{parseInt(wine.quantity) || 1}</span>}
                        </div>
                        <div style={{ color: "#9A8A7A", fontSize: 14 }}>
                          {wine.appellation && <>{wine.appellation} · </>}{wine.region}{wine.grape ? ` · ${wine.grape}` : ""}
                        </div>
                        <div style={{ color: "#B0A090", fontSize: 13, marginTop: 4 }}>
                          Fenêtre : {wine.drinkFrom}–{wine.drinkUntil} · {wine.quantity} btl{wine.rating ? ` · ⭐ ${wine.rating}/100` : ""}
                        </div>
                      </div>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${selected[i] ? "#8B2635" : "#CCC"}`, background: selected[i] ? "#8B2635" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 10 }}>
                        {selected[i] && <span style={{ color: "#fff", fontSize: 13 }}>✓</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={confirmAdd}
                  disabled={Object.values(selected).every(v => !v)}
                  style={{ flex: 1, background: "#8B2635", color: "#fff", border: "none", borderRadius: 7, padding: "12px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5, opacity: Object.values(selected).every(v => !v) ? 0.5 : 1 }}>
                  Ajouter à la cave ({Object.values(selected).filter(Boolean).length})
                </button>
                <button onClick={reset} style={{ background: "#fff", color: "#7A6A5A", border: "1.5px solid #DDD8D0", borderRadius: 7, padding: "12px 16px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11 }}>
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {phase === "error" && (
            <div>
              {preview && <img src={preview} alt="aperçu" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, marginBottom: 16, background: "#FAF7F3" }} />}
              <div style={{ background: "#FDF0EE", border: "1px solid #F5C0B0", borderRadius: 8, padding: "14px 16px", color: "#C0392B", marginBottom: 16, fontSize: 15 }}>
                ⚠️ {errorMsg}
              </div>
              <button onClick={reset} style={{ background: "#8B2635", color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5 }}>
                Réessayer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Vivino Search Link (replaces unstable label image fetch) ──────────────────
function LabelSearch({ wine }) {
  const query = encodeURIComponent(`${wine.name} ${wine.year}`);
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <a
        href={`https://www.vivino.com/search/wines?q=${query}`}
        target="_blank" rel="noreferrer"
        style={{ flex: 1, background: "#F5F8FD", border: "1.5px dashed #C8D8F0", borderRadius: 10, padding: "14px 16px", color: "#5B8DD9", fontFamily: "'Cormorant Garamond',serif", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", transition: "background 0.15s" }}
        onMouseOver={e => e.currentTarget.style.background = "#EEF4FD"}
        onMouseOut={e => e.currentTarget.style.background = "#F5F8FD"}>
        🍇 Voir sur Vivino
      </a>
      <a
        href={`https://www.wine-searcher.com/find/${query}`}
        target="_blank" rel="noreferrer"
        style={{ flex: 1, background: "#FAF5F0", border: "1.5px dashed #C5A090", borderRadius: 10, padding: "14px 16px", color: "#8B2635", fontFamily: "'Cormorant Garamond',serif", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", transition: "background 0.15s" }}
        onMouseOver={e => e.currentTarget.style.background = "#FDF0F0"}
        onMouseOut={e => e.currentTarget.style.background = "#FAF5F0"}>
        🔍 Wine-Searcher
      </a>
    </div>
  );
}

// ── Consumption Log Modal ─────────────────────────────────────────────────────
function LogModal({ wine, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, occasion: "", note: "", rating: "" });
  const inp = { background: "#FDFBF8", border: "1.5px solid #DDD8D0", borderRadius: 7, color: "#2A1F15", padding: "10px 13px", fontFamily: "'Cormorant Garamond',serif", fontSize: 15, width: "100%", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EAE5DF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635" }}>🍷 DÉGUSTATION</div>
            <div style={{ color: "#9A8A7A", fontSize: 14, fontStyle: "italic", marginTop: 2 }}>{wine.name} {wine.year}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A8A7A", fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 2, color: "#9A8A7A", marginBottom: 5 }}>DATE</div>
            <input type="date" style={inp} value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 2, color: "#9A8A7A", marginBottom: 5 }}>OCCASION</div>
            <input style={inp} placeholder="Dîner en famille, anniversaire…" value={form.occasion} onChange={e => setForm(p => ({ ...p, occasion: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 2, color: "#9A8A7A", marginBottom: 5 }}>NOTE DE DÉGUSTATION</div>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 80 }} placeholder="Arômes, bouche, finale…" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} />
          </div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 2, color: "#9A8A7A", marginBottom: 5 }}>NOTE PERSONNELLE /100 (optionnel)</div>
            <input style={inp} type="number" min="50" max="100" placeholder="Ex: 94" value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={() => { onSave({ ...form, rating: form.rating ? parseInt(form.rating) : null, id: Date.now() }); onClose(); }}
              style={{ flex: 1, background: "#8B2635", color: "#fff", border: "none", borderRadius: 7, padding: "12px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5 }}>
              Enregistrer
            </button>
            <button onClick={onClose} style={{ background: "#fff", color: "#7A6A5A", border: "1.5px solid #DDD8D0", borderRadius: 7, padding: "12px 16px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11 }}>
              Passer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  return (
    <div className="fade-in" style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#2A1F15", color: "#F8F5F1", borderRadius: 10, padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, zIndex: 2000, boxShadow: "0 8px 32px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
      <span style={{ fontSize: 15, fontFamily: "'Cormorant Garamond',serif" }}>{toast.message}</span>
      {toast.undo && (
        <button onClick={() => { toast.undo(); onDismiss(); }}
          style={{ background: "#8B2635", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1 }}>
          Annuler
        </button>
      )}
      <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#9A8A7A", fontSize: 16, lineHeight: 1, paddingLeft: 4 }}>✕</button>
    </div>
  );
}

// ── Share encode/decode (Unicode-safe base64) ─────────────────────────────────
function encodeShare(cellar) {
  // Strip consumption logs so the URL stays short
  const stripped = cellar.map(({ log, ...w }) => w);
  const json = JSON.stringify(stripped);
  return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p) => String.fromCharCode(parseInt(p, 16))));
}
function decodeShare(encoded) {
  return JSON.parse(decodeURIComponent(
    Array.from(atob(encoded)).map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  ));
}

// ── Export / Import helpers ────────────────────────────────────────────────────
const CSV_HEADERS = ["name","year","region","appellation","type","grape","quantity","drinkFrom","drinkUntil","rating","notes"];

function exportJSON(cellar) {
  const blob = new Blob([JSON.stringify(cellar, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `ma-cave-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function exportCSV(cellar) {
  const escape = v => (typeof v === "string" && (v.includes(",") || v.includes('"'))) ? `"${v.replace(/"/g,'""')}"` : (v ?? "");
  const rows = cellar.map(w => CSV_HEADERS.map(h => escape(w[h])).join(","));
  const blob = new Blob([[CSV_HEADERS.join(","), ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `ma-cave-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function parseImport(text, filename) {
  if (filename.endsWith(".json")) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error("Le fichier JSON doit contenir un tableau.");
    return parsed;
  }
  // CSV
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(",").map(k => k.trim());
  return rows.filter(r => r.trim()).map(row => {
    const vals = row.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) || [];
    const obj = {};
    keys.forEach((k, i) => { obj[k] = (vals[i] || "").replace(/^"|"$/g, "").trim(); });
    return obj;
  });
}

// ── Form validation ────────────────────────────────────────────────────────────
function validateWineForm(w) {
  const errors = {};
  if (!String(w.name || "").trim()) errors.name = "Nom requis";
  const y = parseInt(w.year);
  if (!y || y < 1800 || y > CY + 5) errors.year = `Millésime invalide (1800–${CY + 5})`;
  const from = parseInt(w.drinkFrom), until = parseInt(w.drinkUntil);
  if (from && until && until < from) errors.drinkUntil = "Doit être après la date de début";
  if (parseInt(w.quantity) < 0) errors.quantity = "Quantité invalide";
  return errors;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function WineCellar() {
  const [cellar, setCellar] = useState(() => loadCellarSync() || SAMPLE_CELLAR);
  // storageReady: false until the IDB check completes — prevents saving SAMPLE_CELLAR
  // back to storage before we know whether IDB has real user data.
  const [storageReady, setStorageReady] = useState(() => !!loadCellarSync());
  const [view, setView] = useState("cellar");
  const [selected, setSelected] = useState(null);
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);
  const [mealInput, setMealInput] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [error, setError] = useState("");

  const [fType, setFType] = useState("Tous");
  const [fRegion, setFRegion] = useState("Tous");
  const [fAppellation, setFAppellation] = useState("Tous");
  const [fStatus, setFStatus] = useState("Tous");
  const [fDecade, setFDecade] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [drinkTonight, setDrinkTonight] = useState(false);

  const [newWine, setNewWine] = useState({ name: "", year: "", region: "", appellation: "", type: "Rouge", grape: "", quantity: 1, drinkFrom: "", drinkUntil: "", notes: "", pricePaid: "" });
  const [wishlist, setWishlist] = useState(() => loadWishlist());
  const [showWishForm, setShowWishForm] = useState(false);
  const [newWish, setNewWish] = useState({ name: "", year: "", region: "", type: "Rouge", notes: "", priority: "normale" });
  const [formErrors, setFormErrors] = useState({});

  const [pairingText, setPairingText] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState("");

  const [analysisText, setAnalysisText] = useState("");
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  const [toast, setToast] = useState(null);
  const [adviceCache, setAdviceCache] = useState({});
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightText, setTonightText] = useState("");
  const [tonightError, setTonightError] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [pendingConsume, setPendingConsume] = useState(null);
  const [shareMode, setShareMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [journalSearch, setJournalSearch] = useState("");
  const [journalSort, setJournalSort] = useState("date_desc");

  // On mount: if localStorage was empty, check IndexedDB (survives iOS ITP better).
  // We must do this BEFORE the save effect runs so we don't overwrite real data
  // with SAMPLE_CELLAR. storageReady gates the save effect.
  useEffect(() => {
    if (storageReady) return; // localStorage had data — IDB should be in sync, skip
    idbLoad().then(data => {
      if (data && Array.isArray(data) && data.length > 0) {
        setCellar(data);
        saveCellarSync(data); // restore to localStorage as well
      } else {
        // Nothing in any storage — show onboarding if first visit
        if (!localStorage.getItem(ONBOARDED_KEY)) {
          setShowOnboarding(true);
        }
      }
      setStorageReady(true);
    });
  }, []);

  // On mount: check URL hash for a shared cellar
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;
    try {
      const data = decodeShare(hash.slice(7));
      if (Array.isArray(data) && data.length > 0) {
        setCellar(data.map((w, i) => ({ ...w, id: w.id ?? Date.now() + i })));
        setShareMode(true);
      }
    } catch {}
  }, []);

  // Save on every cellar change — but only after the IDB check is done
  useEffect(() => {
    if (shareMode || !storageReady) return;
    saveCellar(cellar);
  }, [cellar, shareMode, storageReady]);

  useEffect(() => { saveWishlist(wishlist); }, [wishlist]);

  function showToast(message, undo) {
    setToast({ message, undo });
  }

  function completeOnboarding(startFresh) {
    try { localStorage.setItem(ONBOARDED_KEY, "1"); } catch {}
    if (startFresh) {
      setCellar([]);
      saveCellar([]);
    }
    setShowOnboarding(false);
  }

  function copyShareURL() {
    const encoded = encodeShare(cellar);
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    navigator.clipboard.writeText(url)
      .then(() => showToast("🔗 Lien copié dans le presse-papiers ✓"))
      .catch(() => showToast("Impossible de copier — essayez d'exporter en JSON"));
  }

  function importSharedCellar() {
    const owned = loadCellar();
    const merged = owned ? [...owned, ...cellar.filter(s => !owned.some(o => o.id === s.id))] : cellar;
    saveCellar(merged);
    setCellar(merged);
    setShareMode(false);
    window.location.hash = "";
    showToast(`${cellar.length} vins importés dans votre cave ✓`);
  }

  const regions = ["Tous", ...Array.from(new Set(cellar.map(w => w.region))).sort()];
  const appellations = ["Tous", ...Array.from(new Set(cellar.filter(w => fRegion === "Tous" || w.region === fRegion).map(w => w.appellation).filter(Boolean))).sort()];
  const types = ["Tous", ...Array.from(new Set(cellar.map(w => w.type))).sort()];
  const statuses = ["Tous", "Trop tôt", "Jeune", "Apogée", "À boire vite", "Passé"];

  const MATURITY_ORDER = { "À boire vite": 0, "Apogée": 1, "Jeune": 2, "Trop tôt": 3, "Passé": 4 };

  const filtered = cellar
    .filter(w => {
      if (fType !== "Tous" && w.type !== fType) return false;
      if (fRegion !== "Tous" && w.region !== fRegion) return false;
      if (fAppellation !== "Tous" && w.appellation !== fAppellation) return false;
      if (fDecade !== null && (w.year < fDecade || w.year >= fDecade + 10)) return false;
      if (drinkTonight) {
        if (!["Apogée", "À boire vite"].includes(drinkingStatus(w).label)) return false;
      } else if (fStatus !== "Tous" && drinkingStatus(w).label !== fStatus) return false;
      if (search.trim()) {
        const q = norm(search);
        if (![w.name, w.appellation, w.grape, w.notes, w.region, String(w.year)].some(f => norm(f).includes(q))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":      return a.name.localeCompare(b.name);
        case "year_asc":  return a.year - b.year;
        case "year_desc": return b.year - a.year;
        case "rating":    return (b.rating || 0) - (a.rating || 0);
        case "quantity":  return b.quantity - a.quantity;
        case "maturity":  return (MATURITY_ORDER[drinkingStatus(a).label] ?? 5) - (MATURITY_ORDER[drinkingStatus(b).label] ?? 5);
        default:          return 0;
      }
    });

  const totalBottles = cellar.reduce((s, w) => s + w.quantity, 0);
  const readyNow = cellar.filter(w => ["Apogée", "À boire vite"].includes(drinkingStatus(w).label)).length;
  const urgentCount = cellar.filter(w => drinkingStatus(w).label === "À boire vite" && w.quantity > 0).length;
  const journalEntries = cellar.flatMap(w => (w.log || []).map(e => ({ ...e, wine: w }))).sort((a, b) => new Date(b.date) - new Date(a.date));
  const activeFilters = [fType, fRegion, fAppellation, fStatus].filter(f => f !== "Tous").length
    + (drinkTonight ? 1 : 0)
    + (search.trim() ? 1 : 0)
    + (fDecade !== null ? 1 : 0);

  async function getBottleAdvice(wine) {
    setSelected(wine);
    setView("bottle");
    setError("");
    // Use cache if available
    if (adviceCache[wine.id]) {
      setAiText(adviceCache[wine.id]);
      setLoading(false);
      return;
    }
    setAiText(""); setLoading(true);
    try {
      const st = drinkingStatus(wine);
      const text = await askGeminiStream(
        SYS,
        `Bouteille : ${wine.name} ${wine.year} — ${wine.region}${wine.appellation ? ", " + wine.appellation : ""} — ${wine.grape}${wine.rating ? ` — ${wine.rating}/100` : ""}${wine.notes ? ` — ${wine.notes}` : ""}
Fenêtre de dégustation : ${wine.drinkFrom}–${wine.drinkUntil} | Statut en ${CY} : ${st.label}

Réponds en 4 sections avec exactement ces titres :
MOMENT IDÉAL : conseil sur quand ouvrir cette bouteille
ACCORDS METS-VINS : 3 accords détaillés et créatifs
SERVICE : température, décantation, verre recommandé
ANECDOTE : un fait marquant sur ce vin`,
        (partial) => setAiText(partial)
      );
      setAdviceCache(c => ({ ...c, [wine.id]: text }));
    } catch (e) {
      setError(e.message || "Impossible de contacter le sommelier.");
    }
    setLoading(false);
  }

  async function getOpenTonightAdvice() {
    const ready = cellar.filter(w => ["Apogée", "À boire vite"].includes(drinkingStatus(w).label) && w.quantity > 0);
    if (!ready.length) { setTonightError("Aucune bouteille à l'apogée en cave."); return; }
    setTonightText(""); setTonightError(""); setTonightLoading(true);
    try {
      const list = ready.map(w => `- ${w.name} ${w.year} (${w.type}, ${w.grape}, ${drinkingStatus(w).label}, ${w.quantity} btl${w.rating ? `, ${w.rating}/100` : ""})`).join("\n");
      const text = await askGeminiStream(
        SYS,
        `Voici mes bouteilles actuellement à l'apogée ou à boire rapidement :
${list}

Choisis LA meilleure bouteille à ouvrir ce soir et explique pourquoi c'est le moment idéal. Donne ensuite : le service recommandé (température, décantation) et un accord mets-vins parfait pour ce soir. Sois concis et enthousiaste.`,
        (partial) => setTonightText(partial),
        800
      );
      setTonightText(text);
    } catch (e) {
      setTonightError(e.message || "Impossible de contacter le sommelier.");
    }
    setTonightLoading(false);
  }

  async function getMealPairing() {
    if (!mealInput.trim()) return;
    setPairingText(""); setPairingError(""); setPairingLoading(true);
    try {
      const available = cellar.filter(w => w.quantity > 0);
      const list = available.length > 0
        ? available.map(w => `- ${w.name} ${w.year} (${w.type}, ${w.grape}, ${w.region}, ${drinkingStatus(w).label}, ${w.quantity} btl)`).join("\n")
        : "(cave vide)";

      const text = await askGemini(SYS,
        `Plat : "${mealInput}"

Ma cave actuelle :
${list}

Instructions :
1. Sélectionne jusqu'à 3 vins de ma cave qui s'accordent le mieux avec ce plat. Pour chacun, explique pourquoi l'accord fonctionne et donne un conseil de service (température, décantation). Si plusieurs vins, indique l'ordre de service idéal.
2. Si ma cave ne contient aucun vin idéal pour ce plat (ou est vide), ajoute une section "SUGGESTIONS D'ACHAT" avec 2-3 vins à acquérir : indique le nom, l'appellation, le millésime conseillé, la fourchette de prix approximative, et pourquoi ce vin sublime ce plat.
3. Structure ta réponse avec des titres clairs en majuscules.`,
        1500
      );
      setPairingText(text);
    } catch (e) {
      setPairingError(
        e.name === "AbortError"
          ? "La requête a pris trop de temps. Vérifiez votre connexion et réessayez."
          : e.message || "Impossible de contacter le sommelier."
      );
    }
    setPairingLoading(false);
  }

  function addWine() {
    const errors = validateWineForm(newWine);
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    const y = parseInt(newWine.year);
    const isDupe = cellar.some(w =>
      w.name.trim().toLowerCase() === newWine.name.trim().toLowerCase() && w.year === y
    );
    if (isDupe) { setFormErrors({ name: `"${newWine.name.trim()} ${y}" est déjà dans votre cave` }); return; }
    setFormErrors({});
    setCellar(p => [...p, {
      ...newWine,
      id: Date.now(),
      rating: null,
      year: y,
      quantity: parseInt(newWine.quantity) || 1,
      drinkFrom: parseInt(newWine.drinkFrom) || y + 2,
      drinkUntil: parseInt(newWine.drinkUntil) || y + 15,
    }]);
    setNewWine({ name: "", year: "", region: "", appellation: "", type: "Rouge", grape: "", quantity: 1, drinkFrom: "", drinkUntil: "", notes: "" });
    setShowForm(false);
    showToast("Vin ajouté à la cave ✓");
  }

  function updateWine(updated) {
    setCellar(p => p.map(w => w.id === updated.id ? updated : w));
    setSelected(updated);
  }

  async function uploadLabelPhoto(file, wine) {
    if (!file) return;
    try {
      const dataUrl = await compressToDataURL(file, 600, 0.78);
      updateWine({ ...wine, labelPhoto: dataUrl });
    } catch (err) {
      showToast("Impossible de charger la photo : " + err.message);
    }
  }

  function consumeBottle(wine) {
    if (wine.quantity <= 0) return;
    setPendingConsume(wine);
    setShowLog(true);
  }

  function saveConsumptionLog(wine, entry) {
    const updated = {
      ...wine,
      quantity: wine.quantity - 1,
      log: [...(wine.log || []), entry],
    };
    setCellar(p => p.map(w => w.id === wine.id ? updated : w));
    setSelected(updated);
    showToast("Dégustation enregistrée ✓");
  }

  function deleteWine(id) {
    const wine = cellar.find(w => w.id === id);
    setCellar(p => p.filter(w => w.id !== id));
    setView("cellar");
    setSelected(null);
    showToast(`"${wine.name} ${wine.year}" supprimé`, () => setCellar(p => [...p, wine]));
  }

  function addToWishlist() {
    if (!newWish.name.trim()) return;
    setWishlist(p => [...p, { ...newWish, id: Date.now(), name: newWish.name.trim() }]);
    setNewWish({ name: "", year: "", region: "", type: "Rouge", notes: "", priority: "normale" });
    setShowWishForm(false);
    showToast("Vin ajouté à la liste d'achat ✓");
  }

  function removeFromWishlist(id) {
    const item = wishlist.find(w => w.id === id);
    setWishlist(p => p.filter(w => w.id !== id));
    showToast(`"${item.name}" retiré de la liste`, () => setWishlist(p => [...p, item]));
  }

  function buyWishlistItem(item) {
    const y = parseInt(item.year) || CY;
    setCellar(p => [...p, {
      id: Date.now(), name: item.name, year: y, region: item.region || "",
      appellation: "", type: item.type || "Rouge", grape: "", quantity: 1,
      drinkFrom: y + 2, drinkUntil: y + 12, rating: null, notes: item.notes || "",
    }]);
    setWishlist(p => p.filter(w => w.id !== item.id));
    showToast(`"${item.name}" ajouté à la cave ✓`);
  }

  async function getCellarAnalysis() {
    setAnalysisText(""); setAnalysisError(""); setAnalysisLoading(true);
    try {
      const byType = {};
      const byRegion = {};
      cellar.forEach(w => {
        byType[w.type] = (byType[w.type] || 0) + w.quantity;
        byRegion[w.region] = (byRegion[w.region] || 0) + w.quantity;
      });
      const urgent = cellar.filter(w => drinkingStatus(w).label === "À boire vite").map(w => `${w.name} ${w.year}`).join(", ") || "aucune";
      const totalQty = cellar.reduce((s, w) => s + w.quantity, 0);
      const avgRating = (() => { const rated = cellar.filter(w => w.rating); return rated.length ? Math.round(rated.reduce((s, w) => s + w.rating, 0) / rated.length) : null; })();
      const summary = [
        `Cave : ${totalQty} bouteilles, ${cellar.length} références`,
        `Types : ${Object.entries(byType).map(([t, q]) => `${t} ${q} btl`).join(", ")}`,
        `Régions : ${Object.entries(byRegion).map(([r, q]) => `${r} ${q} btl`).join(", ")}`,
        avgRating ? `Note moyenne : ${avgRating}/100` : null,
        `À boire vite : ${urgent}`,
      ].filter(Boolean).join("\n");

      const text = await askGeminiStream(
        SYS,
        `Voici le contenu de ma cave à vin :
${summary}

Effectue une analyse complète de ma cave. Réponds en 4 sections avec exactement ces titres :
BILAN : état général, forces et faiblesses de la collection
URGENCES : bouteilles à ouvrir en priorité et pourquoi
ÉQUILIBRE : diversité des types, régions et millésimes — ce qui manque
RECOMMANDATIONS D'ACHAT : 3 à 5 vins à acquérir pour compléter idéalement la cave (nom, appellation, millésime, budget indicatif)`,
        (partial) => setAnalysisText(partial),
        1800
      );
      setAnalysisText(text);
    } catch (e) {
      setAnalysisError(e.message || "Impossible de contacter le sommelier.");
    }
    setAnalysisLoading(false);
  }

  function importWines(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = parseImport(e.target.result, file.name);
        const normalized = parsed.map(w => ({
          ...w,
          id: Date.now() + Math.random(),
          year: parseInt(w.year) || CY,
          quantity: parseInt(w.quantity) || 1,
          drinkFrom: parseInt(w.drinkFrom) || CY,
          drinkUntil: parseInt(w.drinkUntil) || CY + 10,
          rating: w.rating ? parseInt(w.rating) : null,
        }));
        if (!normalized.length) throw new Error("Aucun vin trouvé dans le fichier.");
        const prev = cellar;
        setCellar(normalized);
        showToast(`${normalized.length} vins importés`, () => setCellar(prev));
      } catch (err) {
        showToast(`Erreur d'import : ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  const inp = { background: "#FDFBF8", border: "1.5px solid #DDD8D0", borderRadius: 7, color: "#2A1F15", padding: "10px 13px", fontFamily: "'Cormorant Garamond',serif", fontSize: 16, width: "100%", outline: "none", transition: "border-color 0.15s" };
  const btnP = { background: "#8B2635", color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5, transition: "background 0.15s" };
  const btnG = { background: "#fff", color: "#7A6A5A", border: "1.5px solid #DDD8D0", borderRadius: 7, padding: "9px 16px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1, transition: "all 0.15s" };

  return (
    <div style={{ fontFamily: "'Cormorant Garamond','Georgia',serif", minHeight: "100vh", background: "#F8F5F1", color: "#2A1F15", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#F8F5F1}::-webkit-scrollbar-thumb{background:#D5CFC8;border-radius:3px}
        .wcard:hover{border-color:#C5A090!important;box-shadow:0 3px 16px rgba(139,38,53,0.10)!important;transform:translateY(-1px)}
        .fade-in{animation:fadeIn .3s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @media(max-width:560px){.hide-sm{display:none!important}.grid2{grid-template-columns:1fr!important}.grid3{grid-template-columns:1fr 1fr!important}}
        @media(max-width:600px){.top-nav{display:none!important}main{padding-bottom:76px!important}.bottom-nav{display:flex!important}}
        .bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #EAE5DF;z-index:200;justify-content:space-around;align-items:stretch;padding-bottom:env(safe-area-inset-bottom,0px)}
        a{color:inherit}
        @media print{.no-print,.bottom-nav,footer{display:none!important}.top-nav{display:none!important}header{position:relative!important}main{padding:8px!important;max-width:100%!important}body,#root>div{background:#fff!important}.wcard{break-inside:avoid;box-shadow:none!important}@page{margin:1.5cm;size:A4 portrait}}
      `}</style>

      {showOnboarding && (
        <OnboardingModal
          onStartFresh={() => completeOnboarding(true)}
          onKeepSamples={() => completeOnboarding(false)}
        />
      )}

      {showLog && pendingConsume && (
        <LogModal
          wine={pendingConsume}
          onSave={(entry) => saveConsumptionLog(pendingConsume, entry)}
          onClose={() => { setShowLog(false); setPendingConsume(null); }}
        />
      )}
      {showScan && <ScanModal onClose={() => setShowScan(false)} cellar={cellar} onAdd={(wines) => {
        let added = 0, merged = 0;
        setCellar(prev => {
          const updated = [...prev];
          wines.forEach(w => {
            const dupeIdx = updated.findIndex(e =>
              norm(e.name) === norm(String(w.name || "")) && e.year === parseInt(w.year)
            );
            if (dupeIdx >= 0) {
              updated[dupeIdx] = { ...updated[dupeIdx], quantity: updated[dupeIdx].quantity + (parseInt(w.quantity) || 1) };
              merged++;
            } else {
              updated.push(w);
              added++;
            }
          });
          return updated;
        });
        const parts = [];
        if (added > 0) parts.push(`${added} bouteille${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""}`);
        if (merged > 0) parts.push(`${merged} quantité${merged > 1 ? "s" : ""} mise${merged > 1 ? "s" : ""} à jour`);
        showToast((parts.join(" · ") || "Cave mise à jour") + " ✓");
      }} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {showEdit && selected && <EditModal wine={selected} onSave={updateWine} onClose={() => setShowEdit(false)} />}

      {/* SHARE MODE BANNER */}
      {shareMode && (
        <div className="no-print" style={{ background: "#FDF4E0", borderBottom: "2px solid #E5D090", padding: "10px 20px", display: "flex", alignItems: "center", gap: 12, justifyContent: "center", flexWrap: "wrap", zIndex: 150, position: "relative" }}>
          <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A7010" }}>🔗 CAVE PARTAGÉE · LECTURE SEULE</span>
          <button onClick={importSharedCellar}
            style={{ background: "#8B2635", color: "#fff", border: "none", borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 1 }}>
            Importer dans ma cave
          </button>
          <button onClick={() => { setShareMode(false); setCellar(loadCellar() || SAMPLE_CELLAR); window.location.hash = ""; }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9A7010", fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "1px solid #EAE5DF", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ padding: "16px 0 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600, letterSpacing: 3, color: "#8B2635" }}>🍷 MA CAVE</div>
              <div style={{ fontSize: 13, color: "#9A8A7A", fontStyle: "italic", marginTop: 2 }}>{totalBottles} bouteilles · {readyNow} à l'apogée</div>
            </div>
          </div>
          <nav className="top-nav" style={{ display: "flex", borderTop: "1px solid #F0EBE5" }}>
            {[["cellar","Cave"],["stats","Statistiques"],["pairing","Accords Mets-Vins"],["wishlist","Liste d'achat"],["journal","Journal"]].map(([v, label]) => {
              const active = view === v || (view === "bottle" && v === "cellar");
              const badge = v === "cellar" && urgentCount > 0 ? urgentCount : (v === "journal" && journalEntries.length > 0 ? journalEntries.length : null);
              return (
                <button key={v} onClick={() => setView(v)}
                  style={{ background: "none", border: "none", borderBottom: `2.5px solid ${active ? "#8B2635" : "transparent"}`, cursor: "pointer", padding: "10px 18px", color: active ? "#8B2635" : "#8A7A6A", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, transition: "all 0.15s", position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {label}
                  {badge && <span style={{ background: "#C0392B", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontFamily: "'Cinzel',serif", letterSpacing: 0, lineHeight: 1.5 }}>{badge}</span>}
                </button>
              );
            })}
          </nav>
          {/* ── Sticky search + filter bar (only on cellar view) ── */}
          {view === "cellar" && (
            <div className="no-print" style={{ padding: "10px 0", borderTop: "1px solid #F0EBE5", display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Search row */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                  <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#B0A090", fontSize: 15, pointerEvents: "none" }}>🔍</span>
                  <input
                    style={{ boxSizing: "border-box", width: "100%", background: "#FDFBF8", border: "1.5px solid #DDD8D0", borderRadius: 8, padding: "8px 32px 8px 34px", fontFamily: "'Cormorant Garamond',serif", fontSize: 15, color: "#2A1F15", outline: "none" }}
                    placeholder="Rechercher un vin, cépage, appellation…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#B0A090", fontSize: 16, lineHeight: 1 }}>✕</button>
                  )}
                </div>
                <button
                  onClick={() => setShowScan(true)}
                  style={{ ...btnG, display: "flex", alignItems: "center", gap: 5, borderColor: "#C8D8F0", color: "#5B8DD9", flexShrink: 0 }}>
                  📷 <span className="hide-sm">Scanner</span>
                </button>
                <button style={{ ...btnG, flexShrink: 0 }} onClick={() => { setShowForm(s => !s); setFormErrors({}); }}>+ Saisir</button>
                {/* Export/Import dropdown */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    id="export-btn"
                    style={{ ...btnG, padding: "9px 11px" }}
                    onClick={() => document.getElementById("export-menu").style.display === "none"
                      ? (document.getElementById("export-menu").style.display = "block")
                      : (document.getElementById("export-menu").style.display = "none")}
                    onBlur={() => setTimeout(() => { const m = document.getElementById("export-menu"); if (m) m.style.display = "none"; }, 150)}>
                    ⋯
                  </button>
                  <div id="export-menu" style={{ display: "none", position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #E5E0DA", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)", minWidth: 150, overflow: "hidden" }}>
                    {[
                      { label: "🔗 Partager ma cave", action: copyShareURL },
                      { label: "🖨️ Imprimer / PDF",   action: () => window.print() },
                      { label: "⬇ Exporter JSON",    action: () => exportJSON(cellar) },
                      { label: "⬇ Exporter CSV",     action: () => exportCSV(cellar) },
                    ].map(({ label, action }) => (
                      <div key={label} onMouseDown={() => { action(); document.getElementById("export-menu").style.display = "none"; }}
                        style={{ padding: "11px 16px", cursor: "pointer", fontSize: 14, fontFamily: "'Cormorant Garamond',serif", color: "#3A2A1A", borderBottom: "1px solid #F5F0EC" }}
                        onMouseOver={e => e.currentTarget.style.background = "#FAF5F0"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                        {label}
                      </div>
                    ))}
                    <label style={{ padding: "11px 16px", cursor: "pointer", fontSize: 14, fontFamily: "'Cormorant Garamond',serif", color: "#3A2A1A", display: "block" }}
                      onMouseOver={e => e.currentTarget.style.background = "#FAF5F0"}
                      onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                      ⬆ Importer JSON/CSV
                      <input type="file" accept=".json,.csv" style={{ display: "none" }} onChange={e => { importWines(e.target.files[0]); e.target.value = ""; document.getElementById("export-menu").style.display = "none"; }} />
                    </label>
                  </div>
                </div>
              </div>
              {/* Filter + sort row */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <FilterDropdown label="Type" value={fType} options={types} onChange={setFType} />
                <FilterDropdown label="Région" value={fRegion} options={regions} onChange={v => { setFRegion(v); setFAppellation("Tous"); }} />
                <FilterDropdown label="Appellation" value={fAppellation} options={appellations} onChange={setFAppellation} />
                <FilterDropdown label="Maturité" value={fStatus} options={statuses} onChange={v => { setFStatus(v); setDrinkTonight(false); }} />
                {/* Drink Tonight */}
                <button
                  onClick={() => { setDrinkTonight(d => !d); setFStatus("Tous"); }}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: drinkTonight ? "#FDF0EE" : "#fff", border: `1.5px solid ${drinkTonight ? "#C0392B" : "#DDD8D0"}`, borderRadius: 8, padding: "8px 13px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11, color: drinkTonight ? "#C0392B" : "#6A5A4A", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                  🍷 Ce soir
                </button>
                {/* Decade quick-filter */}
                {(() => {
                  const decades = [...new Set(cellar.map(w => w.year ? Math.floor(w.year / 10) * 10 : null).filter(Boolean))].sort();
                  if (decades.length < 2) return null;
                  return decades.map(d => (
                    <button key={d}
                      onClick={() => setFDecade(fDecade === d ? null : d)}
                      style={{ background: fDecade === d ? "#FDF0F0" : "#fff", border: `1.5px solid ${fDecade === d ? "#8B2635" : "#DDD8D0"}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11, color: fDecade === d ? "#8B2635" : "#6A5A4A", whiteSpace: "nowrap", transition: "all 0.15s" }}>
                      {d}s
                    </button>
                  ));
                })()}
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ background: sortBy !== "default" ? "#FDF0F0" : "#fff", border: `1.5px solid ${sortBy !== "default" ? "#8B2635" : "#DDD8D0"}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 11, color: sortBy !== "default" ? "#8B2635" : "#6A5A4A", outline: "none" }}>
                  <option value="default">Trier…</option>
                  <option value="name">Nom A–Z</option>
                  <option value="year_desc">Millésime ↓</option>
                  <option value="year_asc">Millésime ↑</option>
                  <option value="rating">Note ↓</option>
                  <option value="quantity">Quantité ↓</option>
                  <option value="maturity">Maturité</option>
                </select>
                {activeFilters > 0 && (
                  <button
                    style={{ ...btnG, color: "#8B2635", borderColor: "#C5A090", fontSize: 11 }}
                    onClick={() => { setFType("Tous"); setFRegion("Tous"); setFAppellation("Tous"); setFStatus("Tous"); setDrinkTonight(false); setSearch(""); setSortBy("default"); setFDecade(null); }}>
                    ✕ Tout effacer ({activeFilters})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: "20px", maxWidth: 840, width: "100%", margin: "0 auto" }}>

        {/* ── STATISTICS ──────────────────────────────────── */}
        {view === "stats" && (
          <div className="fade-in">
            {/* AI Cellar Analysis panel */}
            <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, color: "#8B2635" }}>🤖 ANALYSE DE MA CAVE</div>
                  <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic", marginTop: 2 }}>Bilan, urgences, équilibre et recommandations d'achat par votre sommelier IA</div>
                </div>
                <button
                  onClick={getCellarAnalysis}
                  disabled={analysisLoading}
                  style={{ background: "#8B2635", color: "#fff", border: "none", borderRadius: 7, padding: "10px 20px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1.5, opacity: analysisLoading ? 0.7 : 1, whiteSpace: "nowrap" }}>
                  {analysisLoading ? "…" : analysisText ? "Réanalyser" : "Analyser"}
                </button>
              </div>
              {(analysisLoading || analysisText || analysisError) && (
                <div style={{ marginTop: 14, borderTop: "1px solid #EAE5DF", paddingTop: 14 }}>
                  {analysisError
                    ? <div style={{ color: "#C0392B", fontSize: 14 }}>⚠️ {analysisError}</div>
                    : analysisLoading && !analysisText
                      ? <LoadingSkeleton message="Le sommelier analyse votre collection…" />
                      : (() => {
                          const ANALYSIS_SECTIONS = [
                            { key: "bilan",  re: /BILAN\s*:/i,              icon: "📋", label: "BILAN" },
                            { key: "urgent", re: /URGENCES?\s*:/i,          icon: "🔥", label: "URGENCES" },
                            { key: "equil",  re: /[EÉ]QUILIBRE\s*:/i,      icon: "⚖️", label: "ÉQUILIBRE" },
                            { key: "reco",   re: /RECOMMANDATIONS?\s*(D.ACHAT)?\s*:/i, icon: "🛒", label: "RECOMMANDATIONS D'ACHAT" },
                          ];
                          const parts = analysisText.split(/(?=(?:BILAN|URGENCES?|[EÉ]QUILIBRE|RECOMMANDATIONS?)[\s]*:)/i);
                          const sections = {};
                          for (const part of parts) {
                            for (const { key, re } of ANALYSIS_SECTIONS) {
                              if (re.test(part)) { sections[key] = part.replace(re, "").trim(); break; }
                            }
                          }
                          const hasStructure = Object.keys(sections).length >= 2;
                          if (!hasStructure) return (
                            <div>
                              <p style={{ lineHeight: 1.8, fontSize: 15, color: "#4A3A2A", whiteSpace: "pre-wrap", margin: 0 }}>{analysisText}</p>
                              {analysisLoading && <span style={{ color: "#B0A090", fontSize: 13, fontStyle: "italic" }}> ✍️</span>}
                            </div>
                          );
                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                              {ANALYSIS_SECTIONS.map(({ key, icon, label }) => sections[key] ? (
                                <div key={key} style={{ background: "#FAF7F3", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #DDD8D0" }}>
                                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#8B2635", marginBottom: 8 }}>{icon} {label}</div>
                                  <p style={{ lineHeight: 1.8, fontSize: 15, color: "#4A3A2A", whiteSpace: "pre-wrap", margin: 0 }}>{sections[key]}</p>
                                </div>
                              ) : null)}
                              {analysisLoading && <div style={{ color: "#B0A090", fontSize: 13, fontStyle: "italic" }}>✍️ Analyse en cours…</div>}
                            </div>
                          );
                        })()
                  }
                </div>
              )}
            </div>
            <StatsDashboard cellar={cellar} />
          </div>
        )}

        {/* ── CAVE ────────────────────────────────────────── */}
        {view === "cellar" && (
          <div className="fade-in">

            {activeFilters > 0 && (
              <div style={{ color: "#9A8A7A", fontSize: 14, fontStyle: "italic", marginBottom: 10 }}>
                {filtered.length} bouteille{filtered.length !== 1 ? "s" : ""} trouvée{filtered.length !== 1 ? "s" : ""}
                {drinkTonight && <span style={{ marginLeft: 8, color: "#C0392B" }}>· À ouvrir ce soir</span>}
              </div>
            )}

            {/* ── Open Tonight AI panel (hidden when cave is empty) ── */}
            {cellar.length > 0 && <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, color: "#8B2635" }}>🍷 QUE BOIRE CE SOIR ?</div>
                  <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic", marginTop: 2 }}>Le sommelier choisit la meilleure bouteille de votre cave pour ce soir</div>
                </div>
                <button
                  onClick={getOpenTonightAdvice}
                  disabled={tonightLoading}
                  style={{ ...btnP, opacity: tonightLoading ? 0.7 : 1, whiteSpace: "nowrap" }}>
                  {tonightLoading ? "…" : "Demander"}
                </button>
              </div>
              {(tonightLoading || tonightText || tonightError) && (
                <div style={{ marginTop: 14, borderTop: "1px solid #EAE5DF", paddingTop: 14 }}>
                  {tonightError
                    ? <div style={{ color: "#C0392B", fontSize: 14 }}>⚠️ {tonightError}</div>
                    : tonightLoading && !tonightText ? <LoadingSkeleton message="Le sommelier choisit votre bouteille…" />
                    : <div>
                        <p style={{ lineHeight: 1.8, fontSize: 15, color: "#4A3A2A", whiteSpace: "pre-wrap", margin: 0 }}>{tonightText}</p>
                        {tonightLoading && <span style={{ color: "#B0A090", fontSize: 13, fontStyle: "italic" }}> ✍️</span>}
                      </div>}
                </div>
              )}
            </div>}

            {showForm && (
              <div className="fade-in" style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 14 }}>✦ SAISIE MANUELLE</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="grid2">
                  {[["Nom du vin *","name"],["Millésime *","year"],["Région","region"],["Appellation","appellation"],["Cépage","grape"]].map(([ph,key]) => (
                    <div key={key}>
                      <input style={{ ...inp, borderColor: formErrors[key] ? "#C0392B" : "#DDD8D0" }} placeholder={ph} value={newWine[key]} onChange={e => { setNewWine(p => ({ ...p, [key]: e.target.value })); setFormErrors(p => ({ ...p, [key]: undefined })); }} />
                      {formErrors[key] && <div style={{ color: "#C0392B", fontSize: 12, marginTop: 3 }}>{formErrors[key]}</div>}
                    </div>
                  ))}
                  <select style={inp} value={newWine.type} onChange={e => setNewWine(p => ({ ...p, type: e.target.value }))}>
                    {ALL_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <div>
                    <input style={{ ...inp, borderColor: formErrors.quantity ? "#C0392B" : "#DDD8D0" }} placeholder="Quantité" type="number" min="1" value={newWine.quantity} onChange={e => setNewWine(p => ({ ...p, quantity: e.target.value }))} />
                    {formErrors.quantity && <div style={{ color: "#C0392B", fontSize: 12, marginTop: 3 }}>{formErrors.quantity}</div>}
                  </div>
                  <input style={inp} placeholder="Boire à partir de" value={newWine.drinkFrom} onChange={e => setNewWine(p => ({ ...p, drinkFrom: e.target.value }))} />
                  <div>
                    <input style={{ ...inp, borderColor: formErrors.drinkUntil ? "#C0392B" : "#DDD8D0" }} placeholder="Boire avant" value={newWine.drinkUntil} onChange={e => { setNewWine(p => ({ ...p, drinkUntil: e.target.value })); setFormErrors(p => ({ ...p, drinkUntil: undefined })); }} />
                    {formErrors.drinkUntil && <div style={{ color: "#C0392B", fontSize: 12, marginTop: 3 }}>{formErrors.drinkUntil}</div>}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="grid2">
                  <input style={inp} placeholder="Notes" value={newWine.notes} onChange={e => setNewWine(p => ({ ...p, notes: e.target.value }))} />
                  <input style={inp} placeholder="Prix payé (€/btl)" type="number" min="0" step="0.01" value={newWine.pricePaid} onChange={e => setNewWine(p => ({ ...p, pricePaid: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={btnP} onClick={addWine}>Ajouter à la cave</button>
                  <button style={btnG} onClick={() => { setShowForm(false); setFormErrors({}); }}>Annuler</button>
                </div>
              </div>
            )}

            {cellar.length === 0 ? (
              /* ── True empty cellar — first-use CTAs ── */
              <div className="fade-in" style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🍾</div>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 16, letterSpacing: 2, color: "#8B2635", marginBottom: 8 }}>VOTRE CAVE EST VIDE</div>
                <p style={{ color: "#9A8A7A", fontSize: 15, fontStyle: "italic", marginBottom: 28, lineHeight: 1.6 }}>
                  Commencez par scanner une étiquette, saisir une bouteille manuellement,<br className="hide-sm" /> ou importer un fichier existant.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360, margin: "0 auto" }}>
                  <button onClick={() => setShowScan(true)}
                    style={{ background: "#8B2635", color: "#fff", border: "none", borderRadius: 10, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, fontSize: 15, fontFamily: "'Cormorant Garamond',serif", transition: "background 0.15s" }}
                    onMouseOver={e => e.currentTarget.style.background = "#A02A3F"}
                    onMouseOut={e => e.currentTarget.style.background = "#8B2635"}>
                    <span style={{ fontSize: 26 }}>📷</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1.5, marginBottom: 2 }}>SCANNER UNE ÉTIQUETTE</div>
                      <div style={{ fontSize: 13, opacity: 0.85 }}>L'IA identifie votre vin automatiquement</div>
                    </div>
                  </button>
                  <button onClick={() => setShowForm(true)}
                    style={{ background: "#fff", color: "#4A3A2A", border: "1.5px solid #DDD8D0", borderRadius: 10, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, fontSize: 15, fontFamily: "'Cormorant Garamond',serif", transition: "all 0.15s" }}
                    onMouseOver={e => { e.currentTarget.style.background = "#FAF7F3"; e.currentTarget.style.borderColor = "#C5A090"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#DDD8D0"; }}>
                    <span style={{ fontSize: 26 }}>✏️</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1.5, marginBottom: 2, color: "#6A5A4A" }}>SAISIE MANUELLE</div>
                      <div style={{ fontSize: 13, color: "#9A8A7A" }}>Entrez les détails de votre bouteille</div>
                    </div>
                  </button>
                  <label style={{ background: "#fff", color: "#4A3A2A", border: "1.5px solid #DDD8D0", borderRadius: 10, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, fontSize: 15, fontFamily: "'Cormorant Garamond',serif", transition: "all 0.15s", position: "relative" }}
                    onMouseOver={e => { e.currentTarget.style.background = "#FAF7F3"; e.currentTarget.style.borderColor = "#C5A090"; }}
                    onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#DDD8D0"; }}>
                    <span style={{ fontSize: 26 }}>⬆️</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1.5, marginBottom: 2, color: "#6A5A4A" }}>IMPORTER UN FICHIER</div>
                      <div style={{ fontSize: 13, color: "#9A8A7A" }}>Reprenez une cave existante (JSON ou CSV)</div>
                    </div>
                    <input type="file" accept=".json,.csv" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", fontSize: 0 }}
                      onChange={e => { importWines(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "#9A8A7A", fontStyle: "italic" }}>Aucun vin ne correspond à ces filtres.</div>
            ) : filtered.map(wine => {
              const st = drinkingStatus(wine);
              const tc = TYPE_CONFIG[wine.type] || TYPE_CONFIG.Rouge;
              const range = wine.drinkUntil - wine.drinkFrom;
              const progress = range > 0 ? Math.max(0, Math.min(1, (CY - wine.drinkFrom) / range)) : 0;
              return (
                <div key={wine.id} className="wcard"
                  style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 10, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s", marginBottom: 8 }}
                  onClick={() => getBottleAdvice(wine)}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {wine.labelPhoto
                      ? <img src={wine.labelPhoto} alt="" style={{ width: 38, height: 54, objectFit: "cover", borderRadius: 4, flexShrink: 0, border: "1px solid #EAE5DF" }} />
                      : <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: tc.color, flexShrink: 0, marginTop: 2 }} />
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "3px 10px", marginBottom: 4 }}>
                        <span style={{ fontSize: 18, fontWeight: 600 }}>{wine.name}</span>
                        <span style={{ color: "#8A7A6A", fontSize: 15, fontStyle: "italic" }}>{wine.year}</span>
                        <span className="hide-sm" style={{ display: "inline-block", padding: "2px 9px", borderRadius: 20, fontSize: 11, fontFamily: "'Cinzel',serif", background: tc.pill, color: tc.color }}>{wine.type}</span>
                      </div>
                      <div style={{ color: "#9A8A7A", fontSize: 14, marginBottom: 8 }}>
                        {wine.appellation && <>{wine.appellation} · </>}{wine.grape}
                      </div>
                      <div style={{ height: 3, background: "#EAE5DF", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(4, progress * 100)}%`, background: tc.color, borderRadius: 2, transition: "width 0.4s" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: "#B0A090" }}>{wine.drinkFrom} – {wine.drinkUntil}</span>
                        {wine.notes && <span className="hide-sm" style={{ fontSize: 12, color: "#B0A090", fontStyle: "italic" }}>{wine.notes}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 12, background: st.bg, color: st.color, fontFamily: "'Cinzel',serif", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                        {st.icon} {st.label}
                      </span>
                      <span style={{ fontSize: 13, color: "#9A8A7A" }}>{wine.quantity} btl</span>
                      {wine.rating && <span style={{ fontSize: 12, color: "#D4820A", fontWeight: 600 }}>{wine.rating}/100</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── BOTTLE DETAIL ───────────────────────────────── */}
        {view === "bottle" && selected && (() => {
          const st = drinkingStatus(selected);
          const tc = TYPE_CONFIG[selected.type] || TYPE_CONFIG.Rouge;
          return (
            <div className="fade-in">
              <button style={{ ...btnG, marginBottom: 16 }} onClick={() => setView("cellar")}>← Retour à la cave</button>
              <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                {/* Label photo */}
                {selected.labelPhoto ? (
                  <div style={{ position: "relative", marginBottom: 16, display: "flex", justifyContent: "center" }}>
                    <img src={selected.labelPhoto} alt="étiquette"
                      style={{ maxHeight: 220, maxWidth: "100%", borderRadius: 8, objectFit: "contain", border: "1px solid #EAE5DF", display: "block" }} />
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                      <label title="Changer la photo" style={{ background: "rgba(0,0,0,0.45)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#fff", fontSize: 13, lineHeight: 1.2 }}>
                        ✏️ <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) uploadLabelPhoto(e.target.files[0], selected); e.target.value = ""; }} />
                      </label>
                      <button title="Supprimer la photo" onClick={() => updateWine({ ...selected, labelPhoto: undefined })}
                        style={{ background: "rgba(0,0,0,0.45)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#fff", fontSize: 13, lineHeight: 1.2 }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FAF7F3", border: "1.5px dashed #DDD8D0", borderRadius: 8, padding: "7px 14px", cursor: "pointer", color: "#9A8A7A", fontSize: 13, fontStyle: "italic", marginBottom: 14 }}>
                    📷 Ajouter une photo de l'étiquette
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) uploadLabelPhoto(e.target.files[0], selected); e.target.value = ""; }} />
                  </label>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                      <h2 style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600 }}>{selected.name}</h2>
                      <span style={{ color: "#8A7A6A", fontSize: 18, fontStyle: "italic" }}>{selected.year}</span>
                      <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontFamily: "'Cinzel',serif", background: tc.pill, color: tc.color }}>{selected.type}</span>
                    </div>
                    <div style={{ color: "#9A8A7A", fontSize: 15 }}>
                      {selected.appellation && <>{selected.appellation} · </>}{selected.region} · {selected.grape}
                    </div>
                    {selected.notes && <div style={{ color: "#B0A090", fontSize: 14, fontStyle: "italic", marginTop: 4 }}>{selected.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <button style={{ ...btnG, color: "#5B8DD9", borderColor: "#C8D8F0", fontSize: 11 }}
                      onClick={() => setShowEdit(true)}>✏️ Modifier</button>
                    <button style={{ ...btnG, color: "#C0392B", borderColor: "#EAE5DF", fontSize: 11 }}
                      onClick={() => deleteWine(selected.id)}>🗑 Supprimer</button>
                  </div>
                </div>
                <hr style={{ border: "none", borderTop: "1px solid #EAE5DF", margin: "14px 0" }} />
                {/* Drinking window timeline */}
                <DrinkingWindowTimeline wine={selected} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
                  {[
                    [st.bg, st.color, `${st.icon} ${st.label}`, false],
                    ...(selected.rating ? [["#FDF8EE", "#D4820A", `⭐ ${selected.rating}/100`, true]] : []),
                    ...(selected.pricePaid ? [["#F0F5FD", "#3A5A9A", `💸 ${parseFloat(selected.pricePaid).toLocaleString("fr-FR")} €/btl`, false]] : []),
                  ].map(([bg, color, text, bold], i) => (
                    <div key={i} style={{ background: bg, borderRadius: 7, padding: "6px 14px", fontSize: 14, color, fontWeight: bold ? 600 : 400 }}>{text}</div>
                  ))}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, background: "#FAF5F0", borderRadius: 8, padding: "6px 14px", border: "1px solid #EAE5DF" }}>
                    <button
                      onClick={() => consumeBottle(selected)}
                      disabled={selected.quantity <= 0}
                      style={{ background: selected.quantity > 0 ? "#8B2635" : "#DDD", color: "#fff", border: "none", borderRadius: 5, width: 28, height: 28, cursor: selected.quantity > 0 ? "pointer" : "default", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                      title="J'en ai bu une">
                      −
                    </button>
                    <span style={{ fontFamily: "'Cinzel',serif", fontSize: 14, color: "#4A3A2A", minWidth: 60, textAlign: "center" }}>
                      {selected.quantity} btl
                    </span>
                    <button
                      onClick={() => { const updated = { ...selected, quantity: selected.quantity + 1 }; setCellar(p => p.map(w => w.id === selected.id ? updated : w)); setSelected(updated); }}
                      style={{ background: "#EAE5DF", color: "#4A3A2A", border: "none", borderRadius: 5, width: 28, height: 28, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}
                      title="Ajouter une bouteille">
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Consumption history */}
              {selected.log && selected.log.length > 0 && (
                <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 16 }}>📖 HISTORIQUE DE DÉGUSTATION</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[...selected.log].reverse().map((entry, i) => (
                      <div key={entry.id || i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#8B2635", marginTop: 4 }} />
                          {i < selected.log.length - 1 && <div style={{ width: 1, flex: 1, background: "#EAE5DF", minHeight: 20, marginTop: 4 }} />}
                        </div>
                        <div style={{ flex: 1, background: "#FAF7F3", borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: entry.note || entry.occasion ? 6 : 0 }}>
                            <span style={{ fontFamily: "'Cinzel',serif", fontSize: 12, color: "#6A5A4A", letterSpacing: 1 }}>
                              {new Date(entry.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                            {entry.rating && (
                              <span style={{ fontSize: 13, color: "#D4820A", fontWeight: 600 }}>⭐ {entry.rating}/100</span>
                            )}
                          </div>
                          {entry.occasion && (
                            <div style={{ fontSize: 14, color: "#8B2635", fontStyle: "italic", marginBottom: entry.note ? 4 : 0 }}>{entry.occasion}</div>
                          )}
                          {entry.note && (
                            <div style={{ fontSize: 14, color: "#4A3A2A", lineHeight: 1.6 }}>{entry.note}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#5B8DD9", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>🔍 RECHERCHER CE VIN</div>
                <LabelSearch wine={selected} />
              </div>

              {/* Similar wines in cellar */}
              {(() => {
                const similar = cellar.filter(w =>
                  w.id !== selected.id && w.quantity > 0 &&
                  (w.type === selected.type || w.region === selected.region)
                ).sort((a, b) => {
                  // Prefer same type AND same region first
                  const scoreA = (a.type === selected.type ? 1 : 0) + (a.region === selected.region ? 1 : 0);
                  const scoreB = (b.type === selected.type ? 1 : 0) + (b.region === selected.region ? 1 : 0);
                  return scoreB - scoreA;
                }).slice(0, 4);
                if (!similar.length) return null;
                return (
                  <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 14 }}>
                      🍾 AUTRES VINS SIMILAIRES
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {similar.map(w => {
                        const tc2 = TYPE_CONFIG[w.type] || TYPE_CONFIG.Rouge;
                        const st2 = drinkingStatus(w);
                        return (
                          <div key={w.id}
                            onClick={() => getBottleAdvice(w)}
                            className="wcard"
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid #EAE5DF", borderRadius: 8, cursor: "pointer", transition: "all 0.15s" }}>
                            {w.labelPhoto
                              ? <img src={w.labelPhoto} alt="" style={{ width: 30, height: 42, objectFit: "cover", borderRadius: 3, flexShrink: 0, border: "1px solid #EAE5DF" }} />
                              : <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: tc2.color, flexShrink: 0 }} />
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.name}</div>
                              <div style={{ fontSize: 13, color: "#9A8A7A" }}>{w.year} · {w.region}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                              <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: 10, fontFamily: "'Cinzel',serif", background: tc2.pill, color: tc2.color }}>{w.type}</span>
                              <span style={{ fontSize: 11, color: st2.color }}>{st2.icon} {st2.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  ✦ CONSEIL DU SOMMELIER
                  {adviceCache[selected.id] && !loading && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#B0A090", fontFamily: "'Cormorant Garamond',serif", fontStyle: "italic", letterSpacing: 0 }}>
                      ✓ en cache · <button onClick={() => { setAdviceCache(c => { const n = {...c}; delete n[selected.id]; return n; }); getBottleAdvice(selected); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5B8DD9", fontSize: 11, padding: 0, textDecoration: "underline" }}>Actualiser</button>
                    </span>
                  )}
                </div>
                {error
                  ? <div style={{ color: "#C0392B", fontSize: 15, padding: "12px 16px", background: "#FDF0EE", borderRadius: 7 }}>{error}</div>
                  : loading && !aiText ? <LoadingSkeleton />
                  : aiText ? (() => {
                      const sections = parseSommelierText(aiText);
                      const hasStructure = Object.keys(sections).length >= 2;
                      if (!hasStructure) return <p style={{ lineHeight: 1.85, fontSize: 16, color: "#4A3A2A", whiteSpace: "pre-wrap" }}>{aiText}</p>;
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {SECTION_DEFS.map(({ key, label, icon }) => sections[key] ? (
                            <div key={key} style={{ background: "#FAF7F3", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #DDD8D0" }}>
                              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#8B2635", marginBottom: 8 }}>{icon} {label}</div>
                              <p style={{ lineHeight: 1.8, fontSize: 15, color: "#4A3A2A", whiteSpace: "pre-wrap", margin: 0 }}>{sections[key]}</p>
                            </div>
                          ) : null)}
                          {loading && <div style={{ color: "#B0A090", fontSize: 13, fontStyle: "italic" }}>✍️ Le sommelier écrit…</div>}
                        </div>
                      );
                    })()
                  : null}
              </div>
            </div>
          );
        })()}

        {/* ── PAIRING ─────────────────────────────────────── */}
        {view === "pairing" && (
          <div className="fade-in">

            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 8 }}>✦ ACCORDS METS-VINS</div>
            <p style={{ color: "#9A8A7A", fontStyle: "italic", fontSize: 16, marginBottom: 20 }}>
              Décrivez votre plat — le sommelier sélectionne les meilleures bouteilles de votre cave, ou vous suggère quoi acheter.
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <input style={{ ...inp, fontSize: 17 }}
                placeholder="Ex: Magret de canard aux cerises, risotto aux truffes…"
                value={mealInput}
                onChange={e => setMealInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !pairingLoading && getMealPairing()}
              />
              <button style={{ ...btnP, whiteSpace: "nowrap", flexShrink: 0, opacity: pairingLoading ? 0.7 : 1 }}
                onClick={getMealPairing} disabled={pairingLoading}>
                {pairingLoading ? "…" : "Accorder"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
              {["Filet de bœuf","Homard beurre blanc","Plateau de fromages","Foie gras poêlé","Sole meunière","Tarte Tatin"].map(s => (
                <button key={s} onClick={() => { setMealInput(s); setPairingText(""); setPairingError(""); }}
                  style={{ background: "#fff", border: "1.5px solid #DDD8D0", borderRadius: 20, color: "#8A7A6A", fontSize: 14, padding: "5px 14px", cursor: "pointer", fontFamily: "'Cormorant Garamond',serif", transition: "all 0.15s" }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = "#C5A090"; e.currentTarget.style.color = "#5A3A2A"; }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = "#DDD8D0"; e.currentTarget.style.color = "#8A7A6A"; }}>
                  {s}
                </button>
              ))}
            </div>
            {(pairingLoading || pairingText || pairingError) && (
              <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 16 }}>✦ SÉLECTION DU SOMMELIER</div>
                {pairingError
                  ? <div style={{ color: "#C0392B", fontSize: 15, padding: "12px 16px", background: "#FDF0EE", borderRadius: 7 }}>⚠️ {pairingError}</div>
                  : pairingLoading ? <LoadingSkeleton message="Le sommelier analyse votre plat…" />
                  : <p style={{ lineHeight: 1.85, fontSize: 16, color: "#4A3A2A", whiteSpace: "pre-wrap" }}>{pairingText}</p>}
              </div>
            )}
          </div>
        )}
        {/* ── WISHLIST ─────────────────────────────────────── */}
        {view === "wishlist" && (
          <div className="fade-in">
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 4 }}>✦ LISTE D'ACHAT</div>
            <p style={{ color: "#9A8A7A", fontStyle: "italic", fontSize: 15, marginBottom: 20 }}>
              Notez les vins que vous souhaitez acquérir — cliquez sur "J'ai acheté" pour les ajouter directement à votre cave.
            </p>

            {/* Add wish form toggle */}
            <button
              style={{ ...btnP, marginBottom: 16 }}
              onClick={() => setShowWishForm(s => !s)}>
              {showWishForm ? "Annuler" : "+ Ajouter un vin"}
            </button>

            {showWishForm && (
              <div className="fade-in" style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 10, padding: 20, marginBottom: 16 }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, color: "#8B2635", marginBottom: 14 }}>NOUVEAU VIN À ACQUÉRIR</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }} className="grid2">
                  <input style={inp} placeholder="Nom du vin *" value={newWish.name} onChange={e => setNewWish(p => ({ ...p, name: e.target.value }))} />
                  <input style={inp} placeholder="Millésime" value={newWish.year} onChange={e => setNewWish(p => ({ ...p, year: e.target.value }))} />
                  <input style={inp} placeholder="Région" value={newWish.region} onChange={e => setNewWish(p => ({ ...p, region: e.target.value }))} />
                  <select style={inp} value={newWish.type} onChange={e => setNewWish(p => ({ ...p, type: e.target.value }))}>
                    {ALL_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }} className="grid2">
                  <input style={inp} placeholder="Notes / source" value={newWish.notes} onChange={e => setNewWish(p => ({ ...p, notes: e.target.value }))} />
                  <select style={inp} value={newWish.priority} onChange={e => setNewWish(p => ({ ...p, priority: e.target.value }))}>
                    <option value="urgente">🔴 Urgente</option>
                    <option value="haute">🟠 Haute</option>
                    <option value="normale">🟡 Normale</option>
                    <option value="basse">🟢 Basse</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={btnP} onClick={addToWishlist}>Ajouter à la liste</button>
                  <button style={btnG} onClick={() => setShowWishForm(false)}>Annuler</button>
                </div>
              </div>
            )}

            {wishlist.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: "#9A8A7A", fontStyle: "italic" }}>
                Votre liste d'achat est vide.<br />Ajoutez des vins que vous souhaitez acquérir.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {wishlist.map(item => {
                  const tc = TYPE_CONFIG[item.type] || TYPE_CONFIG.Rouge;
                  const priorityLabel = { urgente: "🔴 Urgente", haute: "🟠 Haute", normale: "🟡 Normale", basse: "🟢 Basse" }[item.priority] || "🟡 Normale";
                  return (
                    <div key={item.id} style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: tc.color, flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "3px 10px", marginBottom: 4 }}>
                            <span style={{ fontSize: 17, fontWeight: 600 }}>{item.name}</span>
                            {item.year && <span style={{ color: "#8A7A6A", fontSize: 15, fontStyle: "italic" }}>{item.year}</span>}
                            <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontFamily: "'Cinzel',serif", background: tc.pill, color: tc.color }}>{item.type}</span>
                            <span style={{ fontSize: 12, color: "#9A8A7A" }}>{priorityLabel}</span>
                          </div>
                          {item.region && <div style={{ color: "#9A8A7A", fontSize: 14, marginBottom: 4 }}>{item.region}</div>}
                          {item.notes && <div style={{ color: "#B0A090", fontSize: 13, fontStyle: "italic" }}>{item.notes}</div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => buyWishlistItem(item)}
                            style={{ background: "#2E8B57", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 1, whiteSpace: "nowrap" }}>
                            ✓ Acheté
                          </button>
                          <button
                            onClick={() => removeFromWishlist(item.id)}
                            style={{ background: "#fff", color: "#C0392B", border: "1.5px solid #EAE5DF", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: 10, letterSpacing: 1 }}>
                            Retirer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── JOURNAL ──────────────────────────────────────── */}
        {view === "journal" && (() => {
          // Build flat list with search + sort applied
          const q = norm(journalSearch.trim());
          const entries = journalEntries
            .filter(e => !q || norm(e.wine.name).includes(q) || norm(e.occasion || "").includes(q) || norm(e.note || "").includes(q))
            .sort((a, b) => {
              if (journalSort === "date_asc")  return new Date(a.date) - new Date(b.date);
              if (journalSort === "rating")    return (b.rating || 0) - (a.rating || 0);
              return new Date(b.date) - new Date(a.date); // date_desc default
            });

          // Group by year-month for timeline display
          const groups = {};
          entries.forEach(e => {
            const d = new Date(e.date);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
            if (!groups[key]) groups[key] = { label, entries: [] };
            groups[key].entries.push(e);
          });

          const avgRating = (() => {
            const rated = journalEntries.filter(e => e.rating);
            return rated.length ? (rated.reduce((s, e) => s + e.rating, 0) / rated.length).toFixed(1) : null;
          })();

          return (
            <div className="fade-in">
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#8B2635", marginBottom: 4 }}>📖 JOURNAL DE DÉGUSTATION</div>
              <p style={{ color: "#9A8A7A", fontStyle: "italic", fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
                L'ensemble de vos notes de dégustation, regroupées par date.
              </p>

              {journalEntries.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ fontSize: 52, marginBottom: 14 }}>📝</div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: 2, color: "#9A8A7A", marginBottom: 8 }}>AUCUNE DÉGUSTATION ENREGISTRÉE</div>
                  <p style={{ color: "#B0A090", fontSize: 14, fontStyle: "italic" }}>
                    Ouvrez une bouteille de votre cave et enregistrez vos impressions avec le bouton "−".
                  </p>
                </div>
              ) : (
                <>
                  {/* Summary KPIs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }} className="grid3">
                    {[
                      ["🥂", journalEntries.length, "dégustations"],
                      ["⭐", avgRating ? `${avgRating}/100` : "—", "note moy."],
                      ["🍷", new Set(journalEntries.map(e => e.wine.id)).size, "vins goûtés"],
                    ].map(([icon, val, lbl], i) => (
                      <div key={i} style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600, color: "#2A1F15" }}>{val}</div>
                        <div style={{ color: "#9A8A7A", fontSize: 13, fontStyle: "italic" }}>{lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* Search + sort bar */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, position: "relative", minWidth: 180 }}>
                      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#B0A090", fontSize: 15, pointerEvents: "none" }}>🔍</span>
                      <input
                        style={{ boxSizing: "border-box", width: "100%", background: "#FDFBF8", border: "1.5px solid #DDD8D0", borderRadius: 8, padding: "8px 32px 8px 34px", fontFamily: "'Cormorant Garamond',serif", fontSize: 15, color: "#2A1F15", outline: "none" }}
                        placeholder="Rechercher un vin, occasion, note…"
                        value={journalSearch}
                        onChange={e => setJournalSearch(e.target.value)}
                      />
                      {journalSearch && <button onClick={() => setJournalSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#B0A090", fontSize: 16, lineHeight: 1 }}>✕</button>}
                    </div>
                    <select value={journalSort} onChange={e => setJournalSort(e.target.value)}
                      style={{ background: "#fff", border: "1.5px solid #DDD8D0", borderRadius: 8, padding: "8px 12px", fontFamily: "'Cinzel',serif", fontSize: 11, color: "#6A5A4A", outline: "none", cursor: "pointer" }}>
                      <option value="date_desc">Plus récent</option>
                      <option value="date_asc">Plus ancien</option>
                      <option value="rating">Meilleure note</option>
                    </select>
                  </div>

                  {entries.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 20px", color: "#9A8A7A", fontStyle: "italic" }}>Aucune dégustation ne correspond à cette recherche.</div>
                  ) : (
                    /* Timeline grouped by month */
                    Object.entries(groups).map(([key, { label, entries: monthEntries }]) => (
                      <div key={key} style={{ marginBottom: 24 }}>
                        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 3, color: "#8B2635", textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                          {label}
                          <div style={{ flex: 1, height: 1, background: "#EAE5DF" }} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {monthEntries.map((entry, i) => {
                            const tc = TYPE_CONFIG[entry.wine.type] || TYPE_CONFIG.Rouge;
                            return (
                              <div key={entry.id || i} style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "16px 18px" }}>
                                {/* Wine header — clickable */}
                                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: entry.note || entry.occasion ? 12 : 0, cursor: "pointer" }}
                                  onClick={() => getBottleAdvice(entry.wine)}>
                                  {entry.wine.labelPhoto
                                    ? <img src={entry.wine.labelPhoto} alt="" style={{ width: 32, height: 46, objectFit: "cover", borderRadius: 4, flexShrink: 0, border: "1px solid #EAE5DF" }} />
                                    : <div style={{ width: 4, height: 46, borderRadius: 2, background: tc.color, flexShrink: 0 }} />
                                  }
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.wine.name} <span style={{ fontWeight: 400, color: "#8A7A6A", fontStyle: "italic" }}>{entry.wine.year}</span></div>
                                    <div style={{ fontSize: 13, color: "#9A8A7A" }}>{entry.wine.region}{entry.wine.appellation ? ` · ${entry.wine.appellation}` : ""}</div>
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                                    <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, color: "#9A8A7A", letterSpacing: 1 }}>
                                      {new Date(entry.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                                    </span>
                                    {entry.rating && <span style={{ fontSize: 13, color: "#D4820A", fontWeight: 600 }}>⭐ {entry.rating}/100</span>}
                                  </div>
                                </div>
                                {(entry.occasion || entry.note) && (
                                  <div style={{ borderTop: "1px solid #F5F0EB", paddingTop: 10 }}>
                                    {entry.occasion && <div style={{ fontSize: 14, color: "#8B2635", fontStyle: "italic", marginBottom: entry.note ? 6 : 0 }}>{entry.occasion}</div>}
                                    {entry.note && <p style={{ fontSize: 15, color: "#4A3A2A", lineHeight: 1.7, margin: 0 }}>{entry.note}</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          );
        })()}

      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="bottom-nav">
        {[["cellar","🍾","Cave"],["stats","📊","Stats"],["pairing","🍽️","Accords"],["wishlist","🛒","Liste"],["journal","📖","Journal"]].map(([v, icon, label]) => {
          const active = view === v || (view === "bottle" && v === "cellar");
          const badge = v === "cellar" && urgentCount > 0 ? urgentCount : (v === "journal" && journalEntries.length > 0 ? journalEntries.length : null);
          return (
            <button key={v} onClick={() => setView(v)}
              style={{ flex: 1, background: "none", border: "none", borderTop: `2.5px solid ${active ? "#8B2635" : "transparent"}`, cursor: "pointer", padding: "10px 4px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "#8B2635" : "#8A7A6A", transition: "all 0.15s", position: "relative" }}>
              <span style={{ fontSize: 22, lineHeight: 1, position: "relative", display: "inline-block" }}>
                {icon}
                {badge && <span style={{ position: "absolute", top: -4, right: -6, background: "#C0392B", color: "#fff", borderRadius: 10, padding: "1px 5px", fontSize: 9, fontFamily: "'Cinzel',serif", letterSpacing: 0, lineHeight: 1.5 }}>{badge}</span>}
              </span>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 9, letterSpacing: 1.5 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      <footer style={{ textAlign: "center", padding: "14px", borderTop: "1px solid #EAE5DF", color: "#C0B0A0", fontSize: 12, fontStyle: "italic", background: "#fff" }}>
        In vino veritas · Sommelier propulsé par Gemini
      </footer>
    </div>
  );
}
