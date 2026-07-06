import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import BackButton from '../components/BackButton';
import '../styles/features-game.css';
import '../styles/calendar.css';

export default function ParentPortalPage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson('/api/parent/dashboard').then(({ data }) => {
      if (data.success) setChildren(data.children || []);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="parent-portal page-wrap">
      <BackButton to="/" title={t('logout')} />
      <header className="game-hud">
        <span className="game-hud__badge">PARENT</span>
        <h1>{t('parent_portal_title')}</h1>
        <p className="game-hud__sub">{t('parent_portal_sub')}</p>
      </header>

      <div className="parent-user-bar game-panel">
        <span>{user.username}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
          {t('logout')}
        </button>
      </div>

      {loading ? (
        <p>{t('loading')}</p>
      ) : children.length === 0 ? (
        <p className="subtitle">{t('parent_no_children')}</p>
      ) : (
        children.map(({ student, progress, lessons, homework, recentJournal }) => (
          <section key={student.id} className="parent-child-card game-panel">
            <h2>{student.username}</h2>
            <p className="subtitle">
              {t('profile_rating')}: {student.rating} · {student.level}
            </p>

            {progress && (
              <div className="parent-progress-block">
                <h3>{t('calendar_topics_progress')}</h3>
                {progress.topicsDone?.length > 0 && (
                  <p><strong>{t('journal_topics_done')}:</strong> {progress.topicsDone.join(', ')}</p>
                )}
                {progress.topicsPlanned?.length > 0 && (
                  <p><strong>{t('weak_topics_label')}:</strong> {progress.topicsPlanned.join(', ')}</p>
                )}
                <p>
                  {t('homework_title')}: {progress.homeworkDone}/{progress.homeworkTotal}
                </p>
              </div>
            )}

            {lessons?.length > 0 && (
              <div className="parent-block">
                <h3>{t('schedule_title')}</h3>
                <ul className="parent-list">
                  {lessons.map((l) => (
                    <li key={l.id}>{l.lesson_date} {l.time_slot} — {l.teacher_name}</li>
                  ))}
                </ul>
              </div>
            )}

            {homework?.length > 0 && (
              <div className="parent-block">
                <h3>{t('homework_title')}</h3>
                <ul className="parent-list">
                  {homework.map((h) => (
                    <li key={h.id}>{h.due_date}: {h.title} ({h.status})</li>
                  ))}
                </ul>
              </div>
            )}

            {recentJournal?.length > 0 && (
              <div className="parent-block">
                <h3>{t('journal_entries_tab')}</h3>
                {recentJournal.map((e) => (
                  <article key={e.id} className="parent-journal-snippet">
                    <strong>{e.lesson_date}</strong> — {e.title || t('journal_entry')}
                    {e.parent_message && <p>{e.parent_message}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
