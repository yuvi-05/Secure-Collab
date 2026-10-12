def test_register(client):
    res = client.post("/api/auth/register", json={
        "username": "newuser",
        "email": "newuser@example.com",
        "password": "securepassword",
        "full_name": "New Person"
    })
    assert res.status_code == 201
    data = res.get_json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert data["data"]["user"]["username"] == "newuser"

def test_login(client, test_user):
    res = client.post("/api/auth/login", json={
        "login_id": "testuser",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["success"] is True
    assert "access_token" in data["data"]

def test_login_invalid_password(client, test_user):
    res = client.post("/api/auth/login", json={
        "login_id": "testuser",
        "password": "wrongpassword"
    })
    assert res.status_code == 401

def test_get_me(client, auth_headers):
    res = client.get("/api/auth/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.get_json()
    assert data["data"]["user"]["username"] == "testuser"
