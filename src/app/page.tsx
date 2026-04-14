"use client";
import { useState, useEffect, useRef } from "react";
import Login from "./login";
import UploadPage from "./upload";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const API_BASE = "https://upi-fraud-detection-major-project.onrender.com";

let accessToken: string | null = null;

async function getToken() {
  const stored = localStorage.getItem("access_token");
  if (stored) { accessToken = stored; return accessToken; }
  throw new Error("Not logged in");
}

// ✅ Refresh token se naya access token lo
async function tryRefreshToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return false;
  try {
    const res = await fetch(`http://127.0.0.1:8000/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    accessToken = data.access;
    localStorage.setItem("access_token", data.access);
    return true;
  } catch {
    return false;
  }
}

// ✅ 401 pe refresh try karo, tab bhi fail ho toh logout
async function apiFetch(path, opts = {}) {
  if (!accessToken) {
    const stored = localStorage.getItem("access_token");
    if (stored) accessToken = stored;
    else { window.location.reload(); return; }
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return apiFetch(path, opts);
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_email");
    accessToken = null;
    window.location.reload();
    return;
  }
  return res.json();
}

const fmtAmt = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

function getStatusColor(status) {
  if (status === "fraud") return "#ff3250";
  if (status === "suspicious") return "#f59e0b";
  return "#00ffa0";
}

function getStatusLabel(status) {
  if (status === "fraud") return "⚠ FRAUD";
  if (status === "suspicious") return "⚡ SUSPICIOUS";
  return "✓ SAFE";
}

const S = {
  app: {
    fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
    background: "#060810", minHeight: "100vh", color: "#e2e8f0", overflowX: "hidden",
  },
  header: {
    background: "linear-gradient(135deg,#0a0f1e,#0d1526)",
    borderBottom: "1px solid rgba(0,255,160,.15)", padding: "18px 32px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    position: "sticky", top: 0, zIndex: 100,
  },
  logoText: {
    fontSize: 18, fontWeight: 700, letterSpacing: "0.05em",
    background: "linear-gradient(90deg,#00ffa0,#00b4ff)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  liveChip: {
    display: "flex", alignItems: "center", gap: 6,
    background: "rgba(0,255,160,.08)", border: "1px solid rgba(0,255,160,.3)",
    borderRadius: 20, padding: "5px 14px",
    fontSize: 11, letterSpacing: "0.12em", color: "#00ffa0", fontWeight: 600,
  },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "#00ffa0", animation: "pulse 1.5s ease-in-out infinite" },
  grid5: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, padding: "24px 32px 0" },
  statCard: (accent) => ({
    background: "linear-gradient(135deg,#0d1526,#0a1020)",
    border: `1px solid ${accent}22`, borderRadius: 16, padding: 20, position: "relative",
  }),
  statLabel: { fontSize: 10, letterSpacing: "0.15em", color: "#64748b", textTransform: "uppercase", marginBottom: 8 },
  statValue: (accent) => ({ fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1 }),
  statSub: { fontSize: 11, color: "#475569", marginTop: 4 },
  mainGrid: { display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, padding: "16px 32px" },
  card: {
    background: "linear-gradient(135deg,#0d1526,#0a1020)",
    border: "1px solid rgba(255,255,255,.06)", borderRadius: 16, overflow: "hidden",
  },
  cardHeader: {
    padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,.05)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  cardTitle: { fontSize: 12, letterSpacing: "0.1em", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 },
  txnRow: (status, isNew) => ({
    display: "grid", gridTemplateColumns: "90px 1fr 90px 90px 90px",
    gap: 12, padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,.03)", alignItems: "center",
    background: status === "fraud"
      ? isNew ? "rgba(255,50,80,.12)" : "rgba(255,50,80,.04)"
      : status === "suspicious"
      ? isNew ? "rgba(245,158,11,.12)" : "rgba(245,158,11,.04)"
      : isNew ? "rgba(0,255,160,.06)" : "transparent",
    transition: "background 1.2s ease",
    borderLeft: `3px solid ${status === "fraud" ? "#ff3250" : status === "suspicious" ? "#f59e0b" : "transparent"}`,
  }),
  badge: (status) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    background: status === "fraud" ? "rgba(255,50,80,.15)" : status === "suspicious" ? "rgba(245,158,11,.15)" : "rgba(0,255,160,.1)",
    color: getStatusColor(status),
    border: `1px solid ${status === "fraud" ? "rgba(255,50,80,.3)" : status === "suspicious" ? "rgba(245,158,11,.3)" : "rgba(0,255,160,.2)"}`,
    borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700,
  }),
  alertPanel: { display: "flex", flexDirection: "column", gap: 10, padding: 12, maxHeight: 500, overflowY: "auto" },
  alertCard: (status) => ({
    background: status === "suspicious" ? "rgba(245,158,11,.07)" : "rgba(255,50,80,.07)",
    border: `1px solid ${status === "suspicious" ? "rgba(245,158,11,.2)" : "rgba(255,50,80,.2)"}`,
    borderRadius: 12, padding: 14, animation: "slideIn .4s ease",
  }),
  flag: {
    display: "inline-block",
    background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.25)",
    color: "#f59e0b", borderRadius: 4, padding: "1px 6px",
    fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", margin: "2px 2px 0 0",
  },
  bottomGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "0 32px 32px" },
  errorBanner: {
    background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)",
    borderRadius: 12, padding: "12px 20px", margin: "16px 32px", fontSize: 12, color: "#f59e0b",
  },
  userBar: {
    background: "rgba(0,255,160,.05)", borderBottom: "1px solid rgba(0,255,160,.08)",
    padding: "8px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
    fontSize: 11, color: "#475569",
  },
};

function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={S.statCard(accent)}>
      <div style={{ position: "absolute", right: 16, top: 16, fontSize: 22, opacity: 0.3 }}>{icon}</div>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue(accent)}>{value}</div>
      {sub && <div style={S.statSub}>{sub}</div>}
    </div>
  );
}

function RiskGauge({ score }) {
  const pct = Math.round(score * 100);
  const color = score > 0.75 ? "#ff3250" : score > 0.5 ? "#f59e0b" : "#00ffa0";
  const r = 40, cx = 52, cy = 52, circ = 2 * Math.PI * r;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="8" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: "stroke-dasharray .6s ease" }} />
      <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="18" fontWeight="700" fontFamily="monospace">{pct}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#475569" fontSize="9" fontFamily="monospace">RISK %</text>
    </svg>
  );
}

const ChartTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1526", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 14px", fontSize: 11 }}>
      <div style={{ color: "#00ffa0" }}>Safe: {payload[0]?.value}</div>
      <div style={{ color: "#f59e0b" }}>Suspicious: {payload[1]?.value}</div>
      <div style={{ color: "#ff3250" }}>Fraud: {payload[2]?.value}</div>
    </div>
  );
};

function AuthWrapper({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const email = localStorage.getItem("user_email");
    if (token && email) { accessToken = token; setUser({ email, access: token }); }
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!user) return <Login onLoginSuccess={(data) => { accessToken = data.access; setUser(data); }} />;
  return children({ user, onLogout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_email");
    accessToken = null;
    setUser(null);
  }});
}

function Dashboard({ user, onLogout }) {
  const [showUpload, setShowUpload] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ total: 0, fraud_count: 0, suspicious_count: 0, safe_count: 0, fraud_rate: 0, total_fraud_amount: 0 });
  const [chartData, setChartData] = useState(Array.from({ length: 20 }, (_, i) => ({ t: i, safe: 0, suspicious: 0, fraud: 0 })));
  const [pieData, setPieData] = useState([
    { name: "Safe", value: 0 },
    { name: "Suspicious", value: 0 },
    { name: "Fraud", value: 0 },
  ]);
  const [newIds, setNewIds] = useState(new Set());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // [ADDED] Track CSV download loading state
  const [csvDownloading, setCsvDownloading] = useState(false);
  const sseRef = useRef(null);
  const chartBuf = useRef({ safe: 0, suspicious: 0, fraud: 0, tick: 0 });

  // [ADDED] Download fraud CSV for the logged-in user.
  // Uses raw fetch (not apiFetch) so we can handle a Blob response.
  async function handleDownloadCsv() {
    setCsvDownloading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/download-csv/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        alert("Failed to download CSV. Please try again.");
        return;
      }
      // [ADDED] Derive filename from Content-Disposition header, fallback to generic name
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match ? match[1] : "fraud_transactions.csv";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("CSV download error: " + e.message);
    } finally {
      setCsvDownloading(false);
    }
  }

  useEffect(() => {
    const s = document.createElement("style");
    s.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
      @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
      @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
      ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
    `;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await getToken();
        setAuthReady(true);
        await refreshStats();
        await loadTransactions();
      } catch (e) {
        setError("⚠ Cannot reach Django backend at localhost:8000.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const id = setInterval(refreshStats, 5000);
    return () => clearInterval(id);
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    connectSSE();
    return () => sseRef.current?.close();
  }, [authReady]);

  async function connectSSE() {
    if (sseRef.current) sseRef.current.close();
    if (!accessToken) accessToken = localStorage.getItem("access_token");
    const es = new EventSource(`${API_BASE}/stream/?token=${accessToken}`);
    sseRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = async () => { setConnected(false); es.close(); setTimeout(connectSSE, 4000); };
    es.onmessage = (e) => { const txn = JSON.parse(e.data); ingestTransaction(txn); };
  }

  async function refreshStats() {
    try {
      const data = await apiFetch("/stats/");
      if (!data) return;
      setStats(data);
      setPieData([
        { name: "Safe",       value: data.safe_count       || 0 },
        { name: "Suspicious", value: data.suspicious_count || 0 },
        { name: "Fraud",      value: data.fraud_count      || 0 },
      ]);
    } catch (_) {}
  }

  async function loadTransactions() {
    try {
      const data = await apiFetch("/transactions/?page_size=30");
      if (!data) return;
      const list = data.results || [];
      setTransactions(list);
      setAlerts(list.filter(t => t.status === "fraud" || t.status === "suspicious").slice(0, 12));
    } catch (_) {}
  }

  function ingestTransaction(txn) {
    setTransactions(prev => [txn, ...prev].slice(0, 60));
    setNewIds(new Set([txn.id || txn.txn_id]));
    setTimeout(() => setNewIds(new Set()), 2000);
    if (txn.status === "fraud" || txn.status === "suspicious") {
      setAlerts(prev => [txn, ...prev].slice(0, 12));
    }
    const key = txn.status === "fraud" ? "fraud" : txn.status === "suspicious" ? "suspicious" : "safe";
    chartBuf.current[key] += 1;
    chartBuf.current.tick += 1;
    if (chartBuf.current.tick % 3 === 0) {
      const snap = { ...chartBuf.current };
      setChartData(prev => [...prev.slice(1), { t: prev.length, safe: snap.safe, suspicious: snap.suspicious, fraud: snap.fraud }]);
      chartBuf.current.safe = 0; chartBuf.current.suspicious = 0; chartBuf.current.fraud = 0;
    }
  }

  if (showUpload) {
    return <UploadPage user={user} onBack={() => { setShowUpload(false); loadTransactions(); refreshStats(); }} />;
  }

  const fraudRate = stats.fraud_rate?.toFixed(1) ?? "0.0";

  return (
    <div style={S.app}>
      <div style={S.userBar}>
        <span>👤 {user.email}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowUpload(true)} style={{ background: "rgba(0,255,160,.1)", border: "1px solid rgba(0,255,160,.2)", color: "#00ffa0", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
            📂 CSV Upload
          </button>
          {/* [ADDED] Download CSV button — exports only this user's fraud transactions */}
          <button
            onClick={handleDownloadCsv}
            disabled={csvDownloading}
            style={{ background: "rgba(168,85,247,.1)", border: "1px solid rgba(168,85,247,.3)", color: "#a855f7", borderRadius: 6, padding: "4px 12px", cursor: csvDownloading ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "inherit", opacity: csvDownloading ? 0.6 : 1 }}
          >
            {csvDownloading ? "⏳ Downloading…" : "⬇ Download CSV"}
          </button>
          <button onClick={onLogout} style={{ background: "rgba(255,50,80,.1)", border: "1px solid rgba(255,50,80,.2)", color: "#ff3250", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
            Logout
          </button>
        </div>
      </div>

      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "linear-gradient(135deg,#00ffa0,#00b4ff)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: "0 0 20px rgba(0,255,160,.4)" }}>🛡</div>
          <div>
            <div style={S.logoText}>UPI FRAUD SENTINEL</div>
            <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em" }}>DJANGO + RANDOM FOREST · REAL-TIME DETECTION</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={S.liveChip}>
            <div style={{ ...S.dot, background: connected ? "#00ffa0" : "#f59e0b" }} />
            {connected ? "LIVE · SSE CONNECTED" : authReady ? "POLLING MODE" : "CONNECTING…"}
          </div>
          <button onClick={loadTransactions} style={{ background: "rgba(0,180,255,.1)", border: "1px solid rgba(0,180,255,.3)", color: "#00b4ff", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.08em" }}>
            ↻ REFRESH
          </button>
        </div>
      </div>

      {error && (
        <div style={S.errorBanner}>{error}
          <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            Run: <code style={{ background: "rgba(0,0,0,.3)", padding: "1px 6px", borderRadius: 4 }}>python manage.py runserver</code>
          </div>
        </div>
      )}

      <div style={S.grid5}>
        <StatCard label="Total" value={(stats.total || 0).toLocaleString()} sub="Stored in DB" accent="#00b4ff" icon="📊" />
        <StatCard label="Fraud" value={(stats.fraud_count || 0).toLocaleString()} sub={`${fraudRate}% fraud rate`} accent="#ff3250" icon="🚨" />
        <StatCard label="Suspicious" value={(stats.suspicious_count || 0).toLocaleString()} sub="Need review" accent="#f59e0b" icon="⚡" />
        <StatCard label="Safe" value={(stats.safe_count || 0).toLocaleString()} sub="Cleared by model" accent="#00ffa0" icon="✓" />
        <StatCard label="Amount at Risk" value={fmtAmt(stats.total_fraud_amount || 0)} sub="Fraud amount" accent="#a855f7" icon="💰" />
      </div>

      <div style={S.mainGrid}>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}>⚡ Live Transaction Feed</div>
            <div style={{ fontSize: 10, color: "#334155" }}>{transactions.length} loaded</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 90px 90px 90px", gap: 12, padding: "8px 20px", fontSize: 9, color: "#334155", letterSpacing: "0.12em", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
            <span>TIME</span><span>SENDER → RECEIVER</span><span>AMOUNT</span><span>STATUS</span><span>RISK</span>
          </div>
          <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {transactions.length === 0 && (
              <div style={{ textAlign: "center", color: "#334155", padding: "48px 0", fontSize: 12 }}>
                {error ? "Backend unreachable" : "CSV upload karo transactions dekhne ke liye!"}
              </div>
            )}
            {transactions.map((txn) => {
              const id = txn.txn_id || txn.id;
              const txnStatus = txn.status || (txn.is_fraud ? "fraud" : "safe");
              const risk = txn.risk_score ?? 0;
              return (
                <div key={id} style={S.txnRow(txnStatus, newIds.has(id))}>
                  <div>
                    <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{id}</div>
                    <div style={{ fontSize: 10, color: "#334155" }}>{fmtTime(txn.timestamp)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.sender_upi || txn.sender}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>→ {txn.receiver_upi || txn.receiver} · {txn.city}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: getStatusColor(txnStatus) }}>{fmtAmt(txn.amount)}</div>
                  <div><span style={S.badge(txnStatus)}>{getStatusLabel(txnStatus)}</span></div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: getStatusColor(txnStatus) }}>{Math.round(risk * 100)}%</div>
                    <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden", marginTop: 3 }}>
                      <div style={{ height: "100%", width: `${risk * 100}%`, background: getStatusColor(txnStatus), borderRadius: 2, transition: "width .5s" }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}>🚨 Fraud & Suspicious Alerts</div>
            <div style={{ background: "rgba(255,50,80,.1)", color: "#ff3250", border: "1px solid rgba(255,50,80,.25)", borderRadius: 12, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{alerts.length}</div>
          </div>
          <div style={S.alertPanel}>
            {alerts.length === 0 && <div style={{ textAlign: "center", color: "#334155", padding: "40px 0", fontSize: 12 }}>No alerts yet</div>}
            {alerts.map((txn, i) => {
              const id = txn.txn_id || txn.id;
              const risk = txn.risk_score ?? 0;
              const flags = txn.flags || [];
              const txnStatus = txn.status || (txn.is_fraud ? "fraud" : "safe");
              const color = getStatusColor(txnStatus);
              return (
                <div key={`${id}-${i}`} style={S.alertCard(txnStatus)}>
                  <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    {txnStatus === "suspicious" ? "⚡" : "⚠"} {id}
                    <span style={{ marginLeft: "auto", color: "#475569", fontSize: 10, fontWeight: 400 }}>{fmtTime(txn.timestamp)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                    <RiskGauge score={risk} />
                    <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
                      <div><span style={{ color: "#475569" }}>From:</span> {txn.sender_upi || txn.sender}</div>
                      <div><span style={{ color: "#475569" }}>To:</span> {txn.receiver_upi || txn.receiver}</div>
                      <div><span style={{ color: "#475569" }}>Amt:</span> <span style={{ color, fontWeight: 700 }}>{fmtAmt(txn.amount)}</span></div>
                      <div><span style={{ color: "#475569" }}>Loc:</span> {txn.city}</div>
                      <div><span style={{ color: "#475569" }}>Status:</span> <span style={{ color, fontWeight: 700 }}>{getStatusLabel(txnStatus)}</span></div>
                    </div>
                  </div>
                  <div>{flags.map(f => <span key={f} style={S.flag}>{f}</span>)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={S.bottomGrid}>
        <div style={S.card}>
          <div style={S.cardHeader}><div style={S.cardTitle}>📈 Transaction Volume (Session)</div></div>
          <div style={{ padding: "16px 8px 8px" }}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gSafe" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ffa0" stopOpacity={0.3} /><stop offset="95%" stopColor="#00ffa0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSusp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFraud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3250" stopOpacity={0.3} /><stop offset="95%" stopColor="#ff3250" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.04)" />
                <XAxis hide /><YAxis tick={{ fontSize: 9, fill: "#334155" }} width={28} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="safe" stroke="#00ffa0" strokeWidth={2} fill="url(#gSafe)" dot={false} />
                <Area type="monotone" dataKey="suspicious" stroke="#f59e0b" strokeWidth={2} fill="url(#gSusp)" dot={false} />
                <Area type="monotone" dataKey="fraud" stroke="#ff3250" strokeWidth={2} fill="url(#gFraud)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", gap: 20, padding: "0 16px", marginTop: 4 }}>
              {[["#00ffa0", "Safe"], ["#f59e0b", "Suspicious"], ["#ff3250", "Fraud"]].map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#475569" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{l}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHeader}><div style={S.cardTitle}>🔬 Detection Breakdown</div></div>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 20px", gap: 24 }}>
            <PieChart width={160} height={160}>
              <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                <Cell fill="#00ffa0" />
                <Cell fill="#f59e0b" />
                <Cell fill="#ff3250" />
              </Pie>
            </PieChart>
            <div style={{ flex: 1 }}>
              {pieData.map((d, i) => {
                const colors = ["#00ffa0", "#f59e0b", "#ff3250"];
                const total = pieData.reduce((a, b) => a + b.value, 0);
                return (
                  <div key={d.name} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: colors[i] }}>{d.name}</span>
                      <span style={{ color: "#94a3b8", fontWeight: 700 }}>{d.value}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,.06)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${total > 0 ? (d.value / total) * 100 : 0}%`, background: colors[i], borderRadius: 2, transition: "width .5s" }} />
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 16, padding: 12, background: "rgba(0,180,255,.05)", border: "1px solid rgba(0,180,255,.12)", borderRadius: 10 }}>
                <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em", marginBottom: 6 }}>BACKEND · ML MODEL</div>
                <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.8 }}>
                  <div>🤖 Random Forest (sklearn)</div>
                  <div>⚙ Django 4.2 + DRF</div>
                  <div>🔐 JWT Auth + Email OTP</div>
                  <div>📡 Server-Sent Events</div>
                  <div>🗄 SQLite → PostgreSQL</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthWrapper>
      {({ user, onLogout }) => <Dashboard user={user} onLogout={onLogout} />}
    </AuthWrapper>
  );
}
