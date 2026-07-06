import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import Swal from 'sweetalert2';
import { apiJson } from '../api';
import Board from '../components/Board';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import '../styles/features-game.css';
import '../styles/homework.css';

export default function HomeworkPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [fen, setFen] = useState('');
  const gameRef = useRef(new Chess());

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  const load = useCallback(async () => {
    const { data } = await apiJson('/api/homework');
    setItems(data.items || []);
    const id = searchParams.get('id');
    if (id) {
      const hw = (data.items || []).find((x) => String(x.id) === String(id));
      if (hw) openHomework(hw);
    }
  }, [searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  function openHomework(hw) {
    setActive(hw);
    gameRef.load(hw.fen);
    setFen(hw.fen);
  }

  const onDrop = useCallback(
    (source, target) => {
      if (isTeacher || active?.status !== 'pending') return false;
      const move = gameRef.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;
      setFen(gameRef.fen());
      return true;
    },
    [active, gameRef, isTeacher]
  );

  async function complete() {
    const { res } = await apiJson(`/api/homework/${active.id}/complete`, { method: 'POST' });
    if (res.ok) {
      Swal.fire({ icon: 'success', title: t('homework_completed'), timer: 1500, showConfirmButton: false });
      setActive(null);
      load();
    }
  }

  function statusLabel(status) {
    if (status === 'completed') return t('homework_completed');
    if (status === 'late') return t('homework_late');
    return t('homework_pending');
  }

  function statusClass(status) {
    if (status === 'completed') return 'completed';
    if (status === 'late') return 'late';
    return 'pending';
  }


  return (
    <div className="homework-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <header className="game-hud">
        <span className="game-hud__badge">QUEST LOG</span>
        <h1>{t('homework_title')}</h1>
        <p className="game-hud__sub">
          {items.length > 0
            ? `${items.length} ${isTeacher ? 'assignments' : t('homework_pending').toLowerCase()}`
            : t('homework_empty')}
        </p>
      </header>

      <div className="homework-layout">
        <aside className="homework-list game-panel">
          <div className="game-panel__head">
            <span className="game-panel__head-icon">📜</span>
            {t('homework_title')}
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.length === 0 ? (
            <p className="subtitle">{t('homework_empty')}</p>
          ) : (
            items.map((hw) => (
              <button
                key={hw.id}
                type="button"
                className={`game-quest-card homework-card${active?.id === hw.id ? ' active' : ''} status-${hw.status}`}
                onClick={() => openHomework(hw)}
              >
                <span className="game-quest-card__title">{hw.title}</span>
                <span className="game-quest-card__meta">{t('homework_due', { date: hw.due_date })}</span>
                <span className={`game-status-pill game-status-pill--${statusClass(hw.status)}`}>
                  {statusLabel(hw.status)}
                </span>
                {isTeacher ? (
                  <span className="game-quest-card__meta">{t('homework_for', { name: hw.student_name })}</span>
                ) : (
                  <span className="game-quest-card__meta">{t('homework_from', { name: hw.teacher_name })}</span>
                )}
              </button>
            ))
          )}
          </div>
        </aside>

        <div className="homework-board game-panel homework-arena">
          <div className="game-panel__head">
            <span className="game-panel__head-icon">⚔️</span>
            {active ? active.title : t('homework_open')}
          </div>
          <div className="homework-arena__body">
          {active ? (
            <>
              {active.instructions && (
                <p className="homework-instructions">
                  <strong>{t('homework_instructions')}:</strong> {active.instructions}
                </p>
              )}
              <div className="homework-board-wrap">
                <Board
                  id="homework-board"
                  fen={fen}
                  onDrop={onDrop}
                  canDragPiece={() => !isTeacher && active.status === 'pending'}
                />
              </div>
              {!isTeacher && active.status === 'pending' && (
                <button type="button" className="btn-game homework-arena__complete" onClick={complete}>
                  ✓ {t('homework_complete')}
                </button>
              )}
            </>
          ) : (
            <p className="subtitle" style={{ textAlign: 'center', padding: 40 }}>
              ← {t('homework_open')}
            </p>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
