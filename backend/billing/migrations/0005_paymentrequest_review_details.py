from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0004_merge_0002_paymentrequest_review_details_0003_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="paymentrequest",
            name="reference",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.RemoveConstraint(
            model_name="paymentrequest",
            name="unique_payment_transfer_reference",
        ),
        migrations.AddConstraint(
            model_name="paymentrequest",
            constraint=models.UniqueConstraint(
                condition=~Q(reference=""),
                fields=("method", "reference"),
                name="unique_payment_transfer_reference",
            ),
        ),
    ]
