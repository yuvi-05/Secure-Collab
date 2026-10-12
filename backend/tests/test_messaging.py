import io

def test_messaging_and_reactions(client, auth_headers):
    # 1. Create workspace
    res_ws = client.post("/api/workspaces", json={"name": "Chat Space"}, headers=auth_headers)
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

def test_file_upload_and_download(client, auth_headers):
    # Create workspace
    res_ws = client.post("/api/workspaces", json={"name": "File Space"}, headers=auth_headers)
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
