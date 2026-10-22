def test_empty_message_rejected(self):
    response = self.client.post(
        "/api/messages/conversations/1/messages/",
        {
            "content": ""
        },
        format="json",
    )

    self.assertEqual(
        response.status_code,
        400,
    )

def test_send_message(self):
    response = self.client.post(
        f"/api/messages/conversations/{self.conversation.id}/messages/",
        {
            "content": "Hello Bob!",
        },
        format="json",
    )

    self.assertEqual(
        response.status_code,
        201,
    )