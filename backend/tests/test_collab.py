def test_project_and_yjs_sync(client, auth_headers, create_workspace):
    # Create workspace
    res_ws = create_workspace("Dev Space")
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

def test_unauthorized_project_access(client, auth_headers, second_auth_headers, create_workspace):
    # User 1 creates workspace and project
    res_ws = create_workspace("Proprietary Core")
    ws_id = res_ws.get_json()["data"]["workspace"]["id"]

    res_proj = client.post(f"/api/workspaces/{ws_id}/projects", json={
        "name": "Secret Project",
        "description": "Internal algorithms"
    }, headers=auth_headers)
    assert res_proj.status_code == 201
    proj_id = res_proj.get_json()["data"]["project"]["id"]

    # User 2 (not a member of the workspace or project) tries to access project -> 403
    res_unauth = client.get(f"/api/workspaces/{ws_id}/projects/{proj_id}", headers=second_auth_headers)
    assert res_unauth.status_code == 403

    # User 2 tries to fetch project files -> 403
    res_unauth_files = client.get(f"/api/workspaces/{ws_id}/projects/{proj_id}/files", headers=second_auth_headers)
    assert res_unauth_files.status_code == 403
