import React, { useState } from 'react';
import { Copy, Check, UserPlus } from 'lucide-react';
import Modal from '../common/Modal';
import { workspaceService } from '../../services/workspaceService';
import { useToast } from '../../contexts/ToastContext';

export const InviteModal = ({ isOpen, onClose, workspaceId, canAssignPrivilegedRoles = false }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('team_member');
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const assignedRole =
    !canAssignPrivilegedRoles && role === 'project_manager' ? 'team_member' : role;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await workspaceService.createInvitation(workspaceId, {
        email: email.trim(),
        role: assignedRole,
      });
      const link = `${window.location.origin}/invite/${res.data.invitation.token}`;
      setInviteLink(link);
      showToast('Invitation created successfully!', 'success');
      setEmail('');
    } catch (err) {
      showToast('Failed to create invitation: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    showToast('Invite link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Teammates to Workspace">
      <div className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Teammate's Email Address *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Assign Role
            </label>
            <select
              value={assignedRole}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="team_member">Team Member (Chat and view assigned projects)</option>
              <option value="developer">Developer (Collaborate and edit assigned projects)</option>
              <option value="guest">Guest (Read-only access to shared projects)</option>
              {canAssignPrivilegedRoles && (
                <option value="project_manager">Project Manager (Manage projects and project members)</option>
              )}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? 'Creating Invitation...' : 'Send Invitation / Generate Link'}
          </button>
        </form>

        {inviteLink && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 animate-in fade-in">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Shareable Direct Invitation Link:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-mono select-all focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white flex items-center gap-1.5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InviteModal;
