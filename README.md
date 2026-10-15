# Secure-Collab

> **Real-Time Team Collaboration & AI Coding Platform**  
> Inspired by Slack, Discord, and collaborative IDEs.

Secure-Collab is a full-stack, enterprise-grade web application enabling distributed engineering teams to communicate, share files securely, write and edit code simultaneously in real-time, and get AI-powered coding assistance in one unified workspace.

---

## 🌟 Architecture & Features

### 1. Modern Frontend
- **Framework**: React 19 + Vite + React Router v7
- **Styling**: Tailwind CSS v4 with dark and light mode support
- **Code Editor**: Monaco Editor (VS Code core engine) with syntax highlighting for Python, JavaScript, TypeScript, Java, C++, HTML, CSS, and JSON
- **Real-time Collaboration**: Yjs CRDTs + `y-monaco` + Socket.IO custom provider for concurrent multi-user editing, cursor sharing, and conflict-free text synchronization
- **Real-Time Networking**: Socket.IO Client
- **Icons**: Lucide React

### 2. High-Performance Backend
- **Framework**: Python 3 + Flask + Flask-SocketIO (WebSocket & Polling transports)
- **Database & ORM**: PostgreSQL as the primary database with Flask-SQLAlchemy (with plug-and-play local SQLite fallback out-of-the-box)
- **Authentication**: Flask-JWT-Extended with secure password hashing (`werkzeug.security`)
- **Real-Time Engine**: Flask-SocketIO with rooms for channels, direct messages, thread replies, presence tracking, and Yjs CRDT document synchronization
- **Security**: Workspace roles are Owner, Project Manager, Developer, Team Member, and Guest. Owners manage members, workspace project availability, emergency-access policy, and workspace audit history. Project Managers create projects and assign members; Developers edit assigned projects; Team Members have read-only project access; Guests can only access explicitly assigned projects and are read-only. Member deactivation is scoped to the workspace.
- **Role scope**: Owners have administrative control only within their own workspace. Project access is explicit for Developers, Team Members, and Guests. Tasks, meetings, and development-database integrations are not currently part of the application.
- **Emergency Access**: Workspace members may request temporary Project Manager or Developer access with a required justification and must select one or more existing projects. The temporary role applies only to those projects. Workspace owners approve or deny requests, choose the grant duration, set a workspace-specific duration limit, and can revoke active access. Requests, project selections, decisions, expiry, and revocation are retained in workspace audit history.
- **Platform Administration**: A single Super Admin account is configured using `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. It signs in through the separate Super Admin option on the login page and can create/delete workspaces and assign workspace Owners. Regular users, including Owners, cannot create or delete workspaces.

### 3. Modular AI Coding Assistant
- Dedicated AI panel inside the coding workspace.
- **Provider Agnostic**: Works with OpenAI (`gpt-4o`, `gpt-4o-mini`) or any OpenAI-compatible API (DeepSeek, Groq, OpenRouter, local Ollama).
- **Contextual Actions**:
  - **Explain Code**: Explains architecture, execution flow, and logic.
  - **Debug Code**: Finds bugs, exceptions, and security pitfalls.
  - **Refactor Code**: Produces modern, optimized code with unified diff preview.
  - **Generate Tests**: Generates comprehensive unit tests.
  - **User Review & Approval**: Shows a git-style diff preview modal before applying any AI changes into the editor.
  - Intelligent fallback guide when API key is not yet set.

### 4. Real-Time Chat & Threads
- One-to-one Direct Messages (DMs) and multi-user group DMs.
- Public and private workspace channels.
- Real-time unread message counters and notification badges in the sidebar.
- Message pagination ("Load earlier messages") with cursor-based infinite history navigation.
- Reply threads with parent-message scoping and live counter badges.
- Live emoji reactions on messages.
- Real-time typing indicators and online/offline user presence tracking.
- Message editing and deletion with permission verification.
- Search messages across the entire workspace.

### 5. Secure File Management
- Interactive drag-and-drop file upload into channels, DMs, or the workspace file repository.
- Inline preview for images, PDFs, and code/text files.
- Secure, authorized download endpoints (no unrestricted static file exposure).
- Unique file UUID storage and workspace directory isolation.

---

## 🚀 Quick Start & Development Setup

### Prerequisites
- **Node.js**: v18+ (tested on Node v24) & npm
- **Python**: v3.10+ (tested on Python 3.14)
- **Git**

---

### Step 1: Clone the Repository
```bash
git clone <repo-url>
cd "Secure Collab"
```

---

### Step 2: Backend Setup (Windows / VS Code)

1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd backend
   ```

