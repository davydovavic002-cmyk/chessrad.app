import { useI18n } from '../../i18n/I18nContext';

const ROLE_KEYS = {
  student: 'auth_student',
  teacher: 'auth_teacher',
  player: 'auth_player',
  admin: 'auth_teacher',
};

export default function ProfileHero({ user, rating, isPlayer }) {
  const { t } = useI18n();
  const displayName = user?.display_name || user?.username || '';
  const initial = (displayName[0] || '?').toUpperCase();
  const roleKey = ROLE_KEYS[user?.role] || 'auth_player';

  return (
    <header className="profile-hero">
      <div className="profile-hero__glow" aria-hidden />
      <div className="profile-hero__body">
        <div className="profile-hero__identity">
          <div className="profile-hero__row">
            <span className="user-avatar user-avatar--lg" aria-hidden>{initial}</span>
            <div>
              <span className="profile-welcome-pill">{t('profile_welcome')}</span>
              <h1 className="profile-hero__name">{displayName}</h1>
              <p className="profile-hero__nick">@{user?.username}</p>
            </div>
          </div>
        </div>
        <div className="profile-hero__chips">
          <span className="profile-role-pill">{t(roleKey)}</span>
          {isPlayer && (
            <span className="profile-rating-pill">{rating}</span>
          )}
        </div>
      </div>
    </header>
  );
}

export function ProfileSection({ title, children, className = '' }) {
  return (
    <section className={`profile-section${className ? ` ${className}` : ''}`}>
      {title && <h2 className="profile-section__title">{title}</h2>}
      <div className="profile-section__grid">{children}</div>
    </section>
  );
}
