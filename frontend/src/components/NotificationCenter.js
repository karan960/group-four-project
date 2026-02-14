import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './NotificationCenter.css';

const NotificationCenter = ({ onClose, onNotificationRead }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'sent', 'send-new'
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  // Send notification form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    targetRole: 'student',
    priority: 'normal',
    type: 'announcement',
    targetYear: '',
    targetBranch: '',
    targetDivision: ''
  });

  useEffect(() => {
    fetchUnreadCount();
    if (activeTab === 'inbox') {
      fetchNotifications();
    } else if (activeTab === 'sent') {
      fetchSentNotifications();
    }
  }, [activeTab]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/notifications/inbox?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setStatus('❌ Error fetching notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchSentNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/notifications/sent?limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error('Error fetching sent notifications:', error);
      setStatus('❌ Error fetching sent notifications');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://localhost:5000/api/notifications/unread/count', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUnreadCount(response.data.unreadCount || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `http://localhost:5000/api/notifications/${notificationId}/read`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      // Update local state
      setNotifications(notifications.map(n => 
        n._id === notificationId ? { ...n, isRead: true } : n
      ));
      fetchUnreadCount();
      if (onNotificationRead) {
        onNotificationRead();
      }
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        'http://localhost:5000/api/notifications/mark-all/read',
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      fetchNotifications();
      fetchUnreadCount();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleSendNotification = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.message.trim()) {
      setStatus('❌ Please fill in title and message');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/notifications/send',
        formData,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setStatus(`✅ Notification sent to ${response.data.recipientCount} recipients!`);
      
      // Reset form
      setFormData({
        title: '',
        message: '',
        targetRole: 'student',
        priority: 'normal',
        type: 'announcement',
        targetYear: '',
        targetBranch: '',
        targetDivision: ''
      });

      // Refresh sent notifications
      setTimeout(() => {
        setActiveTab('sent');
        fetchSentNotifications();
      }, 1500);
    } catch (error) {
      console.error('Error sending notification:', error);
      setStatus('❌ ' + (error.response?.data?.message || 'Error sending notification'));
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notificationId) => {
    if (!window.confirm('Delete this notification?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `http://localhost:5000/api/notifications/${notificationId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      setNotifications(notifications.filter(n => n._id !== notificationId));
      setStatus('✅ Notification deleted');
      setTimeout(() => setStatus(''), 2000);
    } catch (error) {
      console.error('Error deleting notification:', error);
      setStatus('❌ Error deleting notification');
    }
  };

  return (
    <div className="notification-modal-overlay" onClick={onClose}>
      <div className="notification-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="notification-header">
          <h2>🔔 Notification Center</h2>
          <button onClick={onClose} className="btn-close">×</button>
        </div>

        {/* Status message */}
        {status && (
          <div className={`alert ${status.includes('✅') ? 'alert-success' : 'alert-error'}`} style={{ margin: '0 1.5rem' }}>
            {status}
          </div>
        )}

        {/* Tabs */}
        <div className="notification-tabs">
          <button 
            className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            📬 Inbox {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>
          {['admin', 'faculty'].includes(user?.role) && (
            <>
              <button 
                className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
                onClick={() => setActiveTab('sent')}
              >
                📤 Sent
              </button>
              <button 
                className={`tab-btn ${activeTab === 'send-new' ? 'active' : ''}`}
                onClick={() => setActiveTab('send-new')}
              >
                ✏️ Send New
              </button>
            </>
          )}
        </div>

        {/* Content */}
        <div className="notification-content">
          {/* Inbox Tab */}
          {activeTab === 'inbox' && (
            <div className="notification-inbox">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="btn btn-secondary"
                  style={{ marginBottom: '1rem' }}
                >
                  ✅ Mark all as read
                </button>
              )}

              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="notification-list">
                  {notifications.map((notif) => (
                    <div 
                      key={notif._id} 
                      className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
                      onClick={() => !notif.isRead && markAsRead(notif._id)}
                    >
                      <div className="notification-badge">
                        {notif.type === 'announcement' && '📢'}
                        {notif.type === 'alert' && '⚠️'}
                        {notif.type === 'update' && '📝'}
                        {notif.type === 'reminder' && '⏰'}
                      </div>

                      <div className="notification-body">
                        <div className="notification-title">
                          {notif.title}
                          {!notif.isRead && <span className="unread-indicator">●</span>}
                        </div>
                        <div className="notification-message">{notif.message}</div>
                        <div className="notification-meta">
                          <span className={`priority-badge priority-${notif.priority}`}>
                            {notif.priority.toUpperCase()}
                          </span>
                          <span className="sender-info">
                            From: {notif.sender?.name || notif.sender?.username}
                          </span>
                          <span className="timestamp">
                            {new Date(notif.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notif._id);
                        }}
                        className="btn-delete-notif"
                        title="Delete notification"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sent Tab */}
          {activeTab === 'sent' && (
            <div className="notification-sent">
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="spinner"></div>
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                  <p>No sent notifications yet</p>
                </div>
              ) : (
                <div className="notification-list">
                  {notifications.map((notif) => (
                    <div key={notif._id} className="notification-item sent">
                      <div className="notification-badge">
                        {notif.type === 'announcement' && '📢'}
                        {notif.type === 'alert' && '⚠️'}
                        {notif.type === 'update' && '📝'}
                        {notif.type === 'reminder' && '⏰'}
                      </div>

                      <div className="notification-body">
                        <div className="notification-title">{notif.title}</div>
                        <div className="notification-message">{notif.message}</div>
                        <div className="notification-meta">
                          <span className={`priority-badge priority-${notif.priority}`}>
                            {notif.priority.toUpperCase()}
                          </span>
                          <span className="target-info">
                            To: {notif.targetRole === 'all' ? 'All Users' : notif.targetRole + 's'}
                            {notif.targetYear && ` (${notif.targetYear})`}
                          </span>
                          <span className="read-count">
                            👁️ {notif.readBy?.length || 0} read
                          </span>
                          <span className="timestamp">
                            {new Date(notif.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteNotification(notif._id)}
                        className="btn-delete-notif"
                        title="Delete notification"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Send New Tab */}
          {activeTab === 'send-new' && (
            <form onSubmit={handleSendNotification} className="notification-form">
              <div className="form-group">
                <label>📌 Title *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notification title"
                  maxLength="100"
                />
              </div>

              <div className="form-group">
                <label>💬 Message *</label>
                <textarea
                  className="form-control"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Notification message..."
                  rows="5"
                  maxLength="500"
                />
                <div className="char-count">
                  {formData.message.length}/500 characters
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>👥 Send To *</label>
                  <select
                    className="form-control"
                    value={formData.targetRole}
                    onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                  >
                    <option value="student">Students</option>
                    {user?.role === 'admin' && <option value="faculty">Faculty</option>}
                    {user?.role === 'admin' && <option value="all">All Users</option>}
                  </select>
                </div>

                <div className="form-group">
                  <label>⚡ Priority</label>
                  <select
                    className="form-control"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>📝 Type</label>
                  <select
                    className="form-control"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="announcement">Announcement</option>
                    <option value="alert">Alert</option>
                    <option value="update">Update</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </div>
              </div>

              {formData.targetRole === 'student' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>📚 Year (Optional)</label>
                    <select
                      className="form-control"
                      value={formData.targetYear}
                      onChange={(e) => setFormData({ ...formData, targetYear: e.target.value })}
                    >
                      <option value="">All Years</option>
                      <option value="First">First Year</option>
                      <option value="Second">Second Year</option>
                      <option value="Third">Third Year</option>
                      <option value="Fourth">Fourth Year</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>🏛️ Branch (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.targetBranch}
                      onChange={(e) => setFormData({ ...formData, targetBranch: e.target.value })}
                      placeholder="e.g., Computer Science"
                    />
                  </div>

                  <div className="form-group">
                    <label>📍 Division (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.targetDivision}
                      onChange={(e) => setFormData({ ...formData, targetDivision: e.target.value })}
                      placeholder="e.g., A"
                    />
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="btn btn-success"
                  disabled={loading}
                >
                  📤 Send Notification
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({
                    title: '',
                    message: '',
                    targetRole: 'student',
                    priority: 'normal',
                    type: 'announcement',
                    targetYear: '',
                    targetBranch: '',
                    targetDivision: ''
                  })}
                  className="btn btn-secondary"
                >
                  🔄 Clear
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
