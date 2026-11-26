from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0006_remove_paymentrequest_sender_phone"),
    ]

    operations = [
        migrations.AlterField(
            model_name="paymentrequest",
            name="method",
            field=models.CharField(
                choices=[
                    ("qr_payment", "QR Payment (Talha Shop)"),
                    ("sadapay", "Legacy payment (not accepted)"),
                    ("card", "Legacy payment (not accepted)"),
                    ("easypaisa", "Legacy payment (not accepted)"),
                    ("jazzcash", "Legacy payment (not accepted)"),
                ],
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="paymentrequest",
            name="transfer_app",
            field=models.CharField(
                blank=True,
                choices=[
                    ("sadapay", "Legacy wallet"),
                    ("easypaisa", "EasyPaisa"),
                    ("jazzcash", "JazzCash"),
                    ("nayapay", "NayaPay"),
                    ("raast", "Raast"),
                    ("bank", "Bank transfer"),
                    ("other", "Other"),
                ],
                max_length=20,
            ),
        ),
    ]
