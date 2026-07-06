import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiJson } from '../api';
import { getSocket } from '../socket';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import '../styles/tournament.css';
import '../styles/features-game.css';

const LEAGUES = ['all', 'open', 'novice', 'advanced'];

function formatDate(iso, lang) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusKey(row) {
  const live = row.liveStatus || row.status;
  if (live === 'running') return 'running';
  if (live === 'finished') return 'finished';
  if (live === 'scheduled') return 'scheduled';
  return 'registration';
}

function ListSkeleton() {
  return (
    <div className="tournament-schedule-grid">
      {[1, 2, 3].map((n) => (
        <div key={n} className="tournament-schedule-card tournament-schedule-card--skeleton game-panel" aria-hidden />
      ))}
    </div>
  );
}

function Countdown({ iso, lang }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!iso) return;
    const tick = () => {
      const diff = new Date(iso).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setLabel(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [iso]);
  if (!label) return null;
  return <span className="tournament-countdown">⏳ {label}</span>;
}

export default function TournamentListPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [league, setLeague] = useState('all');

  useEffect(() => {
    let cancelled = false;
    apiJson('/api/tournaments').then(({ res, data }) => {
      if (cancelled) return;
      if (data.success) setTournaments(data.tournaments || []);
      else setError(res.ok ? 'load_failed' : `load_failed_${res.status}`);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError('load_failed');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onSchedule = (updates) => {
      if (!Array.isArray(updates)) return;
      setTournaments((prev) =>
        prev.map((row) => {
          const u = updates.find((x) => x.id === row.id);
          return u ? { ...row, liveStatus: u.liveStatus, playerCount: u.playerCount, currentRound: u.currentRound } : row;
        })
      );
    };
    socket.on('tournament:scheduleUpdate', onSchedule);
    return () => socket.off('tournament:scheduleUpdate', onSchedule);
  }, []);

  const filtered = tournaments.filter((row) => league === 'all' || (row.league || 'open') === league);

  const stats = useMemo(() => {
    const counts = { running: 0, upcoming: 0, finished: 0 };
    filtered.forEach((row) => {
      const sk = statusKey(row);
      if (sk === 'running') counts.running += 1;
      else if (sk === 'finished') counts.finished += 1;
      else counts.upcoming += 1;
    });
    return counts;
  }, [filtered]);

  return (
    <div className="tournament-list-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />

      <header className="game-hud tournament-list-hero">
        <span className="game-hud__badge">TOURNAMENTS</span>
        <h1>{t('tournament_schedule_title')}</h1>
        <p className="game-hud__sub">{t('tournament_schedule_sub')}</p>
      </header>

      {!loading && !error && filtered.length > 0 && (
        <div className="tournament-stats-bar">
          <div className="tournament-stat tournament-stat--live">
            <span className="tournament-stat__value">{stats.running}</span>
            <span className="tournament-stat__label">{t('tournament_status_running')}</span>
          </div>
          <div className="tournament-stat">
            <span className="tournament-stat__value">{stats.upcoming}</span>
            <span className="tournament-stat__label">{t('tournament_status_scheduled')}</span>
          </div>
          <div className="tournament-stat">
            <span className="tournament-stat__value">{filtered.length}</span>
            <span className="tournament-stat__label">{t('tournament_stats_total')}</span>
          </div>
        </div>
      )}

      <div className="tournament-league-tabs">
        {LEAGUES.map((lg) => (
          <button
            key={lg}
            type="button"
            className={league === lg ? 'active' : ''}
            onClick={() => setLeague(lg)}
          >
            {t(`league_${lg}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <p className="subtitle tournament-list-error">
          {error.startsWith('load_failed_')
            ? `${t('tournament_list_error')} (${error.replace('load_failed_', '')})`
            : t('tournament_list_error')}
        </p>
      ) : filtered.length === 0 ? (
        <div className="tournament-empty-state game-panel">
          <span className="tournament-empty-state__icon">♟</span>
          <p>{t('tournament_list_empty')}</p>
        </div>
      ) : (
        <div className="tournament-schedule-grid">
          {filtered.map((row) => {
            const sk = statusKey(row);
            const isTeam = row.format_type === 'team';
            const fillPct = row.max_players
              ? Math.min(100, Math.round(((row.playerCount || 0) / row.max_players) * 100))
              : null;
            return (
              <article
                key={row.id}
                className={`tournament-schedule-card game-panel status-${sk}`}
                onClick={() => navigate(`/tournaments/${row.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/tournaments/${row.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="tournament-schedule-card__inner">
                  <div className="tournament-schedule-card__head">
                    <h3>{row.name}</h3>
                    <span className={`game-status-pill game-status-pill--${sk === 'registration' ? 'pending' : sk === 'running' ? 'active' : sk === 'finished' ? 'completed' : 'scheduled'}`}>
                      {sk === 'running' && <span className="tournament-live-dot" aria-hidden />}
                      {t(`tournament_status_${sk}`)}
                    </span>
                  </div>
                  <div className="tournament-card-tags">
                    <span className={`tag-league tag-league--${row.league || 'open'}`}>{t(`league_${row.league || 'open'}`)}</span>
                    {isTeam && <span className="tag-team">{t('tournament_team_format')}</span>}
                    {row.id.startsWith('demo-') && <span className="tag-demo">DEMO</span>}
                  </div>
                  {row.description && (
                    <p className="subtitle tournament-schedule-desc">{row.description}</p>
                  )}
                  <div className="tournament-schedule-meta">
                    <span className="tournament-meta-chip">
                      <span className="tournament-meta-chip__icon" aria-hidden>📅</span>
                      {formatDate(row.starts_at, lang)}
                      <Countdown iso={row.starts_at} lang={lang} />
                    </span>
                    <span className="tournament-meta-chip">
                      <span className="tournament-meta-chip__icon" aria-hidden>⏱</span>
                      {row.time_control}
                    </span>
                    <span className="tournament-meta-chip">
                      <span className="tournament-meta-chip__icon" aria-hidden>👥</span>
                      {row.playerCount || 0}{row.max_players ? ` / ${row.max_players}` : ''}
                    </span>
                  </div>
                  {fillPct !== null && (
                    <div className="tournament-fill-bar" title={`${fillPct}%`}>
                      <div className="tournament-fill-bar__track">
                        <div className="tournament-fill-bar__fill" style={{ width: `${fillPct}%` }} />
                      </div>
                      <span className="tournament-fill-bar__label">{fillPct}%</span>
                    </div>
                  )}
                  <div className="tournament-schedule-card__foot">
                    <Link
                      to={`/tournaments/${row.id}`}
                      className="btn btn-primary btn-sm tournament-schedule-enter"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {sk === 'finished' ? t('tournament_view') : t('tournament_enter')}
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
