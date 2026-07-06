import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Chess } from 'chess.js';
import { useAuth } from '../auth/AuthContext';
import { api, apiJson } from '../api';
import { getSocket } from '../socket';
import Board from '../components/Board';
import Modal from '../components/Modal';
import BackButton from '../components/BackButton';
import StudyDrawOverlay from '../components/StudyDrawOverlay';
import { useI18n } from '../i18n/I18nContext';
import StudyVideoRoom from '../components/StudyVideoRoom';
import '../styles/study-video.css';
import '../styles/study.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const PALETTE = [
  { code: 'wK', label: '♔' },
  { code: 'wQ', label: '♕' },
  { code: 'wR', label: '♖' },
  { code: 'wB', label: '♗' },
  { code: 'wN', label: '♘' },
  { code: 'wP', label: '♙' },
  { code: 'bK', label: '♚' },
  { code: 'bQ', label: '♛' },
  { code: 'bR', label: '♜' },
  { code: 'bB', label: '♝' },
  { code: 'bN', label: '♞' },
  { code: 'bP', label: '♟' },
];

function toSetupFen(game) {
  const parts = game.fen().split(' ');
  parts[1] = 'w';
  parts[2] = '-';
  parts[3] = '-';
  parts[4] = '0';
  parts[5] = '1';
  return parts.join(' ');
}

function normalizeFen(fen) {
  return fen === 'start' ? START_FEN : fen;
}

