import React, { useState } from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import ChatArea from '../chat/ChatArea';
import CodeWorkspace from '../editor/CodeWorkspace';
import FileManager from '../files/FileManager';
import MembersManager from '../workspace/MembersManager';
import CreateWorkspaceModal from '../modals/CreateWorkspaceModal';
import CreateChannelModal from '../modals/CreateChannelModal';
import CreateProjectModal from '../modals/CreateProjectModal';
import StartDMModal from '../modals/StartDMModal';
import InviteModal from '../modals/InviteModal';
import ProfileModal from '../modals/ProfileModal';
import SearchModal from '../modals/SearchModal';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';

export const AppLayout = () => {
  const {
    currentWorkspace,
    currentChannel,
    currentConversation,
    currentProject,
    viewMode,
  } = useWorkspace();
  const { user } = useAuth();

  // Modals state
  const [modalState, setModalState] = useState({
    createWorkspace: false,
    createChannel: false,
    createProject: false,
    startDM: false,
    invite: false,
    profile: false,
    search: false,
  });

  const openModal = (name) => setModalState((prev) => ({ ...prev, [name]: true }));
  const closeModal = (name) => setModalState((prev) => ({ ...prev, [name]: false }));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 1. Workspace Switcher (Slack-style left rail) */}
      <WorkspaceSwitcher
        onOpenCreateWorkspace={() => openModal('createWorkspace')}
        onOpenProfile={() => openModal('profile')}
      />

      {/* 2. Workspace Channels & Projects Sidebar */}
      <Sidebar
        onOpenCreateChannel={() => openModal('createChannel')}
        onOpenCreateProject={() => openModal('createProject')}
        onOpenStartDM={() => openModal('startDM')}
        onOpenInvite={() => openModal('invite')}
        onOpenWorkspaceSettings={() => openModal('invite')}
      />

      {/* 3. Main Center Content + TopNav */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <TopNav
          onOpenSearch={() => openModal('search')}
          onOpenProfile={() => openModal('profile')}
        />

        {/* Dynamic Main Body Content */}
        <main className="flex-1 flex overflow-hidden">
          {viewMode === 'project' && currentProject ? (
            <CodeWorkspace
              workspaceId={currentWorkspace?.id}
              project={currentProject}
            />
          ) : viewMode === 'files' ? (
            <FileManager workspaceId={currentWorkspace?.id} />
          ) : viewMode === 'members' ? (
            <MembersManager
              workspaceId={currentWorkspace?.id}
              onOpenInvite={() => openModal('invite')}
            />
          ) : (
            <ChatArea
              workspaceId={currentWorkspace?.id}
              channel={currentChannel}
              conversation={currentConversation}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={modalState.createWorkspace}
        onClose={() => closeModal('createWorkspace')}
      />
      <CreateChannelModal
        isOpen={modalState.createChannel}
        onClose={() => closeModal('createChannel')}
      />
      <CreateProjectModal
        isOpen={modalState.createProject}
        onClose={() => closeModal('createProject')}
      />
      <StartDMModal
        isOpen={modalState.startDM}
        onClose={() => closeModal('startDM')}
        workspaceId={currentWorkspace?.id}
        currentUserId={user?.id}
      />
      <InviteModal
        isOpen={modalState.invite}
        onClose={() => closeModal('invite')}
        workspaceId={currentWorkspace?.id}
      />
      <ProfileModal
        isOpen={modalState.profile}
        onClose={() => closeModal('profile')}
      />
      <SearchModal
        isOpen={modalState.search}
        onClose={() => closeModal('search')}
        workspaceId={currentWorkspace?.id}
      />
    </div>
  );
};

export default AppLayout;
