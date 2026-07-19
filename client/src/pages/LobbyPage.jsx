import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { apiJson } from '../api';
import { getSocket } from '../socket';
import LanguageToggle from '../components/LanguageToggle';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';
import Board from '../components/Board';
import {
  LobbyFloatingPieces,
  LobbyHeroBanner,
  LobbyLeaderMedal,
  LobbyMenuWatermark,
} from '../components/lobby/LobbyChessDecor';
import AcademicLockedGate from '../components/AcademicLockedGate';
import '../styles/style.css';
import '../styles/lobby.css';
import '../styles/lobby-spotlight.css';
import '../styles/academic-lock.css';

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [studyCode, setStudyCode] = useState('');
  const [spotlight, setSpotlight] = useState(null);
  const [badges, setBadges] = useState([]);

  const role = (user?.role || '').toLowerCase();
  const academicLocked = role === 'student' && Boolean(user?.needs_teacher_link);

  useEffect(() => {
    getSocket();
    apiJson('/api/lobby/spotlight').then(({ data }) => {
      if (data.success) setSpotlight(data);
    });
    apiJson('/api/achievements').then(({ data }) => {
      if (data.success) setBadges(data.badges || []);
    });
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function createStudy(roomType = 'duo') {
    const { data } = await apiJson('/api/study/create', {
      method: 'POST',
      body: JSON.stringify({ roomType }),
    });
    if (data.success) {
      const path = data.roomType === 'group' ? '/group-study' : '/study';
      await Swal.fire({
        icon: 'success',
        title: roomType === 'group' ? t('lobby_group_created') : t('lobby_room_created'),
        html: `${t('lobby_student_code')} <b style="font-size: 1.5em; color: #3498db;">${data.roomCode}</b>`,
        confirmButtonText: t('lobby_enter_room'),
      });
      navigate(`${path}?room=${data.roomCode}`);
    } else {
      Swal.fire({ icon: 'error', title: t('error'), text: data.message });
    }
  }

  async function createGroupStudy() {
    await createStudy('group');
  }

  async function joinStudy() {
    const roomCode = studyCode.trim().toUpperCase();
    if (!roomCode) {
      Swal.fire({ icon: 'info', text: t('lobby_enter_code') });
      return;
    }
    const { data } = await apiJson('/api/study/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode }),
    });
    if (data.success) {
      const path = data.roomType === 'group' ? '/group-study' : '/study';
      navigate(`${path}?room=${data.roomCode}`);
    } else if (data.message === 'teacher_link_required') {
      Swal.fire({
        icon: 'warning',
        title: t('link_teacher_required'),
        text: t('lobby_teacher_link_required'),
        confirmButtonText: t('back_to_profile'),
      }).then(() => navigate('/profile'));
    } else {
      Swal.fire({ icon: 'error', text: data.message || t('lobby_room_not_found') });
    }
  }

  const streakHtml =
    user?.win_streak > 0 ? (
      <span className="win-streak-badge streak-active">🔥 {user.win_streak}</span>
    ) : null;

  return (
    <div className="lobby-page lobby-page--chess">
      <LobbyFloatingPieces />
      <div className="lobby-container page-wrap">
        <header className="lobby-header">
          <div className="logo">
            <span className="logo-icon">♞</span>
            <span>ChessRad</span>
          </div>
          <div id="user-status" className="user-info">
            <ThemeToggle />
            <LanguageToggle />
            <NotificationBell />
            <span className="user-info__greeting">
              <span className="user-avatar user-avatar--sm" aria-hidden>
                {(user.display_name || user.username || '?')[0].toUpperCase()}
              </span>
              <span>
                {t('lobby_hello')}, <strong>{user.display_name || user.username}</strong>! {streakHtml}
              </span>
            </span>
            <button id="logout-btn" style={{ marginLeft: 15, cursor: 'pointer' }} onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </header>

        <main className="lobby-content">
          <LobbyHeroBanner user={user} t={t} academicLocked={academicLocked} />

          {academicLocked && (
            <div className="lobby-link-banner">
              <p>{t('lobby_teacher_link_banner')}</p>
              <Link to="/profile" className="btn btn-primary btn-sm">
                {t('link_connect_btn')}
              </Link>
            </div>
          )}

          {badges.length > 0 && (
            <div className="lobby-badges-strip">
              {badges.slice(0, 6).map((b, i) => (
                <span key={b.badgeId || i} className="lobby-badge-chip" title={b.title || b.tournamentName}>
                  {b.icon || '🏅'} {b.title || b.tournamentName}
                </span>
              ))}
            </div>
          )}

          {spotlight && (spotlight.leaders?.length > 0 || spotlight.liveGame) && (
            <section className="lobby-spotlight game-panel">
              <h3>{t('lobby_spotlight_title')}</h3>
              <div className="lobby-spotlight-inner">
                {spotlight.leaders?.length > 0 && (
                  <div className="lobby-leaders">
                    {spotlight.leaders.map((l) => (
                      <div key={l.rank} className="lobby-leader-row">
                        <span className="lobby-leader-rank">
                          {[1, 2, 3].includes(l.rank) ? <LobbyLeaderMedal rank={l.rank} /> : l.rank}
                        </span>
                        <span>{l.username}</span>
                        <strong>{l.score} {t('tournament_points').toLowerCase()}</strong>
                      </div>
                    ))}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/tournaments')}>
                      {t('tournament_schedule_title')} →
                    </button>
                  </div>
                )}
                {spotlight.liveGame?.fen && (
                  <div className="lobby-live-board">
                    <p className="subtitle">{t('lobby_live_game')}: {spotlight.liveGame.white} vs {spotlight.liveGame.black}</p>
                    <div style={{ maxWidth: 200, margin: '0 auto' }}>
                      <Board id="lobby-spotlight-board" fen={spotlight.liveGame.fen} allowDragging={false} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {role === 'student' ? (
            <>
              <div className="menu-grid">
                <div className="menu-card glass-card menu-card--profile menu-card--chess" onClick={() => navigate('/profile')}>
                  <LobbyMenuWatermark pieceKey="profile" />
                  <div className="card-icon">👤</div>
                  <div className="card-text">
                    <h3>{t('lobby_profile')}</h3>
                    <p>{t('lobby_profile_sub_dual')}</p>
                  </div>
                </div>
              </div>

              <div className="lobby-section lobby-section--play">
                <h2>🏆 {t('mode_tournament')}</h2>
                <p className="subtitle lobby-section__hint">{t('mode_tournament_hint')}</p>
                <div className="menu-grid">
                  <div className="menu-card primary glass-card menu-card--chess" onClick={() => navigate('/game')}>
                    <LobbyMenuWatermark pieceKey="game" />
                    <div className="card-icon">⚔️</div>
                    <div className="card-text">
                      <h3>{t('lobby_find_game')}</h3>
                      <p>{t('lobby_find_game_sub')}</p>
                    </div>
                  </div>
                  <div className="menu-card glass-card menu-card--chess" onClick={() => navigate('/tournaments')}>
                    <LobbyMenuWatermark pieceKey="tournaments" />
                    <div className="card-icon">🏆</div>
                    <div className="card-text">
                      <h3>{t('lobby_tournaments')}</h3>
                      <p>{t('lobby_tournaments_sub')}</p>
                    </div>
                  </div>
                </div>
              </div>

              <AcademicLockedGate locked={academicLocked} t={t} className="lobby-section-lock">
                <div className="lobby-section lobby-section--learn">
                  <h2>📚 {t('mode_academic')}</h2>
                  <p className="subtitle lobby-section__hint">{t('mode_academic_hint')}</p>
                  <div className="menu-grid">
                    <div className="menu-card glass-card menu-card--chess" onClick={() => navigate('/schedule')}>
                      <LobbyMenuWatermark pieceKey="schedule" />
                      <div className="card-icon">📅</div>
                      <div className="card-text">
                        <h3>{t('lobby_schedule')}</h3>
                        <p>{t('lobby_schedule_sub')}</p>
                      </div>
                    </div>
                    <div className="menu-card glass-card game-feature-card menu-card--chess" onClick={() => navigate('/homework')}>
                      <LobbyMenuWatermark pieceKey="homework" />
                      <div className="card-icon">📝</div>
                      <div className="card-text">
                        <h3>{t('lobby_homework')}</h3>
                        <p>{t('lobby_homework_sub')}</p>
                      </div>
                    </div>
                    <div className="menu-card glass-card game-feature-card menu-card--chess" onClick={() => navigate('/calendar')}>
                      <LobbyMenuWatermark pieceKey="calendar" />
                      <div className="card-icon">🗓️</div>
                      <div className="card-text">
                        <h3>{t('lobby_calendar')}</h3>
                        <p>{t('lobby_calendar_sub')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lobby-section study-section">
                  <h2>{t('lobby_study')}</h2>
                  <div id="study-controls">
                    <div className="menu-card study-card menu-card--chess" style={{ cursor: 'default', padding: 15, minHeight: 'auto' }}>
                      <LobbyMenuWatermark pieceKey="study" />
                      <div className="card-icon">🎓</div>
                      <div className="card-text" style={{ width: '100%' }}>
                        <h3>{t('lobby_join_study')}</h3>
                        <div className="study-join-row">
                          <input
                            type="text"
                            className="form-input study-join-input"
                            placeholder={t('lobby_room_code')}
                            value={studyCode}
                            onChange={(e) => setStudyCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && joinStudy()}
                          />
                          <button type="button" className="btn btn-primary btn-sm study-join-btn" onClick={joinStudy}>
                            {t('lobby_join')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </AcademicLockedGate>
            </>
          ) : (
            <>
              <div className="menu-grid">
                <div className="menu-card glass-card menu-card--profile menu-card--chess" onClick={() => navigate('/profile')}>
                  <LobbyMenuWatermark pieceKey="profile" />
                  <div className="card-icon">👤</div>
                  <div className="card-text">
                    <h3>{t('lobby_profile')}</h3>
                    <p>{t('lobby_profile_sub')}</p>
                  </div>
                </div>

                {role !== 'teacher' && role !== 'admin' && (
                  <div className="menu-card primary glass-card menu-card--chess" onClick={() => navigate('/game')}>
                    <LobbyMenuWatermark pieceKey="game" />
                    <div className="card-icon">⚔️</div>
                    <div className="card-text">
                      <h3>{t('lobby_find_game')}</h3>
                      <p>{t('lobby_find_game_sub')}</p>
                    </div>
                  </div>
                )}

                {(role === 'teacher' || role === 'admin') && (
                  <>
                    <div
                      className="menu-card primary glass-card game-feature-card game-feature-card--journal menu-card--chess"
                      onClick={() => navigate('/journal')}
                    >
                      <LobbyMenuWatermark pieceKey="journal" />
                      <div className="card-icon">📓</div>
                      <div className="card-text">
                        <h3>{t('lobby_journal')}</h3>
                        <p>{t('lobby_journal_sub')}</p>
                      </div>
                    </div>
                    <div className="menu-card glass-card menu-card--chess" onClick={() => navigate('/schedule')}>
                      <LobbyMenuWatermark pieceKey="schedule" />
                      <div className="card-icon">📅</div>
                      <div className="card-text">
                        <h3>{t('lobby_schedule')}</h3>
                        <p>{t('lobby_schedule_sub')}</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="menu-card glass-card menu-card--chess" onClick={() => navigate('/tournaments')}>
                  <LobbyMenuWatermark pieceKey="tournaments" />
                  <div className="card-icon">🏆</div>
                  <div className="card-text">
                    <h3>{t('lobby_tournaments')}</h3>
                    <p>{t('lobby_tournaments_sub')}</p>
                  </div>
                </div>

                {role === 'admin' && (
                  <div
                    className="menu-card glass-card menu-card--chess"
                    style={{ borderColor: 'rgba(255,107,107,0.4)', background: 'rgba(255,107,107,0.1)' }}
                    onClick={() => navigate('/admin')}
                  >
                    <LobbyMenuWatermark pieceKey="admin" />
                    <div className="card-icon">⚙️</div>
                    <div className="card-text">
                      <h3>{t('lobby_admin')}</h3>
                      <p>{t('lobby_admin_sub')}</p>
                    </div>
                  </div>
                )}
              </div>

              {role !== 'player' && (
                <div className="lobby-section study-section">
                  <h2>{t('lobby_study')}</h2>
                  <div id="study-controls">
                    {(role === 'teacher' || role === 'admin') && (
                      <>
                        <div
                          className="menu-card primary study-card menu-card--chess"
                          style={{ cursor: 'pointer', padding: 15 }}
                          onClick={() => createStudy('duo')}
                        >
                          <LobbyMenuWatermark pieceKey="study" />
                          <div className="card-icon">👨‍🏫</div>
                          <div className="card-text">
                            <h3>{t('lobby_create_study')}</h3>
                            <p>{t('lobby_create_study_sub')}</p>
                          </div>
                        </div>
                        <div
                          className="menu-card study-card menu-card--chess"
                          style={{ cursor: 'pointer', padding: 15, marginTop: 12 }}
                          onClick={createGroupStudy}
                        >
                          <LobbyMenuWatermark pieceKey="group" />
                          <div className="card-icon">👥</div>
                          <div className="card-text">
                            <h3>{t('lobby_create_group')}</h3>
                            <p>{t('lobby_create_group_sub')}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
