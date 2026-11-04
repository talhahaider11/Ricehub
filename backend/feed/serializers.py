from posts.serializers import PostSerializer


class FeedPostSerializer(PostSerializer):
    class Meta(PostSerializer.Meta):
        read_only_fields = tuple(PostSerializer.Meta.fields)
