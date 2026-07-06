import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle({ variant }) {
  const { t } = useI18n();
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`theme-toggle${variant ? ` theme-toggle--${variant}` : ''}`}
      onClick={toggleTheme}
      title={t('theme_toggle')}
      aria-label={t('theme_toggle')}
    >
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb">{isDark ? '🌙' : '☀️'}</span>
      </span>
    </button>
  );
}
