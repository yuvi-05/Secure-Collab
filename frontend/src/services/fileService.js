import api from './api';

export const fileService = {
  async uploadFile(workspaceId, file, messageId = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (messageId) {
      formData.append('message_id', messageId);
    }
    return api.post(`/workspaces/${workspaceId}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  async listFiles(workspaceId, query = '') {
    return api.get(`/workspaces/${workspaceId}/files?q=${encodeURIComponent(query)}`);
  },
  async deleteFile(workspaceId, fileId) {
    return api.delete(`/workspaces/${workspaceId}/files/${fileId}`);
  },
  getDownloadUrl(workspaceId, fileId) {
    return `/api/workspaces/${workspaceId}/files/${fileId}/download`;
  },
  getPreviewUrl(workspaceId, fileId) {
    return `/api/workspaces/${workspaceId}/files/${fileId}/preview`;
  },
};
