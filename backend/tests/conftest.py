import pytest
from app import create_app
from app.extensions import db
from app.config import TestConfig
from app.models import User, Workspace, WorkspaceMember, Channel, ChannelMember, CodingProject, ProjectFile

@pytest.fixture
def app():
    app = create_app(TestConfig)
    app.config["SUPER_ADMIN_EMAIL"] = "platform-admin@example.test"
    app.config["SUPER_ADMIN_PASSWORD"] = "test-only-platform-admin-password"
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def runner(app):
    return app.test_cli_runner()

@pytest.fixture
def test_user(app):
    with app.app_context():
        user = User(
            username="testuser",
            email="test@collab.io",
            full_name="Test User"
        )
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        return user.id

@pytest.fixture
def second_user(app):
    with app.app_context():
        user = User(
            username="seconduser",
            email="second@collab.io",
            full_name="Second User"
        )
        user.set_password("password123")
        db.session.add(user)
        db.session.commit()
        return user.id

@pytest.fixture
def auth_headers(client, test_user):
    res = client.post("/api/auth/login", json={
        "login_id": "testuser",
        "password": "password123"
    })
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def second_auth_headers(client, second_user):
    res = client.post("/api/auth/login", json={
        "login_id": "seconduser",
        "password": "password123"
    })
    token = res.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def super_admin_headers(client):
    response = client.post("/api/auth/super-admin/login", json={
        "email": "platform-admin@example.test",
        "password": "test-only-platform-admin-password"
    })
    assert response.status_code == 200
    token = response.get_json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def create_workspace(client, super_admin_headers, test_user):
    def create(name, description=""):
        return client.post("/api/workspaces", json={
            "name": name,
            "description": description,
            "owner_id": test_user,
        }, headers=super_admin_headers)
    return create
