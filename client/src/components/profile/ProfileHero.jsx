import { useI18n } from '../../i18n/I18nContext';
import {
  ProfileChessMotto,
  ProfileHeroDecor,
  ProfileMiniBoard,
  rolePiece,
} from './ProfileChessDecor';

const ROLE_KEYS = {
  student: 'auth_student',
  teacher: 'auth_teacher',
  player: 'auth_player',
  admin: 'auth_teacher',
};

export default function ProfileHero({
  user,
  rating,
  dash,
  levelLabel,
  winStreak = 0,
}) {
  const { t } = useI18n();
  const displayName = user?.display_name || user?.username || '';
  const initial = (displayName[0] || '?').toUpperCase();
  const roleKey = ROLE_KEYS[user?.role] || 'auth_player';
  const piece = rolePiece(user?.role);
  const puzzleStreak = dash?.puzzle?.streak || 0;
  const wins = Number(user?.wins) || 0;
  const losses = Number(user?.losses) || 0;
  const draws = Number(user?.draws) || 0;

  return (
    <header className="profile-hero profile-hero--chess">
      <ProfileHeroDecor />
      <div className="profile-hero__board-strip" aria-hidden>
        <ProfileMiniBoard squares={24} />
      </div>
      <div className="profile-hero__body">
        <div className="profile-hero__identity">
          <div className="profile-hero__row">
            <div className="profile-hero__avatar-wrap">
              <span className="profile-hero__piece-ring" aria-hidden>{piece}</span>
              <span className="user-avatar user-avatar--lg profile-hero__avatar" aria-hidden>
                {initial}
              </span>
            </div>
            <div>
              <span className="profile-welcome-pill">
                <span aria-hidden>{piece}</span> {t('profile_welcome')}
              </span>
              <h1 className="profile-hero__name">{displayName}</h1>
              <p className="profile-hero__nick">@{user?.username}</p>
              <ProfileChessMotto t={t} username={user?.username || ''} role={user?.role} />
            </div>
          </div>
        </div>
        <div className="profile-hero__side">
          <div className="profile-hero__chips">
            <span className="profile-role-pill">
              <span aria-hidden>{piece}</span> {t(roleKey)}
            </span>
            <span className="profile-rating-pill profile-rating-pill--all">
              <span className="profile-rating-pill__piece" aria-hidden>♚</span>
              {rating} Elo
            </span>
            {levelLabel ? (
              <span className="profile-hero-chip profile-hero-chip--level">{levelLabel}</span>
            ) : null}
            {puzzleStreak > 0 ? (
              <span className="profile-hero-chip profile-hero-chip--puzzle">
                🧩 {puzzleStreak}
              </span>
            ) : null}
            {winStreak > 0 ? (
              <span className="profile-hero-chip profile-hero-chip--fire">
                🔥 {winStreak}
              </span>
            ) : null}
          </div>
          <div className="profile-hero__record" aria-label={t('profile_wins')}>
            <span className="profile-hero__record-item profile-hero__record-item--win" title={t('profile_wins')}>
              <span aria-hidden>♔</span> {wins}
            </span>
            <span className="profile-hero__record-item profile-hero__record-item--draw" title={t('profile_draws')}>
              <span aria-hidden>♕</span> {draws}
            </span>
            <span className="profile-hero__record-item profile-hero__record-item--loss" title={t('profile_losses')}>
              <span aria-hidden>♘</span> {losses}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function ProfileSection({ title, children, className = '', piece = '♟' }) {
  return (
    <section className={`profile-section${className ? ` ${className}` : ''}`}>
      {title && (
        <h2 className="profile-section__title">
          <span className="profile-section__piece" aria-hidden>{piece}</span>
          {title}
        </h2>
      )}
      <div className="profile-section__grid">{children}</div>
    </section>
  );
}
