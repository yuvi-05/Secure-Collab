import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, UserX, Search, Check, X } from 'lucide-react';
import { workspaceService } from '../../services/workspaceService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import socketClient from '../../socket/socketClient';
import Avatar from '../common/Avatar';

export const MembersManager = ({ workspaceId, onOpenInvite }) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [emergencyProjects, setEmergencyProjects] = useState([]);
  const [selectedEmergencyProjectIds, setSelectedEmergencyProjectIds] = useState([]);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [requestedRole, setRequestedRole] = useState('project_manager');
  const [durationHours, setDurationHours] = useState({});

  const loadMembers = useCallback(async () => {
    try {
      const res = await workspaceService.getMembers(workspaceId);
      setMembers(res.data.members || []);
    } catch (err) {
      showToast('Failed to load members: ' + err.message, 'error');
    }
  }, [workspaceId, showToast]);

  const loadEmergencyRequests = useCallback(async () => {
    try {
      const res = await workspaceService.listEmergencyAccess(workspaceId);
      setEmergencyRequests(res.data.requests || []);
    } catch (err) {
      showToast('Failed to load emergency access requests: ' + err.message, 'error');
    }
  }, [workspaceId, showToast]);

  const loadEmergencyProjects = useCallback(async () => {
    try {
      const res = await workspaceService.listEmergencyAccessProjects(workspaceId);
      setEmergencyProjects(res.data.projects || []);
    } catch (err) {
      showToast('Failed to load projects for emergency access: ' + err.message, 'error');
    }
  }, [workspaceId, showToast]);

  useEffect(() => {
    loadMembers();
    loadEmergencyRequests();
    loadEmergencyProjects();
    const handleEmergencyAccessChanged = (data) => {
      if (data?.workspace_id === workspaceId) loadEmergencyRequests();
    };
    socketClient.on('emergency_access_changed', handleEmergencyAccessChanged);
    return () => socketClient.off('emergency_access_changed', handleEmergencyAccessChanged);
  }, [loadMembers, loadEmergencyRequests, loadEmergencyProjects, workspaceId]);

  const handleEmergencyRequest = async (e) => {
    e.preventDefault();
    try {
      await workspaceService.requestEmergencyAccess(
        workspaceId, emergencyReason, requestedRole, selectedEmergencyProjectIds
      );
      setEmergencyReason('');
      setSelectedEmergencyProjectIds([]);
      showToast('Emergency access request sent to the workspace owner', 'success');
      loadEmergencyRequests();
    } catch (err) {
      showToast('Emergency access request failed: ' + err.message, 'error');
    }
  };

  const handleEmergencyDecision = async (requestId, approve) => {
    try {
      if (approve) {
        const hours = Number(durationHours[requestId] || 4);
        await workspaceService.approveEmergencyAccess(workspaceId, requestId, hours);
        showToast('Temporary emergency access approved', 'success');
      } else {
        await workspaceService.denyEmergencyAccess(workspaceId, requestId);
        showToast('Emergency access request denied', 'success');
      }
      loadEmergencyRequests();
    } catch (err) {
      showToast('Emergency access decision failed: ' + err.message, 'error');
    }
  };

  const handleEmergencyRevoke = async (requestId) => {
    try {
      await workspaceService.revokeEmergencyAccess(workspaceId, requestId);
      showToast('Emergency access revoked', 'success');
      loadEmergencyRequests();
    } catch (err) {
      showToast('Could not revoke emergency access: ' + err.message, 'error');
    }
  };

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

  const handleMemberAccess = async (member) => {
    try {
      const response = await workspaceService.updateMember(workspaceId, member.user_id, {
        is_active: !member.is_active,
      });
      setMembers((previous) => previous.map((item) => (
        item.user_id === member.user_id ? response.data.member : item
      )));
      showToast(`Workspace access ${member.is_active ? 'deactivated' : 'reactivated'}`, 'success');
    } catch (err) {
      showToast('Could not update workspace access: ' + err.message, 'error');
    }
  };

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isOwner = myMembership?.role === 'owner';
  const canManageMembers = isOwner;
  const canRequestEmergencyAccess = !isOwner && myMembership?.role !== 'project_manager';
  const pendingOrActiveRequest = emergencyRequests.find(
    (item) => item.status === 'pending' || item.is_active
  );

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

        {canManageMembers && (
          <button
            onClick={onOpenInvite}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Invite Teammates
          </button>
        )}
      </div>

      <section className="mb-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Emergency Access</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Temporary Project Manager or Developer access requires owner approval and a recorded justification.
          Grants expire at the approved time and are recorded in the audit history.
        </p>

        {isOwner ? (
          <div className="space-y-3">
            {emergencyRequests.length === 0 ? (
              <p className="text-xs text-slate-500">No emergency access requests yet.</p>
            ) : emergencyRequests.map((item) => (
              <div key={item.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200">
                      {item.requester?.full_name || item.requester?.username} · {item.requested_role?.replace('_', ' ')} · {item.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-400 whitespace-pre-wrap">{item.reason}</p>
                    <p className="mt-1 text-[11px] text-indigo-300">
                      Projects: {(item.projects || item.project_ids || []).map((project) => (
                        typeof project === 'object'
                          ? project.name
                          : emergencyProjects.find((available) => available.id === project)?.name || `Project ${project}`
                      )).join(', ')}
                    </p>
                    {item.expires_at && (
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.is_active ? 'Expires' : 'Expiry'}: {new Date(item.expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  {item.is_active && (
                    <button
                      onClick={() => handleEmergencyRevoke(item.id)}
                      className="shrink-0 px-2 py-1 rounded-lg text-[11px] text-rose-300 bg-rose-950/60 hover:bg-rose-900"
                    >
                      Revoke
                    </button>
                  )}
                </div>
                {item.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-3">
                    <label className="text-[11px] text-slate-400" htmlFor={`duration-${item.id}`}>
                      Grant duration (hours)
                    </label>
                    <input
                      id={`duration-${item.id}`}
                      type="number"
                      min="1"
                      step="1"
                      value={durationHours[item.id] ?? 4}
                      onChange={(e) => setDurationHours((prev) => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))}
                      className="w-20 px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                    <button
                      onClick={() => handleEmergencyDecision(item.id, true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900"
                    >
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => handleEmergencyDecision(item.id, false)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-rose-300 bg-rose-950/60 hover:bg-rose-900"
                    >
                      <X className="w-3 h-3" /> Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <>
            {pendingOrActiveRequest ? (
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-300">
                  Emergency access {pendingOrActiveRequest.is_active
                    ? `active until ${new Date(pendingOrActiveRequest.expires_at).toLocaleString()}`
                    : 'request is awaiting owner approval'}
                </span>
                {pendingOrActiveRequest.is_active && (
                  <button
                    onClick={() => handleEmergencyRevoke(pendingOrActiveRequest.id)}
                    className="px-2 py-1 rounded-lg text-[11px] text-rose-300 bg-rose-950/60 hover:bg-rose-900"
                  >
                    Revoke my access
                  </button>
                )}
              </div>
            ) : canRequestEmergencyAccess ? (
              <form onSubmit={handleEmergencyRequest} className="space-y-2">
                <label htmlFor="emergency-role" className="block text-xs font-medium text-slate-300">
                  Temporary project role
                </label>
                <select
                  id="emergency-role"
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value)}
                  className="block px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
                >
                  <option value="project_manager">Project Manager</option>
                  <option value="developer">Developer</option>
                </select>
                <p className="text-[11px] text-slate-500">
                  Project Manager permissions apply only to the projects selected below.
                </p>
                <fieldset className="space-y-1">
                  <legend className="block text-xs font-medium text-slate-300">
                    Projects to access
                  </legend>
                  {emergencyProjects.length ? emergencyProjects.map((project) => (
                    <label key={project.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={selectedEmergencyProjectIds.includes(project.id)}
                        onChange={(event) => setSelectedEmergencyProjectIds((current) => (
                          event.target.checked
                            ? [...current, project.id]
                            : current.filter((id) => id !== project.id)
                        ))}
                        className="accent-indigo-500"
                      />
                      {project.name}
                    </label>
                  )) : (
                    <p className="text-xs text-slate-500">No active projects are available for access.</p>
                  )}
                </fieldset>
                <label htmlFor="emergency-reason" className="block text-xs font-medium text-slate-300">
                  Why is temporary elevated access needed?
                </label>
                <textarea
                  id="emergency-reason"
                  required
                  minLength={10}
                  maxLength={2000}
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  placeholder="Describe the incident and access needed..."
                  className="w-full min-h-20 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={emergencyReason.trim().length < 10 || selectedEmergencyProjectIds.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"
                >
                  Request Emergency Access
                </button>
              </form>
            ) : (
              <p className="text-xs text-slate-500">
                You already have manager-level access and do not need an emergency grant.
              </p>
            )}
          </>
        )}
      </section>

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
              {canManageMembers && <th className="py-3 px-4 text-right">Actions</th>}
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
                      <option value="project_manager">Project Manager</option>
                      <option value="developer">Developer</option>
                      <option value="team_member">Team Member</option>
                      <option value="guest">Guest</option>
                    </select>
                  ) : (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        m.role === 'owner'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : m.role === 'project_manager'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : m.role === 'guest'
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : m.role === 'developer'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : m.role === 'team_member'
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {m.role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
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
                    {m.is_active ? (m.user?.is_online ? 'Online · Active' : 'Offline · Active') : 'Deactivated'}
                  </span>
                </td>
                {canManageMembers && (
                  <td className="py-3 px-4 text-right">
                    {m.role !== 'owner' &&
                      m.user_id !== user?.id &&
                      isOwner && (
                      <>
                      <button
                        onClick={() => handleMemberAccess(m)}
                        className={`mr-2 rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                          m.is_active
                            ? 'border-amber-800 text-amber-300 hover:bg-amber-950/50'
                            : 'border-emerald-800 text-emerald-300 hover:bg-emerald-950/50'
                        }`}
                      >
                        {m.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Remove Member"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                      </>
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
