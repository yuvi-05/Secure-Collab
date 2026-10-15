import io
from datetime import datetime

def test_messaging_and_reactions(client, auth_headers, create_workspace):
    # 1. Create workspace
    res_ws = create_workspace("Chat Space")
    ws_id = res_ws.get_json()["data"]["workspace"]["id"]

    # 2. Get general channel
    res_ws_detail = client.get(f"/api/workspaces/{ws_id}", headers=auth_headers)
    ch_id = res_ws_detail.get_json()["data"]["workspace"]["channels"][0]["id"]

    # 3. Post a message
    res_msg = client.post(f"/api/workspaces/{ws_id}/messages", json={
        "channel_id": ch_id,
        "content": "Hello team from test!"
    }, headers=auth_headers)
    assert res_msg.status_code == 201
    msg = res_msg.get_json()["data"]["message"]
    msg_id = msg["id"]
    assert msg["content"] == "Hello team from test!"
    expiry = datetime.fromisoformat(msg["expires_at"].replace("Z", ""))
    remaining_seconds = (expiry - datetime.utcnow()).total_seconds()
    assert 31535800 < remaining_seconds <= 31536000

    # 4. Toggle reaction
    res_rxn = client.post(f"/api/workspaces/{ws_id}/messages/{msg_id}/reactions", json={
        "emoji": "🚀"
    }, headers=auth_headers)
    assert res_rxn.status_code == 200
    assert res_rxn.get_json()["data"]["action"] == "added"

    # 5. Post thread reply
    res_reply = client.post(f"/api/workspaces/{ws_id}/messages", json={
        "parent_id": msg_id,
        "content": "This is a threaded reply."
    }, headers=auth_headers)
    assert res_reply.status_code == 201

    # 6. Retrieve thread messages
    res_thread = client.get(f"/api/workspaces/{ws_id}/messages?parent_id={msg_id}", headers=auth_headers)
    assert res_thread.status_code == 200
    assert len(res_thread.get_json()["data"]["messages"]) == 1

def test_file_upload_and_download(client, auth_headers, create_workspace):
    # Create workspace
    res_ws = create_workspace("File Space")
    ws_id = res_ws.get_json()["data"]["workspace"]["id"]

    # Upload test file
    data = {
        "file": (io.BytesIO(b"Hello from test file attachment"), "test_document.txt")
    }
    res_upload = client.post(
        f"/api/workspaces/{ws_id}/files/upload",
        data=data,
        content_type="multipart/form-data",
        headers=auth_headers
    )
    assert res_upload.status_code == 201
    file_id = res_upload.get_json()["data"]["file"]["id"]

    # Download test file
    res_dl = client.get(f"/api/workspaces/{ws_id}/files/{file_id}/download", headers=auth_headers)
    assert res_dl.status_code == 200
    assert res_dl.data == b"Hello from test file attachment"


def test_direct_message_delete_for_everyone_is_limited_to_author(
    client,
    auth_headers,
    second_auth_headers,
    second_user,
    create_workspace,
):
    workspace = create_workspace("Direct Message Delete Space")
    workspace_id = workspace.get_json()["data"]["workspace"]["id"]

    add_member = client.post(
        f"/api/workspaces/{workspace_id}/members",
        json={"user_id": second_user, "role": "team_member"},
        headers=auth_headers,
    )
    assert add_member.status_code == 201

    conversation = client.post(
        f"/api/workspaces/{workspace_id}/conversations",
        json={"participant_ids": [second_user]},
        headers=auth_headers,
    )
    assert conversation.status_code == 201
    conversation_id = conversation.get_json()["data"]["conversation"]["id"]

    message = client.post(
        f"/api/workspaces/{workspace_id}/messages",
        json={"conversation_id": conversation_id, "content": "Private message"},
        headers=auth_headers,
    )
    assert message.status_code == 201
    message_id = message.get_json()["data"]["message"]["id"]

    denied = client.delete(
        f"/api/workspaces/{workspace_id}/messages/{message_id}?delete_for_everyone=true",
        headers=second_auth_headers,
    )
    assert denied.status_code == 403

    deleted = client.delete(
        f"/api/workspaces/{workspace_id}/messages/{message_id}?delete_for_everyone=true",
        headers=auth_headers,
    )
    assert deleted.status_code == 200


def test_messages_expire_and_are_removed_from_storage(
    client, auth_headers, create_workspace
):
    client.application.config["CHAT_MESSAGE_TTL_SECONDS"] = 0
    workspace = create_workspace("Expiring Chat Space")
    workspace_id = workspace.get_json()["data"]["workspace"]["id"]
    workspace_detail = client.get(
        f"/api/workspaces/{workspace_id}", headers=auth_headers
    )
    channel_id = workspace_detail.get_json()["data"]["workspace"]["channels"][0]["id"]

    sent = client.post(
        f"/api/workspaces/{workspace_id}/messages",
        json={"channel_id": channel_id, "content": "This expires immediately"},
        headers=auth_headers,
    )
    assert sent.status_code == 201
    assert sent.get_json()["data"]["message"]["expires_at"]

    messages = client.get(
        f"/api/workspaces/{workspace_id}/messages?channel_id={channel_id}",
        headers=auth_headers,
    )
    assert messages.status_code == 200
    assert messages.get_json()["data"]["messages"] == []
