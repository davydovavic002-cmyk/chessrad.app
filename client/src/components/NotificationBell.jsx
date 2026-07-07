import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [panelPos, setPanelPos] = useState({ top: 0, right: 0 });

  const load = useCallback(async () => {
    const { res, data } = await apiJson('/api/notifications');
    if (res.ok) {
      setItems(data.items || []);
      setUnread(data.unread || 0);
    }
  }, []);

  const updatePanelPos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updatePanelPos();
    window.addEventListener('resize', updatePanelPos);
    window.addEventListener('scroll', updatePanelPos, true);
    return () => {
      window.removeEventListener('resize', updatePanelPos);
      window.removeEventListener('scroll', updatePanelPos, true);
    };
  }, [open, updatePanelPos]);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(e) {
      const panel = panelRef.current;
      const btn = btnRef.current;
      if (panel?.contains(e.target) || btn?.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

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

  const panel = open
    ? createPortal(
        <div
          ref={panelRef}
          className="notify-bell__panel glass-strong"
          style={{ top: panelPos.top, right: panelPos.right }}
        >
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
        </div>,
        document.body
      )
    : null;

  return (
    <div className="notify-bell">
      <button
        ref={btnRef}
        type="button"
        className="notify-bell__btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notify_title')}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && <span className="notify-bell__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {panel}
    </div>
  );
}
