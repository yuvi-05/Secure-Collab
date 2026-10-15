import datetime
from app.extensions import db
from app.models import EmergencyAccessRequest
from app.utils.datetime_utils import utc_now


def test_create_workspace(create_workspace, test_user):
    res = create_workspace("Acme Corp", "Building cool things")
    assert res.status_code == 201
    data = res.get_json()["data"]["workspace"]
    assert data["name"] == "Acme Corp"
    assert data["owner_id"] == test_user

def test_workspace_membership_check(client, create_workspace, second_auth_headers):
    # User 1 creates workspace
    res = create_workspace("Private Team")
    ws_id = res.get_json()["data"]["workspace"]["id"]

    # User 2 tries to access without membership -> should return 403
    res2 = client.get(f"/api/workspaces/{ws_id}", headers=second_auth_headers)
    assert res2.status_code == 403

def test_private_channel_permissions(client, auth_headers, second_auth_headers, second_user, create_workspace):
    # User 1 creates workspace
    res = create_workspace("Secure HQ")
    ws_id = res.get_json()["data"]["workspace"]["id"]

    # User 1 adds User 2 as a normal member
    res_add = client.post(f"/api/workspaces/{ws_id}/members", json={
        "user_id": second_user,
        "role": "team_member"
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


def test_workspace_roles_and_guest_permissions(client, auth_headers, second_auth_headers, second_user, create_workspace):
    workspace_res = create_workspace("Role Access")
    workspace_id = workspace_res.get_json()["data"]["workspace"]["id"]

    member_res = client.post(
        f"/api/workspaces/{workspace_id}/members",
        json={"user_id": second_user, "role": "project_manager"},
        headers=auth_headers
    )
    assert member_res.status_code == 201
    assert member_res.get_json()["data"]["member"]["role"] == "project_manager"

    manager_invite_res = client.post(
        f"/api/workspaces/{workspace_id}/invitations",
        json={"email": "developer@example.com", "role": "developer"},
        headers=second_auth_headers
    )
    assert manager_invite_res.status_code == 403

    invite_res = client.post(
        f"/api/workspaces/{workspace_id}/invitations",
        json={"email": "developer@example.com", "role": "developer"},
        headers=auth_headers
    )
    assert invite_res.status_code == 201
    assert invite_res.get_json()["data"]["invitation"]["role"] == "developer"

    project_res = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Managed Project"},
        headers=second_auth_headers
    )
    assert project_res.status_code == 201
    project_id = project_res.get_json()["data"]["project"]["id"]

    change_res = client.put(
        f"/api/workspaces/{workspace_id}/members/{second_user}",
        json={"role": "developer"},
        headers=auth_headers
    )
    assert change_res.status_code == 200
    assign_res = client.post(
        f"/api/workspaces/{workspace_id}/projects/{project_id}/members",
        json={"user_id": second_user},
        headers=auth_headers
    )
    assert assign_res.status_code == 201

    developer_file_res = client.post(
        f"/api/workspaces/{workspace_id}/projects/{project_id}/files",
        json={"path": "developer.txt", "content": "allowed"},
        headers=second_auth_headers
    )
    assert developer_file_res.status_code == 201

    change_res = client.put(
        f"/api/workspaces/{workspace_id}/members/{second_user}",
        json={"role": "team_member"},
        headers=auth_headers
    )
    assert change_res.status_code == 200

    workspace_read_res = client.get(
        f"/api/workspaces/{workspace_id}",
        headers=second_auth_headers
    )
    assert workspace_read_res.status_code == 200

    project_create_res = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Viewer Project"},
        headers=second_auth_headers
    )
    assert project_create_res.status_code == 403

    change_res = client.put(
        f"/api/workspaces/{workspace_id}/members/{second_user}",
        json={"role": "guest"},
        headers=second_auth_headers
    )
    assert change_res.status_code == 403

    change_res = client.put(
        f"/api/workspaces/{workspace_id}/members/{second_user}",
        json={"role": "guest"},
        headers=auth_headers
    )
    assert change_res.status_code == 200
    message_res = client.post(
        f"/api/workspaces/{workspace_id}/messages",
        json={"content": "not allowed", "channel_id": 1},
        headers=second_auth_headers
    )
    assert message_res.status_code == 403


