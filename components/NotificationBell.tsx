import React, { useState, useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { db } from '../services/supabaseDb';
import { supabase } from '../src/integrations/supabase/client';

interface Notification {
  id: string;
  user_id: string;
  project_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

interface NotificationBellProps {
  userId: string;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ userId }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const bellRef = useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const data = await db.notifications.getForUser(userId, 10);
      setNotifications(data);
      
      // Count unread notifications
      const unread = data.filter((n: Notification) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await db.notifications.markAsRead(notificationId);
      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      await db.notifications.markAllAsRead(userId);
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Fetch notifications on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchNotifications();
      
      // Set up a polling interval to check for new notifications
      const interval = setInterval(fetchNotifications, 30000); // Every 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [userId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Mark all as read when opening the dropdown
      if (unreadCount > 0) {
        markAllAsRead();
      }
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-slate-700 hover:text-slate-900 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b-2 border-black flex justify-between items-center">
            <h3 className="font-black uppercase text-lg">Notifications</h3>
            {notifications.length > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-bold"
              >
                Mark All Read
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-slate-500">No notifications</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className={`p-4 ${!notification.is_read ? 'bg-yellow-50' : 'bg-white'}`}
                >
                  <div className="flex justify-between">
                    <h4 className="font-bold text-slate-900">{notification.title}</h4>
                    {!notification.is_read && (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded font-bold">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 mt-1">{notification.message}</p>
                  <div className="text-xs text-slate-400 mt-2">
                    {formatDate(notification.created_at)}
                  </div>
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-bold"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;