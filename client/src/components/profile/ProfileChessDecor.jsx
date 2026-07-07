const ROLE_PIECES = {
  student: '♙',
  teacher: '♕',
  player: '♘',
  admin: '♔',
};

const FLOAT_PIECES = ['♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝'];

function hashCode(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function pickChessItem(seed, items) {
  if (!items?.length) return '';
  return items[hashCode(seed) % items.length];
}

export function rolePiece(role) {
  return ROLE_PIECES[role] || '♟';
}

export function ProfileHeroDecor() {
  return (
    <div className="profile-hero__pieces" aria-hidden>
      {FLOAT_PIECES.map((piece, index) => (
        <span
          key={`${piece}-${index}`}
          className={`profile-hero__float-piece profile-hero__float-piece--${index}`}
        >
          {piece}
        </span>
      ))}
    </div>
  );
}

export function ProfileMiniBoard({ squares = 32 }) {
  const cells = Array.from({ length: squares }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return (row + col) % 2 === 0 ? 'light' : 'dark';
  });
  return (
    <div className="profile-mini-board" aria-hidden>
      {cells.map((tone, i) => (
        <span key={i} className={`profile-mini-board__cell profile-mini-board__cell--${tone}`} />
      ))}
    </div>
  );
}

export function ProfileChessMotto({ t, username, role }) {
  const key = pickChessItem(`${username}-${role}`, [
    'profile_motto_1',
    'profile_motto_2',
    'profile_motto_3',
    'profile_motto_4',
    'profile_motto_5',
  ]);
  return (
    <p className="profile-hero__motto">
      <span className="profile-hero__motto-piece" aria-hidden>{rolePiece(role)}</span>
      {t(key)}
    </p>
  );
}

export function ChessTipCard({ t, username, role }) {
  const tipKey = pickChessItem(`${username}-${role}-tip`, [
    'profile_tip_1',
    'profile_tip_2',
    'profile_tip_3',
    'profile_tip_4',
    'profile_tip_5',
    'profile_tip_6',
  ]);
  return (
    <section className="profile-block profile-block--full profile-chess-tip">
      <div className="profile-chess-tip__head">
        <span className="profile-chess-tip__piece" aria-hidden>💡</span>
        <h3>{t('profile_tip_title')}</h3>
      </div>
      <p className="profile-chess-tip__text">{t(tipKey)}</p>
    </section>
  );
}

export function ChessCornerBadge({ piece, label }) {
  return (
    <span className="profile-corner-badge" title={label}>
      <span className="profile-corner-badge__piece" aria-hidden>{piece}</span>
      {label ? <span className="profile-corner-badge__label">{label}</span> : null}
    </span>
  );
}

export function ProfilePieceProgress({ t, done, total, piece = '♙' }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const filled = Math.min(6, Math.max(0, Math.round((pct / 100) * 6)));
  return (
    <div className="profile-piece-progress">
      <div className="profile-piece-progress__track" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i}
            className={`profile-piece-progress__step${i < filled ? ' profile-piece-progress__step--on' : ''}`}
          >
            {piece}
          </span>
        ))}
      </div>
      <p className="subtitle profile-piece-progress__caption">
        {t('profile_piece_progress', { pct })}
      </p>
    </div>
  );
}

export function TeacherClassPieces({ count, t }) {
  const n = Math.min(count || 0, 8);
  return (
    <div className="profile-class-pieces" aria-label={t('dash_students')}>
      {Array.from({ length: Math.max(n, 1) }, (_, i) => (
        <span key={i} className={`profile-class-pieces__p${i % 2 ? ' profile-class-pieces__p--dark' : ''}`}>
          ♙
        </span>
      ))}
      {count > 8 ? <span className="subtitle">+{count - 8}</span> : null}
    </div>
  );
}

export const SECTION_PIECES = {
  now: '♗',
  connect: '♖',
  game: '♘',
  materials: '♕',
  account: '♔',
};
