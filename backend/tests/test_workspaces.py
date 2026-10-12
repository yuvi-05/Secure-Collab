def test_create_workspace(client, auth_headers):
    res = client.post("/api/workspaces", json={
        "name": "Acme Corp",
        "description": "Building cool things"
    }, headers=auth_headers)
    assert res.status_code == 201
    data = res.get_json()["data"]["workspace"]
    assert data["name"] == "Acme Corp"
    assert data["my_role"] == "owner"

def test_workspace_membership_check(client, auth_headers, second_auth_headers):
    # User 1 creates workspace
    res = client.post("/api/workspaces", json={"name": "Private Team"}, headers=auth_headers)
    ws_id = res.get_json()["data"]["workspace"]["id"]

    # User 2 tries to access without membership -> should return 403
    res2 = client.get(f"/api/workspaces/{ws_id}", headers=second_auth_headers)
    assert res2.status_code == 403

def test_private_channel_permissions(client, auth_headers, second_auth_headers, second_user):
    # User 1 creates workspace
    res = client.post("/api/workspaces", json={"name": "Secure HQ"}, headers=auth_headers)
    ws_id = res.get_json()["data"]["workspace"]["id"]

    # User 1 adds User 2 as a normal member
    res_add = client.post(f"/api/workspaces/{ws_id}/members", json={
        "user_id": second_user,
        "role": "member"
    }, headers=auth_headers)
    assert res_add.status_code == 201

    # User 1 creates a private channel
    res_priv = client.post(f"/api/workspaces/{ws_id}/channels", json={
        "name": "exec-only",
        "is_private": True
    }, headers=auth_headers)
    assert res_priv.status_code == 201
    ch_id = res_priv.get_json()["data"]["channel"]["id"]

    # User 2 (member of workspace but NOT in private channel) attempts to read private channel -> 403
    res_unauth = client.get(f"/api/workspaces/{ws_id}/channels/{ch_id}", headers=second_auth_headers)
    assert res_unauth.status_code == 403

    # User 1 adds User 2 to the private channel
    res_join = client.post(f"/api/workspaces/{ws_id}/channels/{ch_id}/members", json={
        "user_id": second_user
    }, headers=auth_headers)
    assert res_join.status_code == 201

    # User 2 can now access private channel -> 200
    res_auth = client.get(f"/api/workspaces/{ws_id}/channels/{ch_id}", headers=second_auth_headers)
    assert res_auth.status_code == 200