2. Create a virtual environment:
   ```powershell
   python -m venv venv
   ```

3. Activate the virtual environment:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

4. Install backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

5. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```powershell
   copy .env.example .env
   ```
   Set `SUPER_ADMIN_EMAIL` to an email reserved for platform administration and set `SUPER_ADMIN_PASSWORD` to a strong password. The Super Admin login is unavailable until both are configured. Do not reuse a regular user's email.
   *(Optional: If connecting to PostgreSQL, set `DATABASE_URL=postgresql://user:password@localhost:5432/secure_collab`. By default, it uses a local SQLite database for instant setup without requiring an external database service).*

6. Apply database migrations:
   ```powershell
   $env:SKIP_DB_CREATE="1"
   flask --app run db upgrade
   Remove-Item Env:SKIP_DB_CREATE
   ```

7. Seed the database with starter demo accounts, channels, and projects:
   ```powershell
   $env:PYTHONPATH="."
   python seed.py
   ```
   *Demo accounts created:*
   - **Alice** (Workspace Owner): `alice@collab.io` / `password123`
   - **Bob** (Project Manager): `bob@collab.io` / `password123`

8. Run the backend server:
   ```powershell
   python run.py
   ```
   Backend will start at: `http://localhost:5000`

---

### Step 3: Frontend Setup

1. In a separate terminal, navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite development server:
   ```powershell
   npm run dev
   ```
   Frontend will run at: `http://localhost:5173`

---

## 🤖 Configuring the AI Assistant

The AI service is modular and supports OpenAI or any OpenAI-compatible provider.

1. Open `backend/.env`.
2. Add your provider API key:
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   OPENAI_BASE_URL=https://api.openai.com/v1
   AI_MODEL=gpt-4o-mini
   AI_PROVIDER=openai
   ```
3. **Using Other Providers**:
   - **DeepSeek**: Set `OPENAI_BASE_URL=https://api.deepseek.com` and `AI_MODEL=deepseek-chat`
   - **Groq**: Set `OPENAI_BASE_URL=https://api.groq.com/openai/v1` and `AI_MODEL=llama-3.3-70b-versatile`
   - **OpenRouter**: Set `OPENAI_BASE_URL=https://openrouter.ai/api/v1` and `AI_MODEL=anthropic/claude-3.5-sonnet`
   - **Local Ollama**: Set `OPENAI_BASE_URL=http://localhost:11434/v1` and `AI_MODEL=llama3`
4. Restart the backend server to apply changes.

---

## 👥 Testing Two-Browser Multi-User Collaboration

To test live simultaneous code editing and messaging across two users:

1. Open **Browser 1** (e.g., Chrome) at `http://localhost:5173`.
   - Click the quick demo login button: **👩‍💻 Alice (Owner)**.
2. Open **Browser 2** (e.g., Chrome Incognito or Firefox) at `http://localhost:5173`.
   - Click the quick demo login button: **👨‍💻 Bob (Project Manager)**.

3. In both browser windows, navigate to:
   - **Real-Time Chat**: Switch to `#general` or `#dev-chat`. Send messages, add emoji reactions, and reply in threads. Notice instantaneous real-time updates and typing indicators!
   - **Collaborative Coding Workspace**: Click **Quantum Data Processor** under *CODING PROJECTS*.
   - Open `main.py` in both windows.
   - Start typing simultaneously in both windows. Notice Yjs CRDT synchronization merges all concurrent edits without conflicts!
   - Notice collaborator presence avatars with unique peer colors appear in the top-right header!
   - Highlight any block of code, open the **AI Assistant** panel on the right, and click **Explain** or **Refactor**. Review the suggested diff and approve changes into the editor!

