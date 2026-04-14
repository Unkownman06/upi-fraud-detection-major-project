# test_model.py — replace karo
import sys
sys.path.insert(0, '.')

from frauds.ml_model import detector

# Fraud wali features
fraud_features = {
    "amount": 95000,
    "hour": 2,
    "city": "Unknown",
    "is_new_device": 1,
    "txn_count_1h": 15,
    "avg_amount_sender": 200,
}

# Safe wali features
safe_features = {
    "amount": 1500,
    "hour": 14,
    "city": "Mumbai",
    "is_new_device": 0,
    "txn_count_1h": 2,
    "avg_amount_sender": 5000,
}

fraud_result = detector.predict(fraud_features)
safe_result  = detector.predict(safe_features)

print(f"FRAUD features → risk={fraud_result['risk_score']} | is_fraud={fraud_result['is_fraud']} | flags={fraud_result['flags']}")
print(f"SAFE  features → risk={safe_result['risk_score']}  | is_fraud={safe_result['is_fraud']}  | flags={safe_result['flags']}")