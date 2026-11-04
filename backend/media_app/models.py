from django.conf import settings
from django.db import models


class MediaAsset(models.Model):
    class MediaType(models.TextChoices):
        IMAGE = "image", "Image"
        VIDEO = "video", "Video"

    class ProcessingStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready"
        FAILED = "failed", "Failed"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="media_assets",
    )
    media_type = models.CharField(max_length=20, choices=MediaType.choices)
    file = models.FileField(
        upload_to="media/originals/%Y/%m/",
        max_length=512,
    )
    thumbnail = models.ImageField(
        upload_to="media/thumbnails/%Y/%m/",
        blank=True,
        max_length=512,
    )
    compressed_file = models.FileField(
        upload_to="media/processed/%Y/%m/",
        blank=True,
        max_length=512,
    )
    original_filename = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=100, blank=True)
    file_size = models.PositiveBigIntegerField(default=0)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING,
    )
    processing_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "-created_at"]),
            models.Index(fields=["media_type", "processing_status"]),
        ]

    def __str__(self):
        return f"{self.owner.username} - {self.media_type} - {self.pk}"

    @property
    def playable_file(self):
        if self.processing_status == self.ProcessingStatus.READY and self.compressed_file:
            return self.compressed_file
        return self.file
