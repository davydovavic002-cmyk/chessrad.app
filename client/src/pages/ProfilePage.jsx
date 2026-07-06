import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { api, apiJson } from '../api';
import Modal from '../components/Modal';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import { triggerOnboardingReplay } from '../components/OnboardingModal';
import { TIMEZONE_OPTIONS } from '../utils/timezone';
import '../styles/profile.css';

const LEVEL_KEYS = [
  { key: 'profile_level_novice', min: 0, next: 1500 },
  { key: 'profile_level_amateur', min: 1500, next: 2500 },
  { key: 'profile_level_skilled', min: 2500, next: 4500 },
  { key: 'profile_level_master', min: 4500, next: 7500 },
  { key: 'profile_level_grandmaster', min: 7500, next: Infinity },
];

function resultLabel(result, t) {
  if (result === 'Победа' || result === 'Win') return t('profile_result_win');
  if (result === 'Ничья' || result === 'Draw') return t('profile_result_draw');
  if (result === 'Поражение' || result === 'Loss') return t('profile_result_loss');
  return result;
}

function resultColor(result) {
  if (result === 'Победа' || result === 'Win') return '#2ed573';
  if (result === 'Ничья' || result === 'Draw') return '#ff9f43';
  return '#ff4757';
}

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [forceOld, setForceOld] = useState('');
  const [forceNew, setForceNew] = useState('');
  const [forceMsg, setForceMsg] = useState('');
  const [profileOld, setProfileOld] = useState('');
  const [profileNew, setProfileNew] = useState('');
  const [profilePassMsg, setProfilePassMsg] = useState('');
  const [profilePassOk, setProfilePassOk] = useState(false);
  const [parentEmail, setParentEmail] = useState(user?.parent_email || '');
  const [notifyEmail, setNotifyEmail] = useState(user?.notify_email !== 0);
  const [notifyPush, setNotifyPush] = useState(user?.notify_push !== 0);
  const [tzPrimary, setTzPrimary] = useState(user?.tz_primary || 'Asia/Yerevan');
  const [tzSecondary, setTzSecondary] = useState(user?.tz_secondary || 'Europe/Berlin');
  const [pgnArchive, setPgnArchive] = useState([]);

  const mustChange = user?.must_change_password === 1;
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const loadRooms = useCallback(async () => {
    if (!isTeacher) return;
    const { data } = await apiJson('/api/study/my-rooms');
    setRooms(data.rooms || []);
  }, [isTeacher]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    setParentEmail(user?.parent_email || '');
    setNotifyEmail(user?.notify_email !== 0);
    setNotifyPush(user?.notify_push !== 0);
    setTzPrimary(user?.tz_primary || 'Asia/Yerevan');
    setTzSecondary(user?.tz_secondary || 'Europe/Berlin');
  }, [user]);

  const loadPgnArchive = useCallback(async () => {
    const { data } = await apiJson('/api/pgn-archive');
    if (data.success) setPgnArchive(data.items || []);
  }, []);

  useEffect(() => {
    loadPgnArchive();
  }, [loadPgnArchive]);

  const rating = parseInt(user?.rating, 10) || 0;
  const currentLevel = LEVEL_KEYS.find((l) => rating >= l.min && rating < l.next) || LEVEL_KEYS[0];
  let progressPct = 100;
  let pointsText = t('profile_level_max');
  if (currentLevel.next !== Infinity) {
    const range = currentLevel.next - currentLevel.min;
    progressPct = Math.max(5, Math.min(100, ((rating - currentLevel.min) / range) * 100));
    const nextLevel = LEVEL_KEYS[LEVEL_KEYS.indexOf(currentLevel) + 1];
    pointsText = t('profile_level_points', {
      name: t(nextLevel.key),
      n: currentLevel.next - rating,
    });
  }

  let trophies = [];
  try {
    trophies = typeof user?.trophies === 'string' ? JSON.parse(user.trophies) : user?.trophies || [];
  } catch {
    trophies = [];
  }

  async function saveSettings() {
    await apiJson('/api/profile/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        parentEmail,
        notifyEmail,
        notifyPush,
        tzPrimary,
        tzSecondary,
      }),
    });
    await refreshUser();
  }

  async function handleLogout() {
    const result = await Swal.fire({
      title: t('profile_logout_q'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('logout'),
      cancelButtonText: t('profile_stay'),
    });
    if (result.isConfirmed) {
      await logout();
      navigate('/');
    }
  }

  async function changePassword(isForce) {
    const oldPassword = isForce ? forceOld : profileOld;
    const newPassword = isForce ? forceNew : profileNew;
    const setMsg = isForce
      ? setForceMsg
      : (text, ok = false) => {
          setProfilePassMsg(text);
          setProfilePassOk(ok);
        };

    if (isForce) setForceMsg('');
    else {
      setProfilePassMsg('');
      setProfilePassOk(false);
    }

    if (!newPassword || newPassword.length < 6) {
      setMsg(t('profile_min6'));
      return;
    }

    const { res, data } = await apiJson('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    if (res.ok) {
      await refreshUser();
      if (isForce) setForceMsg(t('profile_pass_updated'));
      else {
        setProfilePassMsg(t('profile_pass_updated'));
        setProfilePassOk(true);
        setProfileOld('');
        setProfileNew('');
      }
    } else {
      setMsg(data.message || t('error'));
    }
  }

  async function deleteRoom(code) {
    const result = await Swal.fire({
      title: t('profile_delete_room_q'),
      text: t('profile_delete_room_text', { code }),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel'),
    });
    if (!result.isConfirmed) return;
    const res = await api(`/api/study/${code}`, { method: 'DELETE' });
    if (res.ok) {
      Swal.fire(t('profile_deleted'), t('profile_room_deleted'), 'success');
      loadRooms();
    } else {
      Swal.fire(t('error'), t('profile_room_delete_fail'), 'error');
    }
  }

  return (
    <>
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <Modal open={mustChange} onClose={() => {}}>
        <h2>{t('profile_security')}</h2>
        <p>{t('profile_force_hint')}</p>
        <input
          type="password"
          className="form-input"
          placeholder={t('profile_force_pass_ph')}
          value={forceOld}
          onChange={(e) => setForceOld(e.target.value)}
        />
        <input
          type="password"
          className="form-input mt-2"
          placeholder={t('profile_new_pass_ph')}
          value={forceNew}
          onChange={(e) => setForceNew(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-block mt-2" onClick={() => changePassword(true)}>
          {t('profile_force_update')}
        </button>
        <button type="button" className="btn btn-ghost btn-block mt-1" onClick={handleLogout}>
          {t('profile_logout_q')}
        </button>
        <div className={`status-msg${forceMsg ? ' success' : ''}`}>{forceMsg}</div>
      </Modal>

      <div className="profile-container page-wrap">
        <div className="profile-bento">
          <section className="profile-bento__cell profile-bento__cell--hero">
            <h1>{t('profile_title')}</h1>
            <div className="profile-hero-meta">
              <p style={{ margin: 0 }}>
                {t('profile_name')}: <strong>{user.username}</strong>
              </p>
              <p style={{ margin: 0 }}>
                {t('profile_rating')}: <span className="rating-badge">{rating}</span>
              </p>
            </div>
          </section>

          <section className="profile-bento__cell profile-bento__cell--stats">
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{Number(user.wins) || 0}</span>
                <span className="stat-label">{t('profile_wins')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{Number(user.draws) || 0}</span>
                <span className="stat-label">{t('profile_draws')}</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{Number(user.losses) || 0}</span>
                <span className="stat-label">{t('profile_losses')}</span>
              </div>
            </div>
          </section>

          <section className="profile-bento__cell profile-bento__cell--progress">
            <h3>
              {t('profile_progress')}: <span>{t(currentLevel.key)}</span>
            </h3>
            <div className="progress-container">
              <div id="progress-fill-bar" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="subtitle">{pointsText}</p>
          </section>

          <section className="profile-bento__cell profile-bento__cell--trophies">
            <h3>{t('profile_trophies')}</h3>
            <div className="trophy-shelf">
              {trophies.length === 0 ? (
                <p className="subtitle">{t('profile_no_trophies')}</p>
              ) : (
                trophies.map((tr, i) => {
                  const bgColor =
                    { red: '#ff4757', blue: '#2e86de', green: '#2ed573', yellow: '#ffa502' }[tr.color] || '#ffd700';
                  return (
                    <div
                      key={i}
                      className="trophy-chip"
                      title={t('profile_trophy_tip', {
                        name: tr.tournamentName || t('profile_tournament'),
                        place: tr.place,
                        date: tr.date,
                      })}
                      style={{ background: bgColor }}
                    >
                      {tr.place === 1 ? '🏆' : '🏅'}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="profile-bento__cell profile-bento__cell--history">
            <h3>{t('profile_history')}</h3>
            <div className="table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>{t('profile_opponent')}</th>
                    <th>{t('profile_result')}</th>
                    <th>{t('profile_type')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(user.history || []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="subtitle">
                        {t('profile_history_empty')}
                      </td>
                    </tr>
                  ) : (
                    (user.history || []).slice(0, 5).map((game, i) => (
                      <tr key={i}>
                        <td>{game.opponent || t('profile_anonymous')}</td>
                        <td style={{ color: resultColor(game.result), fontWeight: 'bold' }}>
                          {resultLabel(game.result, t)}
                        </td>
                        <td>{game.type || t('profile_match')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {user.role === 'student' && (
            <section className="profile-bento__cell profile-bento__cell--wide">
              <h3>{t('profile_homework')}</h3>
              <Link to="/homework" className="btn btn-primary btn-block">
                {t('homework_title')}
              </Link>
              <p className="subtitle" style={{ marginTop: 12, marginBottom: 8 }}>
                {t('onboarding_replay_hint')}
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  triggerOnboardingReplay();
                  navigate('/lobby');
                }}
              >
                {t('onboarding_replay')}
              </button>
            </section>
          )}

          {isTeacher && (
            <section className="profile-bento__cell profile-bento__cell--wide" id="teacher-rooms-panel">
              <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                <Link to="/journal" className="btn btn-primary btn-block">
                  {t('profile_journal')}
                </Link>
                <Link to="/library-editor" className="btn btn-secondary btn-block">
                  {t('profile_library')}
                </Link>
              </div>
              <h3>
                {t('profile_rooms')} (<span id="rooms-count-label">{rooms.length}</span>/5)
              </h3>
              <div id="my-rooms-list" className="rooms-list-container">
                {rooms.length === 0 ? (
                  <p className="subtitle">{t('profile_no_rooms')}</p>
                ) : (
                  rooms.map((room) => (
                    <div className="room-item" key={room.room_code}>
                      <div>
                        <strong>{room.room_code}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/study?room=${room.room_code}`} className="btn btn-primary btn-sm">
                          {t('profile_enter_room')}
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteRoom(room.room_code)}
                        >
                          {t('delete')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          <section className="profile-bento__cell profile-bento__cell--third">
            <h3>{t('tz_settings')}</h3>
            <label className="profile-check" style={{ display: 'block', marginBottom: 8 }}>
              {t('tz_primary')}
              <select
                className="form-input mt-1"
                value={tzPrimary}
                onChange={(e) => setTzPrimary(e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="profile-check" style={{ display: 'block', marginBottom: 8 }}>
              {t('tz_secondary')}
              <select
                className="form-input mt-1"
                value={tzSecondary}
                onChange={(e) => setTzSecondary(e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <p className="subtitle">{t('tz_hint')}</p>
          </section>

          <section className="profile-bento__cell profile-bento__cell--wide">
            <h3>{t('pgn_archive_title')}</h3>
            {pgnArchive.length === 0 ? (
              <p className="subtitle">{t('pgn_archive_empty')}</p>
            ) : (
              <div className="pgn-archive-list">
                {pgnArchive.slice(0, 10).map((item) => (
                  <div key={item.id} className="pgn-archive-item">
                    <strong>{item.title || item.lesson_date}</strong>
                    <div className="subtitle" style={{ fontSize: 12 }}>{item.lesson_date}</div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm mt-1"
                      onClick={() => {
                        navigator.clipboard.writeText(item.pgn || '');
                        Swal.fire({ icon: 'success', title: t('study_pgn_copied'), timer: 1200, showConfirmButton: false });
                      }}
                    >
                      {t('study_copy_pgn')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="profile-bento__cell profile-bento__cell--third">
            <h3>{t('profile_parent_email')}</h3>
            <input
              className="form-input"
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              placeholder="parent@email.com"
            />
            <label className="profile-check mt-1">
              <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
              {t('profile_notify_email')}
            </label>
            <label className="profile-check">
              <input type="checkbox" checked={notifyPush} onChange={(e) => setNotifyPush(e.target.checked)} />
              {t('profile_notify_push')}
            </label>
            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={saveSettings}>
              {t('save')}
            </button>
          </section>

          <section className="profile-bento__cell profile-bento__cell--wide password-section">
            <h3>{t('profile_security')}</h3>
            <input
              type="password"
              className="form-input"
              placeholder={t('profile_old_pass')}
              value={profileOld}
              onChange={(e) => setProfileOld(e.target.value)}
            />
            <input
              type="password"
              className="form-input mt-1"
              placeholder={t('profile_new_pass')}
              value={profileNew}
              onChange={(e) => setProfileNew(e.target.value)}
            />
            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => changePassword(false)}>
              {t('profile_change_pass')}
            </button>
            <div className={`status-msg${profilePassMsg ? (profilePassOk ? ' success' : ' error') : ''}`}>
              {profilePassMsg}
            </div>
          </section>

          <section className="profile-bento__cell profile-bento__cell--actions">
            <button type="button" id="logout-btn" className="btn btn-danger" onClick={handleLogout}>
              {t('logout')}
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
