"""
fraud/views.py
"""

import csv
import json
import time
import random
import threading
from datetime import datetime

import pandas as pd

from django.db.models import Count, Sum, Q
from django.http import StreamingHttpResponse, HttpResponseForbidden, HttpResponse
from django.views.decorators.http import require_GET
from django.core.mail import send_mail
from django.contrib.auth.models import User

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from rest_framework_simplejwt.tokens import AccessToken, RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import Transaction, OTPVerification
from .serializers import PredictRequestSerializer, TransactionSerializer
from .ml_model import detector
from django.http import HttpResponse

def home(request):
    return HttpResponse("🚀 UPI Fraud Detection API is Running!")

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Kolkata"]
BANKS  = ["okicici", "ybl", "okhdfc", "okaxis", "paytm", "oksbi"]

def rand_upi(prefix="user"):
    return f"{prefix}{random.randint(10000,99999)}@{random.choice(BANKS)}"

def get_status(risk_score):
    if risk_score >= 0.75:
        return "fraud"
    elif risk_score >= 0.50:
        return "suspicious"
    else:
        return "safe"


# ── Predict ────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def predict(request):
    ser = PredictRequestSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    data = ser.validated_data
    now = datetime.now()

    features = {
        "amount":            float(data["amount"]),
        "hour":              int(data.get("hour", now.hour)),
        "city":              data["city"],
        "is_new_device":     int(data["is_new_device"]),
        "txn_count_1h":      data["txn_count_1h"],
        "avg_amount_sender": data["avg_amount_sender"],
    }

    result = detector.predict(features)
    txn_status = get_status(result["risk_score"])

    txn = Transaction.objects.create(
        user=request.user,
        txn_id=data["txn_id"],
        sender_upi=data["sender_upi"],
        receiver_upi=data["receiver_upi"],
        sender_bank=data.get("sender_bank", ""),
        receiver_name=data.get("receiver_name", ""),
        amount=data["amount"],
        city=data["city"],
        device_id=data.get("device_id", ""),
        ip_address=data.get("ip_address"),
        risk_score=result["risk_score"],
        is_fraud=result["is_fraud"],
        status=txn_status,
        flags=result["flags"],
    )

    return Response({
        "txn_id":     txn.txn_id,
        "is_fraud":   txn.is_fraud,
        "risk_score": txn.risk_score,
        "flags":      txn.flags,
        "status":     txn.status,
        "timestamp":  txn.timestamp,
    }, status=status.HTTP_201_CREATED)


# ── CSV Upload ─────────────────────────────────────────────────────────────

