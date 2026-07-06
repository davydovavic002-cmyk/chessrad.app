import Modal from './Modal';
import { useI18n } from '../i18n/I18nContext';

const WHITE = [
  { piece: 'q', label: '♕' },
  { piece: 'r', label: '♖' },
  { piece: 'b', label: '♗' },
  { piece: 'n', label: '♘' },
];

const BLACK = [
  { piece: 'q', label: '♛' },
  { piece: 'r', label: '♜' },
  { piece: 'b', label: '♝' },
  { piece: 'n', label: '♞' },
];

export default function PromotionModal({ color = 'w', onSelect, onCancel }) {
  const { t } = useI18n();
  const options = color === 'b' ? BLACK : WHITE;

  return (
    <Modal open onClose={onCancel} dark contentClassName="promotion-modal-panel">
      <h3 style={{ color: 'white', marginBottom: 15, textAlign: 'center' }}>{t('promotion_title')}</h3>
      <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
        {options.map(({ piece, label }) => (
          <button
            key={piece}
            type="button"
            onClick={() => onSelect(piece)}
            style={{
              width: 60,
              height: 60,
              fontSize: 40,
              cursor: 'pointer',
              background: '#ecf0f1',
              borderRadius: 5,
              border: 'none',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
