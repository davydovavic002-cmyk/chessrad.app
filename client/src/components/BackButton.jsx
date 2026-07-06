import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';

/**
 * Compact fixed back control (‹), same pattern as schedule.
 */
export default function BackButton({ to = '/lobby', title }) {
  const { t } = useI18n();
  return (
    <Link to={to} className="back-btn-fixed" title={title || t('back_short')} aria-label={title || t('back_short')}>
      ‹
    </Link>
  );
}
