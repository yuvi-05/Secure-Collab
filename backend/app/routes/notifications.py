from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from app.extensions import db
from app.models import Notification
from app.utils.response import success_response, error_response
from app.middleware.auth_middleware import get_current_user

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

@notifications_bp.route("", methods=["GET"])
@jwt_required()
def list_notifications():
    current_user = get_current_user()
    limit = min(request.args.get("limit", 30, type=int), 100)
    notifs = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.id.desc()).limit(limit).all()
    unread_count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()

    return success_response({
        "notifications": [n.to_dict() for n in notifs],
        "unread_count": unread_count
    })


@notifications_bp.route("/unread-count", methods=["GET"])
@jwt_required()
def get_unread_count():
    current_user = get_current_user()
    count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return success_response({"unread_count": count})


@notifications_bp.route("/<int:notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_notification_read(notification_id):
    current_user = get_current_user()
    notif = Notification.query.filter_by(id=notification_id, user_id=current_user.id).first()
    if not notif:
        return error_response("Notification not found", 404)

    notif.is_read = True
    db.session.commit()
    return success_response({"notification": notif.to_dict()}, "Marked as read")


@notifications_bp.route("/read-all", methods=["POST"])
@jwt_required()
def mark_all_read():
    current_user = get_current_user()
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return success_response(None, "All notifications marked as read")
