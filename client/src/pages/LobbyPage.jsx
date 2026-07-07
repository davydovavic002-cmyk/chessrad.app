import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { apiJson } from '../api';
import { getSocket } from '../socket';
import Modal from '../components/Modal';
import LanguageToggle from '../components/LanguageToggle';
import ThemeToggle from '../components/ThemeToggle';
import NotificationBell from '../components/NotificationBell';
import Board from '../components/Board';
import '../styles/style.css';
import '../styles/lobby-spotlight.css';

export default function LobbyPage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [puzzleStatus, setPuzzleStatus] = useState(null);
  const [studyCode, setStudyCode] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const [spotlight, setSpotlight] = useState(null);
  const [badges, setBadges] = useState([]);

  const role = (user?.role || '').toLowerCase();

  const loadPuzzleStatus = useCallback(async () => {
    try {
      const { res, data } = await apiJson('/api/user/puzzle-status');
      if (res.ok) setPuzzleStatus(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadPuzzleStatus();
    getSocket();
    apiJson('/api/lobby/spotlight').then(({ data }) => {
      if (data.success) setSpotlight(data);
    });
    apiJson('/api/achievements').then(({ data }) => {
      if (data.success) setBadges(data.badges || []);
    });
  }, [loadPuzzleStatus]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === 'STREAK_RESTORED') {
        setBotOpen(false);
        loadPuzzleStatus();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadPuzzleStatus]);

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
    const { res, data } = await apiJson('/api/study/join', {
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
    user?.daily_streak > 0 ? (
      <span className="win-streak-badge streak-active">🔥 {user.daily_streak}</span>
    ) : null;

  let puzzleCardClass = 'menu-card glass-card streak-daily-card';
  let puzzleTitle = t('lobby_daily');
  let puzzleSubtitle = t('lobby_daily_loading');
  let puzzleIcon = '🔥';
  let barWidth = '0%';
  let onPuzzleClick = () => navigate('/puzzle');

  if (puzzleStatus?.canRestore) {
    puzzleCardClass += ' streak-broken';
    puzzleTitle = t('lobby_streak_threat');
    puzzleSubtitle = t('lobby_streak_return', { n: puzzleStatus.previousStreak });
    puzzleIcon = '💔';
    onPuzzleClick = () => setRestoreOpen(true);
  } else if (puzzleStatus?.completedToday) {
    puzzleCardClass += ' streak-completed';
    puzzleTitle = t('lobby_daily_done');
    puzzleSubtitle = t('lobby_daily_done_sub');
    puzzleIcon = '✅';
    barWidth = '100%';
  } else if (puzzleStatus) {
    puzzleCardClass += ' streak-urgent';
    puzzleTitle = t('lobby_daily_tasks');
    puzzleSubtitle = t('lobby_daily_progress', { n: puzzleStatus.solvedToday || 0 });
    barWidth = `${(puzzleStatus.solvedToday || 0) * 10}%`;
  }

  return (
    <>
      <div className="lobby-container page-wrap" style={{ visibility: 'visible' }}>
        <header className="lobby-header">
          <div className="logo-area">
            <h1>{t('app_name')}</h1>
            <span className="badge badge-online">Online</span>
          </div>
          <div id="user-status" className="user-info">
            <ThemeToggle />
            <LanguageToggle />
            <NotificationBell />
            <span>
              {t('lobby_hello')}, <strong>{user.display_name || user.username}</strong>! {streakHtml}
            </span>
            <button id="logout-btn" style={{ marginLeft: 15, cursor: 'pointer' }} onClick={handleLogout}>
              {t('logout')}
            </button>
          </div>
        </header>

        <main className="lobby-content">
          <div className="lobby-intro">
            <span className="lobby-welcome-pill">{t('lobby_welcome')}</span>
            <p className="lobby-intro__name">{user.display_name || user.username}</p>
            <p className="subtitle lobby-intro__sub">{t('lobby_subtitle')}</p>
          </div>

          {role === 'student' && user?.needs_teacher_link && (
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
                        <span className="lobby-leader-rank">{l.rank}</span>
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

          <div className="menu-grid">
            {role !== 'teacher' && role !== 'admin' && (
            <div className="menu-card primary glass-card" onClick={() => navigate('/game')}>
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
                className="menu-card primary glass-card game-feature-card game-feature-card--journal"
                onClick={() => navigate('/journal')}
              >
                <div className="card-icon">📓</div>
                <div className="card-text">
                  <h3>{t('lobby_journal')}</h3>
                  <p>{t('lobby_journal_sub')}</p>
                </div>
              </div>
              <div className="menu-card glass-card" onClick={() => navigate('/schedule')}>
                <div className="card-icon">📅</div>
                <div className="card-text">
                  <h3>{t('lobby_schedule')}</h3>
                  <p>{t('lobby_schedule_sub')}</p>
                </div>
              </div>
              </>
            )}

            <div className="menu-card glass-card" onClick={() => navigate('/profile')}>
              <div className="card-icon">👤</div>
              <div className="card-text">
                <h3>{t('lobby_profile')}</h3>
                <p>{t('lobby_profile_sub')}</p>
              </div>
            </div>

            {role === 'student' && (
            <div className="menu-card glass-card" onClick={() => navigate('/schedule')}>
              <div className="card-icon">📅</div>
              <div className="card-text">
                <h3>{t('lobby_schedule')}</h3>
                <p>{t('lobby_schedule_sub')}</p>
              </div>
            </div>
            )}

            {role === 'student' && (
              <>
              <div
                className="menu-card glass-card game-feature-card"
                onClick={() => navigate('/homework')}
              >
                <div className="card-icon">📝</div>
                <div className="card-text">
                  <h3>{t('lobby_homework')}</h3>
                  <p>{t('lobby_homework_sub')}</p>
                </div>
              </div>
              <div
                className="menu-card glass-card game-feature-card"
                onClick={() => navigate('/calendar')}
              >
                <div className="card-icon">🗓️</div>
                <div className="card-text">
                  <h3>{t('lobby_calendar')}</h3>
                  <p>{t('lobby_calendar_sub')}</p>
                </div>
              </div>
              </>
            )}

            <div className="menu-card glass-card" onClick={() => navigate('/tournaments')}>
              <div className="card-icon">🏆</div>
              <div className="card-text">
                <h3>{t('lobby_tournaments')}</h3>
                <p>{t('lobby_tournaments_sub')}</p>
              </div>
            </div>

            {role !== 'teacher' && role !== 'admin' && (
            <div className={puzzleCardClass} onClick={onPuzzleClick}>
              <div className="card-icon">{puzzleIcon}</div>
              <div className="card-text">
                <h3>{puzzleTitle}</h3>
                <p>{puzzleSubtitle}</p>
                <div className="streak-progress-mini">
                  <div id="streak-bar-fill" style={{ width: barWidth }} />
                </div>
              </div>
            </div>
            )}

            {role === 'admin' && (
              <div
                className="menu-card glass-card"
                style={{ borderColor: 'rgba(255,107,107,0.4)', background: 'rgba(255,107,107,0.1)' }}
                onClick={() => navigate('/admin')}
              >
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
              {role === 'teacher' || role === 'admin' ? (
                <>
                <div
                  className="menu-card primary study-card"
                  style={{ cursor: 'pointer', padding: 15 }}
                  onClick={() => createStudy('duo')}
                >
                  <div className="card-icon">👨‍🏫</div>
                  <div className="card-text">
                    <h3>{t('lobby_create_study')}</h3>
                    <p>{t('lobby_create_study_sub')}</p>
                  </div>
                </div>
                <div
                  className="menu-card study-card"
                  style={{ cursor: 'pointer', padding: 15, marginTop: 12 }}
                  onClick={createGroupStudy}
                >
                  <div className="card-icon">👥</div>
                  <div className="card-text">
                    <h3>{t('lobby_create_group')}</h3>
                    <p>{t('lobby_create_group_sub')}</p>
                  </div>
                </div>
                </>
              ) : (
                <div className="menu-card study-card" style={{ cursor: 'default', padding: 15, minHeight: 'auto' }}>
                  <div className="card-icon">🎓</div>
                  <div className="card-text" style={{ width: '100%' }}>
                    <h3>{t('lobby_join_study')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder={t('lobby_room_code')}
                        value={studyCode}
                        onChange={(e) => setStudyCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && joinStudy()}
                        style={{ padding: 10, border: '1px solid #ddd', borderRadius: 6, width: 180, color: '#333' }}
                      />
                      <button
                        type="button"
                        onClick={joinStudy}
                        style={{
                          padding: '10px 15px',
                          background: '#2ecc71',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {t('lobby_join')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </main>
      </div>

      <Modal open={restoreOpen} onClose={() => setRestoreOpen(false)}>
        <span className="modal-icon">💔</span>
        <h2>{t('lobby_streak_threat')}</h2>
        <p>
          {t('lobby_streak_return', { n: puzzleStatus?.previousStreak })}
        </p>
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setRestoreOpen(false);
            setBotOpen(true);
          }}
        >
          ⚔️
        </button>
        <button className="btn btn-ghost btn-block mt-2" onClick={() => setRestoreOpen(false)}>
          {t('cancel')}
        </button>
      </Modal>

      <Modal
        open={botOpen}
        onClose={() => {
          setBotOpen(false);
          loadPuzzleStatus();
        }}
        contentClassName="bot-modal-panel"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, textAlign: 'left' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🤖</h3>
          <button
            type="button"
            className="close-btn"
            style={{ background: 'none', border: 'none', color: 'var(--coral)', fontSize: 28, cursor: 'pointer' }}
            onClick={() => {
              setBotOpen(false);
              loadPuzzleStatus();
            }}
          >
            &times;
          </button>
        </div>
        <iframe title="bot" src="/play-bot?mode=restore_streak" style={{ width: '100%', height: 520, border: 'none' }} />
      </Modal>
    </>
  );
}
