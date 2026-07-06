import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { api, apiJson } from '../api';
import Modal from '../components/Modal';
import LanguageToggle from '../components/LanguageToggle';
import BackButton from '../components/BackButton';
import { formatTimeInZone, zoneShortName, TIMEZONE_OPTIONS } from '../utils/timezone';
import '../styles/schedule.css';

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00',
  '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatRuDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const isTeacher = user.role === 'teacher' || user.role === 'admin';
  const dayNames = t('days_short');

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [modal, setModal] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [tzPrimary, setTzPrimary] = useState(user?.tz_primary || 'Asia/Yerevan');
  const [tzSecondary, setTzSecondary] = useState(user?.tz_secondary || 'Europe/Berlin');

  useEffect(() => {
    setTzPrimary(user?.tz_primary || 'Asia/Yerevan');
    setTzSecondary(user?.tz_secondary || 'Europe/Berlin');
  }, [user?.tz_primary, user?.tz_secondary]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor]
  );
  const weekStart = formatDate(weekDays[0]);
  const weekEnd = formatDate(weekDays[6]);

  const loadLessons = useCallback(async () => {
    const { data } = await apiJson(`/api/schedule?weekStart=${weekStart}&weekEnd=${weekEnd}`);
    if (data.success) setLessons(data.lessons || []);
  }, [weekStart, weekEnd]);

  const loadRequests = useCallback(async () => {
    if (!isTeacher) return;
    const { data } = await apiJson('/api/schedule/requests');
    if (data.success) setRequests(data.requests || []);
  }, [isTeacher]);

  const loadStudents = useCallback(async () => {
    if (!isTeacher) return;
    const { data } = await apiJson('/api/schedule/students');
    if (data.success) setStudents(data.students || []);
  }, [isTeacher]);

  useEffect(() => {
    loadLessons();
    loadRequests();
    loadStudents();
  }, [loadLessons, loadRequests, loadStudents]);

  const lessonMap = useMemo(() => {
    const map = new Map();
    lessons.forEach((l) => {
      map.set(`${l.lesson_date}|${l.time_slot}`, l);
    });
    return map;
  }, [lessons]);

  const studentNameById = useMemo(() => {
    const map = new Map(students.map((s) => [Number(s.id), s.username]));
    return map;
  }, [students]);

  async function saveTzSettings(primary, secondary) {
    await api('/api/profile/settings', {
      method: 'PATCH',
      body: JSON.stringify({ tzPrimary: primary, tzSecondary: secondary }),
    });
  }

  function dualTimeLabel(dateStr, timeSlot) {
    const sec =
      tzSecondary !== tzPrimary
        ? formatTimeInZone(dateStr, timeSlot, tzPrimary, tzSecondary)
        : null;
    return { primary: timeSlot, sec };
  }

  function openCell(dateStr, timeSlot) {
    const lesson = lessonMap.get(`${dateStr}|${timeSlot}`);
    if (isTeacher) {
      setSelectedStudents(lesson ? lesson.student_ids.map(Number) : []);
      setVideoUrl(lesson?.video_url || '');
      setModal({
        mode: 'teacher',
        date: dateStr,
        time: timeSlot,
        lessonId: lesson?.id || null,
      });
      return;
    }

    if (lesson) {
      const dt = dualTimeLabel(dateStr, timeSlot);
      const timeText =
        dt.sec != null
          ? `${dt.primary} ${zoneShortName(tzPrimary)} / ${dt.sec} ${zoneShortName(tzSecondary)}`
          : `${dt.primary} ${zoneShortName(tzPrimary)}`;
      Swal.fire({
        icon: 'info',
        title: t('schedule_lesson'),
        html: `${formatRuDate(dateStr)} · ${timeText}<br><small>${t('schedule_video_hint')}</small>`,
      });
      return;
    }

    setModal({ mode: 'student', date: dateStr, time: timeSlot });
  }

  function closeModal() {
    setModal(null);
    setSelectedStudents([]);
    setVideoUrl('');
  }

  function toggleStudent(id) {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function saveLesson() {
    if (!modal) return;
    const body = {
      lessonDate: modal.date,
      timeSlot: modal.time,
      studentIds: selectedStudents,
      videoUrl: videoUrl.trim(),
    };
    if (modal.lessonId) {
      await api(`/api/schedule/${modal.lessonId}`, {
        method: 'PUT',
        body: JSON.stringify({ studentIds: selectedStudents, videoUrl: videoUrl.trim() }),
      });
    } else {
      await api('/api/schedule', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal();
    loadLessons();
  }

  async function deleteLesson() {
    if (!modal?.lessonId) return;
    const result = await Swal.fire({
      title: t('schedule_delete_q'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b23333',
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel'),
    });
    if (!result.isConfirmed) return;
    await api(`/api/schedule/${modal.lessonId}`, { method: 'DELETE' });
    closeModal();
    loadLessons();
  }

  async function requestLesson() {
    if (!modal) return;
    const { data } = await apiJson('/api/schedule/requests', {
      method: 'POST',
      body: JSON.stringify({ lessonDate: modal.date, timeSlot: modal.time }),
    });
    if (data.success) {
      Swal.fire({ icon: 'success', title: t('schedule_request_sent'), timer: 1500, showConfirmButton: false });
      closeModal();
    } else {
      Swal.fire({ icon: 'info', text: data.message || t('error') });
    }
  }

  async function approveRequest(id) {
    await api(`/api/schedule/requests/${id}/approve`, { method: 'POST' });
    loadRequests();
    loadLessons();
  }

  async function rejectRequest(id) {
    await api(`/api/schedule/requests/${id}/reject`, { method: 'POST' });
    loadRequests();
  }

  function lessonLabel(lesson) {
    if (!lesson.student_ids?.length) return t('schedule_free');
    const names = (lesson.student_names || lesson.student_ids.map((id) => studentNameById.get(Number(id)) || `#${id}`)).slice(0, 3);
    const extra = lesson.student_ids.length > 3 ? ` +${lesson.student_ids.length - 3}` : '';
    return names.join(', ') + extra;
  }

  const roleText = isTeacher
    ? t('schedule_teacher_hint', { name: user.username })
    : t('schedule_student_hint', { name: user.username });

  return (
    <div className="schedule-page-body">
      <BackButton to="/lobby" title={t('back_to_lobby')} />

      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 10001 }}>
        <LanguageToggle />
      </div>

      <div className="header-area">
        <h1 onClick={() => navigate('/lobby')}>{t('app_name')}</h1>
        <p id="role-text" style={{ color: '#888', fontSize: 14, marginTop: 10 }}>
          {roleText}
        </p>
      </div>

      <div className="main-wrapper">
        <h2 id="schedule-title" style={{ color: '#f0d9b5', textAlign: 'center', marginBottom: 25 }}>
          {t('schedule_title')}
        </h2>

        <div className="week-nav">
          <button type="button" onClick={() => setWeekAnchor((w) => addDays(w, -7))}>
            ← {t('schedule_week')}
          </button>
          <span>
            {formatRuDate(weekStart)} — {formatRuDate(weekEnd)}
          </span>
          <button type="button" onClick={() => setWeekAnchor((w) => addDays(w, 7))}>
            {t('schedule_week')} →
          </button>
        </div>

        <div className="schedule-tz-bar">
          <label>
            {t('tz_primary')}
            <select
              value={tzPrimary}
              onChange={(e) => {
                setTzPrimary(e.target.value);
                saveTzSettings(e.target.value, tzSecondary);
              }}
            >
              {TIMEZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            {t('tz_secondary')}
            <select
              value={tzSecondary}
              onChange={(e) => {
                setTzSecondary(e.target.value);
                saveTzSettings(tzPrimary, e.target.value);
              }}
            >
              {TIMEZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="schedule-content-layout">
          <div className="grid-container">
            <div className="schedule-grid" id="schedule-grid">
              <div className="grid-header">{t('schedule_time')}</div>
              {weekDays.map((d, i) => (
                <div className="grid-header" key={i}>
                  {dayNames[i]}
                  <div style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
                    {String(d.getDate()).padStart(2, '0')}.{String(d.getMonth() + 1).padStart(2, '0')}
                  </div>
                </div>
              ))}

              {TIME_SLOTS.map((time) => {
                const dt = dualTimeLabel(weekStart, time);
                return (
                <div key={time} style={{ display: 'contents' }}>
                  <div className="time-label">
                    <div className="schedule-dual-time">
                      <span className="tz-primary">{dt.primary} {zoneShortName(tzPrimary)}</span>
                      {dt.sec != null && (
                        <span className="tz-secondary">{dt.sec} {zoneShortName(tzSecondary)}</span>
                      )}
                    </div>
                  </div>
                  {weekDays.map((d) => {
                    const dateStr = formatDate(d);
                    const lesson = lessonMap.get(`${dateStr}|${time}`);
                    const isMine =
                      !isTeacher &&
                      lesson?.student_ids?.map(Number).includes(Number(user.id));
                    return (
                      <div
                        key={`${dateStr}-${time}`}
                        className="grid-cell"
                        onClick={() => openCell(dateStr, time)}
                      >
                        {lesson && (
                          <div className={`lesson-slot${isMine ? ' mine' : ''}`}>
                            {isTeacher ? lessonLabel(lesson) : t('schedule_my_lesson')}
                            {lesson.video_url && (
                              <span className="video-icon" title={t('calendar_video')}>📹</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );})}
            </div>
          </div>

          {isTeacher && (
            <div id="teacher-requests-panel" className="requests-container">
              <h3 style={{ color: '#f0d9b5', fontSize: 16, marginTop: 0 }}>{t('schedule_requests')}</h3>
              <div id="requests-list" className="requests-list">
                {requests.length === 0 ? (
                  <p style={{ color: '#888', fontSize: 13 }}>{t('schedule_no_requests')}</p>
                ) : (
                  requests.map((r) => (
                    <div className="request-item" key={r.id}>
                      <div>
                        <strong>{r.student_name}</strong>
                        <div>
                          {formatRuDate(r.lesson_date)}{' '}
                          {(() => {
                            const dt = dualTimeLabel(r.lesson_date, r.time_slot);
                            return dt.sec != null
                              ? `${dt.primary} / ${dt.sec}`
                              : dt.primary;
                          })()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" className="btn-approve" onClick={() => approveRequest(r.id)}>
                          ✓
                        </button>
                        <button type="button" className="btn-reject" onClick={() => rejectRequest(r.id)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={!!modal} onClose={closeModal} dark contentClassName="schedule-modal-panel">
        {modal && (
          <>
            <h3 id="modal-date-title" style={{ color: '#f0d9b5', marginTop: 0 }}>
              {formatRuDate(modal.date)} · {modal.time} {zoneShortName(tzPrimary)}
              {tzSecondary !== tzPrimary && (
                <span style={{ fontSize: 13, fontWeight: 500, color: '#aaa' }}>
                  {' '}
                  / {formatTimeInZone(modal.date, modal.time, tzPrimary, tzSecondary)}{' '}
                  {zoneShortName(tzSecondary)}
                </span>
              )}
            </h3>

            {modal.mode === 'teacher' ? (
              <>
                <div id="modal-edit-zone">
                  <p style={{ fontSize: 14, color: '#aaa', marginBottom: 10 }}>{t('schedule_select_students')}</p>
                  <div id="students-checkbox-list" className="checkbox-list">
                    {students.length === 0 ? (
                      <p style={{ color: '#888', padding: 8 }}>{t('schedule_no_students')}</p>
                    ) : (
                      students.map((s) => (
                        <label className="student-label" key={s.id}>
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(Number(s.id))}
                            onChange={() => toggleStudent(Number(s.id))}
                          />
                          {s.username}
                        </label>
                      ))
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: '#8ec5ff', marginBottom: 10 }}>{t('schedule_video_hint')}</p>
                  <label style={{ display: 'block', fontSize: 13, color: '#aaa', marginBottom: 6 }}>
                    {t('schedule_video_backup')}
                  </label>
                  <input
                    type="url"
                    className="form-input"
                    style={{ marginBottom: 12, width: '100%', boxSizing: 'border-box' }}
                    placeholder="https://zoom.us/j/..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                  <button id="save-lesson-btn" type="button" className="btn-save" onClick={saveLesson}>
                    {t('schedule_save_lesson')}
                  </button>
                </div>
                {modal.lessonId && (
                  <div id="modal-delete-zone" style={{ marginTop: 10 }}>
                    <button id="delete-lesson-btn" type="button" className="btn-delete" onClick={deleteLesson}>
                      {t('schedule_delete_lesson')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button type="button" className="btn-request" onClick={requestLesson}>
                {t('schedule_request_btn')}
              </button>
            )}

            <button type="button" onClick={closeModal} className="btn-cancel">
              {t('cancel')}
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
