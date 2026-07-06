import { useState } from 'react';
import Modal from './Modal';
import { useI18n } from '../i18n/I18nContext';
import { apiJson } from '../api';
import { useAuth } from '../auth/AuthContext';

const STEPS = [
  { key: 'onboarding_welcome', icon: '♟️' },
  { key: 'onboarding_step1', icon: '🔥' },
  { key: 'onboarding_step2', icon: '🎓' },
  { key: 'onboarding_step3', icon: '📅' },
  { key: 'onboarding_step4', icon: '👨‍👩‍👧' },
];

const REPLAY_KEY = 'chessrad_force_onboarding';

export default function OnboardingModal() {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const forceReplay = (() => {
    try {
      return localStorage.getItem(REPLAY_KEY) === '1';
    } catch {
      return false;
    }
  })();

  const show =
    user &&
    user.role === 'student' &&
    (!Number(user.onboarding_done) || forceReplay);

  async function finish() {
    try {
      localStorage.removeItem(REPLAY_KEY);
    } catch {
      /* ignore */
    }
    await apiJson('/api/profile/settings', {
      method: 'PATCH',
      body: JSON.stringify({ onboardingDone: true }),
    });
    await refreshUser();
  }

  if (!show) return null;

  const isLast = step >= STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <Modal open onClose={() => finish()} contentClassName="onboarding-modal-panel">
      <div className="onboarding-game">
        <div className="onboarding-game__step">
          {t('onboarding_step_label', { n: step + 1, total: STEPS.length })}
        </div>
        <div className="onboarding-game__icon" key={step}>
          {current.icon}
        </div>
        <h2>{t(current.key)}</h2>
        <div className="game-xp-bar">
          <div className="game-xp-bar__fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="game-xp-label">{Math.round(progress)}% — {t('onboarding_progress')}</div>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'active' : i < step ? 'done' : ''} />
          ))}
        </div>
        <button
          type="button"
          className="btn-game"
          onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
        >
          {isLast ? t('onboarding_done') : t('onboarding_next')}
        </button>
        {!isLast && (
          <button type="button" className="btn btn-ghost btn-block mt-2" onClick={finish}>
            {t('onboarding_skip')}
          </button>
        )}
      </div>
    </Modal>
  );
}

export function triggerOnboardingReplay() {
  try {
    localStorage.setItem(REPLAY_KEY, '1');
  } catch {
    /* ignore */
  }
}
