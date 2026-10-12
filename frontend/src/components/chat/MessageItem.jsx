import React, { useState } from 'react';
import {
  Smile,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import EmojiReactionPicker from './EmojiReactionPicker';

export const MessageItem = ({
  message,
  currentUserId,
  onReact,
  onOpenThread,
  onEdit,
  onDelete,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isAuthor = message.user_id === currentUserId;

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowPicker(false);
      }}
      className="group relative flex items-start gap-3 px-4 py-2 hover:bg-slate-800/40 transition-colors"
    >
      {/* User Avatar */}
      <Avatar
        name={message.user?.username || 'User'}
        src={message.user?.avatar_url}
        size="md"
        className="mt-0.5"
      />

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-slate-100">
            {message.user?.full_name || message.user?.username || 'Unknown'}
          </span>
          <span className="text-[11px] text-slate-500">
            {formatTimestamp(message.created_at)}
          </span>
          {message.is_edited && (
            <span className="text-[10px] text-slate-500 italic">(edited)</span>
          )}
        </div>

        {/* Content or Edit Form */}
        {isEditing ? (
          <form onSubmit={handleEditSubmit} className="mt-1">
            <input
              type="text"
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-slate-900 border border-indigo-500 rounded-lg text-white focus:outline-none"
            />
            <div className="flex items-center gap-2 mt-1.5 text-xs">
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-indigo-600 text-white font-medium"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-slate-200 mt-0.5 whitespace-pre-wrap break-words leading-relaxed select-text">
            {message.content}
          </div>
        )}

        {/* File Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => {
              const isImage = att.content_type?.startsWith('image/');
              return (
                <div
                  key={att.id}
                  className="rounded-xl border border-slate-700/80 bg-slate-800/80 overflow-hidden max-w-xs"
                >
                  {isImage ? (
                    <a href={att.download_url} target="_blank" rel="noreferrer" className="block">
                      <img
                        src={att.preview_url}
                        alt={att.filename}
                        className="max-h-48 w-auto object-cover rounded-t-xl"
                      />
                    </a>
                  ) : null}
                  <div className="p-2 flex items-center justify-between gap-2 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate">{att.filename}</span>
                    </div>
                    <a
                      href={att.download_url}
                      download
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.reactions.map((rxn, idx) => (
              <button
                key={idx}
                onClick={() => onReact(message.id, rxn.emoji)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${
                  rxn.reacted_by_me
                    ? 'bg-indigo-900/40 border-indigo-600 text-indigo-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
                title={rxn.users?.join(', ')}
              >
                <span>{rxn.emoji}</span>
                <span className="text-[11px] font-semibold">{rxn.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Thread replies trigger badge */}
        {message.reply_count > 0 && (
          <button
            onClick={() => onOpenThread(message)}
            className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              {message.reply_count} {message.reply_count === 1 ? 'reply' : 'replies'}
            </span>
          </button>
        )}
      </div>

      {/* Floating Action Menu Bar on Hover */}
      {showActions && (
        <div className="absolute top-1 right-4 flex items-center bg-slate-800 border border-slate-700 rounded-xl shadow-lg p-0.5 text-slate-400 z-10 animate-in fade-in zoom-in-95">
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              onClick={() => setShowPicker(!showPicker)}
              title="Add Reaction"
              className="p-1.5 rounded-lg hover:bg-slate-700 hover:text-amber-400 transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>
            {showPicker && (
              <EmojiReactionPicker
                onSelect={(emoji) => onReact(message.id, emoji)}
                onClose={() => setShowPicker(false)}
              />
            )}
          </div>

          {/* Reply in Thread Button */}
          <button
            onClick={() => onOpenThread(message)}
            title="Reply in thread"
            className="p-1.5 rounded-lg hover:bg-slate-700 hover:text-indigo-400 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Edit Button (author only) */}
          {isAuthor && (
            <button
              onClick={() => setIsEditing(true)}
              title="Edit message"
              className="p-1.5 rounded-lg hover:bg-slate-700 hover:text-slate-200 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete Button (author or admin) */}
          {(isAuthor || currentUserId === 1) && (
            <button
              onClick={() => onDelete(message.id)}
              title="Delete message"
              className="p-1.5 rounded-lg hover:bg-rose-900/60 hover:text-rose-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageItem;
