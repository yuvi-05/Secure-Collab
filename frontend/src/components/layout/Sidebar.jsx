import React, { useState } from 'react';
import {
  Hash,
  Lock,
  Plus,
  Code2,
  FolderArchive,
  Users,
  ChevronDown,
  UserPlus,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import Avatar from '../common/Avatar';

export const Sidebar = ({
  onOpenCreateChannel,
  onOpenCreateProject,
  onOpenStartDM,
  onOpenInvite,
  onOpenWorkspaceSettings,
}) => {
  const {
    currentWorkspace,
    channels,
    currentChannel,
    selectChannel,
    conversations,
    currentConversation,
    selectConversation,
    projects,
    currentProject,
    selectProject,
    viewMode,
    setViewMode,
  } = useWorkspace();

  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [showWsMenu, setShowWsMenu] = useState(false);

  if (!currentWorkspace) {
    return (
      <div className="w-64 h-full bg-slate-900 border-r border-slate-800 flex items-center justify-center text-slate-500 text-sm">
        Select a workspace
      </div>
    );
  }

  const isOwnerOrAdmin = currentWorkspace.my_role === 'owner' || currentWorkspace.my_role === 'admin';

  return (
    <aside className="w-64 h-full bg-slate-900/95 dark:bg-slate-900 border-r border-slate-800 flex flex-col select-none z-10 shrink-0">
      {/* Workspace Header Dropdown */}
      <div className="relative h-14 px-4 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={() => setShowWsMenu(!showWsMenu)}
          className="flex items-center gap-2 font-bold text-slate-100 hover:text-white truncate text-left flex-1"
        >
          <span className="truncate">{currentWorkspace.name}</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showWsMenu ? 'rotate-180' : ''}`} />
        </button>

        {showWsMenu && (
          <div
            className="absolute top-14 left-2 right-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 flex flex-col gap-1 text-sm animate-in fade-in zoom-in-95"
            onClick={() => setShowWsMenu(false)}
          >
            <button
              onClick={onOpenInvite}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700/80 hover:text-white text-left transition-colors"
            >
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Invite Teammates
            </button>
            {isOwnerOrAdmin && (
              <button
                onClick={onOpenWorkspaceSettings}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-200 hover:bg-slate-700/80 hover:text-white text-left transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                Workspace Settings
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6 text-sm text-slate-300">
        {/* Quick Nav Tools */}
        <div className="space-y-0.5">
          <button
            onClick={() => setViewMode('files')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'files'
                ? 'bg-indigo-600 text-white font-medium'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Workspace Files</span>
          </button>
          <button
            onClick={() => setViewMode('members')}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'members'
                ? 'bg-indigo-600 text-white font-medium'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members & Roles</span>
          </button>
        </div>

        {/* Channels Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <span>Channels</span>
            <button
              onClick={onOpenCreateChannel}
              title="Create Channel"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {channels.map((ch) => {
              const isActive = viewMode === 'chat' && currentChannel?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => selectChannel(ch)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  {ch.is_private ? (
                    <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  ) : (
                    <Hash className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  )}
                  <span className="truncate">{ch.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <span>Direct Messages</span>
            <button
              onClick={onOpenStartDM}
              title="Start Direct Message"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {conversations.map((conv) => {
              const isActive = viewMode === 'chat' && currentConversation?.id === conv.id;
              // Find other member
              const otherMember = conv.members?.find((m) => m.user_id !== user?.id)?.user;
              const isOtherOnline = otherMember ? onlineUsers.get(otherMember.id) : false;

              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <Avatar
                    name={conv.title || otherMember?.username}
                    src={otherMember?.avatar_url}
                    size="xs"
                    isOnline={isOtherOnline}
                  />
                  <span className="truncate">{conv.title || otherMember?.full_name || 'DM'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Coding Workspaces & Projects */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <span>Coding Projects</span>
            <button
              onClick={onOpenCreateProject}
              title="Create Coding Project"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {projects.map((proj) => {
              const isActive = viewMode === 'project' && currentProject?.id === proj.id;
              return (
                <button
                  key={proj.id}
                  onClick={() => selectProject(proj)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <Code2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{proj.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
