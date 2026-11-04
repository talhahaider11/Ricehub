from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404

from rest_framework import generics, serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from config.permissions import IsActiveAndNotSuspended as IsAuthenticated
from rest_framework.response import Response

from config.throttling import MediaUploadRateThrottle
from .models import MediaAsset
from .serializers import MediaAssetSerializer, MediaUploadSerializer
from .services import MediaQueueUnavailable, delete_unattached_media, upload_media


class MediaUploadView(generics.GenericAPIView):
    serializer_class = MediaUploadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [MediaUploadRateThrottle]

    def post(self, request, *args, **kwargs):
        upload_serializer = self.get_serializer(data=request.data)
        upload_serializer.is_valid(raise_exception=True)
        try:
            asset = upload_media(
                request.user,
                upload_serializer.validated_data["file"],
                upload_serializer.validated_data["media_type"],
            )
        except DjangoValidationError as error:
            detail = error.message_dict if hasattr(error, "message_dict") else error.messages
            raise serializers.ValidationError(detail) from error
        except MediaQueueUnavailable as error:
            return Response(
                {"detail": str(error)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        output = MediaAssetSerializer(asset, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)


class MediaAssetDeleteView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        asset = get_object_or_404(MediaAsset, pk=pk, owner=request.user)
        serializer = MediaAssetSerializer(
            asset,
            context={"request": request},
        )
        return Response(serializer.data)

    def delete(self, request, pk):
        asset = get_object_or_404(MediaAsset, pk=pk, owner=request.user)
        try:
            delete_unattached_media(asset)
        except DjangoValidationError as error:
            detail = error.message_dict if hasattr(error, "message_dict") else error.messages
            raise serializers.ValidationError(detail) from error
        return Response(status=status.HTTP_204_NO_CONTENT)
