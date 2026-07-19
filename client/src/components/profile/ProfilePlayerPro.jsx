import { PlayerProSectionHead, PlayerProTrophyShelf } from './PlayerProShell';
import {
  PlayerChessArmy,
  PlayerDailyQuest,
  PlayerFavoriteMode,
  PlayerHistoryFlair,
  PlayerLevelLadder,
  PlayerLuckyPieceCard,
  PlayerNemesisCard,
  PlayerPlaystyleCard,
} from './PlayerProfileFlair';
import { ChessTipCard } from './ProfileChessDecor';

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
    <div className="player-pro-badges">
      {badges.slice(0, 10).map((b, i) => (
        <span
          key={b.badgeId || b.id || i}
          className="player-pro-badge"
          style={{ background: b.color || 'rgba(255,143,98,0.25)' }}
          title={b.title || b.tournamentName}
        >
          {b.icon || '🏅'} {b.title || b.tournamentName}
        </span>
      ))}
    </div>
  );
}

function RatingSparkline({ points, deltaWeek, t }) {
  if (!points?.length || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 40);
  const width = 280;
  const height = 72;
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const pathLen = 400;
  return (
    <div className="player-pro-sparkline-wrap">
      <svg className="player-pro-sparkline player-pro-sparkline--animated" viewBox={`0 0 ${width} ${height}`} aria-hidden>
        <defs>
          <linearGradient id="playerProSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          className="player-pro-sparkline__fill"
          points={`0,${height} ${coords} ${width},${height}`}
          fill="url(#playerProSparkGrad)"
        />
        <polyline
          className="player-pro-sparkline__line"
          points={coords}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={pathLen}
        />
      </svg>
      {deltaWeek != null && deltaWeek !== 0 && (
        <span className={`player-pro-sparkline-delta${deltaWeek > 0 ? ' is-up' : ' is-down'}`}>
          {deltaWeek > 0 ? '+' : ''}{deltaWeek} {t('player_pro_rating_week_short')}
        </span>
      )}
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
    <ul className="player-pro-tourney-list">
      {tournaments.map((row) => (
        <li key={row.id}>
          <button type="button" className="player-pro-tourney-item" onClick={() => navigate(`/tournaments/${row.id}`)}>
            <span className="player-pro-tourney-item__name">{row.name}</span>
            <span className="player-pro-tourney-item__meta">
              {fmt(row.starts_at)} · {row.time_control}
              {row.status === 'running' ? ` · ${t('tournament_status_running')}` : ''}
            </span>
            <span className="player-pro-tourney-item__slots">
              {row.demo_players || 0}/{row.max_players || 32}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ProfilePlayerDashboard({
  dash,
  rating,
  t,
  lang,
  navigate,
  resultLabel,
  resultColor,
  userHistory,
  username,
  role,
  levelLabel,
  progressPct,
  pointsText,
  trophies = [],
}) {
  const history = dash?.history?.length ? dash.history : userHistory || [];
  const form = dash?.form;
  const extras = dash?.extras;

  return (
    <div className="player-pro-board player-pro-stagger">
      <PlayerProSectionHead piece="♗" title={t('player_pro_performance')} sub={t('player_pro_performance_sub')} />

      <div className="player-pro-bento player-pro-bento--performance">
        <section className="player-pro-panel player-pro-panel--chart player-pro-hover-panel">
          <h3>{t('player_rating_chart')}</h3>
          <RatingSparkline points={dash?.ratingSparkline} deltaWeek={dash?.ratingDeltaWeek} t={t} />
          <div className="player-pro-panel__stats">
            <StatPill label={t('profile_rating')} value={rating} />
            {form?.total ? (
              <StatPill label={t('player_form_winrate')} value={`${form.winRate}%`} tone={form.winRate >= 50 ? undefined : 'warn'} />
            ) : null}
            {dash?.stats?.allTimeWinRate != null && (
              <StatPill label={t('player_alltime_winrate')} value={`${dash.stats.allTimeWinRate}%`} />
            )}
          </div>
        </section>

        <section className="player-pro-panel player-pro-panel--quest player-pro-hover-panel">
          <PlayerDailyQuest quest={extras?.dailyQuest} t={t} navigate={navigate} />
        </section>
      </div>

      <PlayerProSectionHead piece="♔" title={t('player_pro_career')} sub={t('player_pro_career_sub')} />

      <div className="player-pro-bento player-pro-bento--career">
        <section className="player-pro-panel player-pro-panel--army player-pro-hover-panel">
          <PlayerChessArmy army={extras?.army} t={t} />
        </section>
        <section className="player-pro-panel player-pro-panel--level player-pro-hover-panel">
          {levelLabel != null && (
            <PlayerLevelLadder
              levelLabel={levelLabel}
              progressPct={progressPct ?? 0}
              pointsText={pointsText}
              t={t}
            />
          )}
        </section>
        <section className="player-pro-panel player-pro-panel--trophies player-pro-hover-panel">
          <h3>{t('profile_trophies')}</h3>
          <PlayerProTrophyShelf trophies={trophies} t={t} />
        </section>
      </div>

      <PlayerProSectionHead piece="♞" title={t('player_pro_identity')} sub={t('player_pro_identity_sub')} />

      <div className="player-pro-bento player-pro-bento--identity">
        <PlayerPlaystyleCard playstyle={extras?.playstyle} t={t} />
        <PlayerLuckyPieceCard lucky={extras?.luckyPiece} t={t} />
        <PlayerFavoriteMode mode={extras?.favoriteMode} t={t} />
        <PlayerNemesisCard nemesis={extras?.nemesis} rivals={extras?.rivals} t={t} />
      </div>

      <PlayerProSectionHead piece="♕" title={t('player_pro_arena')} sub={t('player_pro_arena_sub')} />

      <div className="player-pro-bento player-pro-bento--arena">
        <section className="player-pro-panel player-pro-panel--tourney player-pro-hover-panel">
          <h3>{t('player_tourney_title')}</h3>
          <PlayerTournamentList tournaments={dash?.tournaments} t={t} navigate={navigate} lang={lang} />
          <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => navigate('/tournaments')}>
            {t('player_tourney_all')}
          </button>
        </section>
        <section className="player-pro-panel player-pro-panel--badges player-pro-hover-panel">
          <h3>{t('dash_achievements')}</h3>
          <BadgeStrip badges={dash?.badges} t={t} />
        </section>
      </div>

      <PlayerProSectionHead piece="♖" title={t('profile_history')} sub={t('player_pro_history_sub')} />

      <section className="player-pro-panel player-pro-panel--history player-pro-hover-panel">
        <PlayerHistoryFlair history={history} t={t} resultLabel={resultLabel} resultColor={resultColor} />
        <div className="table-wrapper player-pro-history-table-wrap">
          <table className="history-table player-pro-history-table">
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
                  <tr key={game.id || i}>
                    <td>
                      <span className="player-pro-history-opp">@{game.opponent || t('profile_anonymous')}</span>
                    </td>
                    <td>
                      <span
                        className="player-pro-history-result"
                        style={{ color: resultColor(game.result) }}
                      >
                        {resultLabel(game.result)}
                      </span>
                    </td>
                    <td>{game.type || t('profile_match')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ChessTipCard t={t} username={username} role={role} />
    </div>
  );
}
