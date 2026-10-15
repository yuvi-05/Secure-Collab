import React, { useState } from 'react';
import { Check, LogOut, Plus } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Avatar from '../common/Avatar';

export const ProfileModal = ({ isOpen, onClose, editable = true, showSignOut = false }) => {
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [loading, setLoading] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '' });

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Profile images must be 2 MB or smaller.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.onerror = () => showToast('Could not read the selected image.', 'error');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile({
        username: username.trim(),
        full_name: fullName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl.trim(),
      });
      if (passwords.current || passwords.next) {
        await changePassword({
          current_password: passwords.current,
          new_password: passwords.next,
        });
        setPasswords({ current: '', next: '' });
      }
      showToast('Profile updated successfully!', 'success');
      onClose();
    } catch (err) {
      showToast('Error updating profile: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editable ? 'User Profile & Account' : 'Account'}>
      <div className="space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
          <div className="relative shrink-0">
            <Avatar
              name={user?.username}
              src={avatarUrl || user?.avatar_url}
              size="lg"
              isOnline={user?.is_online}
            />
            {editable && (
              <label
                htmlFor="profile-avatar-upload"
                title="Add profile picture"
                className="absolute -bottom-1 -right-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-slate-950 bg-indigo-600 text-white shadow-lg hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" />
                <input
                  id="profile-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="sr-only"
                />
              </label>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-white truncate">
              {fullName || user?.username}
            </h4>
            <p className="text-xs text-slate-400">@{user?.username}</p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {!editable ? (
          <div className="flex items-center justify-center gap-3 border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/50"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        ) : (
        /* Profile Form */
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Username ({Math.max(0, 3 - (user?.username_changes_count || 0))} changes remaining)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={user?.username_changes_count >= 3}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">About Me / Bio</label>
            <textarea
              rows="2"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-3 border-t border-slate-800 pt-3">
            <p className="text-xs font-semibold text-slate-300">Change Password</p>
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords((value) => ({ ...value, current: e.target.value }))}
              placeholder="Current password"
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
            <input
              type="password"
              value={passwords.next}
              onChange={(e) => setPasswords((value) => ({ ...value, next: e.target.value }))}
              placeholder="New password (minimum 6 characters)"
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white"
            />
          </div>

          <div className="flex items-center justify-center gap-3 pt-3 border-t border-slate-800">
            {showSignOut && <button
              type="button"
              onClick={logout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/50 hover:text-rose-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>}
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
        )}
      </div>
    </Modal>
  );
};

export default ProfileModal;