---

## 🧪 Running the Test Suite

### Backend Tests (pytest)
Runs 13 automated test suites covering authentication, workspace authorization, private channel permissions, message history, reactions, thread replies, secure file uploads/downloads, Yjs CRDT persistence and unauthorized project access guards, and AI endpoints:
```powershell
cd backend
$env:PYTHONPATH="."
.\venv\Scripts\python.exe -m pytest tests -v
```

### Frontend Tests (Vitest)
Runs automated component and CRDT integration tests:
```powershell
cd frontend
npm test
```

---

## 🗄️ Database Migrations (Flask-Migrate / Alembic)

The application uses Flask-Migrate for tracking database schema changes:

- **Run pending migrations to the latest revision**:
  ```powershell
  cd backend
  $env:PYTHONPATH="."
  flask db upgrade
  ```
- **Generate a new migration after modifying models**:
  ```powershell
  $env:SKIP_DB_CREATE="1"
  $env:PYTHONPATH="."
  flask db migrate -m "Description of changes"
  ```

---

## 🐳 Docker Compose Deployment

Run the complete stack (PostgreSQL 16, Redis 7, Flask Backend, Nginx Frontend) with one command:

```bash
docker-compose up --build -d
```

- Web Application: `http://localhost`
- Backend API: `http://localhost:5000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

---

## 📁 Project Structure

```text
secure-collab/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Flask application factory
│   │   ├── config.py            # Environment configuration
│   │   ├── extensions.py        # SQLAlchemy, JWT, SocketIO extensions
│   │   ├── middleware/          # Role and workspace access decorators
│   │   ├── models/              # Database models (User, Workspace, Message, File, Project, Yjs, AI, etc.)
│   │   ├── routes/              # REST API blueprints (Auth, Workspaces, Channels, Messages, Files, Projects, AI)
│   │   ├── services/            # AIService, FileService, YjsService
│   │   ├── sockets/             # Socket.IO chat, presence, and Yjs collab event handlers
│   │   └── utils/               # Response formatting and security sanitization
│   ├── tests/                   # Pytest automated test suites
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── run.py                   # Backend entrypoint with Socket.IO
│   └── seed.py                  # Database starter seed script
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/              # AIPanel, AIDiffModal
│   │   │   ├── chat/            # ChatArea, MessageItem, MessageInput, ThreadDrawer, EmojiPicker
│   │   │   ├── common/          # Avatar, Modal
│   │   │   ├── editor/          # CodeWorkspace, FileTree, EditorTabs
│   │   │   ├── files/           # FileManager, FilePreviewModal
│   │   │   ├── layout/          # AppLayout, Sidebar, WorkspaceSwitcher, TopNav
│   │   │   ├── modals/          # CreateWorkspace, CreateChannel, CreateProject, Invite, Profile, Search
│   │   │   └── workspace/       # MembersManager
│   │   ├── contexts/            # AuthContext, WorkspaceContext, SocketContext, ThemeContext, ToastContext
│   │   ├── pages/               # LoginPage, RegisterPage, InviteAcceptPage
│   │   ├── services/            # Axios API client and service modules
│   │   ├── socket/              # Socket.IO client singleton
│   │   ├── styles/              # Tailwind CSS index.css
│   │   ├── App.jsx              # Routing & application shell
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── README.md
└── .gitignore
```

---

## 🔒 Security Best Practices Implemented

- **Password Hashing**: Secure salted password hashing using PBKDF2/SHA256.
- **Route Authorization**: Strict server-side membership checks for all workspace, channel, and coding project operations.
- **Path Sanitization**: Directory traversal prevention when manipulating project files.
- **File Validation**: Strict MIME type and extension whitelist, unique UUID filenames, and workspace directory isolation.
- **Stateless Authentication**: Signed JWT tokens stored securely on client and verified per-request.
- **CORS Protection**: Explicit cross-origin resource sharing configuration.

---

## 📄 License
MIT License. Built for real-time team collaboration and AI-assisted engineering.
