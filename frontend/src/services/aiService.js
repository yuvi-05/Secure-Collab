import api from './api';

export const aiService = {
  async listConversations(workspaceId, projectId = null) {
    const url = projectId 
      ? `/workspaces/${workspaceId}/ai/conversations?project_id=${projectId}`
      : `/workspaces/${workspaceId}/ai/conversations`;
    return api.get(url);
  },
  async getConversation(workspaceId, conversationId) {
    return api.get(`/workspaces/${workspaceId}/ai/conversations/${conversationId}`);
  },
  async chatWithAI(workspaceId, payload) {
    return api.post(`/workspaces/${workspaceId}/ai/chat`, payload);
  },
};
