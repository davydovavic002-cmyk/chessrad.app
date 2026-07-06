import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { apiJson } from '../api';
import { getSocket } from '../socket';
import BackButton from '../components/BackButton';
import '../styles/tournament.css';

export default function TournamentPage() {
  const { id: tournamentId } = useParams();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!tournamentId) return;
    apiJson(`/api/tournaments/${tournamentId}`).then(({ data }) => {
      if (data.success) setMeta(data.tournament);
    });
  }, [tournamentId]);

  function statusText(status) {
    return (
      {
        waiting: t('tournament_waiting'),
        running: t('tournament_running'),
        finished: t('tournament_finished'),
        registration: t('tournament_waiting'),
      }[status] || t('unknown')
    );
  }

  useEffect(() => {
    if (!tournamentId) return;
    const socket = getSocket();

    const onConnect = () => socket.emit('tournament:getState', tournamentId);
    const onState = (s) => setState(s);
    const onGame = (data) => {
      if (data.gameId) navigate(`/game/${data.gameId}`);
    };
    const onError = (data) => {
      Swal.fire({ icon: 'error', title: t('tournament_error'), text: data.message, confirmButtonColor: '#e74c3c' });
    };

    socket.on('connect', onConnect);
    socket.on('tournament:stateUpdate', onState);
    socket.on('tournament:gameCreated', onGame);
    socket.on('tournament:error', onError);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('tournament:stateUpdate', onState);
      socket.off('tournament:gameCreated', onGame);
      socket.off('tournament:error', onError);
    };
  }, [navigate, t, tournamentId]);

  const players = state?.players || [];
  const isRegistered = players.some((p) => String(p.id) === String(user.id));
  const waiting = state?.status === 'waiting' || state?.status === 'registration';

  async function leave() {
    const result = await Swal.fire({
      title: t('tournament_leave_q'),
      text: t('tournament_leave_text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: t('tournament_leave_yes'),
      cancelButtonText: t('cancel'),
    });
    if (result.isConfirmed) getSocket().emit('tournament:leave', tournamentId);
  }

  async function start() {
    const result = await Swal.fire({
      title: t('tournament_start_q'),
      text: t('tournament_start_text'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2ecc71',
      confirmButtonText: t('tournament_start_yes'),
      cancelButtonText: t('tournament_start_no'),
    });
    if (result.isConfirmed) getSocket().emit('tournament:start', tournamentId);
  }

  async function handleLogout(e) {
    e.preventDefault();
    await logout();
    navigate('/');
  }

  const pairingsRows = (() => {
    if (!state?.rounds?.length || !state.currentRound) {
      return (
        <tr>
          <td colSpan={3} className="empty-msg">
            {t('tournament_no_pairings')}
          </td>
        </tr>
      );
    }
    const currentRoundData = state.rounds[state.currentRound - 1];
    if (!currentRoundData) return null;
    return currentRoundData.games.map((match, i) => {
      const gameId = match.gameId || match.id;
      const p1 = state.players.find((p) => p.id === match.players[0])?.username || t('unknown');
      const p2 = match.players[1]
        ? state.players.find((p) => p.id === match.players[1])?.username || t('unknown')
        : <span className="bye">{t('tournament_bye')}</span>;
      let resultDisplay = match.result || <i>{t('tournament_in_progress')}</i>;
      if (
        !match.result &&
        gameId &&
        (match.players[0] === user.id || match.players[1] === user.id)
      ) {
        resultDisplay = (
          <Link to={`/game/${gameId}`} className="join-link">
            {t('tournament_join_game')}
          </Link>
        );
      }
      return (
        <tr key={i}>
          <td>{p1}</td>
          <td>{p2}</td>
          <td>{resultDisplay}</td>
        </tr>
      );
    });
  })();

  const standingsRows = (() => {
    if (!players.length) {
      return (
        <tr>
          <td colSpan={6} className="empty-msg">
            {t('tournament_no_players')}
          </td>
        </tr>
      );
    }
    const stats = {};
    players.forEach((p) => {
      stats[p.id] = { wins: 0, draws: 0, losses: 0 };
    });
    (state.rounds || []).forEach((round) => {
      round.games.forEach((game) => {
        if (!game.result) return;
        const [p1Id, p2Id] = game.players;
        if (game.result === '1-0') {
          if (stats[p1Id]) stats[p1Id].wins++;
          if (p2Id && stats[p2Id]) stats[p2Id].losses++;
        } else if (game.result === '0-1') {
          if (stats[p1Id]) stats[p1Id].losses++;
          if (p2Id && stats[p2Id]) stats[p2Id].wins++;
        } else if (game.result === '1/2-1/2' || String(game.result).includes('½')) {
          if (stats[p1Id]) stats[p1Id].draws++;
          if (p2Id && stats[p2Id]) stats[p2Id].draws++;
        }
      });
    });
    return [...players]
      .sort((a, b) => b.score - a.score)
      .map((p, index) => {
        const s = stats[p.id] || { wins: 0, draws: 0, losses: 0 };
        const rankClass = index === 0 ? 'rank-gold' : index === 1 ? 'rank-silver' : index === 2 ? 'rank-bronze' : '';
        return (
          <tr key={p.id} className={rankClass}>
            <td className="col-rank">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
            </td>
            <td className="col-player">{p.username}</td>
            <td className="col-stat">
              <strong>{p.score}</strong>
            </td>
            <td className="col-stat">{s.wins}</td>
            <td className="col-stat">{s.draws}</td>
            <td className="col-stat">{s.losses}</td>
          </tr>
        );
      });
  })();

  const title = state?.name || meta?.name || t('tournament_title');
  const liveStatus = state?.status || meta?.liveStatus || meta?.status || 'waiting';
  const statusClass = liveStatus === 'running' ? 'running' : liveStatus === 'finished' ? 'finished' : 'registration';

  return (
    <div className="tournament-page page-wrap">
      <BackButton to="/tournaments" title={t('tournament_back_schedule')} />
      <aside className="tournament-sidebar glass">
        <div className="tournament-sidebar-hero">
          <span className={`tournament-detail-status game-status-pill game-status-pill--${statusClass === 'registration' ? 'pending' : statusClass === 'running' ? 'active' : 'completed'}`}>
            {statusClass === 'running' && <span className="tournament-live-dot" aria-hidden />}
            {statusText(liveStatus)}
          </span>
          <h1>{title}</h1>
          {meta?.description && <p className="tournament-sidebar-desc">{meta.description}</p>}
        </div>
        <div className="tournament-info-chips">
          {meta?.time_control && (
            <span className="tournament-meta-chip">
              <span className="tournament-meta-chip__icon" aria-hidden>⏱</span>
              {meta.time_control}
            </span>
          )}
          {meta?.format && (
            <span className="tournament-meta-chip">
              {meta.format_type === 'team' ? t('tournament_team_format') : meta.format}
            </span>
          )}
          {meta?.league && (
            <span className={`tag-league tag-league--${meta.league}`}>{t(`league_${meta.league}`)}</span>
          )}
        </div>
        <div id="user-status" className="user-profile-box">
          {t('tournament_logged_as')} <strong>{user.username}</strong>
          <a href="#" className="tournament-logout-link" onClick={handleLogout}>
            {t('logout')}
          </a>
        </div>
        <div className="status-card tournament-status-grid">
          <div className="tournament-status-item">
            <span className="tournament-status-item__label">{t('tournament_status')}</span>
            <span id="tournamentstatus" className="tournament-status-item__value">{statusText(state?.status)}</span>
          </div>
          <div className="tournament-status-item">
            <span className="tournament-status-item__label">{t('tournament_round')}</span>
            <span id="roundnumber" className="tournament-status-item__value">
              {state?.currentRound || 0}{state?.totalRounds ? ` / ${state.totalRounds}` : ''}
            </span>
          </div>
        </div>
        <div className="actions">
          {waiting && !isRegistered && (
            <button
              type="button"
              id="registerBtn"
              className="btn btn-primary"
              onClick={() => getSocket().emit('tournament:register', tournamentId)}
            >
              {t('tournament_register')}
            </button>
          )}
          {waiting && isRegistered && (
            <button type="button" className="btn btn-danger" onClick={leave}>
              {t('tournament_leave')}
            </button>
          )}
          {waiting && (user.role === 'admin' || user.role === 'teacher') && (
            <button type="button" className="btn btn-secondary" onClick={start} style={{ marginTop: 8 }}>
              {t('tournament_start')}
            </button>
          )}
        </div>
        <div className="participants-section">
          <h3>
            {t('tournament_players')} <span id="playercount">({players.length})</span>
          </h3>
          <ul id="playerlist">
            {players.map((p) => (
              <li key={p.id} className={String(p.id) === String(user.id) ? 'is-me' : ''}>
                <span className="player-avatar" aria-hidden>{(p.username || '?')[0].toUpperCase()}</span>
                <span className="player-name">{p.username}</span>
                {String(p.id) === String(user.id) && <span className="player-you-badge">{t('tg_you')}</span>}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="tournament-main">
        {state?.teamScores && meta?.format_type === 'team' && (
          <section className="section-box team-scores-box">
            <h2>{t('tournament_team_scores')}</h2>
            <div className="team-scores-grid">
              <div className="team-score-card class">
                <span>{t('team_class')}</span>
                <strong>{state.teamScores.class}</strong>
              </div>
              <div className="team-score-vs">VS</div>
              <div className="team-score-card teacher">
                <span>{t('team_teacher')}</span>
                <strong>{state.teamScores.teacher}</strong>
              </div>
            </div>
          </section>
        )}

        <section className="section-box">
          <h2>{t('tournament_pairings')}</h2>
          <div className="table-wrapper">
            <table id="pairingstable" className="table-glass">
              <thead>
                <tr>
                  <th>{t('tournament_white')}</th>
                  <th>{t('tournament_black')}</th>
                  <th>{t('tournament_result')}</th>
                </tr>
              </thead>
              <tbody>{pairingsRows}</tbody>
            </table>
          </div>
        </section>

        <section className="section-box">
          <h2>{t('tournament_standings')}</h2>
          <div className="table-wrapper">
            <table id="standingstable" className="table-glass">
              <thead>
                <tr>
                  <th className="col-rank">#</th>
                  <th>{t('tournament_player')}</th>
                  <th className="col-stat">{t('tournament_points')}</th>
                  <th className="col-stat">{t('tournament_w')}</th>
                  <th className="col-stat">{t('tournament_d')}</th>
                  <th className="col-stat">{t('tournament_l')}</th>
                </tr>
              </thead>
              <tbody>{standingsRows}</tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
