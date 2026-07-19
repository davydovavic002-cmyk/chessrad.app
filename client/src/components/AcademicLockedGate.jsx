import { Link } from 'react-router-dom';

/** Blurs academic content until student links a teacher — content stays visible underneath. */
export default function AcademicLockedGate({ locked, t, children, className = '' }) {
  if (!locked) return children;

  return (
    <div className={`academic-locked-wrap is-locked${className ? ` ${className}` : ''}`}>
      <div className="academic-locked-wrap__content" aria-hidden="true">
        {children}
      </div>
      <div className="academic-locked-wrap__veil" role="region" aria-label={t('academic_locked_title')}>
        <div className="academic-locked-wrap__card glass-strong">
          <span className="academic-locked-wrap__icon" aria-hidden>
            🔒
          </span>
          <p className="academic-locked-wrap__title">{t('academic_locked_title')}</p>
          <p className="subtitle academic-locked-wrap__hint">{t('academic_locked_hint')}</p>
          <Link to="/profile" className="btn btn-primary btn-sm">
            {t('link_connect_btn')}
          </Link>
        </div>
      </div>
    </div>
  );
}
