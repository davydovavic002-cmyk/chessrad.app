import { useI18n } from '../i18n/I18nContext';
import './LanguageToggle.css';

export default function LanguageToggle({ className = '' }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={`lang-toggle ${className}`.trim()} title={t('lobby_lang')}>
      <span className={`lang-toggle-label${lang === 'ru' ? ' active' : ''}`}>RU</span>
      <button
        type="button"
        className={`lang-toggle-switch${lang === 'en' ? ' is-en' : ''}`}
        onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}
        aria-label={t('lobby_lang')}
        role="switch"
        aria-checked={lang === 'en'}
      >
        <span className="lang-toggle-knob" />
      </button>
      <span className={`lang-toggle-label${lang === 'en' ? ' active' : ''}`}>EN</span>
    </div>
  );
}
