import { Link } from 'react-router-dom';
import { formatTimeInZone, zoneShortName } from '../../utils/timezone';

function StatPill({ label, value, tone }) {
  return (
    <div className={`profile-dash-stat${tone ? ` profile-dash-stat--${tone}` : ''}`}>
      <span className="profile-dash-stat__value">{value}</span>
      <span className="profile-dash-stat__label">{label}</span>
    </div>
  );
}

function BadgeStrip({ badges, t }) {
  if (!badges?.length) {
    return <p className="subtitle">{t('dash_no_badges')}</p>;
  }
  return (
    <div className="profile-dash-badges">
      {badges.slice(0, 8).map((b, i) => (
        <span
          key={b.badgeId || b.id || i}
          className="profile-dash-badge"
          style={{ background: b.color || 'rgba(255,143,98,0.25)' }}
          title={b.title || b.tournamentName}
        >
          {b.icon || '🏅'} {b.title || b.tournamentName}
        </span>
      ))}
    </div>
  );
}

function PuzzleWidget({ puzzle, t, navigate }) {
  if (!puzzle) return null;
  return (
    <div className="profile-dash-puzzle">
      <div className="profile-dash-puzzle__row">
        <span className="profile-dash-puzzle__streak">🔥 {puzzle.streak || 0}</span>
        <span className="subtitle">
          {puzzle.completedToday
            ? t('dash_puzzle_done')
            : t('dash_puzzle_progress', { n: puzzle.solvedToday || 0 })}
        </span>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/puzzle')}>
        {t('dash_puzzle_go')}
      </button>
    </div>
  );
}

