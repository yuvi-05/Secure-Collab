import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { workspaceService } from '../services/workspaceService';
import { channelService } from '../services/channelService';
import { projectService } from '../services/projectService';
import { messageService } from '../services/messageService';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import socketClient from '../socket/socketClient';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [channels, setChannels] = useState([]);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [viewMode, setViewMode] = useState('chat'); // 'chat' | 'project' | 'files' | 'members'
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({ channels: {}, conversations: {} });

  // Real-time unread messages tracking across channels and DMs
  useEffect(() => {
    const handleChannelNotif = (msg) => {
      if (!msg?.channel_id) return;
      if (currentChannel?.id !== msg.channel_id) {
        setUnreadCounts((prev) => ({
          ...prev,
          channels: {
            ...prev.channels,
            [msg.channel_id]: (prev.channels[msg.channel_id] || 0) + 1,
          },
        }));
      }
    };

    const handleDmNotif = (msg) => {
      if (!msg?.conversation_id) return;
      if (currentConversation?.id !== msg.conversation_id) {
        setUnreadCounts((prev) => ({
          ...prev,
          conversations: {
            ...prev.conversations,
            [msg.conversation_id]: (prev.conversations[msg.conversation_id] || 0) + 1,
          },
        }));
      }
    };

    socketClient.on('channel_message_notification', handleChannelNotif);
    socketClient.on('dm_message_notification', handleDmNotif);

    return () => {
      socketClient.off('channel_message_notification', handleChannelNotif);
      socketClient.off('dm_message_notification', handleDmNotif);
    };
  }, [currentChannel?.id, currentConversation?.id]);

  // Load all workspaces on login
  const loadWorkspaces = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await workspaceService.listWorkspaces();
      const list = res.data?.workspaces || [];
      setWorkspaces(list);

      // Auto-select first workspace or restored workspace
      const savedId = localStorage.getItem('active_workspace_id');
      const target = list.find((w) => String(w.id) === savedId) || list[0];
      if (target) {
        selectWorkspace(target.id, false);
      } else {
        setCurrentWorkspace(null);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const selectWorkspace = async (workspaceId, switchView = true) => {
    try {
      const res = await workspaceService.getWorkspace(workspaceId);
      const ws = res.data.workspace;
      setCurrentWorkspace(ws);
      setChannels(ws.channels || []);
      localStorage.setItem('active_workspace_id', String(workspaceId));

      // Join workspace room for events
      socketClient.joinRoom(`workspace_${workspaceId}`);

      // Load projects and conversations in this workspace
      const [projRes, convRes] = await Promise.all([
        projectService.listProjects(workspaceId),
        messageService.listConversations(workspaceId),
      ]);
      setProjects(projRes.data?.projects || []);
      setConversations(convRes.data?.conversations || []);

      // Default to #general or first channel
      const general = (ws.channels || []).find((c) => c.name === 'general') || (ws.channels || [])[0];
      if (general && switchView) {
        selectChannel(general);
      }
    } catch (err) {
      showToast('Could not load workspace details: ' + err.message, 'error');
    }
  };

  const selectChannel = (channel) => {
    if (currentChannel) {
      socketClient.leaveRoom(`channel_${currentChannel.id}`);
    }
    setCurrentChannel(channel);
    setCurrentConversation(null);
    setCurrentProject(null);
    setViewMode('chat');
    if (channel) {
      setUnreadCounts((prev) => ({
        ...prev,
        channels: { ...prev.channels, [channel.id]: 0 },
      }));
      socketClient.joinRoom(`channel_${channel.id}`);
    }
  };

  const selectConversation = (conv) => {
    if (currentChannel) {
      socketClient.leaveRoom(`channel_${currentChannel.id}`);
    }
    if (currentConversation) {
      socketClient.leaveRoom(`conversation_${currentConversation.id}`);
    }
    setCurrentConversation(conv);
    setCurrentChannel(null);
    setCurrentProject(null);
    setViewMode('chat');
    if (conv) {
      setUnreadCounts((prev) => ({
        ...prev,
        conversations: { ...prev.conversations, [conv.id]: 0 },
      }));
      socketClient.joinRoom(`conversation_${conv.id}`);
    }
  };

  const selectProject = (project) => {
    if (currentChannel) {
      socketClient.leaveRoom(`channel_${currentChannel.id}`);
    }
    if (currentConversation) {
      socketClient.leaveRoom(`conversation_${currentConversation.id}`);
    }
    setCurrentProject(project);
    setCurrentChannel(null);
    setCurrentConversation(null);
    setViewMode('project');
    if (project) {
      socketClient.joinRoom(`project_${project.id}`);
    }
  };

  const refreshCurrentWorkspace = async () => {
    if (currentWorkspace) {
      await selectWorkspace(currentWorkspace.id, false);
    }
  };

  const createChannel = async (data) => {
    if (!currentWorkspace) return;
    const res = await channelService.createChannel(currentWorkspace.id, data);
    const newChan = res.data.channel;
    setChannels((prev) => [...prev, newChan]);
    selectChannel(newChan);
    showToast(`Channel #${newChan.name} created!`, 'success');
    return newChan;
  };

  const createProject = async (data) => {
    if (!currentWorkspace) return;
    const res = await projectService.createProject(currentWorkspace.id, data);
    const newProj = res.data.project;
    setProjects((prev) => [newProj, ...prev]);
    selectProject(newProj);
    showToast(`Project '${newProj.name}' created!`, 'success');
    return newProj;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        channels,
        currentChannel,
        conversations,
        currentConversation,
        projects,
        currentProject,
        viewMode,
        loading,
        loadWorkspaces,
        selectWorkspace,
        selectChannel,
        selectConversation,
        selectProject,
        setViewMode,
        refreshCurrentWorkspace,
        createChannel,
        createProject,
        setConversations,
        unreadCounts,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
