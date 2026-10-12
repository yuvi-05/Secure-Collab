import api from './api';

export const messageService = {
  async getMessages(workspaceId, params = {}) {
    return api.get(`/workspaces/${workspaceId}/messages`, { params });
  },
  async sendMessage(workspaceId, data) {
    return api.post(`/workspaces/${workspaceId}/messages`, data);
  },
  async editMessage(workspaceId, messageId, content) {
    return api.put(`/workspaces/${workspaceId}/messages/${messageId}`, { content });
  },
  async deleteMessage(workspaceId, messageId) {
    return api.delete(`/workspaces/${workspaceId}/messages/${messageId}`);
  },
  async toggleReaction(workspaceId, messageId, emoji) {
    return api.post(`/workspaces/${workspaceId}/messages/${messageId}/reactions`, { emoji });
  },
  async listConversations(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/conversations`);
  },
  async startConversation(workspaceId, data) {
    return api.post(`/workspaces/${workspaceId}/conversations`, data);
  },
  async searchMessages(workspaceId, query) {
    return api.get(`/workspaces/${workspaceId}/messages/search?q=${encodeURIComponent(query || '')}`);
  },
};