function QuickActions({ actions }) {
  return (
    <div className="profile-dash-actions">
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          className={`btn ${a.primary ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={a.onClick}
        >
          {a.icon ? `${a.icon} ` : ''}{a.label}
        </button>
      ))}
    </div>
  );
}

export function ProfileStudentDashboard({ dash, t, navigate, tzPrimary, tzSecondary }) {
  const lesson = dash?.nextLesson;
  const hw = dash?.homework;
  const progress = dash?.progress;

  return (
    <>
      <section className="profile-block profile-block--full">
        <div className="profile-dash-grid profile-dash-grid--3">
          <div className="profile-dash-card">
            <h4>{t('dash_next_lesson')}</h4>
            {lesson ? (
              <>
                <p className="profile-dash-card__main">
                  {lesson.lesson_date} · {lesson.time_slot}
                </p>
                <p className="subtitle">
                  {lesson.teacher_display || lesson.teacher_name}
                  {tzPrimary && tzSecondary && (
                    <> · {formatTimeInZone(lesson.lesson_date, lesson.time_slot, tzPrimary, tzSecondary)}{' '}
                    {zoneShortName(tzSecondary)}</>
                  )}
                </p>
                {lesson.video_url && (
                  <a href={lesson.video_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm mt-1">
                    {t('dash_video_link')}
                  </a>
                )}
              </>
            ) : (
              <p className="subtitle">{t('dash_no_lesson')}</p>
            )}
            <Link to="/calendar" className="btn btn-ghost btn-sm mt-2">{t('dash_open_calendar')}</Link>
          </div>

          <div className="profile-dash-card">
            <h4>{t('dash_homework')}</h4>
            <div className="profile-dash-inline-stats">
              <StatPill label={t('dash_hw_pending')} value={hw?.pending || 0} />
              <StatPill label={t('dash_hw_overdue')} value={hw?.overdue || 0} tone={hw?.overdue ? 'warn' : undefined} />
            </div>
            {hw?.latest && (
              <p className="subtitle mt-1">
                {t('dash_hw_next')}: <strong>{hw.latest.title}</strong> — {hw.latest.due_date}
              </p>
            )}
            <Link to={hw?.latest ? `/homework?id=${hw.latest.id}` : '/homework'} className="btn btn-primary btn-sm mt-2">
              {t('homework_title')}
            </Link>
          </div>

          <div className="profile-dash-card">
            <h4>{t('dash_learning')}</h4>
            <p className="subtitle">
              {t('dash_topics_done', { n: progress?.topicsDone?.length || 0 })}
            </p>
            <p className="subtitle">
              {t('dash_hw_ratio', {
                done: progress?.homeworkDone || 0,
                total: progress?.homeworkTotal || 0,
              })}
            </p>
            {(progress?.topicsPlanned?.length || 0) > 0 && (
              <p className="profile-dash-topics">
                {t('dash_weak_topics')}: {progress.topicsPlanned.slice(0, 4).join(', ')}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="profile-block profile-block--third">
        <h3>{t('dash_puzzle_streak')}</h3>
        <PuzzleWidget puzzle={dash?.puzzle} t={t} navigate={navigate} />
      </section>

      <section className="profile-block profile-block--third">
        <h3>{t('dash_achievements')}</h3>
        <BadgeStrip badges={dash?.badges} t={t} />
      </section>
    </>
  );
}

export function ProfileTeacherDashboard({
  dash,
  t,
  navigate,
  onApproveRequest,
  onRejectRequest,
  onCreateRoom,
}) {
  const today = dash?.todayLessons || [];
  const requests = dash?.pendingRequests || [];
  const students = dash?.studentSnapshots || [];

  return (
    <>
      <section className="profile-block profile-block--full">
        <div className="profile-teacher-overview">
          <div className="profile-dash-inline-stats">
            <StatPill label={t('dash_lessons_today')} value={today.length} />
            <StatPill label={t('dash_requests')} value={dash?.pendingRequestsCount || 0} tone={dash?.pendingRequestsCount ? 'warn' : undefined} />
            <StatPill label={t('dash_hw_check')} value={dash?.homeworkPendingTotal || 0} />
            <StatPill label={t('dash_students')} value={students.length} />
          </div>
          <QuickActions
            actions={[
              { key: 'room', label: t('dash_create_room'), icon: '➕', primary: true, onClick: onCreateRoom },
              { key: 'schedule', label: t('profile_schedule'), onClick: () => navigate('/schedule') },
              { key: 'journal', label: t('profile_journal'), onClick: () => navigate('/journal') },
            ]}
          />
        </div>
        <div className="profile-teacher-today mt-2">
          <h4>{t('dash_teacher_schedule_today')}</h4>
          {today.length > 0 ? (
            <ul className="profile-dash-list">
              {today.map((l) => (
                <li key={l.id}>
                  <strong>{l.time_slot}</strong>
                  <span className="subtitle"> · {(l.studentIds || []).length} {t('dash_students_short')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtitle">{t('dash_no_lessons_today')}</p>
          )}
        </div>
      </section>

      {requests.length > 0 && (
        <section className="profile-block profile-block--full">
          <h3>{t('schedule_requests')}</h3>
          <ul className="profile-dash-list">
            {requests.map((r) => (
              <li key={r.id} className="profile-dash-list__item">
                <span>
                  <strong>{r.student_name}</strong>
                  <span className="subtitle"> — {r.lesson_date} {r.time_slot}</span>
                </span>
                <span className="profile-dash-list__actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onApproveRequest(r.id)}>
                    {t('dash_approve')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRejectRequest(r.id)}>
                    {t('dash_reject')}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="profile-block profile-block--full">
        <h3>{t('dash_my_class')}</h3>
        {students.length === 0 ? (
          <p className="subtitle">{t('link_no_students')}</p>
        ) : (
          <div className="profile-dash-student-cards">
            {students.map((st) => (
              <div key={st.id} className="profile-dash-student-card">
                <div>
                  <strong>{st.display_name || st.username}</strong>
                  <p className="subtitle">@{st.username} · {st.rating} Elo</p>
                  <p className="subtitle profile-dash-student-card__meta">
                    {st.pendingHomework > 0
                      ? t('dash_student_hw_pending', { n: st.pendingHomework })
                      : t('dash_student_hw_ok')}
                    {st.lastLessonDate ? ` · ${t('dash_last_lesson')}: ${st.lastLessonDate}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/journal?studentId=${st.id}`)}
                >
                  {t('profile_journal')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function formDotClass(result) {
  if (result === 'Победа' || result === 'Win') return 'win';
  if (result === 'Ничья' || result === 'Draw') return 'draw';
  return 'loss';
}

function RatingSparkline({ points }) {
  if (!points?.length || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 40);
  const width = 220;
  const height = 56;
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg className="profile-player-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayerFormStrip({ games, t, resultLabel }) {
  if (!games?.length) {
    return <p className="subtitle">{t('player_form_empty')}</p>;
  }
  return (
    <div className="profile-player-form">
      <div className="profile-player-form__dots" aria-label={t('player_form_recent')}>
        {[...games].reverse().map((game, index) => (
          <span
            key={`${game.id || index}-${game.opponent}`}
            className={`profile-player-form__dot profile-player-form__dot--${formDotClass(game.result)}`}
            title={`${game.opponent}: ${resultLabel(game.result)}`}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerTournamentList({ tournaments, t, navigate, lang }) {
  if (!tournaments?.length) {
    return <p className="subtitle">{t('player_tourney_empty')}</p>;
  }
  const fmt = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };
  return (
    <ul className="profile-player-tourney-list">
      {tournaments.map((row) => (
        <li key={row.id} className="profile-player-tourney-list__item">
          <button
            type="button"
            className="profile-player-tourney-list__main"
            onClick={() => navigate(`/tournaments/${row.id}`)}
          >
            <strong>{row.name}</strong>
            <span className="subtitle">
              {fmt(row.starts_at)} · {row.time_control}
              {row.status === 'running' ? ` · ${t('tournament_status_running')}` : ''}
            </span>
          </button>
          <span className="profile-player-tourney-list__meta">
            {row.demo_players || 0}/{row.max_players || 32}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProfilePlayerDashboard({ dash, rating, t, lang, navigate, resultLabel, resultColor, userHistory }) {
  const history = dash?.history?.length ? dash.history : userHistory || [];
  const form = dash?.form;
  const recentGames = history.slice(0, 10);

  return (
    <>
      {dash?.funTitle && (
        <section className="profile-block profile-block--full profile-player-title-card">
          <span className="profile-player-fun-title">{t(dash.funTitle)}</span>
          <p className="subtitle profile-player-fun-sub">{t('player_fun_title_hint')}</p>
        </section>
      )}

      <section className="profile-block profile-block--half">
        <h3>{t('player_form_title')}</h3>
        <div className="profile-dash-inline-stats mb-2">
          <StatPill label={t('player_form_winrate')} value={form?.total ? `${form.winRate}%` : '—'} />
          <StatPill
            label={t('player_form_record')}
            value={form?.total ? `${form.wins}/${form.draws}/${form.losses}` : '—'}
          />
        </div>
        <PlayerFormStrip games={recentGames} t={t} resultLabel={resultLabel} />
        {form?.total ? (
          <p className="subtitle profile-player-form-caption">
            {t('player_form_caption', { n: form.total, rate: form.winRate })}
          </p>
        ) : null}
      </section>

      <section className="profile-block profile-block--half">
        <h3>{t('player_rating_chart')}</h3>
        <div className="profile-player-chart-wrap">
          <RatingSparkline points={dash?.ratingSparkline} />
          <div className="profile-player-chart-meta">
            <StatPill label={t('profile_rating')} value={rating} />
            {dash?.stats?.allTimeWinRate != null && (
              <StatPill label={t('player_alltime_winrate')} value={`${dash.stats.allTimeWinRate}%`} />
            )}
          </div>
        </div>
      </section>

      <section className="profile-block profile-block--third">
        <h3>{t('player_streaks_title')}</h3>
        <div className="profile-player-streaks">
          <div className="profile-player-streak">
            <span className="profile-player-streak__emoji">🔥</span>
            <div>
              <strong>{dash?.streaks?.win || 0}</strong>
              <span className="subtitle">{t('player_win_streak')}</span>
            </div>
          </div>
          <div className="profile-player-streak">
            <span className="profile-player-streak__emoji">🧩</span>
            <div>
              <strong>{dash?.streaks?.daily || dash?.puzzle?.streak || 0}</strong>
              <span className="subtitle">{t('player_daily_streak')}</span>
            </div>
          </div>
          <div className="profile-player-streak">
            <span className="profile-player-streak__emoji">🏆</span>
            <div>
              <strong>{dash?.stats?.trophyCount || 0}</strong>
              <span className="subtitle">{t('profile_trophies')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="profile-block profile-block--wide">
        <h3>{t('dash_player_play')}</h3>
        <div className="profile-dash-inline-stats mb-2">
          <StatPill label={t('profile_rating')} value={rating} />
          <StatPill label={t('dash_puzzle_streak')} value={dash?.puzzle?.streak || 0} />
        </div>
        <QuickActions
          actions={[
            { key: 'game', label: t('lobby_find_game'), icon: '⚔️', primary: true, onClick: () => navigate('/game') },
            { key: 'bot', label: t('dash_play_bot'), onClick: () => navigate('/play-bot') },
            { key: 'tournaments', label: t('lobby_tournaments'), onClick: () => navigate('/tournaments') },
            { key: 'puzzle', label: t('lobby_daily'), onClick: () => navigate('/puzzle') },
          ]}
        />
        <PuzzleWidget puzzle={dash?.puzzle} t={t} navigate={navigate} />
      </section>

      <section className="profile-block profile-block--half">
        <h3>{t('player_tourney_title')}</h3>
        <PlayerTournamentList tournaments={dash?.tournaments} t={t} navigate={navigate} lang={lang} />
        <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => navigate('/tournaments')}>
          {t('player_tourney_all')}
        </button>
      </section>

      <section className="profile-block profile-block--third">
        <h3>{t('dash_achievements')}</h3>
        <BadgeStrip badges={dash?.badges} t={t} />
      </section>

      <section className="profile-block profile-block--full">
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
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="subtitle">{t('profile_history_empty')}</td>
                </tr>
              ) : (
                history.map((game, i) => (
                  <tr key={i}>
                    <td>{game.opponent || t('profile_anonymous')}</td>
                    <td style={{ color: resultColor(game.result), fontWeight: 'bold' }}>
                      {resultLabel(game.result)}
                    </td>
                    <td>{game.type || t('profile_match')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function ProfileSettingsPanel({
  t,
  username,
  setUsername,
  displayName,
  setDisplayName,
  onSaveDisplayName,
  displayMsg,
  displayOk,
  lang,
  setLang,
  theme,
  setTheme,
  showTz,
  tzPrimary,
  setTzPrimary,
  tzSecondary,
  setTzSecondary,
  TIMEZONE_OPTIONS,
  showParentNotify,
  parentEmail,
  setParentEmail,
  notifyEmail,
  setNotifyEmail,
  notifyPush,
  setNotifyPush,
}) {
  return (
    <section className="profile-block profile-block--half profile-block--settings">
      <h3>{t('dash_settings')}</h3>
      <label className="profile-check" style={{ display: 'block', marginBottom: 10 }}>
        {t('profile_username')}
        <input
          className="form-input mt-1"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
          placeholder={t('profile_username_ph')}
          autoComplete="username"
        />
      </label>
      <p className="subtitle profile-field-hint">{t('profile_username_hint')}</p>
      <label className="profile-check" style={{ display: 'block', marginBottom: 10, marginTop: 12 }}>
        {t('auth_display_name')}
        <input
          className="form-input mt-1"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('auth_display_name_ph')}
        />
      </label>
      <p className="subtitle profile-field-hint">{t('profile_display_name_hint')}</p>
      <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={onSaveDisplayName}>
        {t('save')}
      </button>
      {displayMsg && (
        <div className={`status-msg${displayOk ? ' success' : ' error'}`}>{displayMsg}</div>
      )}

      {showParentNotify && (
        <div className="profile-notify-compact">
          <label className="profile-notify-compact__label" htmlFor="parent-email-input">
            {t('profile_parent_email')}
          </label>
          <input
            id="parent-email-input"
            className="form-input form-input--compact"
            type="email"
            value={parentEmail}
            onChange={(e) => setParentEmail(e.target.value)}
            placeholder="parent@email.com"
          />
          <div className="profile-notify-compact__checks">
            <label className="profile-check">
              <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
              {t('profile_notify_email')}
            </label>
            <label className="profile-check">
              <input type="checkbox" checked={notifyPush} onChange={(e) => setNotifyPush(e.target.checked)} />
              {t('profile_notify_push')}
            </label>
          </div>
        </div>
      )}

      <div className="profile-dash-settings-row mt-2">
        <label className="profile-check">
          {t('lobby_lang')}
          <select className="form-input mt-1" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="profile-check">
          {t('dash_theme')}
          <select className="form-input mt-1" value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">{t('dash_theme_light')}</option>
            <option value="dark">{t('dash_theme_dark')}</option>
          </select>
        </label>
      </div>

      {showTz && TIMEZONE_OPTIONS && (
        <>
          <label className="profile-check" style={{ display: 'block', marginTop: 12, marginBottom: 8 }}>
            {t('tz_primary')}
            <select className="form-input mt-1" value={tzPrimary} onChange={(e) => setTzPrimary(e.target.value)}>
              {TIMEZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="profile-check" style={{ display: 'block', marginBottom: 8 }}>
            {t('tz_secondary')}
            <select className="form-input mt-1" value={tzSecondary} onChange={(e) => setTzSecondary(e.target.value)}>
              {TIMEZONE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <p className="subtitle">{t('tz_hint')}</p>
        </>
      )}
    </section>
  );
}
