from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0005_paymentrequest_review_details"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="paymentrequest",
            name="sender_phone",
        ),
    ]
