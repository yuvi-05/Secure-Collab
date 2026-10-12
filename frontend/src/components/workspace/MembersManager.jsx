import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, UserX, Search } from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Avatar from '../common/Avatar';

export const MembersManager = ({ workspaceId, onOpenInvite }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await workspaceService.getMembers(workspaceId);
      setMembers(res.data.members || []);
    } catch (err) {
      showToast('Failed to load members: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  const handleRoleChange = async (targetUserId, newRole) => {
    try {
      await workspaceService.updateMemberRole(workspaceId, targetUserId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === targetUserId ? { ...m, role: newRole } : m))
      );
      showToast('Member role updated', 'success');
    } catch (err) {
      showToast('Role update failed: ' + err.message, 'error');
    }
  };

  const handleRemove = async (targetUserId) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      await workspaceService.removeMember(workspaceId, targetUserId);
      setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
      showToast('Member removed', 'success');
    } catch (err) {
      showToast('Remove member failed: ' + err.message, 'error');
    }
  };

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = myMembership?.role === 'owner';
  const isAdmin = isOwner || myMembership?.role === 'admin';

  const filteredMembers = members.filter(
    (m) =>
      m.user?.username?.toLowerCase().includes(search.toLowerCase()) ||
      m.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.user?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 h-full p-6 overflow-y-auto bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Workspace Members
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage who has access to this workspace and assign roles and permissions.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={onOpenInvite}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite Teammates
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm mb-6">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter members by name or email..."
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-850 border-b border-slate-800 uppercase font-semibold text-[11px] text-slate-400">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Status</th>
              {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredMembers.map((m) => (
              <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 flex items-center gap-3">
                  <Avatar
                    name={m.user?.username}
                    src={m.user?.avatar_url}
                    size="sm"
                    isOnline={m.user?.is_online}
                  />
                  <div>
                    <div className="font-semibold text-slate-100">
                      {m.user?.full_name || m.user?.username}
                    </div>
                    <div className="text-[11px] text-slate-500">@{m.user?.username}</div>
                  </div>
                </td>
                <td className="py-3 px-4 text-slate-400">{m.user?.email}</td>
                <td className="py-3 px-4">
                  {isOwner && m.role !== 'owner' ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        m.role === 'owner'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : m.role === 'admin'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {m.role}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        m.user?.is_online ? 'bg-emerald-400' : 'bg-slate-500'
                      }`}
                    />
                    {m.user?.is_online ? 'Online' : 'Offline'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="py-3 px-4 text-right">
                    {m.role !== 'owner' && m.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove Member"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MembersManager;
