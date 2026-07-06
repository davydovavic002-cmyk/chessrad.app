import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import Modal from './Modal';
import { useI18n } from '../i18n/I18nContext';

export default function LibraryPickerModal({ open, onClose, onPick }) {
  const { t } = useI18n();
  const [positions, setPositions] = useState([]);
  const [detail, setDetail] = useState(null);

  const noSection = t('library_no_section');
  const general = t('library_general');

  const load = useCallback(async () => {
    const res = await api('/api/positions');
    setPositions(await res.json());
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const bigs = [...new Set(positions.map((p) => p.big_folder || noSection))].sort();

  return (
    <Modal open={open} onClose={onClose} dark contentClassName="library-picker-modal">
      <h3>{t('study_library')}</h3>
      {!detail ? (
        <div className="library-picker-folders">
          {bigs.map((big) => {
            const subs = [...new Set(
              positions.filter((p) => (p.big_folder || noSection) === big).map((p) => p.category || general)
            )].sort();
            return (
              <div key={big}>
                <strong>{big}</strong>
                {subs.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    className="btn btn-ghost btn-block"
                    style={{ textAlign: 'left', marginTop: 4 }}
                    onClick={() => setDetail({ big, sub })}
                  >
                    📂 {sub}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>
            ← {t('back_short')}
          </button>
          <div className="library-picker-list">
            {positions
              .filter(
                (p) =>
                  (p.big_folder || noSection) === detail.big &&
                  (p.category || general) === detail.sub
              )
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="library-picker-item"
                  onClick={() => {
                    onPick(p.fen, p.title);
                    onClose();
                  }}
                >
                  {p.title}
                </button>
              ))}
          </div>
        </>
      )}
    </Modal>
  );
}
