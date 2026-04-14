from rest_framework import serializers
from .models import Transaction


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = "__all__"
        read_only_fields = ["id", "timestamp", "risk_score", "is_fraud", "status", "flags"]


class PredictRequestSerializer(serializers.Serializer):
    """Payload the frontend/UPI gateway sends to /api/predict/"""
    txn_id          = serializers.CharField(max_length=64)
    sender_upi      = serializers.CharField(max_length=128)
    receiver_upi    = serializers.CharField(max_length=128)
    sender_bank     = serializers.CharField(max_length=64, required=False, default="")
    receiver_name   = serializers.CharField(max_length=128, required=False, default="")
    amount          = serializers.DecimalField(max_digits=12, decimal_places=2)
    city            = serializers.CharField(max_length=64, required=False, default="Unknown")
    device_id       = serializers.CharField(max_length=128, required=False, default="")
    ip_address      = serializers.IPAddressField(required=False, allow_null=True, default=None)
    # Pre-computed context from UPI gateway
    is_new_device   = serializers.BooleanField(required=False, default=False)
    txn_count_1h    = serializers.IntegerField(required=False, default=1)
    avg_amount_sender = serializers.FloatField(required=False, default=0.0)


class PredictResponseSerializer(serializers.Serializer):
    txn_id      = serializers.CharField()
    is_fraud    = serializers.BooleanField()
    risk_score  = serializers.FloatField()
    flags       = serializers.ListField(child=serializers.CharField())
    status      = serializers.CharField()
    timestamp   = serializers.DateTimeField()


class DashboardStatsSerializer(serializers.Serializer):
    total           = serializers.IntegerField()
    fraud_count     = serializers.IntegerField()
    safe_count      = serializers.IntegerField()
    fraud_rate      = serializers.FloatField()
    total_fraud_amount = serializers.DecimalField(max_digits=16, decimal_places=2)
