def test_project_and_yjs_sync(client, auth_headers):
    # Create workspace
    res_ws = client.post("/api/workspaces", json={"name": "Dev Space"}, headers=auth_headers)
    ws_id = res_ws.get_json()["data"]["workspace"]["id"]

    # Create coding project
    res_proj = client.post(f"/api/workspaces/{ws_id}/projects", json={
        "name": "Backend Service",
        "description": "Python API"
    }, headers=auth_headers)
    assert res_proj.status_code == 201
    proj_id = res_proj.get_json()["data"]["project"]["id"]

    # Create a project file
    res_file = client.post(f"/api/workspaces/{ws_id}/projects/{proj_id}/files", json={
        "path": "server.py",
        "content": "print('initial server code')"
    }, headers=auth_headers)
    assert res_file.status_code == 201
    file_id = res_file.get_json()["data"]["file"]["id"]

    # Verify Yjs state endpoint
    res_yjs = client.get(f"/api/workspaces/{ws_id}/projects/{proj_id}/files/{file_id}/yjs-state", headers=auth_headers)
    assert res_yjs.status_code == 200

    # Save updated Yjs CRDT state & plaintext
    res_save = client.post(f"/api/workspaces/{ws_id}/projects/{proj_id}/files/{file_id}/yjs-state", json={
        "yjs_state": "dGVzdC15anMtdXBkYXRl",
        "plaintext_content": "print('updated collaborative server code')"
    }, headers=auth_headers)
    assert res_save.status_code == 200

    # Verify updated content is persisted
    res_check = client.get(f"/api/workspaces/{ws_id}/projects/{proj_id}/files/{file_id}", headers=auth_headers)
    assert res_check.status_code == 200
    assert "updated collaborative" in res_check.get_json()["data"]["file"]["content"]
