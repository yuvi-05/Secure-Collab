import api from './api';

export const projectService = {
  async listProjects(workspaceId) {
    return api.get(`/workspaces/${workspaceId}/projects`);
  },
  async createProject(workspaceId, data) {
    return api.post(`/workspaces/${workspaceId}/projects`, data);
  },
  async getProject(workspaceId, projectId) {
    return api.get(`/workspaces/${workspaceId}/projects/${projectId}`);
  },
  async getFiles(workspaceId, projectId) {
    return api.get(`/workspaces/${workspaceId}/projects/${projectId}/files`);
  },
  async createFile(workspaceId, projectId, data) {
    return api.post(`/workspaces/${workspaceId}/projects/${projectId}/files`, data);
  },
  async getFileContent(workspaceId, projectId, fileId) {
    return api.get(`/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}`);
  },
  async updateFile(workspaceId, projectId, fileId, data) {
    return api.put(`/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}`, data);
  },
  async deleteFile(workspaceId, projectId, fileId) {
    return api.delete(`/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}`);
  },
  async getYjsState(workspaceId, projectId, fileId) {
    return api.get(`/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}/yjs-state`);
  },
  async saveYjsState(workspaceId, projectId, fileId, data) {
    return api.post(`/workspaces/${workspaceId}/projects/${projectId}/files/${fileId}/yjs-state`, data);
  },
};