def test_emergency_access_requires_approval_and_can_be_revoked(
    client, auth_headers, second_auth_headers, second_user, create_workspace
):
    workspace_res = create_workspace("Emergency Access")
    workspace_id = workspace_res.get_json()["data"]["workspace"]["id"]
    first_project = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Incident Response"},
        headers=auth_headers
    ).get_json()["data"]["project"]
    second_project = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Unrelated Project"},
        headers=auth_headers
    ).get_json()["data"]["project"]
    outside_workspace_id = create_workspace("Outside emergency scope").get_json()["data"]["workspace"]["id"]
    outside_project_id = client.post(
        f"/api/workspaces/{outside_workspace_id}/projects",
        json={"name": "Outside Project"},
        headers=auth_headers
    ).get_json()["data"]["project"]["id"]
    add_res = client.post(
        f"/api/workspaces/{workspace_id}/members",
        json={"user_id": second_user, "role": "guest"},
        headers=auth_headers
    )
    assert add_res.status_code == 201

    invalid_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access",
        json={"reason": "A valid incident reason, but missing selected project."},
        headers=second_auth_headers
    )
    assert invalid_res.status_code == 400
    outside_project_request = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access",
        json={
            "reason": "This project belongs to a different workspace.",
            "requested_role": "developer",
            "project_ids": [outside_project_id],
        },
        headers=second_auth_headers
    )
    assert outside_project_request.status_code == 400

    request_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access",
        json={
            "reason": "Production incident requires reviewing workspace settings.",
            "requested_role": "project_manager",
            "project_ids": [first_project["id"]],
        },
        headers=second_auth_headers
    )
    assert request_res.status_code == 201
    request_id = request_res.get_json()["data"]["request"]["id"]
    assert request_res.get_json()["data"]["request"]["status"] == "pending"
    assert request_res.get_json()["data"]["request"]["requested_role"] == "project_manager"

    approval_denied_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access/{request_id}/approve",
        json={"duration_hours": 2},
        headers=second_auth_headers
    )
    assert approval_denied_res.status_code == 403

    invalid_duration_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access/{request_id}/approve",
        json={"duration_hours": 0},
        headers=auth_headers
    )
    assert invalid_duration_res.status_code == 400

    pending_res = client.get(
        f"/api/workspaces/{workspace_id}/emergency-access",
        headers=second_auth_headers
    )
    assert pending_res.get_json()["data"]["requests"][0]["status"] == "pending"

    approval_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access/{request_id}/approve",
        json={"duration_hours": 2},
        headers=auth_headers
    )
    assert approval_res.status_code == 200
    approved = approval_res.get_json()["data"]["request"]
    assert approved["is_active"] is True
    assert approved["reviewer_id"] is not None

    details_res = client.get(
        f"/api/workspaces/{workspace_id}",
        headers=second_auth_headers
    )
    assert details_res.get_json()["data"]["workspace"]["my_role"] == "guest"
    granted_projects = client.get(
        f"/api/workspaces/{workspace_id}/projects",
        headers=second_auth_headers
    ).get_json()["data"]["projects"]
    assert [project["id"] for project in granted_projects] == [first_project["id"]]

    project_access_res = client.get(
        f"/api/workspaces/{workspace_id}/projects/{first_project['id']}",
        headers=second_auth_headers
    )
    assert project_access_res.status_code == 200
    create_project_during_emergency = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Not a workspace project"},
        headers=second_auth_headers
    )
    assert create_project_during_emergency.status_code == 403
    unrelated_access_res = client.get(
        f"/api/workspaces/{workspace_id}/projects/{second_project['id']}",
        headers=second_auth_headers
    )
    assert unrelated_access_res.status_code == 403
    scoped_update_res = client.put(
        f"/api/workspaces/{workspace_id}/projects/{first_project['id']}",
        json={"name": "Incident Response - Managed"},
        headers=second_auth_headers
    )
    assert scoped_update_res.status_code == 200
    unrelated_update_res = client.put(
        f"/api/workspaces/{workspace_id}/projects/{second_project['id']}",
        json={"name": "Unauthorized Rename"},
        headers=second_auth_headers
    )
    assert unrelated_update_res.status_code == 403

    revoke_res = client.delete(
        f"/api/workspaces/{workspace_id}/emergency-access/{request_id}",
        headers=second_auth_headers
    )
    assert revoke_res.status_code == 200
    assert revoke_res.get_json()["data"]["request"]["status"] == "revoked"
    revoked_project_access = client.get(
        f"/api/workspaces/{workspace_id}/projects/{first_project['id']}",
        headers=second_auth_headers
    )
    assert revoked_project_access.status_code == 403

    details_res = client.get(
        f"/api/workspaces/{workspace_id}",
        headers=second_auth_headers
    )
    assert details_res.get_json()["data"]["workspace"]["my_role"] == "guest"

    blocked_project_res = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Blocked Project"},
        headers=second_auth_headers
    )
    assert blocked_project_res.status_code == 403

    second_request_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access",
        json={
            "reason": "A follow-up incident needs temporary configuration access.",
            "requested_role": "developer",
            "project_ids": [second_project["id"]],
        },
        headers=second_auth_headers
    )
    second_request_id = second_request_res.get_json()["data"]["request"]["id"]
    deny_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access/{second_request_id}/deny",
        headers=auth_headers
    )
    assert deny_res.status_code == 200
    assert deny_res.get_json()["data"]["request"]["status"] == "denied"
    assert deny_res.get_json()["data"]["request"]["requested_role"] == "developer"

    developer_request = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access",
        json={
            "reason": "A code review incident needs temporary repository access.",
            "requested_role": "developer",
            "project_ids": [second_project["id"]],
        },
        headers=second_auth_headers
    )
    developer_request_id = developer_request.get_json()["data"]["request"]["id"]
    developer_approval = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access/{developer_request_id}/approve",
        json={"duration_hours": 2},
        headers=auth_headers
    )
    assert developer_approval.status_code == 200
    assert developer_approval.get_json()["data"]["request"]["requested_role"] == "developer"
    developer_workspace = client.get(
        f"/api/workspaces/{workspace_id}",
        headers=second_auth_headers
    )
    assert developer_workspace.get_json()["data"]["workspace"]["my_role"] == "guest"
    developer_projects = client.get(
        f"/api/workspaces/{workspace_id}/projects",
        headers=second_auth_headers
    ).get_json()["data"]["projects"]
    assert [project["id"] for project in developer_projects] == [second_project["id"]]
    developer_file = client.post(
        f"/api/workspaces/{workspace_id}/projects/{second_project['id']}/files",
        json={"path": "emergency.txt", "content": "temporary edit"},
        headers=second_auth_headers
    )
    assert developer_file.status_code == 201
    unrelated_developer_file = client.post(
        f"/api/workspaces/{workspace_id}/projects/{first_project['id']}/files",
        json={"path": "unrelated.txt", "content": "should be blocked"},
        headers=second_auth_headers
    )
    assert unrelated_developer_file.status_code == 403


