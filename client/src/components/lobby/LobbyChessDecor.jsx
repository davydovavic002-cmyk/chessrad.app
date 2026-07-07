import {
  pickChessItem,
  ProfileHeroDecor,
  ProfileMiniBoard,
  rolePiece,
} from '../profile/ProfileChessDecor';

const MENU_PIECES = {
  profile: '♚',
  game: '♞',
  journal: '♖',
  schedule: '♜',
  homework: '♙',
  calendar: '♗',
  tournaments: '♕',
  puzzle: '♘',
  admin: '♔',
  study: '♗',
  group: '♖',
};

export function lobbyMenuPiece(key) {
  return MENU_PIECES[key] || '♟';
}

export function LobbyFunClock({ t }) {
  const whiteTurn = new Date().getMinutes() % 2 === 0;
  return (
    <span className={`lobby-fun-clock${whiteTurn ? ' lobby-fun-clock--white' : ' lobby-fun-clock--black'}`}>
      <span className="lobby-fun-clock__piece" aria-hidden>{whiteTurn ? '♔' : '♚'}</span>
      {whiteTurn ? t('lobby_turn_white') : t('lobby_turn_black')}
    </span>
  );
}

export function LobbyHeroBanner({ user, puzzleStatus, t }) {
  const displayName = user?.display_name || user?.username || '';
  const piece = rolePiece(user?.role);
  const rating = Number(user?.rating) || 0;
  const wins = Number(user?.wins) || 0;
  const losses = Number(user?.losses) || 0;
  const draws = Number(user?.draws) || 0;
  const winStreak = Number(user?.win_streak) || 0;
  const dailyStreak = Number(user?.daily_streak) || 0;
  const mottoKey = pickChessItem(`${user?.username}-lobby`, [
    'lobby_motto_1',
    'lobby_motto_2',
    'lobby_motto_3',
    'lobby_motto_4',
  ]);
  const tipKey = pickChessItem(`${user?.username}-lobby-tip`, [
    'lobby_tip_1',
    'lobby_tip_2',
    'lobby_tip_3',
    'lobby_tip_4',
  ]);

  return (
    <section className="lobby-hero lobby-hero--chess">
      <ProfileHeroDecor />
      <div className="lobby-hero__board-strip" aria-hidden>
        <ProfileMiniBoard squares={32} />
      </div>
      <div className="lobby-hero__body">
        <div className="lobby-hero__main">
          <span className="lobby-welcome-pill">
            <span aria-hidden>{piece}</span> {t('lobby_welcome')}
          </span>
          <p className="lobby-intro__name">{displayName}</p>
          <p className="subtitle lobby-intro__sub">{t('lobby_subtitle')}</p>
          <p className="lobby-hero__motto">
            <span aria-hidden>{piece}</span> {t(mottoKey)}
          </p>
        </div>
        <div className="lobby-hero__aside">
          <LobbyFunClock t={t} />
          <div className="lobby-hero__chips">
            <span className="lobby-hero-chip lobby-hero-chip--rating">
              <span aria-hidden>♚</span> {rating} Elo
            </span>
            {winStreak > 0 && (
              <span className="lobby-hero-chip lobby-hero-chip--fire">🔥 {winStreak}</span>
            )}
            {dailyStreak > 0 && (
              <span className="lobby-hero-chip lobby-hero-chip--puzzle">🧩 {dailyStreak}</span>
            )}
            {puzzleStatus && !puzzleStatus.completedToday && (
              <span className="lobby-hero-chip">
                {puzzleStatus.solvedToday || 0}/10 {t('lobby_daily_short')}
              </span>
            )}
          </div>
          <div className="lobby-hero__record">
            <span title={t('profile_wins')}><span aria-hidden>♔</span> {wins}</span>
            <span title={t('profile_draws')}><span aria-hidden>♕</span> {draws}</span>
            <span title={t('profile_losses')}><span aria-hidden>♘</span> {losses}</span>
          </div>
        </div>
      </div>
      <div className="lobby-hero__tip">
        <span className="lobby-hero__tip-icon" aria-hidden>💡</span>
        <span>{t(tipKey)}</span>
      </div>
    </section>
  );
}

export function LobbyMenuWatermark({ pieceKey }) {
  const piece = lobbyMenuPiece(pieceKey);
  return <span className="menu-card__watermark" aria-hidden>{piece}</span>;
}

export function LobbyFloatingPieces() {
  return (
    <div className="lobby-float-layer" aria-hidden>
      {['♔', '♕', '♖', '♗', '♘', '♙'].map((p, i) => (
        <span key={p} className={`lobby-float-piece lobby-float-piece--${i}`}>{p}</span>
      ))}
    </div>
  );
}

export function LobbyLeaderMedal({ rank }) {
  const medals = { 1: '♔', 2: '♕', 3: '♗' };
  return <span className="lobby-leader-medal" aria-hidden>{medals[rank] || rank}</span>;
}
