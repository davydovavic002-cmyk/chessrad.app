import { Link } from 'react-router-dom';
import { formatTimeInZone, zoneShortName } from '../../utils/timezone';
import {
  ChessCornerBadge,
  ChessTipCard,
  ProfilePieceProgress,
  TeacherClassPieces,
} from './ProfileChessDecor';
import AcademicLockedGate from '../AcademicLockedGate';

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

function MiniSparkline({ points = [], tone = 'elo', label }) {
  const vals = (points || []).map(Number).filter((n) => Number.isFinite(n));
  if (vals.length < 2) {
    return (
      <div className={`mini-spark mini-spark--${tone} mini-spark--empty`} title={label}>
        <span className="mini-spark__label">{label}</span>
        <span className="mini-spark__flat">—</span>
      </div>
    );
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const w = 88;
  const h = 28;
  const path = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className={`mini-spark mini-spark--${tone}`} title={label}>
      <span className="mini-spark__label">{label}</span>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
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

export function ProfileStudentDashboard({
  dash,
  t,
  navigate,
  tzPrimary,
  tzSecondary,
  username,
  role,
  academicLocked = false,
}) {
  const lesson = dash?.nextLesson;
  const hw = dash?.homework;
  const progress = dash?.progress;
  const learnArmy = dash?.learnArmy || [];
  const play = dash?.play || {};
  const playArmy = play.playArmy || [];
  const academicXp = Number(dash?.academicXp) || 0;
  const tournamentElo = Number(dash?.tournamentElo) || 0;
  const delta = Number(play.ratingDeltaWeek) || 0;
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

  return (
    <>
      <AcademicLockedGate locked={academicLocked} t={t}>
        <section className="profile-block profile-block--full profile-mode profile-mode--learn">
          <div className="profile-mode__head">
            <h3 className="profile-mode__title">📚 {t('mode_academic')}</h3>
            <p className="subtitle profile-mode__hint">{t('mode_academic_hint')}</p>
            <span className="profile-mode__xp">{academicXp} XP</span>
          </div>
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

            <div className="profile-dash-card profile-dash-card--chess">
              <ChessCornerBadge piece="♗" label={t('dash_learning')} />
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
              <ProfilePieceProgress
                t={t}
                done={progress?.topicsDone?.length || 0}
                total={Math.max((progress?.topicsDone?.length || 0) + (progress?.topicsPlanned?.length || 0), 1)}
                piece="♙"
              />
            </div>
          </div>

          {learnArmy.length > 0 && (
            <div className="profile-arsenal mt-2">
              <h4>{t('arsenal_learn')}</h4>
              <div className="profile-arsenal__row">
                {learnArmy.map((tier) => (
                  <span
                    key={tier.label}
                    className={`profile-arsenal__piece${tier.unlocked ? '' : ' profile-arsenal__piece--locked'}`}
                    title={`${t(tier.label)} · ${tier.min}+ XP`}
                  >
                    {tier.piece}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </AcademicLockedGate>

      <section className="profile-block profile-block--full profile-mode profile-mode--play">
        <div className="profile-mode__head">
          <h3 className="profile-mode__title">🏆 {t('mode_tournament')}</h3>
          <p className="subtitle profile-mode__hint">{t('mode_tournament_hint')}</p>
          <span className="profile-mode__elo">
            {tournamentElo} Elo
            {delta !== 0 && (
              <span className={`profile-mode__delta${delta > 0 ? ' profile-mode__delta--up' : ' profile-mode__delta--down'}`}>
                {' '}{deltaLabel} {t('rating_week')}
              </span>
            )}
          </span>
        </div>
        <div className="profile-dash-grid profile-dash-grid--3">
          <div className="profile-dash-card">
            <h4>{t('mode_play_form')}</h4>
            <div className="profile-dash-inline-stats">
              <StatPill label={t('profile_wins')} value={play.stats?.wins || 0} tone="ok" />
              <StatPill label={t('profile_draws')} value={play.stats?.draws || 0} />
              <StatPill label={t('profile_losses')} value={play.stats?.losses || 0} />
            </div>
            <p className="subtitle mt-1">
              {t('mode_winrate')}: {play.stats?.allTimeWinRate ?? 0}%
            </p>
            <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => navigate('/game')}>
              {t('lobby_find_game')}
            </button>
          </div>
          <div className="profile-dash-card">
            <h4>{t('lobby_tournaments')}</h4>
            {(play.tournaments || []).length === 0 ? (
              <p className="subtitle">{t('mode_no_tournaments')}</p>
            ) : (
              <ul className="profile-dash-list">
                {play.tournaments.slice(0, 3).map((tr) => (
                  <li key={tr.id}>
                    <strong>{tr.name}</strong>
                    <span className="subtitle"> · {tr.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={() => navigate('/tournaments')}>
              {t('lobby_tournaments')}
            </button>
          </div>
          <div className="profile-dash-card profile-dash-card--chess">
            <ChessCornerBadge piece="♕" label={t('arsenal_play')} />
            <h4>{t('arsenal_play')}</h4>
            <div className="profile-arsenal__row">
              {playArmy.map((tier) => (
                <span
                  key={tier.label}
                  className={`profile-arsenal__piece${tier.unlocked ? '' : ' profile-arsenal__piece--locked'}`}
                  title={`${t(tier.label)} · ${tier.min}+ ${t('profile_wins').toLowerCase()}`}
                >
                  {tier.piece}
                </span>
              ))}
            </div>
            <p className="subtitle mt-1">{t('arsenal_play_hint')}</p>
          </div>
        </div>
      </section>

      <ChessTipCard t={t} username={username} role={role} />

      <section className="profile-block profile-block--full">
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
  username,
  role,
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
          <TeacherClassPieces count={students.length} t={t} />
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
                  <p className="subtitle">@{st.username}</p>
                  <p className="profile-dash-student-card__ratings">
                    <span title={t('rating_tournament_hint')}>🏆 {st.tournamentElo ?? st.rating} Elo</span>
                    <span title={t('rating_academic_hint')}>📚 {st.academicXp ?? st.academic_xp ?? 0} XP</span>
                  </p>
                  <div className="profile-dash-student-card__charts">
                    <MiniSparkline
                      points={st.eloSparkline}
                      tone="elo"
                      label={t('rating_tournament')}
                    />
                    <MiniSparkline
                      points={st.xpSparkline}
                      tone="xp"
                      label={t('rating_academic')}
                    />
                  </div>
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

      <ChessTipCard t={t} username={username} role={role} />
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
