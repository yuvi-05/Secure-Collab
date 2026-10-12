import React, { useState, useEffect } from 'react';
import { Search, MessageSquare, FileText, User as UserIcon, X } from 'lucide-react';
import Modal from '../common/Modal';
import { messageService } from '../../services/messageService';
import { fileService } from '../../services/fileService';
import { authService } from '../../services/authService';
import { useWorkspace } from '../../contexts/WorkspaceContext';

export const SearchModal = ({ isOpen, onClose, workspaceId }) => {
  const { selectChannel, channels, setViewMode } = useWorkspace();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('messages'); // 'messages' | 'files' | 'users'
  const [messages, setMessages] = useState([]);
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !query.trim()) {
      setMessages([]);
      setFiles([]);
      setUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (tab === 'messages') {
          const res = await messageService.searchMessages(workspaceId, query);
          setMessages(res.data.messages || []);
        } else if (tab === 'files') {
          const res = await fileService.listFiles(workspaceId, query);
          setFiles(res.data.files || []);
        } else if (tab === 'users') {
          const res = await authService.searchUsers(query);
          setUsers(res.data.users || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, query, tab, workspaceId]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Global Workspace Search" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all conversations, files, and users..."
            className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
          <button
            onClick={() => setTab('messages')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              tab === 'messages' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Messages ({messages.length})
          </button>
          <button
            onClick={() => setTab('files')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              tab === 'files' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Files ({files.length})
          </button>
          <button
            onClick={() => setTab('users')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              tab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Teammates ({users.length})
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-80 overflow-y-auto space-y-2 text-xs">
          {loading && <div className="text-center text-slate-400 py-6">Searching...</div>}

          {!loading && tab === 'messages' && (
            messages.length === 0 ? (
              <div className="text-center text-slate-500 py-6">No matching messages found</div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    if (m.channel_id) {
                      const ch = channels.find((c) => c.id === m.channel_id);
                      if (ch) selectChannel(ch);
                    }
                    onClose();
                  }}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span className="font-semibold text-slate-200">@{m.user?.username}</span>
                    <span>{new Date(m.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-300 line-clamp-2">{m.content}</p>
                </div>
              ))
            )
          )}

          {!loading && tab === 'files' && (
            files.length === 0 ? (
              <div className="text-center text-slate-500 py-6">No matching files found</div>
            ) : (
              files.map((f) => (
                <div
                  key={f.id}
                  onClick={() => {
                    setViewMode('files');
                    onClose();
                  }}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:border-indigo-500 cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-white">{f.filename}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {(f.file_size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))
            )
          )}

          {!loading && tab === 'users' && (
            users.length === 0 ? (
              <div className="text-center text-slate-500 py-6">No users found</div>
            ) : (
              users.map((u) => (
                <div
                  key={u.id}
                  className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <div className="font-semibold text-white">{u.full_name || u.username}</div>
                    <div className="text-[11px] text-slate-400">@{u.username} • {u.email}</div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SearchModal;
