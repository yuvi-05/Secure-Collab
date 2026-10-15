def test_super_admin_controls_workspace_creation_and_owner_transfer(
    client, auth_headers, super_admin_headers, test_user, second_user, second_auth_headers
):
    denied_create = client.post(
        "/api/workspaces",
        json={"name": "Owner cannot create", "owner_id": test_user},
        headers=auth_headers
    )
    assert denied_create.status_code == 403

    created = client.post(
        "/api/workspaces",
        json={"name": "Platform Workspace", "owner_id": test_user},
        headers=super_admin_headers
    )
    assert created.status_code == 201
    workspace_id = created.get_json()["data"]["workspace"]["id"]
    owner_transfer_denied = client.put(
        f"/api/workspaces/{workspace_id}/owner",
        json={"owner_id": second_user},
        headers=auth_headers
    )
    assert owner_transfer_denied.status_code == 403

    owner_candidates = client.get("/api/workspaces/admin/users", headers=super_admin_headers)
    assert {item["id"] for item in owner_candidates.get_json()["data"]["users"]} >= {
        test_user, second_user
    }

    transferred = client.put(
        f"/api/workspaces/{workspace_id}/owner",
        json={"owner_id": second_user},
        headers=super_admin_headers
    )
    assert transferred.status_code == 200
    assert transferred.get_json()["data"]["workspace"]["owner_id"] == second_user

    former_owner_members = client.get(
        f"/api/workspaces/{workspace_id}/members", headers=auth_headers
    )
    former_owner = next(
        item for item in former_owner_members.get_json()["data"]["members"]
        if item["user_id"] == test_user
    )
    assert former_owner["role"] == "team_member"

    denied_delete = client.delete(f"/api/workspaces/{workspace_id}", headers=second_auth_headers)
    assert denied_delete.status_code == 403
    deleted = client.delete(f"/api/workspaces/{workspace_id}", headers=super_admin_headers)
    assert deleted.status_code == 200


def test_super_admin_login_is_separate_and_credentials_are_not_regular_user_password(
    client, auth_headers
):
    regular_login = client.post("/api/auth/login", json={
        "login_id": "platform-admin@example.test",
        "password": "test-only-platform-admin-password"
    })
    assert regular_login.status_code == 403
    admin_login = client.post("/api/auth/super-admin/login", json={
        "email": "platform-admin@example.test",
        "password": "wrong-password"
    })
    assert admin_login.status_code == 401


def test_workspace_owner_admin_controls_are_workspace_scoped(
    client, auth_headers, second_auth_headers, second_user, create_workspace
):
    workspace_res = create_workspace("Owner-managed workspace")
    workspace_id = workspace_res.get_json()["data"]["workspace"]["id"]
    member_res = client.post(
        f"/api/workspaces/{workspace_id}/members",
        json={"user_id": second_user, "role": "developer"},
        headers=auth_headers
    )
    assert member_res.status_code == 201

    project_res = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Owner project"},
        headers=auth_headers
    )
    assert project_res.status_code == 201
    project = project_res.get_json()["data"]["project"]
    assert project["name"] == "Owner project"

    policy_res = client.put(
        f"/api/workspaces/{workspace_id}/admin/emergency-access-policy",
        json={"max_hours": 6},
        headers=auth_headers
    )
    assert policy_res.status_code == 200
    assert policy_res.get_json()["data"]["max_hours"] == "6"

    status_res = client.patch(
        f"/api/workspaces/{workspace_id}/admin/projects/{project['id']}",
        json={"is_active": False},
        headers=auth_headers
    )
    assert status_res.status_code == 200
    assert status_res.get_json()["data"]["project"]["is_active"] is False

    owner_summary = client.get(f"/api/workspaces/{workspace_id}/admin", headers=auth_headers)
    assert owner_summary.status_code == 200
    assert owner_summary.get_json()["data"]["emergency_access_max_hours"] == "6"
    assert any(item["action"] == "project.status_updated" for item in owner_summary.get_json()["data"]["audit_logs"])

    denied_summary = client.get(f"/api/workspaces/{workspace_id}/admin", headers=second_auth_headers)
    assert denied_summary.status_code == 403

    deactivate_res = client.put(
        f"/api/workspaces/{workspace_id}/members/{second_user}",
        json={"is_active": False},
        headers=auth_headers
    )
    assert deactivate_res.status_code == 200
    assert deactivate_res.get_json()["data"]["member"]["is_active"] is False
    assert client.get(f"/api/workspaces/{workspace_id}", headers=second_auth_headers).status_code == 403
    assert client.get("/api/workspaces", headers=second_auth_headers).get_json()["data"]["workspaces"] == []
