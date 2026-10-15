import api from './api';

export const workspaceService = {
  async listWorkspaces() {
    return api.get('/workspaces');
  },
  async listAdminWorkspaces() {
    return api.get('/workspaces/admin/workspaces');
  },
  async listAdminUsers() {
    return api.get('/workspaces/admin/users');
  },
  async updateWorkspaceOwner(workspaceId, ownerId) {
    return api.put(`/workspaces/${workspaceId}/owner`, { owner_id: ownerId });
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
  async updateMember(workspaceId, userId, changes) {
    return api.put(`/workspaces/${workspaceId}/members/${userId}`, changes);
  },
  async getAdminSummary(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/admin`);
  },
  async updateProjectStatus(workspaceId, projectId, isActive) {
    return api.patch(`/workspaces/${workspaceId}/admin/projects/${projectId}`, { is_active: isActive });
  },
  async updateEmergencyAccessPolicy(workspaceId, maxHours) {
    return api.put(`/workspaces/${workspaceId}/admin/emergency-access-policy`, { max_hours: maxHours });
  },
  async removeMember(workspaceId, userId) {
    return api.delete(`/workspaces/${workspaceId}/members/${userId}`);
  },
  async listEmergencyAccess(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/emergency-access`);
  },
  async listEmergencyAccessProjects(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/emergency-access/projects`);
  },
  async requestEmergencyAccess(workspaceId, reason, requestedRole, projectIds) {
    return api.post(`/workspaces/${workspaceId}/emergency-access`, {
      reason,
      requested_role: requestedRole,
      project_ids: projectIds,
    });
  },
  async approveEmergencyAccess(workspaceId, requestId, durationHours) {
    return api.post(`/workspaces/${workspaceId}/emergency-access/${requestId}/approve`, {
      duration_hours: durationHours,
    });
  },
  async denyEmergencyAccess(workspaceId, requestId) {
    return api.post(`/workspaces/${workspaceId}/emergency-access/${requestId}/deny`);
  },
  async revokeEmergencyAccess(workspaceId, requestId) {
    return api.delete(`/workspaces/${workspaceId}/emergency-access/${requestId}`);
  },
  async createInvitation(workspaceId, data) {
    return api.post(`/workspaces/${workspaceId}/invitations`, data);
  },
  async joinViaToken(token) {
    return api.post(`/workspaces/join/${token}`);
  },
};
