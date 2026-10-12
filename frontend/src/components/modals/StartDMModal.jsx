import React, { useState, useEffect } from 'react';
import { Search, UserCheck, MessageSquare } from 'lucide-react';
import Modal from '../common/Modal';
import { authService } from '../../services/authService';
import { messageService } from '../../services/messageService';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';
import Avatar from '../common/Avatar';

export const StartDMModal = ({ isOpen, onClose, workspaceId, currentUserId }) => {
  const { selectConversation, setConversations } = useWorkspace();
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchUsers = async () => {
      try {
        const res = await authService.searchUsers(query);
        const filtered = (res.data.users || []).filter((u) => u.id !== currentUserId);
        setUsers(filtered);
      } catch (err) {
        console.error(err);
      }
    };
    fetchUsers();
  }, [isOpen, query, currentUserId]);

  const toggleSelectUser = (u) => {
    if (selectedUsers.some((x) => x.id === u.id)) {
      setSelectedUsers(selectedUsers.filter((x) => x.id !== u.id));
    } else {
      setSelectedUsers([...selectedUsers, u]);
    }
  };

  const handleStartDM = async () => {
    if (selectedUsers.length === 0) return;
    setLoading(true);
    try {
      const res = await messageService.startConversation(workspaceId, {
        participant_ids: selectedUsers.map((u) => u.id),
        is_group: selectedUsers.length > 1,
      });
      const conv = res.data.conversation;
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      selectConversation(conv);
      onClose();
      setSelectedUsers([]);
    } catch (err) {
      showToast('Error starting direct message: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Start a Direct Message">
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Selected chips */}
        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
            {selectedUsers.map((u) => (
              <span
                key={u.id}
                onClick={() => toggleSelectUser(u)}
                className="px-2 py-0.5 rounded-md bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs flex items-center gap-1 cursor-pointer hover:bg-rose-900/40 hover:text-rose-300"
              >
                @{u.username} ×
              </span>
            ))}
          </div>
        )}

        {/* Users Search Results */}
        <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-slate-800/60">
          {users.map((u) => {
            const isSelected = selectedUsers.some((x) => x.id === u.id);
            return (
              <div
                key={u.id}
                onClick={() => toggleSelectUser(u)}
                className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? 'bg-indigo-600/20 text-white' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Avatar name={u.username} src={u.avatar_url} size="sm" isOnline={u.is_online} />
                  <div className="truncate text-xs">
                    <span className="font-semibold block text-slate-100">{u.full_name || u.username}</span>
                    <span className="text-[11px] text-slate-500">@{u.username} • {u.email}</span>
                  </div>
                </div>
                {isSelected && <UserCheck className="w-4 h-4 text-indigo-400 shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStartDM}
          disabled={loading || selectedUsers.length === 0}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          {loading ? 'Starting conversation...' : `Start Chat (${selectedUsers.length} selected)`}
        </button>
      </div>
    </Modal>
  );
};

export default StartDMModal;
