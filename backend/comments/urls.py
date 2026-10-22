from django.urls import path
from .views import (CommentDetailView,CommentListCreateView,ReplyListCreateView,)


urlpatterns = [
    path("posts/<int:post_id>/comments/",CommentListCreateView.as_view(),name="comment-list-create",),
    path("posts/<int:post_id>/comments/<int:comment_id>/replies/",ReplyListCreateView.as_view(),name="reply-list-create",),
    path("comments/<int:pk>/",CommentDetailView.as_view(),name="comment-detail",),
]