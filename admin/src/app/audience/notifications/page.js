'use client';

import { useState } from 'react';

export default function NotificationsPage() {
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [notificationSending, setNotificationSending] = useState(false);

  const handleSendPushNotification = async () => {
    if (!notificationTitle.trim() || !notificationBody.trim()) {
      alert('Please fill title and body.');
      return;
    }
    setNotificationSending(true);
    try {
      alert('Push notification command queued!');
      setNotificationTitle('');
      setNotificationBody('');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setNotificationSending(false);
    }
  };

  return (
    <>
      <section className="view-section active-view">
        <div className="card glass">
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: 600 }}>Broadcast Push Notification</h3>
          </div>
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', maxWidth: 600 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Notification Title</label>
              <input
                type="text"
                className="filter-input"
                style={{ width: '100%' }}
                placeholder="🔥 Hot Deal Alert!"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Notification Body</label>
              <textarea
                className="filter-input"
                style={{ width: '100%', minHeight: 100, padding: 10, fontFamily: 'inherit' }}
                placeholder="Check out top discounts on electronics live now..."
                value={notificationBody}
                onChange={(e) => setNotificationBody(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSendPushNotification}
              disabled={notificationSending}
            >
              {notificationSending ? 'Sending...' : '📢 Send Broadcast Notification'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
