import React, { useState } from 'react';
import { User, LogOut, Check } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Avatar from '../common/Avatar';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile, logout } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim(),
      });
      showToast('Profile updated successfully!', 'success');
      onClose();
    } catch (err) {
      showToast('Error updating profile: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="User Profile & Account">
      <div className="space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
          <Avatar
            name={user?.username}
            src={avatarUrl || user?.avatar_url}
            size="lg"
            isOnline={user?.is_online}
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-white truncate">
              {fullName || user?.username}
            </h4>
            <p className="text-xs text-slate-400">@{user?.username}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Avatar Image URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">About Me / Bio</label>
            <textarea
              rows="2"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default ProfileModal;
