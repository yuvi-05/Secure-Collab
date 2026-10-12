import api from './api';

export const notificationService = {
  async listNotifications() {
    return api.get('/notifications');
  },
  async getUnreadCount() {
    return api.get('/notifications/unread-count');
  },
  async markRead(id) {
    return api.put(`/notifications/${id}/read`);
  },
  async markAllRead() {
    return api.post('/notifications/read-all');
  },
};
