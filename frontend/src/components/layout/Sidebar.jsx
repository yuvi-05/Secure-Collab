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
  ShieldCheck,
  Trash2,
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
    unreadCounts,
    deleteProject,
    deleteConversation,
    clearActiveView,
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

  const isPersonalWorkspace = currentWorkspace.is_personal;
  const canInviteMembers = currentWorkspace.my_role === 'owner' && !isPersonalWorkspace;
  const canCreateProject = ['owner', 'project_manager'].includes(currentWorkspace.my_role);
  const canDeleteProject = ['owner', 'project_manager'].includes(currentWorkspace.my_role);
  const canCreateChannel = currentWorkspace.my_role === 'owner' && !isPersonalWorkspace;
  const isGuest = currentWorkspace.my_role === 'guest';

  return (
    <aside className="w-64 h-full bg-slate-900/95 dark:bg-slate-900 border-r border-slate-800 flex flex-col select-none z-10 shrink-0">
      {/* Workspace Header Dropdown */}
      <div className="relative h-14 px-4 border-b border-slate-800 flex items-center justify-between">
        <button
          onClick={() => canInviteMembers && setShowWsMenu(!showWsMenu)}
          className="flex items-center gap-2 font-bold text-slate-100 hover:text-white truncate text-left flex-1"
        >
          <span className="truncate">{currentWorkspace.name}</span>
          {canInviteMembers && (
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showWsMenu ? 'rotate-180' : ''}`} />
          )}
        </button>

        {showWsMenu && canInviteMembers && (
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
          </div>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-6 text-sm text-slate-300">
        {/* Quick Nav Tools */}
        <div className="space-y-0.5">
          {currentWorkspace.my_role === 'owner' && !isPersonalWorkspace && (
            <button
              onClick={() => {
                clearActiveView();
                setViewMode('admin');
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
                viewMode === 'admin'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Workspace Administration</span>
            </button>
          )}
          {!isPersonalWorkspace && <button
            onClick={() => {
              clearActiveView();
              setViewMode('files');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'files'
                ? 'bg-indigo-600 text-white font-medium'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <FolderArchive className="w-4 h-4" />
            <span>Workspace Files</span>
          </button>}
          {!isPersonalWorkspace && <button
            onClick={() => {
              clearActiveView();
              setViewMode('members');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'members'
                ? 'bg-indigo-600 text-white font-medium'
                : 'hover:bg-slate-800/80 text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Members & Roles</span>
          </button>}
        </div>

        {/* Channels Section */}
        <div className={isPersonalWorkspace ? 'hidden' : ''}>
          <div className="flex items-center justify-between px-3 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <span>Channels</span>
            {canCreateChannel && <button
              onClick={onOpenCreateChannel}
              title="Create Channel"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>}
          </div>
          <div className="space-y-0.5">
            {channels.map((ch) => {
              const isActive = viewMode === 'chat' && currentChannel?.id === ch.id;
              const unread = unreadCounts?.channels?.[ch.id] || 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => selectChannel(ch)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {ch.is_private ? (
                      <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    ) : (
                      <Hash className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    )}
                    <span className="truncate">{ch.name}</span>
                  </div>
                  {unread > 0 && !isActive && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white leading-none shrink-0 shadow-sm">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <span>Direct Messages</span>
            {!isGuest && <button
              onClick={onOpenStartDM}
              title="Start Direct Message"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>}
          </div>
          <div className="space-y-0.5">
            {conversations.map((conv) => {
              const isActive = viewMode === 'chat' && currentConversation?.id === conv.id;
              const unread = unreadCounts?.conversations?.[conv.id] || 0;
              // Find other member
              const otherMember = conv.members?.find((m) => m.user_id !== user?.id)?.user;
              const isOtherOnline = otherMember ? onlineUsers.get(otherMember.id) : false;

              return (
                <div
                  key={conv.id}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectConversation(conv)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 truncate text-left"
                  >
                    <Avatar
                      name={conv.title || otherMember?.username}
                      src={otherMember?.avatar_url}
                      size="xs"
                      isOnline={isOtherOnline}
                    />
                    <span className="truncate">{conv.title || otherMember?.full_name || 'DM'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (window.confirm('Delete this chat and all of its messages? This cannot be undone.')) {
                        deleteConversation(conv.id).catch((error) => {
                          window.alert(`Chat could not be deleted: ${error.message}`);
                        });
                      }
                    }}
                    aria-label={`Delete chat ${conv.title || otherMember?.username || 'Direct Message'}`}
                    title="Delete chat"
                    className="ml-1 rounded p-1 text-slate-500 hover:bg-rose-950/50 hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {unread > 0 && !isActive && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-full bg-indigo-500 text-[10px] font-bold text-white leading-none shrink-0 shadow-sm">
                      {unread}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Coding Workspaces & Projects */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            <span>Coding Projects</span>
            {canCreateProject && <button
              onClick={onOpenCreateProject}
              title="Create Coding Project"
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>}
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
                  {canDeleteProject && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`Delete "${proj.name}"? This cannot be undone.`)) {
                          deleteProject(proj.id).catch((error) => {
                            window.alert(`Project could not be deleted: ${error.message}`);
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') event.currentTarget.click();
                      }}
                      className="ml-auto rounded p-1 text-slate-500 hover:bg-rose-950/50 hover:text-rose-400"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
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
