import api from './api';

export const authService = {
  async register(data) {
    return api.post('/auth/register', data);
  },
  async login(data) {
    return api.post('/auth/login', data);
  },
  async getMe() {
    return api.get('/auth/me');
  },
  async updateProfile(data) {
    return api.put('/auth/profile', data);
  },
  async searchUsers(query) {
    return api.get(`/auth/users/search?q=${encodeURIComponent(query || '')}`);
  },
  async logout() {
    return api.post('/auth/logout');
  },
};
