def test_ai_chat_endpoint(client, auth_headers):
    # Create workspace
    res_ws = client.post("/api/workspaces", json={"name": "AI Test Space"}, headers=auth_headers)
    ws_id = res_ws.get_json()["data"]["workspace"]["id"]

    # Send chat prompt to AI endpoint
    res_ai = client.post(f"/api/workspaces/{ws_id}/ai/chat", json={
        "prompt": "How do I reverse a linked list?",
        "action": "custom"
    }, headers=auth_headers)
    assert res_ai.status_code == 200
    data = res_ai.get_json()["data"]
    assert "message" in data
    assert len(data["message"]["content"]) > 0

def test_ai_explain_code_action(client, auth_headers):
    res_ws = client.post("/api/workspaces", json={"name": "AI Test Space 2"}, headers=auth_headers)
    ws_id = res_ws.get_json()["data"]["workspace"]["id"]

    res_ai = client.post(f"/api/workspaces/{ws_id}/ai/chat", json={
        "action": "explain",
        "code_context": "def add(a, b):\n    return a + b\n",
        "filename": "math.py",
        "language": "python"
    }, headers=auth_headers)
    assert res_ai.status_code == 200
    data = res_ai.get_json()["data"]
    assert "math.py" in data["message"]["content"] or "python" in data["message"]["content"].lower()
