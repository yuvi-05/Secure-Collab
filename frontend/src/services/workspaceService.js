import api from './api';

export const workspaceService = {
  async listWorkspaces() {
    return api.get('/workspaces');
  },
  async createWorkspace(data) {
    return api.post('/workspaces', data);
  },
  async getWorkspace(id) {
    return api.get(`/workspaces/${id}`);
  },
  async updateWorkspace(id, data) {
    return api.put(`/workspaces/${id}`, data);
  },
  async deleteWorkspace(id) {
    return api.delete(`/workspaces/${id}`);
  },
  async getMembers(id) {
    return api.get(`/workspaces/${id}/members`);
  },
  async addMember(id, data) {
    return api.post(`/workspaces/${id}/members`, data);
  },
  async updateMemberRole(workspaceId, userId, role) {
    return api.put(`/workspaces/${workspaceId}/members/${userId}`, { role });
  },
  async removeMember(workspaceId, userId) {
    return api.delete(`/workspaces/${workspaceId}/members/${userId}`);
  },
  async createInvitation(workspaceId, data) {
    return api.post(`/workspaces/${workspaceId}/invitations`, data);
  },
  async joinViaToken(token) {
    return api.post(`/workspaces/join/${token}`);
  },
};
