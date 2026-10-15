import React, { useEffect, useRef, useState } from 'react';
import { Search, Bell, Hash, Lock, Code2, Users, FolderArchive, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import NotificationDropdown from '../notifications/NotificationDropdown';

export const TopNav = ({ onOpenSearch, onOpenProfile, navigationVisible }) => {
  const { currentWorkspace, currentChannel, currentConversation, currentProject, viewMode } = useWorkspace();
  const { user } = useAuth();
  const { unreadCount } = useSocket();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showNotifications]);

  const getHeaderTitle = () => {
    if (viewMode === 'files') return { icon: <FolderArchive className="w-5 h-5 text-indigo-400" />, title: 'Workspace Files' };
    if (viewMode === 'members') return { icon: <Users className="w-5 h-5 text-indigo-400" />, title: 'Members & Roles' };
    if (viewMode === 'admin') return { icon: <ShieldCheck className="w-5 h-5 text-indigo-400" />, title: 'Workspace Administration' };
    if (viewMode === 'project' && currentProject) {
      return { icon: <Code2 className="w-5 h-5 text-emerald-400" />, title: currentProject.name };
    }
    if (currentChannel) {
      return {
        icon: currentChannel.is_private ? <Lock className="w-4 h-4 text-amber-400" /> : <Hash className="w-5 h-5 text-slate-400" />,
        title: currentChannel.name,
        subtitle: currentChannel.topic,
      };
    }
    if (currentConversation) {
      return {
        icon: <Users className="w-4 h-4 text-indigo-400" />,
        title: currentConversation.title,
      };
    }
    return { icon: null, title: navigationVisible ? '' : (currentWorkspace?.name || 'Secure-Collab') };
  };

  const header = getHeaderTitle();

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-[100]">
      {/* Left Title Badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        {header.icon}
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
          {header.title}
        </h2>
        {header.subtitle && (
          <span className="hidden md:inline-block text-xs text-slate-400 truncate max-w-md border-l border-slate-700 pl-2.5">
            {header.subtitle}
          </span>
        )}
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all text-left"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1">Search messages, files, or teammates...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div ref={notificationRef} className="relative z-[100]">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <NotificationDropdown onClose={() => setShowNotifications(false)} />
          )}
        </div>

        {/* User Mini Profile */}
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800 hover:opacity-80 transition-opacity"
        >
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {user?.username}
          </span>
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center overflow-hidden ring-1 ring-white/10">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (user?.username?.[0] || 'U').toUpperCase()
            )}
          </div>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
