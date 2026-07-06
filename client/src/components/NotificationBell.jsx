import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { getSocket } from '../socket';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import './NotificationBell.css';

export default function NotificationBell() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const { res, data } = await apiJson('/api/notifications');
    if (res.ok) {
      setItems(data.items || []);
      setUnread(data.unread || 0);
    }
  }, []);

  useEffect(() => {
    load();
    apiJson('/api/notifications/check-upcoming', { method: 'POST' }).then(() => load());

    if (user?.notify_push && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const socket = getSocket();
    const onNew = (n) => {
      setItems((prev) => [{ ...n, read: false, created_at: new Date().toISOString() }, ...prev]);
      setUnread((c) => c + 1);
      if (user?.notify_push && Notification.permission === 'granted') {
        new Notification(n.title, { body: n.body });
      }
    };
    socket.on('notification:new', onNew);
    return () => socket.off('notification:new', onNew);
  }, [load, user?.notify_push]);

  async function markAll() {
    await apiJson('/api/notifications/read-all', { method: 'POST' });
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  function handleClick(item) {
    setOpen(false);
    if (item.type === 'homework' && item.payload?.homeworkId) {
      navigate(`/homework?id=${item.payload.homeworkId}`);
    } else if (item.type === 'reminder') {
      if (item.payload?.kind === 'tournament' && item.payload?.refId) {
        navigate(`/tournaments/${item.payload.refId}`);
      } else if (item.payload?.kind === 'lesson') {
        navigate('/calendar');
      } else {
        navigate('/schedule');
      }
    } else if (item.type === 'lesson_reminder') {
      navigate('/schedule');
    } else if (item.type === 'schedule_request') {
      navigate('/schedule');
    }
  }

  return (
    <div className="notify-bell">
      <button
        type="button"
        className="notify-bell__btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notify_title')}
      >
        🔔
        {unread > 0 && <span className="notify-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notify-bell__panel glass-strong">
          <div className="notify-bell__head">
            <strong>{t('notify_title')}</strong>
            {unread > 0 && (
              <button type="button" className="notify-bell__mark" onClick={markAll}>
                {t('notify_mark_read')}
              </button>
            )}
          </div>
          <div className="notify-bell__list">
            {items.length === 0 ? (
              <p className="notify-bell__empty">{t('notify_empty')}</p>
            ) : (
              items.slice(0, 15).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`notify-bell__item${item.read ? '' : ' unread'}`}
                  onClick={() => handleClick(item)}
                >
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
