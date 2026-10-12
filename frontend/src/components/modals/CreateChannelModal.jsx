import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useToast } from '../../contexts/ToastContext';

export const CreateChannelModal = ({ isOpen, onClose }) => {
  const { createChannel } = useWorkspace();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      await createChannel({
        name: name.trim().toLowerCase().replace(/\s+/g, '-'),
        topic: topic.trim(),
        description: description.trim(),
        is_private: isPrivate,
      });
      setName('');
      setTopic('');
      setDescription('');
      setIsPrivate(false);
      onClose();
    } catch (err) {
      showToast('Error creating channel: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a Channel">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Channel Name *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-slate-500 font-bold">#</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. backend-api, announcements"
              className="w-full pl-7 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What is this channel about?"
            className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700">
          <input
            type="checkbox"
            id="isPrivate"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-indigo-600 focus:ring-0"
          />
          <label htmlFor="isPrivate" className="text-xs text-slate-300 cursor-pointer">
            <span className="font-semibold block text-white">Make channel private</span>
            When private, only invited members can access and view messages.
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Channel'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateChannelModal;