def process_in_background(df, user_id, fraud_col):
    """7000 rows background mein process karo"""
    try:
        user = User.objects.get(id=user_id)
        processed = 0
        errors = 0

        for i, row in df.iterrows():
            try:
                is_fraud_hint = int(row[fraud_col]) == 1 if fraud_col else False
                amount = max(float(row.get("amount", 1000)), 1.0)

                if is_fraud_hint:
                    city          = "Unknown"
                    is_new_dev    = True
                    txn_count     = random.randint(8, 25)
                    avg_amt       = random.uniform(100, 400)
                    hour          = random.choice([0, 1, 2, 3, 23])
                    amount_scaled = round(amount * 80, 2)
                else:
                    raw_city = str(row.get("Transaction_City", "")).strip()
                    city = raw_city if raw_city in CITIES else random.choice(CITIES)
                    is_new_dev    = False
                    txn_count     = int(row.get("Transaction_Frequency", random.randint(1, 3)))
                    avg_amt       = random.uniform(3000, 10000)
                    hour          = random.randint(9, 21)
                    amount_scaled = round(amount, 2)

                features = {
                    "amount":            amount_scaled,
                    "hour":              hour,
                    "city":              city,
                    "is_new_device":     int(is_new_dev),
                    "txn_count_1h":      txn_count,
                    "avg_amount_sender": avg_amt,
                }

                result = detector.predict(features)
                txn_status = get_status(result["risk_score"])

                raw_txn_id = str(row.get("Transaction_ID", "")).strip()
                txn_id = f"{raw_txn_id}_{user_id}" if raw_txn_id and raw_txn_id != "nan" else f"CSV{user_id}R{i:06d}"

                if Transaction.objects.filter(txn_id=txn_id).exists():
                    txn_id = f"{txn_id}_{random.randint(100,999)}"

                raw_ip = str(row.get("IP_Address", "")).strip()
                ip = raw_ip if raw_ip and raw_ip != "nan" else None

                Transaction.objects.create(
                    user=user,
                    txn_id=txn_id,
                    sender_upi=rand_upi("sender"),
                    receiver_upi=rand_upi("receiver"),
                    amount=amount_scaled,
                    city=city,
                    ip_address=ip,
                    risk_score=result["risk_score"],
                    is_fraud=result["is_fraud"],
                    status=txn_status,
                    flags=result["flags"],
                )
                processed += 1

                # Har 500 rows pe log karo
                if processed % 500 == 0:
                    print(f"[CSV] User {user_id}: {processed} rows processed...")

            except Exception as e:
                errors += 1

        print(f"✅ [CSV] Done! User {user_id}: {processed} processed, {errors} errors")

    except Exception as e:
        print(f"❌ [CSV] Background error: {e}")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_csv(request):
    file = request.FILES.get("file")
    if not file:
        return Response({"error": "CSV file required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        df = pd.read_csv(file)
    except Exception as e:
        return Response({"error": f"Invalid CSV: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

    # ✅ STEP 1: Normalize column names (SUPER IMPORTANT)
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_")
        .str.replace("(", "")
        .str.replace(")", "")
    )

    # ✅ STEP 2: AUTO DETECT amount column
    import re
    amount_col = next(
        (col for col in df.columns if re.search(r"amount|amt|price|value", col)),
        None
    )

    if not amount_col:
        return Response({"error": "No amount-like column found in CSV"}, status=400)

    # ✅ Rename to standard
    df.rename(columns={amount_col: "amount"}, inplace=True)

    # ✅ STEP 3: AUTO DETECT fraud column
    fraud_col = next(
        (col for col in df.columns if re.search(r"fraud|class|label|is_fraud", col)),
        None
    )

    # ✅ Shuffle fraud/safe if exists
    if fraud_col:
        fraud_df = df[df[fraud_col] == 1]
        safe_df  = df[df[fraud_col] == 0]

        if not fraud_df.empty and not safe_df.empty:
            df = pd.concat([fraud_df, safe_df]).sample(frac=1, random_state=42).reset_index(drop=True)

    total_rows = len(df)

    # ✅ Background processing
    thread = threading.Thread(
        target=process_in_background,
        args=(df.copy(), request.user.id, fraud_col),
        daemon=True
    )
    thread.start()

    return Response({
        "message": f"✅ Processing started! {total_rows} rows background mein process ho rahe hain.",
        "total": total_rows,
        "status": "processing",
        "note": "Dashboard pe jaao aur Refresh karte raho — data aata dikhega!",
    }, status=status.HTTP_202_ACCEPTED)

# ── Transaction list / detail ──────────────────────────────────────────────

class TxnPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transaction_list(request):
    qs = Transaction.objects.filter(user=request.user)
    if request.query_params.get("fraud_only") == "true":
        qs = qs.filter(status="fraud")

    paginator = TxnPagination()
    page = paginator.paginate_queryset(qs, request)
    ser = TransactionSerializer(page, many=True)
    return paginator.get_paginated_response(ser.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def transaction_detail(request, txn_id):
    try:
        txn = Transaction.objects.get(txn_id=txn_id, user=request.user)
    except Transaction.DoesNotExist:
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response(TransactionSerializer(txn).data)


# ── Dashboard stats ────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def stats(request):
    qs = Transaction.objects.filter(user=request.user)
    agg = qs.aggregate(
        total=Count("id"),
        fraud_count=Count("id", filter=Q(status="fraud")),
        suspicious_count=Count("id", filter=Q(status="suspicious")),
        safe_count=Count("id", filter=Q(status="safe")),
        total_fraud_amount=Sum("amount", filter=Q(status="fraud")),
    )
    total = agg["total"] or 0
    fraud_count = agg["fraud_count"] or 0
    return Response({
        "total":              total,
        "fraud_count":        fraud_count,
        "suspicious_count":   agg["suspicious_count"] or 0,
        "safe_count":         agg["safe_count"] or 0,
        "fraud_rate":         round((fraud_count / total * 100), 2) if total else 0,
        "total_fraud_amount": agg["total_fraud_amount"] or 0,
    })


# ── SSE Stream ─────────────────────────────────────────────────────────────

@require_GET
def sse_stream(request):
    token_str = request.GET.get("token")
    if not token_str:
        return HttpResponseForbidden("Token required")
    try:
        validated = AccessToken(token_str)
        user_id = validated["user_id"]
    except TokenError:
        return HttpResponseForbidden("Invalid or expired token")

    last_id = [0]

    def event_generator():
        yield "retry: 3000\n\n"
        while True:
            new_txns = Transaction.objects.filter(
                id__gt=last_id[0],
                status__in=["fraud", "suspicious"],
                user_id=user_id
            ).order_by("id")[:10]

            for txn in new_txns:
                last_id[0] = txn.id
                payload = {
                    "id":         txn.txn_id,
                    "timestamp":  txn.timestamp.isoformat(),
                    "amount":     str(txn.amount),
                    "sender":     txn.sender_upi,
                    "receiver":   txn.receiver_upi,
                    "city":       txn.city,
                    "risk_score": txn.risk_score,
                    "is_fraud":   txn.is_fraud,
                    "flags":      txn.flags,
                    "status":     txn.status,
                }
                yield f"data: {json.dumps(payload)}\n\n"

            time.sleep(2)

    response = StreamingHttpResponse(event_generator(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


# ── CSV Download ───────────────────────────────────────────────────────────
# [ADDED] Download all fraud transactions for the logged-in user as a CSV file.
# The file is named fraud_transactions_<user_id>.csv and streamed as an attachment.
# Authentication is enforced — users can only download their own data.

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_csv(request):
    """
    Returns a downloadable CSV of the authenticated user's fraud transactions.
    Filename: fraud_transactions_<user_id>.csv
    Fields: transaction_id, amount, sender, receiver, fraud_status, date
    """
    user = request.user

    # [ADDED] Fetch only fraud transactions belonging to this user
    qs = Transaction.objects.filter(
        user=user,
        status="fraud"
    ).order_by("-timestamp").values(
        "txn_id", "amount", "sender_upi", "receiver_upi", "status", "timestamp"
    )

    # [ADDED] Build the HTTP response with CSV content-type
    filename = f"fraud_transactions_{user.id}.csv"
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    # [ADDED] Write header row matching requested fields
    writer.writerow(["transaction_id", "amount", "sender", "receiver", "fraud_status", "date"])

    # [ADDED] Write one row per fraud transaction
    for txn in qs:
        writer.writerow([
            txn["txn_id"],
            txn["amount"],
            txn["sender_upi"],
            txn["receiver_upi"],
            txn["status"],
            txn["timestamp"].strftime("%Y-%m-%d %H:%M:%S"),
        ])

    return response


# ── Email OTP Login ────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([])
def send_otp(request):
    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response({"error": "Email required"}, status=status.HTTP_400_BAD_REQUEST)

    otp = OTPVerification.generate_otp()
    OTPVerification.objects.create(email=email, otp=otp)

    try:
        send_mail(
            subject="Your OTP - UPI Fraud Sentinel",
            message=f"Hi,\n\nYour OTP is: {otp}\n\nValid for 5 minutes. Do not share.\n\n— UPI Fraud Sentinel",
            from_email=None,
            recipient_list=[email],
            fail_silently=False,
        )
    except Exception as e:
        return Response({"error": f"Email send failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({"message": "OTP sent successfully"}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([])
def verify_otp(request):
    email = request.data.get("email", "").strip().lower()
    otp   = request.data.get("otp", "").strip()

    if not email or not otp:
        return Response({"error": "Email and OTP required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        record = OTPVerification.objects.filter(email=email, is_used=False).latest("created_at")
    except OTPVerification.DoesNotExist:
        return Response({"error": "OTP not found."}, status=status.HTTP_400_BAD_REQUEST)

    if not record.is_valid():
        return Response({"error": "OTP expired."}, status=status.HTTP_400_BAD_REQUEST)

    if record.otp != otp:
        return Response({"error": "Invalid OTP."}, status=status.HTTP_400_BAD_REQUEST)

    record.is_used = True
    record.save()

    user, created = User.objects.get_or_create(username=email, defaults={"email": email})
    refresh = RefreshToken.for_user(user)

    return Response({
        "message":     "Login successful",
        "email":       email,
        "access":      str(refresh.access_token),
        "refresh":     str(refresh),
        "is_new_user": created,
    }, status=status.HTTP_200_OK)