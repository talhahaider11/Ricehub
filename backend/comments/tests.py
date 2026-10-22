def test_create_comment(self):
    response = self.client.post(
        f"/api/posts/{self.post.id}/comments/",
        {
            "content": "Great post!",
        },
        format="json",
    )
    self.assertEqual(
        response.status_code,
        201,
    )