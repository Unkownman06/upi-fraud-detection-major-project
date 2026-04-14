import pandas as pd
import os
import django
import uuid
import random

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

# 🔥 IMPORTANT: change 'core' → your actual app name if needed
from frauds.models import Transaction  # <-- if error, we’ll fix

df = pd.read_csv("creditcard.csv")

df = df.head(200)  # limit for demo

cities = ["Mumbai", "Delhi", "Pune", "Bangalore"]

for i, row in df.iterrows():
    Transaction.objects.create(
        txn_id=str(uuid.uuid4()),

        sender_upi=f"user{i}@upi",
        receiver_upi=f"merchant{i}@upi",
        sender_bank="SBI",

        receiver_name=f"Merchant {i}",
        amount=row["Amount"],

        city=random.choice(cities),
        device_id=f"device_{i}",
        ip_address="127.0.0.1",

        # ML fields (from dataset)
        is_fraud=bool(row["Class"]),
        risk_score=0.9 if row["Class"] == 1 else 0.1,
        status="fraud" if row["Class"] == 1 else "safe",

        flags=["HIGH_AMOUNT"] if row["Amount"] > 50000 else []
    )

print("✅ Data inserted successfully")