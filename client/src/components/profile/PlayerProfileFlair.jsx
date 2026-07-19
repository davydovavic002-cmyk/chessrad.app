const STYLE_ICONS = {
  player_style_rookie: '♟',
  player_style_hot: '🔥',
  player_style_attacker: '⚔️',
  player_style_solid: '🛡️',
  player_style_fighter: '💪',
  player_style_balanced: '⚖️',
};

function resultEmoji(result) {
  if (result === 'Победа' || result === 'Win') return '♔';
  if (result === 'Ничья' || result === 'Draw') return '♕';
  return '♚';
}

export function PlayerChessArmy({ army, t }) {
  if (!army?.length) return null;
  const unlocked = army.filter((a) => a.unlocked).length;
  return (
    <section className="profile-block profile-block--full profile-player-army profile-block--chess">
      <ChessCornerBadge piece="♔" />
      <h3>{t('player_army_title')}</h3>
      <p className="subtitle">{t('player_army_sub', { n: unlocked, total: army.length })}</p>
      <div className="profile-player-army__row">
        {army.map((item) => (
          <div
            key={item.piece}
            className={`profile-player-army__piece${item.unlocked ? ' is-unlocked' : ''}`}
            title={t(item.label)}
          >
            <span className="profile-player-army__glyph">{item.piece}</span>
            <span className="profile-player-army__label">{t(item.label)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PlayerPlaystyleCard({ playstyle, t }) {
  const icon = STYLE_ICONS[playstyle] || '♞';
  return (
    <section className="profile-block profile-block--half profile-player-style profile-block--chess">
      <span className="profile-player-style__icon" aria-hidden>{icon}</span>
      <h3>{t('player_style_title')}</h3>
      <p className="profile-player-style__name">{t(playstyle)}</p>
      <p className="subtitle">{t(`${playstyle}_hint`)}</p>
    </section>
  );
}

export function PlayerLuckyPieceCard({ lucky, t }) {
  if (!lucky) return null;
  return (
    <section className="profile-block profile-block--half profile-player-lucky profile-block--chess">
      <span className="profile-player-lucky__piece" aria-hidden>{lucky.piece}</span>
      <h3>{t('player_lucky_title')}</h3>
      <p className="profile-player-lucky__name">{t(lucky.key)}</p>
      <p className="subtitle">{t('player_lucky_hint')}</p>
    </section>
  );
}

export function PlayerDailyQuest({ quest, t, navigate }) {
  if (!quest) return null;
  const progressPct = quest.target
    ? Math.min(100, Math.round(((quest.progress || 0) / quest.target) * 100))
    : 0;
  return (
    <section className={`profile-block profile-block--full profile-player-quest${quest.done ? ' profile-player-quest--done' : ''}`}>
      <div className="profile-player-quest__head">
        <span className="profile-player-quest__icon" aria-hidden>{quest.icon || '🎯'}</span>
        <div>
          <h3>{t('player_quest_title')}</h3>
          <p className="profile-player-quest__text">{t(quest.key, { n: quest.progress, target: quest.target })}</p>
        </div>
      </div>
      {quest.target && !quest.done && (
        <div className="profile-player-quest__bar">
          <div className="profile-player-quest__fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}
      {!quest.done && (
        <button type="button" className="btn btn-primary btn-sm mt-2" onClick={() => navigate(quest.href || (quest.icon === '⚔️' ? '/game' : '/homework'))}>
          {t('player_quest_go')}
        </button>
      )}
    </section>
  );
}

export function PlayerNemesisCard({ nemesis, rivals, t }) {
  if (!nemesis && !rivals?.length) return null;
  return (
    <section className="profile-block profile-block--half profile-player-nemesis profile-block--chess">
      <h3>{t('player_rivals_title')}</h3>
      {nemesis && (
        <div className="profile-player-nemesis__hero">
          <span className="profile-player-nemesis__skull" aria-hidden>☠️</span>
          <div>
            <strong>@{nemesis.username}</strong>
            <p className="subtitle">{t('player_nemesis_sub', { n: nemesis.games })}</p>
          </div>
        </div>
      )}
      {rivals?.length > 0 && (
        <ul className="profile-player-rivals">
          {rivals.map((r) => (
            <li key={r.username}>
              <span>@{r.username}</span>
              <span className="profile-player-rivals__bar-wrap">
                <span
                  className="profile-player-rivals__bar"
                  style={{ width: `${Math.min(100, (r.games / (rivals[0]?.games || 1)) * 100)}%` }}
                />
              </span>
              <span className="subtitle">{r.games}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PlayerFavoriteMode({ mode, t }) {
  if (!mode) return null;
  return (
    <section className="profile-block profile-block--half profile-player-mode">
      <h3>{t('player_mode_title')}</h3>
      <p className="profile-player-mode__value">
        <span aria-hidden>♟</span> {mode.mode}
      </p>
      <p className="subtitle">{t('player_mode_sub', { n: mode.count })}</p>
    </section>
  );
}

export function PlayerLevelLadder({ levelLabel, progressPct, pointsText, t }) {
  const steps = ['♙', '♘', '♗', '♖', '♕', '♔'];
  const filled = Math.max(1, Math.ceil((progressPct / 100) * steps.length));
  return (
    <section className="profile-block profile-block--full profile-player-ladder profile-block--chess">
      <h3>{t('player_ladder_title')}</h3>
      <p className="profile-player-ladder__level">{levelLabel}</p>
      <div className="profile-player-ladder__steps" aria-hidden>
        {steps.map((piece, i) => (
          <span
            key={piece}
            className={`profile-player-ladder__step${i < filled ? ' is-active' : ''}`}
          >
            {piece}
          </span>
        ))}
      </div>
      <div className="progress-container profile-player-ladder__bar">
        <div style={{ width: `${progressPct}%` }} />
      </div>
      <p className="subtitle">{pointsText}</p>
    </section>
  );
}

export function PlayerHistoryFlair({ history, t, resultLabel, resultColor }) {
  if (!history?.length) return null;
  return (
    <div className="profile-player-history-flair">
      {history.slice(0, 6).map((game, i) => (
        <div key={game.id || i} className="profile-player-history-chip" title={game.opponent}>
          <span className="profile-player-history-chip__piece" aria-hidden>{resultEmoji(game.result)}</span>
          <span className="profile-player-history-chip__opp">vs {game.opponent || '?'}</span>
          <span style={{ color: resultColor(game.result), fontWeight: 700, fontSize: '0.75rem' }}>
            {resultLabel(game.result)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChessCornerBadge({ piece, label }) {
  return (
    <span className="profile-corner-badge" title={label}>
      <span className="profile-corner-badge__piece" aria-hidden>{piece}</span>
    </span>
  );
}

export function PlayerQuickLinks({ t, navigate }) {
  return (
    <section className="profile-block profile-block--full profile-player-links">
      <h3>{t('player_links_title')}</h3>
      <div className="profile-player-links__grid">
        <button type="button" className="profile-player-link" onClick={() => navigate('/game')}>
          <span>♞</span> {t('lobby_find_game')}
        </button>
        <button type="button" className="profile-player-link" onClick={() => navigate('/play-bot')}>
          <span>🤖</span> {t('dash_play_bot')}
        </button>
        <button type="button" className="profile-player-link" onClick={() => navigate('/tournaments')}>
          <span>♕</span> {t('lobby_tournaments')}
        </button>
      </div>
    </section>
  );
}
