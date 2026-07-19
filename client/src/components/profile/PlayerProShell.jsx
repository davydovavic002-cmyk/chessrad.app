import { useEffect, useState } from 'react';
import { ProfileMiniBoard } from './ProfileChessDecor';

function formDotClass(result) {
  if (result === 'Победа' || result === 'Win') return 'win';
  if (result === 'Ничья' || result === 'Draw') return 'draw';
  return 'loss';
}

function formatCountdown(ms) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = targetIso ? new Date(targetIso).getTime() : 0;
  const diff = Number.isFinite(target) ? target - now : 0;
  return { diff, ...formatCountdown(diff), isPast: diff <= 0 };
}

function RatingDeltaBadge({ delta, t }) {
  if (delta == null || delta === 0) return null;
  const isUp = delta > 0;
  return (
    <span className={`player-pro-rating-delta${isUp ? ' is-up' : ' is-down'}`}>
      {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{delta}
      <span className="player-pro-rating-delta__period">{t('player_pro_rating_week')}</span>
    </span>
  );
}

export function PlayerProNextTournament({ tournament, t, lang, navigate }) {
  const { days, hours, minutes, seconds, isPast } = useCountdown(tournament?.starts_at);
  if (!tournament) return null;

  const isLive = tournament.status === 'running' || (isPast && tournament.status !== 'finished');
  const pad = (n) => String(n).padStart(2, '0');

  const fmtDate = (iso) => {
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
  };

  return (
    <section className={`player-pro-next-event${isLive ? ' player-pro-next-event--live' : ''}`}>
      <div className="player-pro-next-event__glow" aria-hidden />
      <div className="player-pro-next-event__icon" aria-hidden>♕</div>
      <div className="player-pro-next-event__body">
        <p className="player-pro-next-event__eyebrow">{t('player_pro_next_tourney')}</p>
        <h2 className="player-pro-next-event__name">{tournament.name}</h2>
        <p className="player-pro-next-event__meta">
          {fmtDate(tournament.starts_at)} · {tournament.time_control}
          {tournament.league ? ` · ${tournament.league}` : ''}
        </p>
      </div>
      <div className="player-pro-next-event__timer">
        {isLive ? (
          <>
            <span className="player-pro-next-event__live-dot" aria-hidden />
            <span className="player-pro-next-event__live-label">{t('player_pro_tourney_live')}</span>
          </>
        ) : (
          <>
            <span className="player-pro-next-event__timer-label">{t('player_pro_tourney_starts')}</span>
            <div className="player-pro-countdown" aria-live="polite">
              {days > 0 && (
                <span className="player-pro-countdown__unit">
                  <strong>{days}</strong>
                  <small>{t('player_pro_countdown_days')}</small>
                </span>
              )}
              <span className="player-pro-countdown__unit">
                <strong>{pad(hours)}</strong>
                <small>{t('player_pro_countdown_hours')}</small>
              </span>
              <span className="player-pro-countdown__sep">:</span>
              <span className="player-pro-countdown__unit">
                <strong>{pad(minutes)}</strong>
                <small>{t('player_pro_countdown_min')}</small>
              </span>
              <span className="player-pro-countdown__sep">:</span>
              <span className="player-pro-countdown__unit">
                <strong>{pad(seconds)}</strong>
                <small>{t('player_pro_countdown_sec')}</small>
              </span>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        className="btn btn-primary player-pro-next-event__cta"
        onClick={() => navigate(`/tournaments/${tournament.id}`)}
      >
        {isLive ? t('player_pro_tourney_enter') : t('player_pro_tourney_join')}
      </button>
    </section>
  );
}

export function PlayerProHero({
  user,
  rating,
  ratingDeltaWeek,
  t,
  levelLabel,
  funTitle,
  form,
  recentGames,
  winStreak,
  puzzleStreak,
  navigate,
  resultLabel,
}) {
  const displayName = user?.display_name || user?.username || '';
  const initial = (displayName[0] || '?').toUpperCase();
  const wins = Number(user?.wins) || 0;
  const losses = Number(user?.losses) || 0;
  const draws = Number(user?.draws) || 0;
  const total = wins + losses + draws;
  const winPct = total ? Math.round((wins / total) * 100) : 0;

  return (
    <header className="player-pro-hero player-pro-animate-in">
      <div className="player-pro-hero__board-bg" aria-hidden>
        <ProfileMiniBoard squares={64} />
      </div>
      <div className="player-pro-hero__glow" aria-hidden />

      <div className="player-pro-hero__top">
        <div className="player-pro-hero__identity">
          <div className="player-pro-hero__avatar-ring">
            <span className="player-pro-hero__avatar">{initial}</span>
            <span className="player-pro-hero__badge">{t('player_pro_badge')}</span>
          </div>
          <div>
            <p className="player-pro-hero__eyebrow">{t('player_pro_eyebrow')}</p>
            <h1 className="player-pro-hero__name">{displayName}</h1>
            <p className="player-pro-hero__nick">@{user?.username}</p>
            {funTitle && (
              <span className="player-pro-hero__title-pill">{t(funTitle)}</span>
            )}
          </div>
        </div>

        <div className="player-pro-hero__rating-card">
          <span className="player-pro-hero__rating-label">{t('player_pro_elo')}</span>
          <div className="player-pro-hero__rating-row">
            <span className="player-pro-hero__rating-value">{rating}</span>
            <RatingDeltaBadge delta={ratingDeltaWeek} t={t} />
          </div>
          {levelLabel && (
            <span className="player-pro-hero__level">{levelLabel}</span>
          )}
          {form?.total > 0 && (
            <span className={`player-pro-hero__form-badge${form.winRate >= 50 ? ' is-up' : ''}`}>
              {form.winRate}% {t('player_form_winrate').toLowerCase()}
            </span>
          )}
        </div>
      </div>

      <div className="player-pro-hero__mid">
        <div className="player-pro-hero__record">
          <div className="player-pro-stat player-pro-stat--win player-pro-hover-lift">
            <span className="player-pro-stat__value">{wins}</span>
            <span className="player-pro-stat__label">{t('profile_wins')}</span>
          </div>
          <div className="player-pro-stat player-pro-stat--draw player-pro-hover-lift">
            <span className="player-pro-stat__value">{draws}</span>
            <span className="player-pro-stat__label">{t('profile_draws')}</span>
          </div>
          <div className="player-pro-stat player-pro-stat--loss player-pro-hover-lift">
            <span className="player-pro-stat__value">{losses}</span>
            <span className="player-pro-stat__label">{t('profile_losses')}</span>
          </div>
          <div className="player-pro-stat player-pro-stat--pct player-pro-hover-lift">
            <span className="player-pro-stat__value">{winPct}%</span>
            <span className="player-pro-stat__label">{t('player_alltime_winrate')}</span>
          </div>
        </div>

        {recentGames?.length > 0 && (
          <div className="player-pro-hero__form-strip">
            <span className="player-pro-hero__form-label">{t('player_form_title')}</span>
            <div className="player-pro-form-dots">
              {[...recentGames].reverse().slice(-10).map((game, i) => (
                <span
                  key={`${game.id || i}-${game.opponent}`}
                  className={`player-pro-form-dot player-pro-form-dot--${formDotClass(game.result)} player-pro-dot-pop`}
                  style={{ animationDelay: `${i * 0.05}s` }}
                  title={`${game.opponent}: ${resultLabel(game.result)}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="player-pro-hero__streaks">
          {winStreak > 0 && (
            <span className="player-pro-streak-chip player-pro-streak-chip--fire player-pro-hover-lift">🔥 {winStreak}</span>
          )}
          {puzzleStreak > 0 && (
            <span className="player-pro-streak-chip player-pro-hover-lift">🧩 {puzzleStreak}</span>
          )}
        </div>
      </div>

      <div className="player-pro-hero__actions">
        <button type="button" className="btn btn-primary player-pro-cta player-pro-cta-glow" onClick={() => navigate('/game')}>
          ⚔️ {t('player_pro_play_now')}
        </button>
        <button type="button" className="btn btn-secondary player-pro-cta" onClick={() => navigate('/tournaments')}>
          ♕ {t('lobby_tournaments')}
        </button>
        <button type="button" className="btn btn-ghost player-pro-cta" onClick={() => navigate('/play-bot')}>
          🤖 {t('dash_play_bot')}
        </button>
      </div>
    </header>
  );
}

export function PlayerProTrophyShelf({ trophies, t }) {
  if (!trophies?.length) {
    return (
      <div className="player-pro-trophies player-pro-trophies--empty">
        <span className="player-pro-trophies__empty-icon" aria-hidden>🏆</span>
        <p className="subtitle">{t('profile_no_trophies')}</p>
        <p className="subtitle">{t('player_pro_trophy_hint')}</p>
      </div>
    );
  }
  return (
    <div className="player-pro-trophies">
      {trophies.map((tr, i) => {
        const bgColor =
          { red: '#ff4757', blue: '#2e86de', green: '#2ed573', yellow: '#ffa502' }[tr.color] || '#ffd700';
        return (
          <div
            key={i}
            className="player-pro-trophy player-pro-hover-lift"
            style={{ '--trophy-color': bgColor, animationDelay: `${i * 0.08}s` }}
            title={t('profile_trophy_tip', {
              name: tr.tournamentName || t('profile_tournament'),
              place: tr.place,
              date: tr.date,
            })}
          >
            <span className="player-pro-trophy__icon">{tr.place === 1 ? '🏆' : '🏅'}</span>
            <span className="player-pro-trophy__place">#{tr.place}</span>
            <span className="player-pro-trophy__name">{tr.tournamentName || t('profile_tournament')}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PlayerProSectionHead({ piece, title, sub }) {
  return (
    <div className="player-pro-section-head player-pro-fade-up">
      <h2 className="player-pro-section-head__title">
        <span aria-hidden>{piece}</span> {title}
      </h2>
      {sub && <p className="subtitle player-pro-section-head__sub">{sub}</p>}
    </div>
  );
}
