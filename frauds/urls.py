from django.urls import path
from . import views

urlpatterns = [
    path("predict/",                    views.predict,            name="predict"),
    path("transactions/",               views.transaction_list,   name="transaction-list"),
    path("transactions/<str:txn_id>/",  views.transaction_detail, name="transaction-detail"),
    path("stats/",                      views.stats,              name="stats"),
    path("stream/",                     views.sse_stream,         name="sse-stream"),
    path("auth/send-otp/",              views.send_otp,           name="send-otp"),
    path("auth/verify-otp/",            views.verify_otp,         name="verify-otp"),
    path("upload-csv/",                 views.upload_csv,         name="upload-csv"),
    # [ADDED] Download fraud transactions as CSV for the authenticated user
    path("download-csv/",               views.download_csv,       name="download-csv"),
]