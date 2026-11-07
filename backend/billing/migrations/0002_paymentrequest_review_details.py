import billing.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentrequest",
            name="sender_name",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="paymentrequest",
            name="sender_phone",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="paymentrequest",
            name="transfer_app",
            field=models.CharField(
                blank=True,
                choices=[
                    ("sadapay", "SadaPay"),
                    ("easypaisa", "EasyPaisa"),
                    ("jazzcash", "JazzCash"),
                    ("bank", "Bank transfer"),
                    ("other", "Other"),
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="paymentrequest",
            name="receipt",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to=billing.models.payment_receipt_upload_path,
            ),
        ),
    ]
