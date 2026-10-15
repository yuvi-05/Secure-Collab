import React, { useState } from 'react';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import ChatArea from '../chat/ChatArea';
import CodeWorkspace from '../editor/CodeWorkspace';
import FileManager from '../files/FileManager';
import MembersManager from '../workspace/MembersManager';
import WorkspaceAdminPanel from '../workspace/WorkspaceAdminPanel';
import CreateChannelModal from '../modals/CreateChannelModal';
import CreateProjectModal from '../modals/CreateProjectModal';
import StartDMModal from '../modals/StartDMModal';
import InviteModal from '../modals/InviteModal';
import ProfileModal from '../modals/ProfileModal';
import SearchModal from '../modals/SearchModal';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronRight } from 'lucide-react';

export const AppLayout = () => {
  const {
    currentWorkspace,
    currentChannel,
    currentConversation,
    currentProject,
    viewMode,
  } = useWorkspace();
  const { user } = useAuth();
  const [navigationVisible, setNavigationVisible] = useState(true);

  // Modals state
  const [modalState, setModalState] = useState({
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
    <div className="relative flex h-screen w-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={`relative h-full shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
          navigationVisible ? 'w-80' : 'w-0'
        }`}
      >
        <div className="flex h-full w-80">
          <WorkspaceSwitcher
            onOpenProfile={() => openModal('profile')}
            onToggleNavigation={() => setNavigationVisible(false)}
            navigationVisible={navigationVisible}
          />
          <Sidebar
            onOpenCreateChannel={() => openModal('createChannel')}
            onOpenCreateProject={() => openModal('createProject')}
            onOpenStartDM={() => openModal('startDM')}
            onOpenInvite={() => openModal('invite')}
            onOpenWorkspaceSettings={() => openModal('invite')}
          />
        </div>
      </div>
      {!navigationVisible && (
        <button
          type="button"
          onClick={() => setNavigationVisible(true)}
          aria-label="Show workspace navigation"
          title="Show workspace navigation"
          className="absolute left-0 top-3 z-30 flex h-9 w-7 items-center justify-center rounded-r-lg border border-slate-300 bg-white text-slate-600 shadow-md transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

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
              effectiveRole={
                currentWorkspace?.my_emergency_access?.project_ids?.includes(currentProject.id)
                  ? currentWorkspace.my_emergency_access.requested_role
                  : currentWorkspace?.my_role
              }
              readOnly={['guest', 'team_member'].includes(
                currentWorkspace?.my_emergency_access?.project_ids?.includes(currentProject.id)
                  ? currentWorkspace.my_emergency_access.requested_role
                  : currentWorkspace?.my_role
              )}
            />
          ) : viewMode === 'files' ? (
            <FileManager
              workspaceId={currentWorkspace?.id}
              readOnly={currentWorkspace?.my_role === 'guest' || currentWorkspace?.my_role === 'team_member'}
            />
          ) : viewMode === 'members' ? (
            <MembersManager
              workspaceId={currentWorkspace?.id}
              onOpenInvite={() => openModal('invite')}
            />
          ) : viewMode === 'admin' && currentWorkspace?.my_role === 'owner' ? (
            <WorkspaceAdminPanel workspaceId={currentWorkspace?.id} />
          ) : (
            <ChatArea
              workspaceId={currentWorkspace?.id}
              channel={currentChannel}
              conversation={currentConversation}
              readOnly={currentWorkspace?.my_role === 'guest'}
            />
          )}
        </main>
      </div>

      {/* Modals */}
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
        canAssignPrivilegedRoles={currentWorkspace?.my_role === 'owner'}
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
