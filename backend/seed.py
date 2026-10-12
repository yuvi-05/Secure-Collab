import datetime
from app import create_app
from app.extensions import db
from app.models import User, Workspace, WorkspaceMember, Channel, ChannelMember, Message, CodingProject, ProjectMember, ProjectFile

def seed():
    app = create_app()
    with app.app_context():
        print("[*] Seeding database...")

        # Create demo users
        alice = User.query.filter_by(username="alice").first()
        if not alice:
            alice = User(
                username="alice",
                email="alice@collab.io",
                full_name="Alice Vance",
                bio="Senior Full-Stack Engineer & Team Lead",
                avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
                is_online=True
            )
            alice.set_password("password123")
            db.session.add(alice)

        bob = User.query.filter_by(username="bob").first()
        if not bob:
            bob = User(
                username="bob",
                email="bob@collab.io",
                full_name="Bob Builder",
                bio="Systems & Cloud Architect",
                avatar_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                is_online=True
            )
            bob.set_password("password123")
            db.session.add(bob)

        db.session.commit()

        # Create primary workspace
        ws = Workspace.query.filter_by(name="Engineering Hub").first()
        if not ws:
            ws = Workspace(
                name="Engineering Hub",
                slug="engineering-hub",
                description="Central workspace for software engineering, architecture, and real-time collaboration.",
                owner_id=alice.id
            )
            db.session.add(ws)
            db.session.flush()

            # Add members
            m_alice = WorkspaceMember(workspace_id=ws.id, user_id=alice.id, role="owner")
            m_bob = WorkspaceMember(workspace_id=ws.id, user_id=bob.id, role="admin")
            db.session.add_all([m_alice, m_bob])

            # Channels
            general = Channel(
                workspace_id=ws.id,
                name="general",
                topic="Company-wide announcements and team discussions",
                description="Public channel for everyone in the workspace",
                is_private=False,
                created_by=alice.id
            )
            dev_chat = Channel(
                workspace_id=ws.id,
                name="dev-chat",
                topic="Daily engineering standup, code snippets & AI discussion",
                description="Technical engineering chat",
                is_private=False,
                created_by=alice.id
            )
            db.session.add_all([general, dev_chat])
            db.session.flush()

            # Channel memberships
            for ch in [general, dev_chat]:
                db.session.add(ChannelMember(channel_id=ch.id, user_id=alice.id, role="admin"))
                db.session.add(ChannelMember(channel_id=ch.id, user_id=bob.id, role="member"))

            # Sample messages
            msg1 = Message(
                workspace_id=ws.id,
                channel_id=general.id,
                user_id=alice.id,
                content="Welcome to **Secure-Collab**! 🚀 You can collaborate on code in real time, chat in channels, share files, and use the integrated AI coding assistant."
            )
            msg2 = Message(
                workspace_id=ws.id,
                channel_id=general.id,
                user_id=bob.id,
                content="Excited to be here! Real-time simultaneous Yjs editing with Monaco is super smooth."
            )
            db.session.add_all([msg1, msg2])

            # Starter Coding Project
            proj = CodingProject(
                workspace_id=ws.id,
                name="Quantum Data Processor",
                description="High-throughput stream processing pipeline in Python and JavaScript",
                created_by=alice.id
            )
            db.session.add(proj)
            db.session.flush()

            db.session.add(ProjectMember(project_id=proj.id, user_id=alice.id, role="admin"))
            db.session.add(ProjectMember(project_id=proj.id, user_id=bob.id, role="editor"))

            file1 = ProjectFile(
                project_id=proj.id,
                name="main.py",
                path="main.py",
                is_directory=False,
                language="python",
                content="""import time
import math

class QuantumStream:
    \"\"\"Simulated real-time high-velocity data stream.\"\"\"
    def __init__(self, sample_rate: float = 100.0):
        self.sample_rate = sample_rate
        self.packets_processed = 0

    def generate_signal(self, t: float) -> float:
        return math.sin(2 * math.pi * 5 * t) + 0.5 * math.cos(2 * math.pi * 20 * t)

    def process(self, duration: int = 5):
        print(f"[*] Starting QuantumStream processing for {duration}s...")
        start = time.time()
        while time.time() - start < duration:
            val = self.generate_signal(time.time() - start)
            self.packets_processed += 1
            if self.packets_processed % 50 == 0:
                print(f"[PACKET #{self.packets_processed}] Amplitude: {val:.4f}")
            time.sleep(0.01)
        print(f"[✓] Completed. Total processed: {self.packets_processed} packets.")

if __name__ == '__main__':
    stream = QuantumStream()
    stream.process(duration=2)
""",
                updated_by=alice.id
            )

            file2 = ProjectFile(
                project_id=proj.id,
                name="utils.py",
                path="utils.py",
                is_directory=False,
                language="python",
                content="""def sanitize_metrics(data: list[float]) -> list[float]:
    \"\"\"Filter out outliers and invalid reading anomalies.\"\"\"
    if not data:
        return []
    avg = sum(data) / len(data)
    return [x for x in data if abs(x - avg) < 3.0]
""",
                updated_by=bob.id
            )

            file3 = ProjectFile(
                project_id=proj.id,
                name="config.json",
                path="config.json",
                is_directory=False,
                language="json",
                content="""{\n  "version": "1.0.0",\n  "environment": "production",\n  "workers": 4,\n  "buffer_size": 1024\n}\n""",
                updated_by=alice.id
            )

            db.session.add_all([file1, file2, file3])
            db.session.commit()

        print("[SUCCESS] Database seeding complete!")

if __name__ == "__main__":
    seed()
