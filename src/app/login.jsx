"use client";
import { useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // "email" | "otp"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSendOTP() {
    if (!email) return setError("Email daalo");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSuccess(`OTP bhej diya ${email} pe!`);
      setStep("otp");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!otp) return setError("OTP daalo");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      // Save token
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("user_email", data.email);
      setSuccess("Login successful! 🎉");
      setTimeout(() => onLoginSuccess(data), 1000);
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
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Mono', monospace",
    },
    card: {
      background: "linear-gradient(135deg,#0d1526,#0a1020)",
      border: "1px solid rgba(0,255,160,.2)",
      borderRadius: 20,
      padding: "40px 36px",
      width: 380,
      boxShadow: "0 0 40px rgba(0,255,160,.08)",
    },
    logo: {
      fontSize: 32,
      textAlign: "center",
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      textAlign: "center",
      background: "linear-gradient(90deg,#00ffa0,#00b4ff)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 11,
      color: "#475569",
      textAlign: "center",
      marginBottom: 32,
      letterSpacing: "0.08em",
    },
    label: {
      fontSize: 10,
      color: "#64748b",
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      marginBottom: 6,
      display: "block",
    },
    input: {
      width: "100%",
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: 10,
      padding: "12px 16px",
      color: "#e2e8f0",
      fontSize: 14,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box",
      marginBottom: 16,
    },
    btn: {
      width: "100%",
      background: "linear-gradient(135deg,#00ffa0,#00b4ff)",
      border: "none",
      borderRadius: 10,
      padding: "13px",
      color: "#060810",
      fontSize: 13,
      fontWeight: 700,
      fontFamily: "inherit",
      cursor: "pointer",
      letterSpacing: "0.08em",
      marginTop: 4,
    },
    error: {
      background: "rgba(255,50,80,.1)",
      border: "1px solid rgba(255,50,80,.3)",
      borderRadius: 8,
      padding: "10px 14px",
      color: "#ff3250",
      fontSize: 12,
      marginBottom: 16,
    },
    success: {
      background: "rgba(0,255,160,.08)",
      border: "1px solid rgba(0,255,160,.25)",
      borderRadius: 8,
      padding: "10px 14px",
      color: "#00ffa0",
      fontSize: 12,
      marginBottom: 16,
    },
    back: {
      background: "none",
      border: "none",
      color: "#475569",
      fontSize: 11,
      cursor: "pointer",
      marginTop: 16,
      display: "block",
      textAlign: "center",
      fontFamily: "inherit",
    },
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>🛡</div>
        <div style={S.title}>UPI FRAUD SENTINEL</div>
        <div style={S.subtitle}>
          {step === "email" ? "Enter you mail" : `OTP BHEJA: ${email}`}
        </div>

        {error && <div style={S.error}>⚠ {error}</div>}
        {success && <div style={S.success}>✓ {success}</div>}

        {step === "email" ? (
          <>
            <label style={S.label}>Email Address</label>
            <input
              style={S.input}
              type="email"
              placeholder="yourmail@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
            />
            <button style={S.btn} onClick={handleSendOTP} disabled={loading}>
              {loading ? "sending otp..." : "SEND OTP →"}
            </button>
          </>
        ) : (
          <>
            <label style={S.label}>6-Digit OTP</label>
            <input
              style={{ ...S.input, fontSize: 24, letterSpacing: "0.3em", textAlign: "center" }}
              type="text"
              placeholder="······"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOTP()}
              autoFocus
            />
            <button style={S.btn} onClick={handleVerifyOTP} disabled={loading}>
              {loading ? "Verifying..." : "VERIFY & LOGIN →"}
            </button>
            <button style={S.back} onClick={() => { setStep("email"); setError(""); setSuccess(""); }}>
              ← Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}