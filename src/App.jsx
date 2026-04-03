import { useState, useEffect } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "ma_cave_v2";

// ── Persistence ───────────────────────────────────────────────────────────────
function loadCellar() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}
function saveCellar(cellar) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cellar)); } catch {}
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
};

const CY = new Date().getFullYear();

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
- type doit être l'un de: Rouge, Blanc, Rosé, Champagne, Liquoreux
- year, quantity, drinkFrom, drinkUntil doivent être des entiers
- rating peut être null si inconnu
- Pour drinkFrom et drinkUntil, estime une fenêtre réaliste selon le vin
- quantity vaut 1 par défaut (sauf si plusieurs bouteilles visibles)
- notes peut être vide ""
Identifie tous les vins visibles sur cette photo. Retourne uniquement le tableau JSON.`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erreur API (${res.status})`);
  }
  const data = await res.json();
  return extractJSON(data.text);
}

const SYS = `Tu es un sommelier expert de renommée mondiale. Tu réponds uniquement en français, avec précision et élégance. Sois concis mais complet. Structure ta réponse avec des titres en majuscules suivis de deux-points.`;

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
function StatsDashboard({ cellar }) {
  const totalBottles = cellar.reduce((s, w) => s + w.quantity, 0);
  const byType = {};
  const byRegion = {};
  cellar.forEach(w => {
    byType[w.type] = (byType[w.type] || 0) + w.quantity;
    byRegion[w.region] = (byRegion[w.region] || 0) + w.quantity;
  });
  const statuses = { "Trop tôt": 0, "Jeune": 0, "Apogée": 0, "À boire vite": 0, "Passé": 0 };
  cellar.forEach(w => { const s = drinkingStatus(w); statuses[s.label] = (statuses[s.label] || 0) + w.quantity; });
  const statusColors = { "Trop tôt": "#5B8DD9", "Jeune": "#2E8B57", "Apogée": "#D4820A", "À boire vite": "#C0392B", "Passé": "#AAA" };
  const card = { background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "18px 20px" };

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
      <div style={card}>
        <div style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 2, color: "#9A8A7A", marginBottom: 12 }}>PAR RÉGION</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {Object.entries(byRegion).sort((a,b)=>b[1]-a[1]).map(([region, qty]) => (
            <div key={region} style={{ background: "#FAF5F0", borderRadius: 8, padding: "8px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, letterSpacing: 1, color: "#8B2635" }}>{region}</span>
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Cormorant Garamond',serif", color: "#2A1F15" }}>{qty}</span>
              <span style={{ fontSize: 11, color: "#B0A090" }}>btl</span>
            </div>
          ))}
        </div>
      </div>
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
              {["Rouge", "Blanc", "Rosé", "Champagne", "Liquoreux"].map(t => <option key={t}>{t}</option>)}
            </select>
            <input style={inp} placeholder="Quantité" type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
            <input style={inp} placeholder="Boire à partir de" value={form.drinkFrom} onChange={e => setForm(p => ({ ...p, drinkFrom: e.target.value }))} />
            <input style={inp} placeholder="Boire avant" value={form.drinkUntil} onChange={e => setForm(p => ({ ...p, drinkUntil: e.target.value }))} />
          </div>
          <input style={{ ...inp, marginBottom: 16 }} placeholder="Notes" value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
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
  const [detected, setDetected] = useState([]);
  const [selected, setSelected] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  async function processFile(file) {
    if (!file) return;
    setPhase("scanning");
    setPreview(null);
    setErrorMsg("");
    try {
      const { base64, mediaType, previewUrl } = await compressImage(file);
      setPreview(previewUrl);
      const wines = await analyzeBottlePhoto(base64, mediaType);
      if (!wines || wines.length === 0) throw new Error("Aucun vin détecté. Essayez de photographier l'étiquette de plus près.");
      setDetected(wines);
      const sel = {};
      wines.forEach((_, i) => { sel[i] = true; });
      setSelected(sel);
      setPhase("confirm");
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de l'analyse.");
      setPhase("error");
    }
  }

  function confirmAdd() {
    const toAdd = detected.filter((_, i) => selected[i]).map(w => ({
      ...w,
      id: Date.now() + Math.random(),
      year: parseInt(w.year) || CY,
      quantity: parseInt(w.quantity) || 1,
      drinkFrom: parseInt(w.drinkFrom) || CY + 2,
      drinkUntil: parseInt(w.drinkUntil) || CY + 15,
    }));
    onAdd(toAdd);
    onClose();
  }

  function reset() { setPhase("idle"); setPreview(null); setDetected([]); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fade-in" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #EAE5DF", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: 14, letterSpacing: 3, color: "#8B2635" }}>📷 SCANNER UNE BOUTEILLE</div>
            <div style={{ color: "#9A8A7A", fontSize: 14, fontStyle: "italic", marginTop: 3 }}>Prenez en photo l'étiquette ou la bouteille</div>
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
                  <input type="file" accept="image/*"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 0 }}
                    onChange={e => { const f = e.target.files[0]; e.target.value = ""; if (f) processFile(f); }} />
                  <div style={{ fontSize: 40, marginBottom: 10, pointerEvents: "none" }}>🖼️</div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 1, color: "#5B8DD9", pointerEvents: "none" }}>Choisir une image</div>
                  <div style={{ color: "#9A8A7A", fontSize: 13, marginTop: 4, fontStyle: "italic", pointerEvents: "none" }}>Depuis la galerie</div>
                </label>
              </div>
              <div style={{ background: "#FAF7F3", borderRadius: 8, padding: "12px 16px", color: "#9A8A7A", fontSize: 14, fontStyle: "italic", textAlign: "center" }}>
                💡 Photographiez l'étiquette de face pour une meilleure reconnaissance
              </div>
            </div>
          )}

          {phase === "scanning" && (
            <div>
              {preview && <img src={preview} alt="aperçu" style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 8, marginBottom: 20, background: "#FAF7F3" }} />}
              <LoadingSkeleton message="L'IA analyse votre étiquette…" />
            </div>
          )}

          {phase === "confirm" && (
            <div>
              {preview && <img src={preview} alt="aperçu" style={{ width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 8, marginBottom: 16, background: "#FAF7F3" }} />}
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 2, color: "#2E8B57", marginBottom: 12 }}>
                ✓ {detected.length} vin{detected.length > 1 ? "s" : ""} identifié{detected.length > 1 ? "s" : ""}
              </div>
              {detected.map((wine, i) => {
                const tc = TYPE_CONFIG[wine.type] || TYPE_CONFIG.Rouge;
                const isDupe = cellar.some(w =>
                  w.name.trim().toLowerCase() === String(wine.name || "").trim().toLowerCase() &&
                  w.year === parseInt(wine.year)
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
                          {isDupe && <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 20, fontSize: 11, fontFamily: "'Cinzel',serif", background: "#FDF8EE", color: "#D4820A", border: "1px solid #E8D8A0" }}>⚠️ Doublon</span>}
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
  const [cellar, setCellar] = useState(() => loadCellar() || SAMPLE_CELLAR);
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [drinkTonight, setDrinkTonight] = useState(false);

  const [newWine, setNewWine] = useState({ name: "", year: "", region: "", appellation: "", type: "Rouge", grape: "", quantity: 1, drinkFrom: "", drinkUntil: "", notes: "" });
  const [formErrors, setFormErrors] = useState({});

  const [pairingText, setPairingText] = useState("");
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingError, setPairingError] = useState("");

  const [toast, setToast] = useState(null);
  const [adviceCache, setAdviceCache] = useState({});
  const [tonightLoading, setTonightLoading] = useState(false);
  const [tonightText, setTonightText] = useState("");
  const [tonightError, setTonightError] = useState("");

  useEffect(() => { saveCellar(cellar); }, [cellar]);

  function showToast(message, undo) {
    setToast({ message, undo });
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
      if (drinkTonight) {
        if (!["Apogée", "À boire vite"].includes(drinkingStatus(w).label)) return false;
      } else if (fStatus !== "Tous" && drinkingStatus(w).label !== fStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![w.name, w.appellation, w.grape, w.notes, w.region].some(f => f && f.toLowerCase().includes(q))) return false;
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
  const activeFilters = [fType, fRegion, fAppellation, fStatus].filter(f => f !== "Tous").length
    + (drinkTonight ? 1 : 0)
    + (search.trim() ? 1 : 0);

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

  function consumeBottle(wine) {
    if (wine.quantity <= 0) return;
    const updated = { ...wine, quantity: wine.quantity - 1 };
    setCellar(p => p.map(w => w.id === wine.id ? updated : w));
    setSelected(updated);
  }

  function deleteWine(id) {
    const wine = cellar.find(w => w.id === id);
    setCellar(p => p.filter(w => w.id !== id));
    setView("cellar");
    setSelected(null);
    showToast(`"${wine.name} ${wine.year}" supprimé`, () => setCellar(p => [...p, wine]));
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
        a{color:inherit}
      `}</style>

      {showScan && <ScanModal onClose={() => setShowScan(false)} cellar={cellar} onAdd={(wines) => {
        setCellar(p => [...p, ...wines]);
        showToast(`${wines.length} vin${wines.length > 1 ? "s" : ""} ajouté${wines.length > 1 ? "s" : ""} ✓`);
      }} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {showEdit && selected && <EditModal wine={selected} onSave={updateWine} onClose={() => setShowEdit(false)} />}

      {/* HEADER */}
      <header style={{ background: "#fff", borderBottom: "1px solid #EAE5DF", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ padding: "16px 0 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: 22, fontWeight: 600, letterSpacing: 3, color: "#8B2635" }}>🍷 MA CAVE</div>
              <div style={{ fontSize: 13, color: "#9A8A7A", fontStyle: "italic", marginTop: 2 }}>{totalBottles} bouteilles · {readyNow} à l'apogée</div>
            </div>
          </div>
          <nav style={{ display: "flex", borderTop: "1px solid #F0EBE5" }}>
            {[["cellar","Cave"],["stats","Statistiques"],["pairing","Accords Mets-Vins"]].map(([v, label]) => {
              const active = view === v || (view === "bottle" && v === "cellar");
              return (
                <button key={v} onClick={() => setView(v)}
                  style={{ background: "none", border: "none", borderBottom: `2.5px solid ${active ? "#8B2635" : "transparent"}`, cursor: "pointer", padding: "10px 18px", color: active ? "#8B2635" : "#8A7A6A", fontFamily: "'Cinzel',serif", fontSize: 12, letterSpacing: 2, transition: "all 0.15s" }}>
                  {label}
                </button>
              );
            })}
          </nav>
          {/* ── Sticky search + filter bar (only on cellar view) ── */}
          {view === "cellar" && (
            <div style={{ padding: "10px 0", borderTop: "1px solid #F0EBE5", display: "flex", flexDirection: "column", gap: 8 }}>
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
                      { label: "⬇ Exporter JSON", action: () => exportJSON(cellar) },
                      { label: "⬇ Exporter CSV",  action: () => exportCSV(cellar) },
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
                    onClick={() => { setFType("Tous"); setFRegion("Tous"); setFAppellation("Tous"); setFStatus("Tous"); setDrinkTonight(false); setSearch(""); setSortBy("default"); }}>
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
        {view === "stats" && <StatsDashboard cellar={cellar} />}

        {/* ── CAVE ────────────────────────────────────────── */}
        {view === "cellar" && (
          <div className="fade-in">

            {activeFilters > 0 && (
              <div style={{ color: "#9A8A7A", fontSize: 14, fontStyle: "italic", marginBottom: 10 }}>
                {filtered.length} bouteille{filtered.length !== 1 ? "s" : ""} trouvée{filtered.length !== 1 ? "s" : ""}
                {drinkTonight && <span style={{ marginLeft: 8, color: "#C0392B" }}>· À ouvrir ce soir</span>}
              </div>
            )}

            {/* ── Open Tonight AI panel ── */}
            <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
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
            </div>

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
                    {["Rouge","Blanc","Rosé","Champagne","Liquoreux"].map(t => <option key={t}>{t}</option>)}
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
                <input style={{ ...inp, marginBottom: 14 }} placeholder="Notes" value={newWine.notes} onChange={e => setNewWine(p => ({ ...p, notes: e.target.value }))} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={btnP} onClick={addWine}>Ajouter à la cave</button>
                  <button style={btnG} onClick={() => { setShowForm(false); setFormErrors({}); }}>Annuler</button>
                </div>
              </div>
            )}

            {filtered.length === 0 ? (
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
                    <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: tc.color, flexShrink: 0, marginTop: 2 }} />
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
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {[
                    [st.bg, st.color, `${st.icon} ${st.label}`],
                    ["#FAF5F0", "#6A5A4A", `📅 ${selected.drinkFrom}–${selected.drinkUntil}`],
                    ...(selected.rating ? [["#FDF8EE", "#D4820A", `⭐ ${selected.rating}/100`]] : []),
                  ].map(([bg, color, text], i) => (
                    <div key={i} style={{ background: bg, borderRadius: 7, padding: "6px 14px", fontSize: 14, color, fontWeight: i === 2 ? 600 : 400 }}>{text}</div>
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

              <div style={{ background: "#fff", border: "1px solid #EAE5DF", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Cinzel',serif", fontSize: 13, letterSpacing: 3, color: "#5B8DD9", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>🔍 RECHERCHER CE VIN</div>
                <LabelSearch wine={selected} />
              </div>

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
      </main>

      <footer style={{ textAlign: "center", padding: "14px", borderTop: "1px solid #EAE5DF", color: "#C0B0A0", fontSize: 12, fontStyle: "italic", background: "#fff" }}>
        In vino veritas · Sommelier propulsé par Gemini
      </footer>
    </div>
  );
}
