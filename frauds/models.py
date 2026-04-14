from django.db import models
from django.contrib.auth.models import User
import random


class Transaction(models.Model):
    """Stores every UPI transaction that passes through the system."""

    STATUS_CHOICES = [
        ("safe", "Safe"),
        ("fraud", "Fraud"),
        ("suspicious", "Suspicious"),
        ("review", "Under Review"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name="transactions")

    txn_id = models.CharField(max_length=64, unique=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    sender_upi = models.CharField(max_length=128)
    receiver_upi = models.CharField(max_length=128)
    sender_bank = models.CharField(max_length=64, blank=True)
    receiver_name = models.CharField(max_length=128, blank=True)

    amount = models.DecimalField(max_digits=12, decimal_places=2)
    city = models.CharField(max_length=64, blank=True)
    device_id = models.CharField(max_length=128, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    risk_score = models.FloatField(default=0.0)
    is_fraud = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="safe")
    flags = models.JSONField(default=list)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.txn_id} | ₹{self.amount} | {self.status}"


class OTPVerification(models.Model):
    """Stores email OTP for login."""

    email = models.EmailField()
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def is_valid(self):
        from django.utils import timezone
        diff = timezone.now() - self.created_at
        return not self.is_used and diff.seconds < 300

    @staticmethod
    def generate_otp():
        return str(random.randint(100000, 999999))

    def __str__(self):
        return f"{self.email} | {self.otp} | used={self.is_used}"