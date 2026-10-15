from app.extensions import db


class HiddenMessage(db.Model):
    __tablename__ = "hidden_messages"
    __table_args__ = (db.UniqueConstraint("message_id", "user_id", name="uq_hidden_message_user"),)

    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
