import api from './api';

export const channelService = {
  async createChannel(workspaceId, data) {
    return api.post(`/workspaces/${workspaceId}/channels`, data);
  },
  async getChannel(workspaceId, channelId) {
    return api.get(`/workspaces/${workspaceId}/channels/${channelId}`);
  },
  async updateChannel(workspaceId, channelId, data) {
    return api.put(`/workspaces/${workspaceId}/channels/${channelId}`, data);
  },
  async deleteChannel(workspaceId, channelId) {
    return api.delete(`/workspaces/${workspaceId}/channels/${channelId}`);
  },
  async getMembers(workspaceId, channelId) {
    return api.get(`/workspaces/${workspaceId}/channels/${channelId}/members`);
  },
  async addMember(workspaceId, channelId, userId) {
    return api.post(`/workspaces/${workspaceId}/channels/${channelId}/members`, { user_id: userId });
  },
  async removeMember(workspaceId, channelId, userId) {
    return api.delete(`/workspaces/${workspaceId}/channels/${channelId}/members/${userId}`);
  },
};