export default function StudyPage() {
  const { user } = useAuth();
  const { t, moveLabel: formatPieceMove } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get('room');

  const gameRef = useRef(new Chess());
  const tabsRef = useRef([{ id: 'play', type: 'play', fen: 'start', shapes: [], pgn: '', customHistory: [], notes: '' }]);
  const activeTabIdRef = useRef('play');
  const isTeacherRef = useRef(false);

  const [tabs, setTabs] = useState(tabsRef.current);
  const [activeTabId, setActiveTabId] = useState('play');
  const [isTeacher, setIsTeacher] = useState(false);
  const [fen, setFen] = useState(START_FEN);
  const [orientation, setOrientation] = useState('white');
  const [history, setHistory] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [libOpen, setLibOpen] = useState(false);
  const [libPositions, setLibPositions] = useState([]);
  const [libView, setLibView] = useState({ level: 'folders', big: null, cat: null });
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFen, setEditorFen] = useState(EMPTY_FEN);
  const [palettePiece, setPalettePiece] = useState(null);
  const [roomStudentId, setRoomStudentId] = useState(null);
  const [tabNotes, setTabNotes] = useState('');
  const [hwOpen, setHwOpen] = useState(false);
  const [hwTitle, setHwTitle] = useState('');
  const [hwInstructions, setHwInstructions] = useState('');
  const [hwDue, setHwDue] = useState('');
  const [roomTeacherId, setRoomTeacherId] = useState(null);
  const [pgnImportOpen, setPgnImportOpen] = useState(false);
  const [pgnImportText, setPgnImportText] = useState('');
  const editorGameRef = useRef(new Chess(EMPTY_FEN));

  useEffect(() => {
    if (!roomCode) navigate('/lobby');
  }, [roomCode, navigate]);

  const syncTabsState = useCallback(() => {
    setTabs([...tabsRef.current]);
    setActiveTabId(activeTabIdRef.current);
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab) return;
    const currentFen = normalizeFen(tab.fen);
    gameRef.current.load(currentFen);
    setFen(currentFen);
    setHistory(tab.customHistory || []);
    setShapes(tab.shapes || []);
    setTabNotes(tab.notes || '');
    if (tab.type === 'play') {
      setOrientation(isTeacherRef.current ? 'white' : 'black');
      const side = gameRef.current.turn() === 'w' ? t('study_white') : t('study_black');
      setStatusMsg(t('study_turn', { side }));
    } else {
      setOrientation('white');
      setStatusMsg(t('study_demo_pos'));
    }
  }, [t]);

  const switchTab = useCallback(
    (id, emit = true) => {
      const tab = tabsRef.current.find((t) => t.id === id);
      if (!tab) return;
      activeTabIdRef.current = id;
      if (emit && isTeacherRef.current) {
        getSocket().emit('study:switchTab', { roomCode, tabId: id });
      }
      syncTabsState();
    },
    [roomCode, syncTabsState]
  );

  const applyFen = useCallback(
    (newFen) => {
      if (!isTeacherRef.current) return;
      const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
      if (!tab) return;
      const fenValue = normalizeFen(newFen);
      tab.fen = fenValue;
      tab.initialFen = fenValue;
      tab.pgn = '';
      tab.customHistory = [];
      tab.shapes = [];
      gameRef.current.load(fenValue);
      getSocket().emit('study:move', {
        roomCode,
        tabId: activeTabIdRef.current,
        fen: fenValue,
        pgn: '',
        customHistory: [],
      });
      getSocket().emit('study:draw', {
        roomCode,
        tabId: activeTabIdRef.current,
        shapes: [],
      });
      syncTabsState();
      setLibOpen(false);
    },
    [roomCode, syncTabsState]
  );

  const handleShapesChange = useCallback(
    (nextShapes) => {
      const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
      if (tab) tab.shapes = nextShapes;
      setShapes(nextShapes);
      getSocket().emit('study:draw', {
        roomCode,
        tabId: activeTabIdRef.current,
        shapes: nextShapes,
      });
    },
    [roomCode]
  );

  useEffect(() => {
    if (!roomCode) return;
    const socket = getSocket({ transports: ['websocket'] });

    socket.emit('study:join', { roomCode });

    const onRoomData = (d) => {
      const teacher =
        Number(d.teacher_id) === Number(user.id) ||
        user.role === 'admin' ||
        user.role === 'teacher';
      isTeacherRef.current = teacher;
      setIsTeacher(teacher);
      setRoomTeacherId(d.teacher_id || null);
      setRoomStudentId(d.student_id || null);
      if (d.tabs?.length) tabsRef.current = d.tabs;
      activeTabIdRef.current = d.activeTabId || activeTabIdRef.current;
      syncTabsState();
    };

    const onSyncMove = (d) => {
      const t = tabsRef.current.find((x) => x.id === d.tabId);
      if (!t) return;
      t.fen = d.fen;
      t.pgn = d.pgn || '';
      t.customHistory = d.customHistory || [];
      if (d.tabId === activeTabIdRef.current) syncTabsState();
    };

    const onSyncTabs = (d) => {
      tabsRef.current = d.tabs;
      if (!tabsRef.current.find((t) => t.id === activeTabIdRef.current)) {
        activeTabIdRef.current = 'play';
      }
      syncTabsState();
    };

    const onSyncSwitch = (d) => {
      if (!isTeacherRef.current) switchTab(d.tabId, false);
    };

    const onSyncDraw = (d) => {
      const t = tabsRef.current.find((x) => x.id === d.tabId);
      if (t) t.shapes = d.shapes || [];
      if (d.tabId === activeTabIdRef.current) setShapes(d.shapes || []);
    };

    const onSyncNotes = (d) => {
      const t = tabsRef.current.find((x) => x.id === d.tabId);
      if (t) t.notes = d.notes || '';
      if (d.tabId === activeTabIdRef.current) setTabNotes(d.notes || '');
    };

    socket.on('study:roomData', onRoomData);
    socket.on('study:syncMove', onSyncMove);
    socket.on('study:syncTabs', onSyncTabs);
    socket.on('study:syncSwitchTab', onSyncSwitch);
    socket.on('study:syncDraw', onSyncDraw);
    socket.on('study:syncNotes', onSyncNotes);

    return () => {
      socket.off('study:roomData', onRoomData);
      socket.off('study:syncMove', onSyncMove);
      socket.off('study:syncTabs', onSyncTabs);
      socket.off('study:syncSwitchTab', onSyncSwitch);
      socket.off('study:syncDraw', onSyncDraw);
      socket.off('study:syncNotes', onSyncNotes);
    };
  }, [roomCode, user.id, user.role, syncTabsState, switchTab]);

  const emitMove = useCallback(
    (tab) => {
      getSocket().emit('study:move', {
        roomCode,
        tabId: activeTabIdRef.current,
        fen: tab.fen,
        pgn: tab.pgn,
        customHistory: tab.customHistory,
      });
      syncTabsState();
    },
    [roomCode, syncTabsState]
  );

  const onDrop = useCallback(
    (source, target) => {
      const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
      if (!tab) return false;
      if (!tab.customHistory) tab.customHistory = [];

      const game = gameRef.current;
      if (game.fen() !== normalizeFen(tab.fen)) game.load(normalizeFen(tab.fen));

      const pieceBefore = game.get(source);
      if (!pieceBefore) return false;

      const move = game.move({ from: source, to: target, promotion: 'q' });
      let moveNotation = '';

      if (move) {
        moveNotation = formatPieceMove(move.piece, move.from, move.to);
      } else if (tab.type !== 'play') {
        moveNotation = formatPieceMove(pieceBefore.type, source, target);
        game.remove(source);
        game.put(pieceBefore, target);
        const fenParts = game.fen().split(' ');
        fenParts[1] = game.turn() === 'w' ? 'b' : 'w';
        game.load(fenParts.join(' '));
      } else {
        return false;
      }

      tab.customHistory.push({
        san: moveNotation,
        fen: game.fen(),
        from: source,
        to: target,
        piece: pieceBefore.type,
      });
      tab.fen = game.fen();
      tab.pgn = game.pgn();
      emitMove(tab);
      return true;
    },
    [emitMove, formatPieceMove]
  );

  const canDragPiece = useCallback(({ piece }) => {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab) return false;
    if (tab.type === 'play') {
      if (!isTeacherRef.current && piece.pieceType?.charAt(0) === 'w') return false;
      if (isTeacherRef.current && piece.pieceType?.charAt(0) === 'b') return false;
    }
    return true;
  }, []);

  function addTab() {
    if (!isTeacher) return;
    if (tabsRef.current.length >= 21) {
      alert(t('study_max_tabs'));
      return;
    }
    const newId = `tab_${Date.now()}`;
    const newTab = {
      id: newId,
      type: 'demo',
      fen: EMPTY_FEN,
      initialFen: EMPTY_FEN,
      shapes: [],
      pgn: '',
      customHistory: [],
      notes: '',
    };
    tabsRef.current = [...tabsRef.current, newTab];
    getSocket().emit('study:updateTabs', {
      roomCode,
      tabs: tabsRef.current,
      activeTabId: newId,
    });
    switchTab(newId);
  }

  function removeTab(id, e) {
    e?.stopPropagation();
    if (!isTeacher || id === 'play') return;
    tabsRef.current = tabsRef.current.filter((t) => t.id !== id);
    if (activeTabIdRef.current === id) activeTabIdRef.current = 'play';
    getSocket().emit('study:updateTabs', {
      roomCode,
      tabs: tabsRef.current,
      activeTabId: activeTabIdRef.current,
    });
    switchTab(activeTabIdRef.current);
  }

  function moveLabel(entry) {
    if (entry.from && entry.to) {
      return formatPieceMove(entry.piece || 'p', entry.from, entry.to);
    }
    return entry.san || '—';
  }

  function goToMove(index) {
    if (!isTeacher) return;
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab?.customHistory?.[index]) return;
    const target = tab.customHistory[index];
    // откат доски к выбранному ходу, всё после — стираем
    tab.customHistory = tab.customHistory.slice(0, index + 1);
    gameRef.current.load(target.fen);
    tab.fen = target.fen;
    tab.pgn = gameRef.current.pgn();
    tab.shapes = [];
    setShapes([]);
    getSocket().emit('study:draw', {
      roomCode,
      tabId: activeTabIdRef.current,
      shapes: [],
    });
    emitMove(tab);
  }

  function resetFullHistory() {
    if (!isTeacher) return;
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (!tab) return;
    const initialFen =
      tab.id === 'play' ? START_FEN : normalizeFen(tab.initialFen || EMPTY_FEN);
    tab.customHistory = [];
    tab.fen = initialFen;
    tab.pgn = '';
    tab.shapes = [];
    gameRef.current.load(initialFen);
    setShapes([]);
    getSocket().emit('study:draw', {
      roomCode,
      tabId: activeTabIdRef.current,
      shapes: [],
    });
    emitMove(tab);
  }

  async function openLibrary() {
    const res = await api('/api/positions');
    const data = await res.json();
    setLibPositions(data);
    setLibView({ level: 'folders', big: null, cat: null });
    setLibOpen(true);
  }

  function openEditor() {
    const current = normalizeFen(fen);
    editorGameRef.current.load(current);
    setEditorFen(current);
    setPalettePiece(null);
    setEditorOpen(true);
  }

  const onEditorDrop = useCallback((source, target) => {
    const game = editorGameRef.current;
    if (!target) {
      game.remove(source);
      const next = toSetupFen(game);
      game.load(next);
      setEditorFen(next);
      return true;
    }
    const piece = game.get(source);
    if (!piece) return false;
    game.remove(source);
    game.put(piece, target);
    const next = toSetupFen(game);
    game.load(next);
    setEditorFen(next);
    return true;
  }, []);

  const onEditorSquareClick = useCallback(
    (square) => {
      const game = editorGameRef.current;
      if (palettePiece) {
        const color = palettePiece[0];
        const type = palettePiece[1].toLowerCase();
        game.remove(square);
        game.put({ type, color }, square);
        const next = toSetupFen(game);
        game.load(next);
        setEditorFen(next);
        return;
      }
      if (game.get(square)) {
        game.remove(square);
        const next = toSetupFen(game);
        game.load(next);
        setEditorFen(next);
      }
    },
    [palettePiece]
  );

  function applyEditor() {
    applyFen(editorFen);
    setEditorOpen(false);
    setPalettePiece(null);
  }

  const notesDebounceRef = useRef(null);
  function handleNotesChange(value) {
    setTabNotes(value);
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    if (tab) tab.notes = value;
    if (!isTeacherRef.current) return;
    clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      getSocket().emit('study:notes', {
        roomCode,
        tabId: activeTabIdRef.current,
        notes: value,
      });
    }, 400);
  }

  function exportPgn(copyOnly = false) {
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    const pgnText = tab?.pgn || gameRef.current.pgn() || '';
    if (copyOnly) {
      navigator.clipboard.writeText(pgnText);
      alert(t('study_pgn_copied'));
      return;
    }
    const blob = new Blob([pgnText], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-${roomCode}-${activeTabIdRef.current}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function assignHomework() {
    if (!roomStudentId) {
      alert(t('study_no_student'));
      return;
    }
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    const { res } = await apiJson('/api/homework', {
      method: 'POST',
      body: JSON.stringify({
        studentId: roomStudentId,
        roomCode,
        title: hwTitle || t('study_assign_hw'),
        fen: tab?.fen === 'start' ? START_FEN : normalizeFen(tab?.fen || fen),
        pgn: tab?.pgn || '',
        instructions: hwInstructions,
        dueDate: hwDue,
      }),
    });
    if (res.ok) {
      setHwOpen(false);
      setHwTitle('');
      setHwInstructions('');
      alert(t('study_hw_sent'));
    }
  }

  function importPgnFromText() {
    if (!pgnImportText.trim()) return;
    getSocket().emit('study:importPgn', {
      roomCode,
      pgn: pgnImportText.trim(),
      title: t('pgn_import_title'),
    });
    setPgnImportOpen(false);
    setPgnImportText('');
    Swal.fire({ icon: 'success', title: t('pgn_import_done'), timer: 1500, showConfirmButton: false });
  }

  async function savePgnArchive() {
    if (!roomStudentId) {
      alert(t('study_no_student'));
      return;
    }
    const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
    const pgnText = tab?.pgn || gameRef.current.pgn() || '';
    const { res } = await apiJson('/api/pgn-archive', {
      method: 'POST',
      body: JSON.stringify({
        studentId: roomStudentId,
        roomCode,
        title: tab?.type === 'demo' ? t('study_demo') : t('study_play'),
        pgn: pgnText,
        fen: tab?.fen === 'start' ? START_FEN : normalizeFen(tab?.fen || fen),
        lessonDate: new Date().toISOString().slice(0, 10),
      }),
    });
    if (res.ok) {
      Swal.fire({ icon: 'success', title: t('pgn_archive_saved'), timer: 1500, showConfirmButton: false });
    }
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const noSection = t('library_no_section');
  const general = t('library_general');
  const bigFolders = [...new Set(libPositions.map((p) => p.big_folder || noSection))].sort();

  return (
    <div className="study-page">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <header className="lobby-header">
        <div className="logo-area">
          <h1>
            ChessRad <span className="badge badge-streak">{t('study_badge')}</span>
          </h1>
        </div>
        <div className="user-badge-text">
          {t('study_you')}: <strong>{user.username}</strong>
        </div>
      </header>

      <div className="study-studio">
        <aside className="tabs-sidebar">
          <div id="tabs-list">
            {tabs.map((tabItem) => (
              <div
                key={tabItem.id}
                className={`tab-item${tabItem.id === activeTabId ? ' active' : ''}`}
                onClick={() => switchTab(tabItem.id)}
              >
                <div className="tab-icon-wrapper">{tabItem.type === 'play' ? '🎮' : '📋'}</div>
                <span className="tab-label">{tabItem.type === 'play' ? t('study_play') : t('study_demo')}</span>
                {isTeacher && tabItem.id !== 'play' && (
                  <div className="delete-tab" onClick={(e) => removeTab(tabItem.id, e)}>
                    ×
                  </div>
                )}
              </div>
            ))}
          </div>
          {isTeacher && (
            <button type="button" className="add-tab-btn" onClick={addTab} title={t('study_add_tab')}>
              +
            </button>
          )}
        </aside>

        <div className="board-section study-board-arena">
          <div id="status-msg" className="study-status-msg">{statusMsg}</div>
          <div className="board-container study-board-shell">
            <StudyDrawOverlay
              shapes={shapes}
              orientation={orientation}
              enabled={isTeacher}
              onShapesChange={handleShapesChange}
            >
              <Board
                id="study-board"
                fen={fen}
                orientation={orientation}
                onDrop={onDrop}
                canDragPiece={canDragPiece}
              />
            </StudyDrawOverlay>
          </div>
          {isTeacher && (
            <div className="board-controls study-board-controls">
              <button type="button" className="btn-secondary" onClick={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))}>
                {t('study_flip')}
              </button>
              <button type="button" className="btn-secondary" onClick={() => applyFen(START_FEN)}>
                {t('study_start')}
              </button>
              <button type="button" className="btn-danger-light" onClick={() => applyFen(EMPTY_FEN)}>
                {t('study_clear')}
              </button>
            </div>
          )}
        </div>

        <aside className="study-side-rail info-panel">
          {roomCode && roomTeacherId && (
            <div className="study-video-rail-slot">
              <StudyVideoRoom roomCode={roomCode} teacherId={roomTeacherId} layout="sidebar" />
            </div>
          )}

          <div className="study-side-body">
            <div className="room-info study-room-code">
              <span>{t('study_room')}</span>
              <strong>{roomCode}</strong>
            </div>

            {isTeacher && (
              <div className="study-teacher-tools">
                {activeTab?.type === 'demo' && (
                  <>
                    <button type="button" className="btn-primary-sm" onClick={openEditor}>
                      {t('study_editor')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={openLibrary}>
                      {t('study_library')}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="btn-secondary study-hw-btn"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 3);
                    setHwDue(d.toISOString().slice(0, 10));
                    setHwOpen(true);
                  }}
                >
                  {t('study_assign_hw')}
                </button>
              </div>
            )}

            <div className="study-history-block">
              <div className="history-toolbar">
                {isTeacher && (
                  <button
                    type="button"
                    className="history-reset-btn"
                    onClick={resetFullHistory}
                    title={t('study_reset_history')}
                    aria-label={t('study_reset_history')}
                  >
                    ⏮
                  </button>
                )}
              </div>
              <div className="chat-area history-list study-history-list">
                {history.length === 0 ? (
                  <em>{t('study_history_empty')}</em>
                ) : (
                  history.map((h, i) => {
                    const isLast = i === history.length - 1;
                    return (
                      <button
                        key={`${h.fen}-${i}`}
                        type="button"
                        className={`pgn-move history-move${isLast ? ' active' : ''}`}
                        onClick={() => goToMove(i)}
                        disabled={!isTeacher}
                        title={isTeacher ? t('study_goto_move') : undefined}
                      >
                        <span className="history-move-num">{i + 1}.</span>
                        <span className="history-move-label">{moveLabel(h)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={libOpen}
        onClose={() => setLibOpen(false)}
        contentClassName="study-lib-modal"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, textAlign: 'left' }}>
          <h3 style={{ margin: 0 }}>{t('study_library')}</h3>
          <button type="button" className="close-btn" onClick={() => setLibOpen(false)}>
            ×
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, maxHeight: '60vh', overflowY: 'auto' }}>
          {libView.level === 'folders' &&
            bigFolders.map((bf) => (
              <div
                key={bf}
                className="folder-card"
                style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: 15, textAlign: 'center', cursor: 'pointer', color: '#333' }}
                onClick={() => setLibView({ level: 'subs', big: bf, cat: null })}
              >
                <div style={{ fontSize: 30 }}>📁</div>
                <strong>{bf}</strong>
              </div>
            ))}
          {libView.level === 'subs' && (
            <>
              <button type="button" className="btn btn-secondary" style={{ gridColumn: '1 / -1' }} onClick={() => setLibView({ level: 'folders', big: null, cat: null })}>
                ← {t('back_short')}
              </button>
              {[
                ...new Set(
                  libPositions
                    .filter((p) => (p.big_folder || noSection) === libView.big)
                    .map((p) => p.category || general)
                ),
              ]
                .sort()
                .map((cat) => (
                  <div
                    key={cat}
                    className="folder-card"
                    style={{ background: '#fdfdfd', border: '1px dashed #3498db', borderRadius: 12, padding: 15, textAlign: 'center', cursor: 'pointer', color: '#333' }}
                    onClick={() => setLibView({ level: 'positions', big: libView.big, cat })}
                  >
                    <div style={{ fontSize: 30 }}>📂</div>
                    <strong>{cat}</strong>
                  </div>
                ))}
            </>
          )}
          {libView.level === 'positions' && (
            <>
              <button type="button" className="btn btn-secondary" style={{ gridColumn: '1 / -1' }} onClick={() => setLibView({ level: 'subs', big: libView.big, cat: null })}>
                ← {t('back_short')}
              </button>
              {libPositions
                .filter(
                  (p) =>
                    (p.big_folder || noSection) === libView.big &&
                    (p.category || general) === libView.cat
                )
                .map((pos) => (
                  <div
                    key={pos.id}
                    className="lib-pos-card"
                    onClick={() => applyFen(pos.fen)}
                    title={pos.title}
                  >
                    <div className="lib-mini-board">
                      <Board
                        id={`lib-mini-${pos.id}`}
                        fen={pos.fen || START_FEN}
                        allowDragging={false}
                        canDragPiece={() => false}
                      />
                    </div>
                    <div className="lib-pos-title">{pos.title}</div>
                  </div>
                ))}
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        contentClassName="study-editor-modal"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, textAlign: 'left' }}>
          <h3 style={{ margin: 0 }}>{t('study_editor')}</h3>
          <button type="button" className="close-btn" onClick={() => setEditorOpen(false)}>
            ×
          </button>
        </div>
        <div className="editor-layout">
          <div style={{ width: 'min(360px, 70vw)' }}>
            <Board
              id="study-editor-board"
              fen={editorFen}
              onDrop={onEditorDrop}
              onSquareClick={onEditorSquareClick}
              allowDragOffBoard
            />
          </div>
          <div className="editor-tools">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
              {t('study_editor_hint')}
            </p>
            <div className="piece-palette">
              {PALETTE.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  className={`palette-piece${palettePiece === p.code ? ' active' : ''}`}
                  onClick={() => setPalettePiece((cur) => (cur === p.code ? null : p.code))}
                  title={p.code}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                editorGameRef.current.load(START_FEN);
                setEditorFen(START_FEN);
              }}
            >
              {t('study_start')}
            </button>
            <button
              type="button"
              className="btn-danger-light"
              onClick={() => {
                editorGameRef.current.load(EMPTY_FEN);
                setEditorFen(EMPTY_FEN);
              }}
            >
              {t('study_clear')}
            </button>
            <button type="button" className="btn btn-primary" onClick={applyEditor}>
              {t('study_apply')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={hwOpen} onClose={() => setHwOpen(false)}>
        <h3>{t('study_assign_hw')}</h3>
        <input
          className="form-input"
          placeholder={t('study_hw_title_ph')}
          value={hwTitle}
          onChange={(e) => setHwTitle(e.target.value)}
        />
        <textarea
          className="form-input mt-2"
          rows={3}
          placeholder={t('study_hw_instructions_ph')}
          value={hwInstructions}
          onChange={(e) => setHwInstructions(e.target.value)}
        />
        <label className="study-notes-label mt-2">{t('study_hw_due')}</label>
        <input
          className="form-input"
          type="date"
          value={hwDue}
          onChange={(e) => setHwDue(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-block mt-2" onClick={assignHomework}>
          {t('save')}
        </button>
      </Modal>

      <Modal open={pgnImportOpen} onClose={() => setPgnImportOpen(false)}>
        <h3>{t('pgn_import_btn')}</h3>
        <p className="subtitle">{t('pgn_import_hint')}</p>
        <textarea
          className="form-input"
          rows={8}
          placeholder="1. e4 e5 2. Nf3..."
          value={pgnImportText}
          onChange={(e) => setPgnImportText(e.target.value)}
        />
        <button type="button" className="btn btn-primary btn-block mt-2" onClick={importPgnFromText}>
          {t('pgn_import_load')}
        </button>
      </Modal>
    </div>
  );
}
