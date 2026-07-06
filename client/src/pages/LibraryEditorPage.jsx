import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Swal from 'sweetalert2';
import { api, apiJson } from '../api';
import Board from '../components/Board';
import Modal from '../components/Modal';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import { useAuth } from '../auth/AuthContext';
import '../styles/library-editor.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

export default function LibraryEditorPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const gameRef = useRef(new Chess());
  const dragIndexRef = useRef(null);
  const [fen, setFen] = useState(START_FEN);
  const [positions, setPositions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [title, setTitle] = useState('');
  const [bigFolder, setBigFolder] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState(null);
  const [folderItems, setFolderItems] = useState([]);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [students, setStudents] = useState([]);
  const [hwOpen, setHwOpen] = useState(false);
  const [hwPos, setHwPos] = useState(null);
  const [hwStudentId, setHwStudentId] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDue, setHwDue] = useState('');
  const [hwInstructions, setHwInstructions] = useState('');

  const noSection = t('library_no_section');
  const general = t('library_general');

  const loadLibrary = useCallback(async () => {
    const res = await api('/api/positions');
    setPositions(await res.json());
  }, []);

  useEffect(() => {
    loadLibrary();
    if (user?.role === 'teacher' || user?.role === 'admin') {
      apiJson('/api/schedule/students').then(({ data }) => {
        if (data.success) {
          setStudents(data.students || []);
          if (data.students?.[0]) setHwStudentId(String(data.students[0].id));
        }
      });
    }
  }, [loadLibrary, user?.role]);

  function openAssignHw(pos) {
    setHwPos(pos);
    setHwTitle(pos.title || '');
    setHwInstructions('');
    setHwDue(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    setHwOpen(true);
  }

  async function assignHomeworkFromLibrary() {
    if (!hwStudentId || !hwPos) return;
    const { res } = await apiJson('/api/homework', {
      method: 'POST',
      body: JSON.stringify({
        studentId: Number(hwStudentId),
        title: hwTitle || hwPos.title,
        fen: hwPos.fen,
        pgn: '',
        instructions: hwInstructions,
        dueDate: hwDue,
      }),
    });
    if (res.ok) {
      setHwOpen(false);
      Swal.fire({ icon: 'success', title: t('study_hw_sent'), timer: 1500, showConfirmButton: false });
    }
  }

  useEffect(() => {
    if (!detail) {
      setFolderItems([]);
      return;
    }
    const items = positions
      .filter(
        (p) =>
          (p.big_folder || noSection) === detail.big &&
          (p.category || general) === detail.sub
      )
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    setFolderItems(items);
  }, [detail, positions, noSection, general]);

  const onDrop = useCallback((source, target) => {
    const game = gameRef.current;
    const piece = game.get(source);
    if (!piece) return false;
    game.remove(source);
    game.put(piece, target);
    const fenParts = game.fen().split(' ');
    fenParts[1] = 'w';
    fenParts[2] = '-';
    fenParts[3] = '-';
    fenParts[4] = '0';
    fenParts[5] = '1';
    game.load(fenParts.join(' '));
    setFen(game.fen());
    return true;
  }, []);

  function setBoardFen(newFen) {
    gameRef.current.load(newFen);
    setFen(newFen);
  }

  function openSaveModal(id = '') {
    setEditId(id);
    if (id) {
      const pos = positions.find((p) => String(p.id) === String(id));
      if (pos) {
        setTitle(pos.title);
        setBigFolder(pos.big_folder || '');
        setCategory(pos.category || '');
        setBoardFen(pos.fen);
      }
    } else {
      setTitle('');
      setBigFolder('');
      setCategory('');
    }
    setModalOpen(true);
  }

  async function savePosition() {
    if (!title.trim()) {
      Swal.fire({ icon: 'warning', text: t('library_title_required') });
      return;
    }
    const body = {
      title: title.trim(),
      big_folder: bigFolder.trim() || noSection,
      category: category.trim() || general,
      fen,
    };
    const method = editId ? 'PUT' : 'POST';
    const url = editId ? `/api/positions/${editId}` : '/api/positions';
    await api(url, { method, body: JSON.stringify(body) });
    setModalOpen(false);
    setDetail(null);
    loadLibrary();
  }

  async function deletePos(id) {
    const result = await Swal.fire({
      title: t('library_delete_q'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel'),
    });
    if (!result.isConfirmed) return;
    await api(`/api/positions/${id}`, { method: 'DELETE' });
    loadLibrary();
    setDetail(null);
  }

  async function persistOrder(items) {
    await api('/api/positions/reorder', {
      method: 'POST',
      body: JSON.stringify({
        positions: items.map((p, idx) => ({ id: p.id, order_index: idx })),
      }),
    });
    setPositions((prev) => {
      const orderMap = new Map(items.map((p, idx) => [String(p.id), idx]));
      return prev.map((p) =>
        orderMap.has(String(p.id)) ? { ...p, order_index: orderMap.get(String(p.id)) } : p
      );
    });
  }

  function handleDragStart(index) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function handleDrop(index) {
    const from = dragIndexRef.current;
    setDragOverIndex(null);
    dragIndexRef.current = null;
    if (from === null || from === index) return;

    const items = [...folderItems];
    const [moved] = items.splice(from, 1);
    items.splice(index, 0, moved);
    setFolderItems(items);
    await persistOrder(items);
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  const bigs = [...new Set(positions.map((p) => p.big_folder || noSection))].sort();

  return (
    <div className="library-page page-wrap">
      <BackButton to="/profile" title={t('back_to_profile')} />
      <h1>{t('library_title')}</h1>

      <div className="editor-container">
        <div className="board-section">
          <h3 style={{ marginTop: 0 }}>{t('library_constructor')}</h3>
          <Board id="lib-editor-board" fen={fen} onDrop={onDrop} allowDragging />
          <div id="fen-display">FEN: {fen}</div>
          <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBoardFen(START_FEN)}>
              {t('study_start')}
            </button>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setBoardFen(EMPTY_FEN)}>
              {t('study_clear')}
            </button>
          </div>
          <button type="button" className="btn-save-main" style={{ marginTop: 15 }} onClick={() => openSaveModal()}>
            {t('library_save_pos')}
          </button>
        </div>

        <div className="form-section">
          {!detail ? (
            <div>
              <h2 style={{ marginTop: 0, fontSize: 24 }}>{t('library_sections')}</h2>
              {bigs.map((bigName) => {
                const subPositions = positions.filter((p) => (p.big_folder || noSection) === bigName);
                const subs = [...new Set(subPositions.map((p) => p.category || general))].sort();
                return (
                  <div key={bigName} className="big-folder-container">
                    <div className="big-folder-header">{bigName}</div>
                    <div className="big-folder-content">
                      {subs.map((sub) => (
                        <div
                          key={sub}
                          className="folder-card"
                          onClick={() => setDetail({ big: bigName, sub })}
                          style={{ cursor: 'pointer' }}
                        >
                          <div>📂</div>
                          <strong>{sub}</strong>
                          <div className="count">
                            {t('library_pos_count', {
                              n: subPositions.filter((p) => (p.category || general) === sub).length,
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="back-btn" onClick={() => setDetail(null)}>
                ← {t('back_short')}
              </div>
              <h3>
                {detail.big} / {detail.sub}
              </h3>
              <p className="subtitle" style={{ marginBottom: 12 }}>
                {t('library_drag_hint')}
              </p>
              <div id="positions-sortable">
                {folderItems.map((pos, index) => (
                  <div
                    key={pos.id}
                    className="pos-sort-item"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 8,
                      padding: 8,
                      borderRadius: 8,
                      border:
                        dragOverIndex === index
                          ? '2px dashed var(--peach-600, #e67e22)'
                          : '1px solid rgba(0,0,0,0.08)',
                      background: 'rgba(255,255,255,0.35)',
                      cursor: 'grab',
                    }}
                  >
                    <div
                      className="drag-handle"
                      style={{ cursor: 'grab', padding: '4px 8px', color: '#999', userSelect: 'none' }}
                      title={t('library_drag_title')}
                    >
                      ☰
                    </div>
                    <div className="pos-details" style={{ flex: 1 }}>
                      <strong>{pos.title}</strong>
                    </div>
                    <button type="button" className="btn-edit-small" onClick={() => openSaveModal(pos.id)}>
                      ✎
                    </button>
                    {(user?.role === 'teacher' || user?.role === 'admin') && (
                      <button
                        type="button"
                        className="btn-edit-small"
                        title={t('library_assign_hw')}
                        onClick={() => openAssignHw(pos)}
                      >
                        📝
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-edit-small"
                      style={{ color: '#e74c3c' }}
                      onClick={() => deletePos(pos.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <h3>{editId ? t('library_edit_pos') : t('library_new_pos')}</h3>
        <input
          className="form-input"
          placeholder={t('library_name_ph')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="form-input mt-2"
          placeholder={t('library_section_ph')}
          value={bigFolder}
          onChange={(e) => setBigFolder(e.target.value)}
        />
        <input
          className="form-input mt-2"
          placeholder={t('library_folder_ph')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-block mt-2" onClick={savePosition}>
          {t('save')}
        </button>
        <button type="button" className="btn btn-ghost btn-block mt-1" onClick={() => setModalOpen(false)}>
          {t('cancel')}
        </button>
      </Modal>

      <Modal open={hwOpen} onClose={() => setHwOpen(false)}>
        <h3>{t('library_assign_hw')}</h3>
        <select
          className="form-input"
          value={hwStudentId}
          onChange={(e) => setHwStudentId(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.username}</option>
          ))}
        </select>
        <input
          className="form-input mt-2"
          placeholder={t('journal_entry_title')}
          value={hwTitle}
          onChange={(e) => setHwTitle(e.target.value)}
        />
        <input
          className="form-input mt-2"
          type="date"
          value={hwDue}
          onChange={(e) => setHwDue(e.target.value)}
        />
        <textarea
          className="form-input mt-2"
          rows={3}
          placeholder={t('homework_instructions')}
          value={hwInstructions}
          onChange={(e) => setHwInstructions(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-block mt-2" onClick={assignHomeworkFromLibrary}>
          {t('study_assign_hw')}
        </button>
      </Modal>
    </div>
  );
}
