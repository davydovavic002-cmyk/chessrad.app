import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { formatLinkCode, linkUrl } from '../utils/linkCode';
import { loadQrImage } from '../utils/qrImage';

const ROLE_LABELS = {
  student: 'link_card_role_student',
  teacher: 'link_card_role_teacher',
  player: 'link_card_role_player',
  admin: 'link_card_role_teacher',
};

export default function ProfileLinkCard({ user, onConnectCode, connectMsg, connectOk }) {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const cardRef = useRef(null);
  const [codeInput, setCodeInput] = useState('');
  const formatted = formatLinkCode(user?.link_code);
  const url = linkUrl(user?.link_code);
  const displayName = user?.display_name || user?.username || '';
  const roleKey = ROLE_LABELS[user?.role] || 'link_card_role_player';

  const drawCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !formatted) return;
    const ctx = canvas.getContext('2d');
    const w = 360;
    const h = 520;
    canvas.width = w;
    canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fff5f0');
    grad.addColorStop(0.5, '#ffd4c4');
    grad.addColorStop(1, '#ffb8a0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255,112,67,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    ctx.fillStyle = '#e85a2e';
    ctx.font = 'bold 28px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ChessRad', w / 2, 56);

    ctx.fillStyle = '#2d1f1a';
    ctx.font = 'bold 22px Outfit, sans-serif';
    ctx.fillText(displayName, w / 2, 96);

    ctx.fillStyle = 'rgba(45,31,26,0.65)';
    ctx.font = '14px Outfit, sans-serif';
    ctx.fillText(`@${user?.username || ''}`, w / 2, 122);

    ctx.fillStyle = '#e85a2e';
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.fillText(t(roleKey).toUpperCase(), w / 2, 148);

    const qrImg = await loadQrImage(url, 200);
    ctx.drawImage(qrImg, (w - 200) / 2, 168, 200, 200);

    ctx.fillStyle = '#2d1f1a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(formatted, w / 2, 400);

    ctx.fillStyle = 'rgba(45,31,26,0.55)';
    ctx.font = '12px Outfit, sans-serif';
    ctx.fillText(t('link_card_scan'), w / 2, 430);
    ctx.fillText(t('link_card_footer'), w / 2, 470);
  }, [displayName, formatted, roleKey, t, url, user?.username]);

  useEffect(() => {
    drawCard();
  }, [drawCard]);

  async function downloadCard() {
    await drawCard();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `chessrad-${user?.username || 'card'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function submitCode(e) {
    e.preventDefault();
    if (!codeInput.trim()) return;
    onConnectCode?.(codeInput.trim());
  }

  return (
    <div className="profile-link-card" ref={cardRef}>
      <div className="profile-link-card__preview">
        <canvas ref={canvasRef} className="profile-link-card__canvas" aria-hidden />
      </div>
      <div className="profile-link-card__meta">
        <p className="profile-link-card__code">{formatted}</p>
        <p className="subtitle">{t('link_card_yours')}</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={downloadCard}>
          {t('link_card_download')}
        </button>
      </div>
      {onConnectCode && (
        <form className="profile-link-connect" onSubmit={submitCode}>
          <label htmlFor="link-code-input">{t('link_connect_label')}</label>
          <div className="profile-link-connect__row">
            <input
              id="link-code-input"
              className="form-input"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder={t('link_connect_ph')}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('link_connect_btn')}
            </button>
          </div>
          {connectMsg && (
            <div className={`status-msg${connectOk ? ' success' : ' error'}`}>{connectMsg}</div>
          )}
        </form>
      )}
    </div>
  );
}
