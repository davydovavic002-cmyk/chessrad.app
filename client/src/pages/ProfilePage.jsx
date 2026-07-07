import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { api, apiJson } from '../api';
import Modal from '../components/Modal';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import { triggerOnboardingReplay } from '../components/OnboardingModal';
import ProfileLinkCard from '../components/ProfileLinkCard';
import {
  ProfileStudentDashboard,
  ProfileTeacherDashboard,
  ProfilePlayerDashboard,
  ProfileSettingsPanel,
} from '../components/profile/ProfileDashboard';
import ProfileHero, { ProfileSection } from '../components/profile/ProfileHero';
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
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [dash, setDash] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [displayMsg, setDisplayMsg] = useState('');
  const [displayOk, setDisplayOk] = useState(false);
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
  const [linkMsg, setLinkMsg] = useState('');
  const [linkOk, setLinkOk] = useState(false);
  const [myTeachers, setMyTeachers] = useState([]);
  const [myStudents, setMyStudents] = useState([]);

  const mustChange = user?.must_change_password === 1;
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isPlayer = user?.role === 'player';

  const loadRooms = useCallback(async () => {
    if (!isTeacher) return;
    const { data } = await apiJson('/api/study/my-rooms');
    setRooms(data.rooms || []);
  }, [isTeacher]);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    const { data } = await apiJson('/api/profile/dashboard');
    if (data.success) setDash(data.dashboard);
    setDashLoading(false);
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setMyTeachers(user?.teachers || []);
    setMyStudents(user?.students || []);
  }, [user]);

  useEffect(() => {
    setDisplayName(user?.display_name || user?.username || '');
    setUsername(user?.username || '');
  }, [user]);

  async function connectByCode(code) {
    setLinkMsg('');
    setLinkOk(false);
    const { res, data } = await apiJson('/api/link/connect', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (res.ok && data.success) {
      setLinkOk(true);
      setLinkMsg(t('link_success'));
      if (data.teachers) setMyTeachers(data.teachers);
      if (data.students) setMyStudents(data.students);
      await refreshUser();
    } else {
      const key =
        data.message === 'link_not_found'
          ? 'link_not_found'
          : data.message === 'link_invalid_roles'
            ? 'link_invalid_roles'
            : 'error';
      setLinkMsg(t(key));
    }
  }

  async function unlinkStudent(studentId) {
    const { res, data } = await apiJson(`/api/link/student/${studentId}`, { method: 'DELETE' });
    if (res.ok) {
      setMyStudents(data.students || []);
      await refreshUser();
    }
  }

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    setParentEmail(user?.parent_email || '');
    setNotifyEmail(user?.notify_email !== 0);
    setNotifyPush(user?.notify_push !== 0);
    setTzPrimary(user?.tz_primary || 'Asia/Yerevan');
    setTzSecondary(user?.tz_secondary || 'Europe/Berlin');
    if (user?.theme === 'dark' || user?.theme === 'light') {
      setTheme(user.theme);
    }
  }, [user, setTheme]);

  const loadPgnArchive = useCallback(async () => {
    if (!isStudent) return;
    const { data } = await apiJson('/api/pgn-archive');
    if (data.success) setPgnArchive(data.items || []);
  }, [isStudent]);

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
    const all = typeof user?.trophies === 'string' ? JSON.parse(user.trophies) : user?.trophies || [];
    trophies = all.filter((tr) => tr.type !== 'badge' && !tr.badgeId);
  } catch {
    trophies = [];
  }

  async function saveSettings() {
    const { res, data } = await apiJson('/api/profile/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        displayName,
        username,
        parentEmail,
        notifyEmail,
        notifyPush,
        tzPrimary,
        tzSecondary,
        theme,
      }),
    });
    if (res.ok) {
      setDisplayMsg(t('dash_saved'));
      setDisplayOk(true);
      await refreshUser();
      setTheme(theme);
    } else {
      const key =
        data.message === 'username_taken'
          ? 'username_taken'
          : data.message === 'username_invalid'
            ? 'username_invalid'
            : 'error';
      setDisplayMsg(t(key));
      setDisplayOk(false);
    }
  }

  async function approveRequest(id) {
    await api(`/api/schedule/requests/${id}/approve`, { method: 'POST' });
    await loadDashboard();
  }

  async function rejectRequest(id) {
    await api(`/api/schedule/requests/${id}/reject`, { method: 'POST' });
    await loadDashboard();
  }

  async function createStudyRoom() {
    const { data } = await apiJson('/api/study/create', {
      method: 'POST',
      body: JSON.stringify({ roomType: 'duo' }),
    });
    if (data.success) {
      await Swal.fire({
        icon: 'success',
        title: t('lobby_room_created'),
        html: `${t('lobby_student_code')} <b>${data.roomCode}</b>`,
        confirmButtonText: t('lobby_enter_room'),
      });
      loadRooms();
      navigate(`/study?room=${data.roomCode}`);
    } else {
      Swal.fire({ icon: 'error', title: data.message || t('error') });
    }
  }

  async function copyRoomCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      Swal.fire({ icon: 'success', title: t('dash_copied'), timer: 1000, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: 'error', title: t('error') });
    }
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
        <ProfileHero user={user} rating={rating} isPlayer={isPlayer} />

        <ProfileSection title={t('profile_section_now')}>
          {dashLoading && (
            <section className="profile-block profile-block--full">
              <p className="subtitle">{t('loading')}</p>
            </section>
          )}
          {!dashLoading && isStudent && (
            <ProfileStudentDashboard
              dash={dash}
              t={t}
              navigate={navigate}
              tzPrimary={tzPrimary}
              tzSecondary={tzSecondary}
            />
          )}
          {!dashLoading && isTeacher && (
            <ProfileTeacherDashboard
              dash={dash}
              t={t}
              navigate={navigate}
              onApproveRequest={approveRequest}
              onRejectRequest={rejectRequest}
              onCreateRoom={createStudyRoom}
            />
          )}
          {!dashLoading && isPlayer && (
            <ProfilePlayerDashboard
              dash={dash}
              rating={rating}
              t={t}
              navigate={navigate}
              resultLabel={(r) => resultLabel(r, t)}
              resultColor={resultColor}
              userHistory={user.history}
            />
          )}
        </ProfileSection>

        {(isStudent || isTeacher) && (
          <ProfileSection title={t('profile_section_connect')}>
            <section className="profile-block profile-block--full profile-block--link">
              <h3 className="profile-block__subtitle">{isStudent ? t('link_my_teachers') : t('link_my_students')}</h3>
              {isStudent && user.needs_teacher_link && (
                <p className="profile-link-alert">{t('link_teacher_required')}</p>
              )}
              <ProfileLinkCard
                user={user}
                onConnectCode={connectByCode}
                connectMsg={linkMsg}
                connectOk={linkOk}
              />
              {isStudent && (
                <ul className="profile-link-list">
                  {myTeachers.length === 0 ? (
                    <li className="subtitle">{t('link_no_teachers')}</li>
                  ) : (
                    myTeachers.map((te) => (
                      <li key={te.id}>
                        <strong>{te.display_name || te.username}</strong>
                        <span className="subtitle"> @{te.username}</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
              {isTeacher && (
                <ul className="profile-link-list">
                  {myStudents.length === 0 ? (
                    <li className="subtitle">{t('link_no_students')}</li>
                  ) : (
                    myStudents.map((st) => (
                      <li key={st.id} className="profile-link-list__item">
                        <span>
                          <strong>{st.display_name || st.username}</strong>
                          <span className="subtitle"> · {st.rating} Elo</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => unlinkStudent(st.id)}
                        >
                          {t('unlink')}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </section>
          </ProfileSection>
        )}

        {isPlayer && (
          <ProfileSection title={t('profile_section_game')}>
            <section className="profile-block profile-block--third">
              <div className="stats-grid stats-grid--row">
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
            <section className="profile-block profile-block--third">
              <h3>{t('profile_progress')}: <span>{t(currentLevel.key)}</span></h3>
              <div className="progress-container">
                <div id="progress-fill-bar" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="subtitle">{pointsText}</p>
            </section>
            <section className="profile-block profile-block--third">
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
          </ProfileSection>
        )}

        {(isStudent || isTeacher) && (
          <ProfileSection title={t('profile_section_materials')}>
            {isStudent && (
              <>
                <section className="profile-block profile-block--wide">
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
                <section className="profile-block profile-block--third">
                  <p className="subtitle">{t('onboarding_replay_hint')}</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-block mt-2"
                    onClick={() => {
                      triggerOnboardingReplay();
                      navigate('/lobby');
                    }}
                  >
                    {t('onboarding_replay')}
                  </button>
                </section>
              </>
            )}
            {isTeacher && (
              <>
                <section className="profile-block profile-block--full" id="teacher-rooms-panel">
                  <div className="profile-block__toolbar">
                    <h3>{t('profile_rooms')} ({rooms.length}/5)</h3>
                    <Link to="/library-editor" className="btn btn-secondary btn-sm">
                      {t('profile_library')}
                    </Link>
                  </div>
                  <div id="my-rooms-list" className="rooms-list-container">
                    {rooms.length === 0 ? (
                      <p className="subtitle">{t('profile_no_rooms')}</p>
                    ) : (
                      rooms.map((room) => (
                        <div className="room-item" key={room.room_code}>
                          <div><strong>{room.room_code}</strong></div>
                          <div className="room-item__actions">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyRoomCode(room.room_code)}>
                              {t('dash_copy_code')}
                            </button>
                            <Link to={`/study?room=${room.room_code}`} className="btn btn-primary btn-sm">
                              {t('profile_enter_room')}
                            </Link>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteRoom(room.room_code)}>
                              {t('delete')}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            )}
          </ProfileSection>
        )}

        <ProfileSection title={t('profile_section_account')}>
          <ProfileSettingsPanel
            t={t}
            username={username}
            setUsername={setUsername}
            displayName={displayName}
            setDisplayName={setDisplayName}
            onSaveDisplayName={saveSettings}
            displayMsg={displayMsg}
            displayOk={displayOk}
            lang={lang}
            setLang={setLang}
            theme={theme}
            setTheme={setTheme}
            showTz={isTeacher || isStudent}
            tzPrimary={tzPrimary}
            setTzPrimary={setTzPrimary}
            tzSecondary={tzSecondary}
            setTzSecondary={setTzSecondary}
            TIMEZONE_OPTIONS={TIMEZONE_OPTIONS}
          />
          {isTeacher && (
            <section className="profile-block profile-block--half">
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
          )}
          <section className="profile-block profile-block--half password-section">
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
          <div className="profile-block profile-block--full profile-block--actions">
            <button type="button" id="logout-btn" className="btn btn-danger" onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </ProfileSection>
      </div>
    </>
  );
}
