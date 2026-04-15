"""
fraud/ml_model.py
─────────────────
Random Forest fraud classifier.

• train_and_save()  — train on synthetic data and persist the model to disk.
                      Run once: `python manage.py shell -c "from fraud.ml_model import train_and_save; train_and_save()"`
• FraudDetector     — singleton loaded at Django startup; call .predict(features) for inference.
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

MODEL_PATH = os.path.join(os.path.dirname(__file__), "fraud_model.joblib")

# ── Feature engineering helpers ────────────────────────────────────────────

def extract_features(data: dict) -> np.ndarray:
    """
    Convert raw transaction dict into a numeric feature vector.

    Features (8 total):
        0  amount              — transaction amount in ₹
        1  hour                — hour of day (0-23)
        2  is_odd_hour         — 1 if hour < 5 or hour > 22
        3  amount_log          — log1p(amount) to handle skew
        4  is_new_device       — 1 if device_id not seen recently (passed in)
        5  txn_count_1h        — number of transactions by sender in last hour
        6  avg_amount_sender   — historical average transaction amount for sender
        7  city_risk           — pre-computed city risk score (0-1)
    """
    CITY_RISK = {
        "Mumbai": 0.2, "Delhi": 0.25, "Bangalore": 0.15,
        "Chennai": 0.18, "Hyderabad": 0.2, "Pune": 0.15,
        "Kolkata": 0.22, "Unknown": 0.85,
    }

    amount = float(data.get("amount", 0))
    hour = int(data.get("hour", 12))
    is_odd_hour = 1 if (hour < 5 or hour > 22) else 0
    amount_log = np.log1p(amount)
    is_new_device = int(data.get("is_new_device", 0))
    txn_count_1h = int(data.get("txn_count_1h", 1))
    avg_amount = float(data.get("avg_amount_sender", amount))
    city = data.get("city", "Unknown")
    city_risk = CITY_RISK.get(city, 0.4)

    return np.array([[amount, hour, is_odd_hour, amount_log,
                      is_new_device, txn_count_1h, avg_amount, city_risk]])


# ── Synthetic dataset for initial training ─────────────────────────────────

def _generate_training_data(n_samples: int = 10_000) -> pd.DataFrame:
    np.random.seed(42)
    n_fraud = int(n_samples * 0.15)
    n_safe = n_samples - n_fraud

    # Safe transactions
    safe = pd.DataFrame({
        "amount":          np.random.lognormal(7, 1.2, n_safe),       # ₹50 – ₹15k
        "hour":            np.random.randint(7, 22, n_safe),
        "is_odd_hour":     np.zeros(n_safe),
        "amount_log":      None,
        "is_new_device":   np.random.binomial(1, 0.05, n_safe),
        "txn_count_1h":    np.random.randint(1, 4, n_safe),
        "avg_amount":      np.random.lognormal(7, 0.8, n_safe),
        "city_risk":       np.random.choice([0.15, 0.18, 0.2, 0.22, 0.25], n_safe),
        "label":           0,
    })

    # Fraud transactions
    fraud = pd.DataFrame({
        "amount":          np.random.lognormal(10, 1.5, n_fraud),      # ₹10k – ₹500k
        "hour":            np.random.choice([0, 1, 2, 3, 23], n_fraud),
        "is_odd_hour":     np.ones(n_fraud),
        "amount_log":      None,
        "is_new_device":   np.random.binomial(1, 0.75, n_fraud),
        "txn_count_1h":    np.random.randint(4, 20, n_fraud),
        "avg_amount":      np.random.lognormal(6, 0.5, n_fraud),
        "city_risk":       np.random.choice([0.75, 0.85, 0.9], n_fraud),
        "label":           1,
    })

    df = pd.concat([safe, fraud], ignore_index=True).sample(frac=1, random_state=42)
    df["amount_log"] = np.log1p(df["amount"])
    return df


# ── Train & persist ────────────────────────────────────────────────────────

def train_and_save():
    print("Generating training data...")
    df = _generate_training_data()
    FEATURE_COLS = ["amount", "hour", "is_odd_hour", "amount_log",
                    "is_new_device", "txn_count_1h", "avg_amount", "city_risk"]
    X = df[FEATURE_COLS].values
    y = df["label"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("rf", RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_split=4,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )),
    ])

    print("Training Random Forest...")
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    print(classification_report(y_test, y_pred, target_names=["Safe", "Fraud"]))

    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model saved → {MODEL_PATH}")
    return pipeline


# ── Singleton detector ─────────────────────────────────────────────────────

class FraudDetector:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load()
        return cls._instance

    def _load(self):
        if os.path.exists(MODEL_PATH):
            self.model = joblib.load(MODEL_PATH)
            print("[FraudDetector] Model loaded from disk.")
        else:
            print("[FraudDetector] No saved model found — training now...")
            self.model = train_and_save()

    def predict(self, features: dict) -> dict:
        """
        Returns:
            {
                "is_fraud": bool,
                "risk_score": float,   # probability of fraud (0-1)
                "flags": list[str]
            }
        """
        X = extract_features(features)
        proba = self.model.predict_proba(X)[0]
        risk_score = float(proba[1])
        is_fraud = risk_score > 0.5

        flags = []
        if float(features.get("amount", 0)) > 50_000:
            flags.append("HIGH_AMOUNT")
        if features.get("is_new_device"):
            flags.append("NEW_DEVICE")
        if int(features.get("txn_count_1h", 0)) > 5:
            flags.append("RAPID_SUCCESSION")
        h = int(features.get("hour", 12))
        if h < 5 or h > 22:
            flags.append("ODD_HOUR")
        if features.get("city", "") == "Unknown":
            flags.append("UNUSUAL_LOCATION")

        return {"is_fraud": is_fraud, "risk_score": round(risk_score, 4), "flags": flags}


# Module-level singleton
detector = None

def get_detector():
    global detector
    if detector is None:
        detector = FraudDetector()
    return detector
