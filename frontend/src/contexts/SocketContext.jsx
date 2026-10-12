import React, { createContext, useContext, useState, useEffect } from 'react';
import socketClient from '../socket/socketClient';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState(new Map());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = socketClient.connect(user.id);

    // Join personal user notification room
    socketClient.joinRoom(`user_${user.id}`);

    // Fetch initial notifications & unread count
    const fetchNotifs = async () => {
      try {
        const res = await notificationService.listNotifications();
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      } catch (err) {
        console.warn('Could not load notifications:', err.message);
      }
    };
    fetchNotifs();

    // Request browser notification permission if not yet granted
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const handlePresence = (data) => {
      setOnlineUsers((prev) => {
        const updated = new Map(prev);
        updated.set(data.user_id, data.is_online);
        return updated;
      });
    };

    const handleNewNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);

      // Desktop browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notif.title || 'Secure-Collab', {
          body: notif.content,
          icon: '/favicon.ico',
        });
      }
    };

    socket.on('user_presence_change', handlePresence);
    socket.on('notification_new', handleNewNotification);

    return () => {
      socket.off('user_presence_change', handlePresence);
      socket.off('notification_new', handleNewNotification);
    };
  }, [isAuthenticated, user]);

  const markAllNotificationsRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketClient.socket,
        onlineUsers,
        notifications,
        unreadCount,
        markAllNotificationsRead,
        markNotificationRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
