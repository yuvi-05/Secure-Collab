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
