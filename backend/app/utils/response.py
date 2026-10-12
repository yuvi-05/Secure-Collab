from flask import jsonify

def success_response(data=None, message="Success", status_code=200):
    payload = {
        "success": True,
        "message": message,
        "data": data
    }
    return jsonify(payload), status_code

def error_response(message="An error occurred", status_code=400, errors=None):
    payload = {
        "success": False,
        "message": message,
        "errors": errors or []
    }
    return jsonify(payload), status_code
