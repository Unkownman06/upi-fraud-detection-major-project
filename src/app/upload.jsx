"use client";
import { useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

export default function UploadPage({ user, onBack }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleUpload() {
    if (!file) return setError("Pehle CSV file select karo");
    setLoading(true);
    setError("");
    setResult(null);

    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/upload-csv/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const S = {
    page: {
      minHeight: "100vh",
      background: "#060810",
      fontFamily: "'DM Mono', monospace",
      color: "#e2e8f0",
      padding: "32px",
    },
    header: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 32,
    },
    title: {
      fontSize: 20, fontWeight: 700,
      background: "linear-gradient(90deg,#00ffa0,#00b4ff)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    },
    backBtn: {
      background: "rgba(0,180,255,.1)", border: "1px solid rgba(0,180,255,.3)",
      color: "#00b4ff", borderRadius: 8, padding: "6px 16px",
      cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 700,
    },
    uploadBox: {
      border: `2px dashed ${dragOver ? "rgba(0,255,160,.6)" : "rgba(0,255,160,.2)"}`,
      borderRadius: 16, padding: "48px 32px", textAlign: "center",
      background: dragOver ? "rgba(0,255,160,.04)" : "rgba(13,21,38,.8)",
      cursor: "pointer", transition: "all .2s ease", marginBottom: 20,
    },
    uploadIcon: { fontSize: 48, marginBottom: 12 },
    uploadText: { fontSize: 14, color: "#94a3b8", marginBottom: 8 },
    uploadSub: { fontSize: 11, color: "#334155" },
    fileName: {
      background: "rgba(0,255,160,.08)", border: "1px solid rgba(0,255,160,.2)",
      borderRadius: 8, padding: "10px 16px", fontSize: 12, color: "#00ffa0",
      marginBottom: 16, textAlign: "center",
    },
    uploadBtn: {
      width: "100%", background: "linear-gradient(135deg,#00ffa0,#00b4ff)",
      border: "none", borderRadius: 10, padding: "14px",
      color: "#060810", fontSize: 13, fontWeight: 700,
      fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.08em",
    },
    error: {
      background: "rgba(255,50,80,.1)", border: "1px solid rgba(255,50,80,.3)",
      borderRadius: 8, padding: "10px 16px", color: "#ff3250",
      fontSize: 12, marginBottom: 16,
    },
  };

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>📂 CSV Upload & Detection</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>👤 {user.email}</div>
        </div>
        <button style={S.backBtn} onClick={onBack}>← Go to dashboard</button>
      </div>

      {/* Upload Box */}
      <div
        style={S.uploadBox}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f && f.name.endsWith(".csv")) setFile(f);
          else setError("Sirf CSV file allowed hai");
        }}
        onClick={() => document.getElementById("csvInput").click()}
      >
        <input
          id="csvInput" type="file" accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => setFile(e.target.files[0])}
        />
        <div style={S.uploadIcon}>📊</div>
        <div style={S.uploadText}>Drag and drop the CSV file or select by clicking here </div>
        <div style={S.uploadSub}>
          UPI Dataset ya Kaggle creditcard.csv · fraud/Class + amount columns
        </div>
      </div>

      {file && (
        <div style={S.fileName}>
          ✓ {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </div>
      )}
      {error && <div style={S.error}>⚠ {error}</div>}

      <button style={S.uploadBtn} onClick={handleUpload} disabled={loading}>
        {loading ? "⏳ Uploading..." : "🚀 UPLOAD & DETECT FRAUD"}
      </button>

      {/* ✅ Result — background processing message */}
      {result && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#00ffa0", marginBottom: 16 }}>
            🚀 {result.message}
          </div>

          <div style={{ background: "rgba(0,180,255,.08)", border: "1px solid rgba(0,180,255,.2)", borderRadius: 12, padding: 24, lineHeight: 2 }}>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              📊 Total rows: <span style={{ color: "#00b4ff", fontWeight: 700 }}>{result.total}</span>
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              ⏳ Status: <span style={{ color: "#f59e0b", fontWeight: 700 }}>processing in background ...</span>
            </div>
            <div style={{ marginTop: 16, padding: 16, background: "rgba(0,255,160,.05)", border: "1px solid rgba(0,255,160,.1)", borderRadius: 10, fontSize: 12, color: "#475569" }}>
              👉 Ab <strong style={{ color: "#00ffa0" }}>← Dashboard pe jao</strong> aur <strong style={{ color: "#00ffa0" }}>↻ REFRESH</strong> karte raho
              <br />
              After some time 🚨, suspicious ⚡ aur safe ✓ transactions will be shown
              <br />
              <span style={{ color: "#334155", fontSize: 11 }}>7000 rows = approx 3-5 minutes</span>
            </div>
          </div>

          <button
            onClick={onBack}
            style={{ marginTop: 20, width: "100%", background: "rgba(0,255,160,.1)", border: "1px solid rgba(0,255,160,.2)", color: "#00ffa0", borderRadius: 10, padding: "12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 700 }}
          >
            ← go to dashboard and refresh
          </button>
        </div>
      )}
    </div>
  );
}