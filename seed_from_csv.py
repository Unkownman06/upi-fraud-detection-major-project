import requests, random, string, pandas as pd

TOKEN_URL   = "http://127.0.0.1:8000/api/auth/token/"
PREDICT_URL = "http://127.0.0.1:8000/api/predict/"

def get_token():
    return requests.post(TOKEN_URL, json={"username": "admin", "password": "Rupalshah12"}).json()["access"]

token = get_token()
headers = {"Authorization": f"Bearer {token}"}

BANKS = ["okicici", "ybl", "okhdfc", "okaxis", "paytm", "oksbi"]
CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune"]

def rand_upi(p):
    return f"{p}{''.join(random.choices(string.digits,k=5))}@{random.choice(BANKS)}"

df = pd.read_csv("creditcard.csv")
fraud_rows = df[df["Class"] == 1].head(150)
safe_rows  = df[df["Class"] == 0].head(250)
combined   = pd.concat([fraud_rows, safe_rows]).sample(frac=1, random_state=42).reset_index(drop=True)
print(f"Sending {len(combined)} transactions (150 fraud + 250 safe)...")

fraud_detected = safe_detected = failed = 0

for idx, row in combined.iterrows():
    is_fraud = int(row["Class"]) == 1
    amount   = max(float(row["Amount"]), 1.0)

    if is_fraud:
        payload = {
            "txn_id":            f"CSV{idx:06d}",
            "sender_upi":        rand_upi("suspect"),
            "receiver_upi":      rand_upi("mule"),
            "amount":            str(round(amount * 80, 2)),  # scale to ₹55k+ range
            "city":              "Unknown",                    # triggers city_risk=0.85
            "is_new_device":     True,                        # triggers NEW_DEVICE
            "txn_count_1h":      random.randint(8, 20),       # triggers RAPID_SUCCESSION
            "avg_amount_sender": round(random.uniform(100, 400), 2),
            "hour":              random.choice([0, 1, 2, 3, 23]),  # triggers ODD_HOUR
        }
    else:
        payload = {
            "txn_id":            f"CSV{idx:06d}",
            "sender_upi":        rand_upi("user"),
            "receiver_upi":      rand_upi("merchant"),
            "amount":            str(round(amount * 10, 2)),
            "city":              random.choice(CITIES),
            "is_new_device":     False,
            "txn_count_1h":      random.randint(1, 3),
            "avg_amount_sender": round(random.uniform(3000, 10000), 2),
            "hour":              random.randint(9, 21),
        }

    res = requests.post(PREDICT_URL, json=payload, headers=headers, timeout=5)
    if res.status_code == 201:
        data = res.json()
        label = "🚨 FRAUD" if data["is_fraud"] else "✓  SAFE"
        flags = ", ".join(data.get("flags", [])) or "—"
        print(f"[{idx+1:03}] CSV={'FRAUD' if is_fraud else 'SAFE '} | Model={label} | risk={data['risk_score']:.2f} | ₹{payload['amount']:>10} | {flags}")
        if data["is_fraud"]: fraud_detected += 1
        else: safe_detected += 1
    else:
        print(f"[{idx+1:03}] FAILED: {res.text[:80]}")
        failed += 1

    if (idx + 1) % 100 == 0:
        token = get_token()
        headers = {"Authorization": f"Bearer {token}"}
        print("🔑 Token refreshed")

print(f"\n✅ Done!")
print(f"🚨 Fraud detected: {fraud_detected}")
print(f"✓  Safe detected:  {safe_detected}")
print(f"❌ Failed:         {failed}")
print(f"\nRefresh your dashboard!")     