import React from 'react';
import { CheckCheck, Bell, MessageSquare, AtSign, UserPlus, FolderArchive } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';

export const NotificationDropdown = ({ onClose }) => {
  const { notifications, unreadCount, markAllNotificationsRead, markNotificationRead } = useSocket();
  const navigate = useNavigate();

  const formatContent = (content) => {
    if (typeof content !== 'string') return '';
    const separator = content.indexOf(': ');
    if (separator === -1) return content;
    const prefix = content.slice(0, separator + 2);
    const payload = content.slice(separator + 2);
    try {
      const details = JSON.parse(payload);
      if (!details || typeof details !== 'object' || Array.isArray(details)) return content;
      return `${prefix}${Object.entries(details)
        .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${
          Array.isArray(value) ? value.join(', ') : String(value)
        }`)
        .join(' · ')}`;
    } catch {
      return content;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'mention':
        return <AtSign className="w-4 h-4 text-amber-400" />;
      case 'direct_message':
        return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'invitation':
        return <UserPlus className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const handleNotificationClick = (n) => {
    markNotificationRead(n.id);
    onClose();
    if (n.link) {
      // In-app navigation if link is internal
      if (n.link.startsWith('/')) {
        navigate(n.link);
      } else {
        window.location.href = n.link;
      }
    }
  };

  return (
    <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-[1000] animate-in fade-in zoom-in-95">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-sm text-slate-900 dark:text-slate-100">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsRead}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 font-medium transition-colors"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                n.is_read
                  ? 'hover:bg-slate-50 dark:hover:bg-slate-850 opacity-75'
                  : 'bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-medium'
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate">
                  {n.title}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {formatContent(n.content)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {!n.is_read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationDropdown;
