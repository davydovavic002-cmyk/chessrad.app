import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import { formatTimeInZone, zoneShortName } from '../utils/timezone';
import '../styles/features-game.css';
import '../styles/calendar.css';

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export default function StudentCalendarPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [lessons, setLessons] = useState([]);
  const [homework, setHomework] = useState([]);
  const [progress, setProgress] = useState(null);

  const tzPrimary = user?.tz_primary || 'Asia/Yerevan';
  const tzSecondary = user?.tz_secondary || 'Europe/Berlin';

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor]
  );
  const from = formatDate(weekDays[0]);
  const to = formatDate(weekDays[6]);

  const load = useCallback(async () => {
    const [{ data: cal }, { data: prog }] = await Promise.all([
      apiJson(`/api/student/calendar?from=${from}&to=${to}`),
      apiJson('/api/student/progress'),
    ]);
    if (cal.success) {
      setLessons(cal.lessons || []);
      setHomework(cal.homework || []);
    }
    if (prog.success) setProgress(prog.progress);
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const d of weekDays) {
      map.set(formatDate(d), { lessons: [], homework: [] });
    }
    lessons.forEach((l) => {
      const key = l.lesson_date;
      if (map.has(key)) map.get(key).lessons.push(l);
    });
    homework.forEach((h) => {
      const key = h.due_date;
      if (map.has(key)) map.get(key).homework.push(h);
    });
    return map;
  }, [weekDays, lessons, homework]);

  return (
    <div className="calendar-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <header className="game-hud">
        <span className="game-hud__badge">MY WEEK</span>
        <h1>{t('calendar_title')}</h1>
        <p className="game-hud__sub">{t('calendar_sub')}</p>
      </header>

      {progress && (
        <div className="progress-panel game-panel" style={{ marginBottom: 20, padding: 16 }}>
          <div className="game-panel__head">
            <span className="game-panel__head-icon">📊</span>
            {t('progress_topics')}
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div className="topic-tags done">
              {progress.topicsDone?.length ? (
                progress.topicsDone.map((topic) => (
                  <span key={topic} className="topic-chip done">✓ {topic}</span>
                ))
              ) : (
                <span className="subtitle">{t('progress_no_topics')}</span>
              )}
            </div>
            {progress.topicsPlanned?.length > 0 && (
              <>
                <p className="subtitle" style={{ marginTop: 12 }}>{t('progress_planned')}</p>
                <div className="topic-tags planned">
                  {progress.topicsPlanned.map((topic) => (
                    <span key={topic} className="topic-chip planned">
                      ○ {topic}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginLeft: 8 }}
                        onClick={() => navigate('/homework')}
                      >
                        {t('weak_topics_train')}
                      </button>
                    </span>
                  ))}
                </div>
              </>
            )}
            <div className="game-xp-bar" style={{ marginTop: 16 }}>
              <div
                className="game-xp-bar__fill"
                style={{
                  width: progress.homeworkTotal
                    ? `${(progress.homeworkDone / progress.homeworkTotal) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <p className="game-xp-label">
              {t('progress_hw', { done: progress.homeworkDone, total: progress.homeworkTotal })}
            </p>
          </div>
        </div>
      )}

      <div className="week-nav calendar-week-nav">
        <button type="button" onClick={() => setWeekAnchor((w) => addDays(w, -7))}>←</button>
        <span>
          {from} — {to}
        </span>
        <button type="button" onClick={() => setWeekAnchor((w) => addDays(w, 7))}>→</button>
      </div>

      <div className="calendar-days">
        {weekDays.map((d) => {
          const key = formatDate(d);
          const ev = eventsByDay.get(key) || { lessons: [], homework: [] };
          const dayName = t('days_short')[(d.getDay() + 6) % 7];
          return (
            <div key={key} className="calendar-day game-panel">
              <div className="calendar-day-head">
                <strong>{dayName}</strong>
                <span>{String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}</span>
              </div>
              <div className="calendar-day-events">
                {ev.lessons.map((l) => (
                  <div key={`l-${l.id}`} className="cal-event cal-event--lesson">
                    <span className="cal-event-time">
                      {l.time_slot} {zoneShortName(tzPrimary)}
                      {tzSecondary !== tzPrimary && (
                        <small>
                          {' '}
                          / {formatTimeInZone(l.lesson_date, l.time_slot, tzPrimary, tzSecondary)}{' '}
                          {zoneShortName(tzSecondary)}
                        </small>
                      )}
                    </span>
                    <span>{t('schedule_lesson')} · {l.teacher_name}</span>
                    {l.video_url && (
                      <span className="cal-video-link">{t('video_in_class')} ✓</span>
                    )}
                    {!l.video_url && (
                      <span className="cal-video-link">{t('video_in_class')}</span>
                    )}
                  </div>
                ))}
                {ev.homework.map((h) => (
                  <button
                    key={`h-${h.id}`}
                    type="button"
                    className="cal-event cal-event--hw"
                    onClick={() => navigate(`/homework?id=${h.id}`)}
                  >
                    <span>📝 {h.title}</span>
                    <span className={`game-status-pill game-status-pill--${h.status === 'pending' ? 'pending' : 'completed'}`}>
                      {h.status}
                    </span>
                  </button>
                ))}
                {!ev.lessons.length && !ev.homework.length && (
                  <span className="subtitle">{t('calendar_free')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