def test_expired_emergency_access_grant_does_not_grant_permissions(
    client, app, auth_headers, second_auth_headers, second_user, create_workspace
):
    workspace_res = create_workspace("Expired Emergency Access")
    workspace_id = workspace_res.get_json()["data"]["workspace"]["id"]
    project_res = client.post(
        f"/api/workspaces/{workspace_id}/projects",
        json={"name": "Expiring Project"},
        headers=auth_headers
    )
    project_id = project_res.get_json()["data"]["project"]["id"]
    client.post(
        f"/api/workspaces/{workspace_id}/members",
        json={"user_id": second_user, "role": "guest"},
        headers=auth_headers
    )
    request_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access",
        json={
            "reason": "Urgent recovery access is required for investigation.",
            "requested_role": "project_manager",
            "project_ids": [project_id],
        },
        headers=second_auth_headers
    )
    request_id = request_res.get_json()["data"]["request"]["id"]
    approve_res = client.post(
        f"/api/workspaces/{workspace_id}/emergency-access/{request_id}/approve",
        json={"duration_hours": 1},
        headers=auth_headers
    )
    assert approve_res.status_code == 200

    with app.app_context():
        access_request = db.session.get(EmergencyAccessRequest, request_id)
        access_request.expires_at = utc_now().replace(tzinfo=None) - datetime.timedelta(seconds=1)
        db.session.commit()

    details_res = client.get(
        f"/api/workspaces/{workspace_id}",
        headers=second_auth_headers
    )
    assert details_res.get_json()["data"]["workspace"]["my_role"] == "guest"
    blocked_res = client.post(
        f"/api/workspaces/{workspace_id}/channels",
        json={"name": "expired-access"},
        headers=second_auth_headers
    )
    assert blocked_res.status_code == 403
