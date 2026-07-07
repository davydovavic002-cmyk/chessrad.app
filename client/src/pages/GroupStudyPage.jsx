import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Chess } from 'chess.js';
import { useAuth } from '../auth/AuthContext';
import { getSocket } from '../socket';
import Board from '../components/Board';
import GroupBoardArena from '../components/GroupBoardArena';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import StudyVideoRoom from '../components/StudyVideoRoom';
import LibraryPickerModal from '../components/LibraryPickerModal';
import '../styles/study.css';
import '../styles/group-study.css';
import '../styles/study-video.css';
import '../styles/calendar.css';
import '../styles/features-game.css';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function moveCount(board) {
  return board?.customHistory?.length || board?.pgn?.split(/\d+\./).filter(Boolean).length || 0;
}

export default function GroupStudyPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomCode = searchParams.get('room');

  const gameRef = useRef(new Chess());
  const solutionRef = useRef(new Chess());
  const isTeacherRef = useRef(false);

  const [room, setRoom] = useState(null);
  const [fen, setFen] = useState(START_FEN);
  const [studentBoards, setStudentBoards] = useState({});
  const [studentNames, setStudentNames] = useState({});
  const [broadcast, setBroadcast] = useState({ active: false, fen: '' });
  const [pairings, setPairings] = useState({ round: 0, pairs: [] });
  const [exerciseFen, setExerciseFen] = useState(START_FEN);
  const [solutionFen, setSolutionFen] = useState(START_FEN);
  const [teacherPhase, setTeacherPhase] = useState('exercise');
  const [broadcastDismissed, setBroadcastDismissed] = useState(false);
  const [liveBroadcast, setLiveBroadcast] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [poll, setPoll] = useState(null);
  const [focusedStudentId, setFocusedStudentId] = useState(null);

  const isTeacher = room && Number(room.teacher_id) === Number(user.id);
  isTeacherRef.current = !!isTeacher;

  const phase = useMemo(() => {
    if (pairings.round > 0) return 'tournament';
    if (broadcast.active) return 'solution';
    if (room?.exercise_fen) return 'solving';
    return 'exercise';
  }, [pairings.round, broadcast.active, room?.exercise_fen]);

  useEffect(() => {
    if (!roomCode) navigate('/lobby');
  }, [roomCode, navigate]);

  const applyRoom = useCallback((d) => {
    setRoom(d);
    setStudentBoards(d.student_boards || {});
    if (d.student_names) setStudentNames(d.student_names);
    setBroadcast({ active: !!d.broadcast_active, fen: d.broadcast_fen || '' });
    setBroadcastDismissed(false);
    setPairings(d.pairing_state || { round: 0, pairs: [] });
    setPoll(d.poll_state || null);
    const ex = d.exercise_fen || START_FEN;
    setExerciseFen(ex);
    if (d.broadcast_fen) {
      setSolutionFen(d.broadcast_fen);
      solutionRef.current.load(d.broadcast_fen);
    } else {
      setSolutionFen(ex);
      solutionRef.current.load(ex);
    }
    if (Number(d.teacher_id) !== Number(user.id)) {
      const boards = d.student_boards || {};
      const b = boards[user.id] || boards[String(user.id)];
      const f = b?.fen || d.exercise_fen || START_FEN;
      gameRef.current.load(f === 'start' || !f ? START_FEN : f);
      setFen(gameRef.current.fen());
    }
  }, [user.id]);

  useEffect(() => {
    if (!roomCode) return;
    const socket = getSocket({ transports: ['websocket'] });
    socket.emit('group:join', { roomCode });

    const onRoom = (d) => applyRoom(d);
    const onSync = ({ studentId, fen: f, pgn, customHistory }) => {
      setStudentBoards((prev) => ({
        ...prev,
        [studentId]: { ...prev[studentId], fen: f, pgn, customHistory },
      }));
    };
    const onExercise = ({ fen: f }) => {
      if (!isTeacherRef.current) {
        gameRef.current.load(f);
        setFen(f);
      }
      setStudentBoards((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          next[k] = { ...next[k], fen: f, pgn: '', customHistory: [] };
        });
        return next;
      });
    };
    const onBc = ({ fen: f, active }) => {
      setBroadcast({ active, fen: f });
      if (f) {
        setSolutionFen(f);
        solutionRef.current.load(f);
      }
      setBroadcastDismissed(false);
    };
    const onPairs = (p) => setPairings(p);
    const onPresence = ({ roster, userId, username }) => {
      if (roster) setStudentNames(roster);
      else if (userId) setStudentNames((prev) => ({ ...prev, [userId]: username }));
    };
    const onGame = (data) => {
      if (data.gameId) {
        const q = data.returnGroup ? `?returnGroup=${data.returnGroup}` : '';
        navigate(`/game/${data.gameId}${q}`);
      }
    };
    const onReconnect = () => socket.emit('group:requestState', { roomCode });

    const onPoll = (p) => setPoll(p);
    const onSessionSaved = () => {
      Swal.fire({ icon: 'success', title: t('group_session_saved'), timer: 2000, showConfirmButton: false });
    };

    socket.on('group:roomData', onRoom);
    socket.on('group:syncBoard', onSync);
    socket.on('group:exercise', onExercise);
    socket.on('group:broadcast', onBc);
    socket.on('group:pairings', onPairs);
    socket.on('group:presence', onPresence);
    socket.on('group:gameCreated', onGame);
    socket.on('group:poll', onPoll);
    socket.on('group:sessionSaved', onSessionSaved);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('group:roomData', onRoom);
      socket.off('group:syncBoard', onSync);
      socket.off('group:exercise', onExercise);
      socket.off('group:broadcast', onBc);
      socket.off('group:pairings', onPairs);
      socket.off('group:presence', onPresence);
      socket.off('group:gameCreated', onGame);
      socket.off('group:poll', onPoll);
      socket.off('group:sessionSaved', onSessionSaved);
      socket.off('connect', onReconnect);
    };
  }, [roomCode, applyRoom, navigate, t]);

  const onStudentDrop = useCallback(
    (source, target) => {
      if (isTeacherRef.current) return false;
      const move = gameRef.current.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;
      const newFen = gameRef.current.fen();
      setFen(newFen);
      getSocket().emit('group:move', {
        roomCode,
        fen: newFen,
        pgn: gameRef.current.pgn(),
        customHistory: gameRef.current.history(),
      });
      return true;
    },
    [roomCode]
  );

  const onSolutionDrop = useCallback(
    (source, target) => {
      if (!isTeacherRef.current) return false;
      const move = solutionRef.current.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;
      const newFen = solutionRef.current.fen();
      setSolutionFen(newFen);
      if (liveBroadcast) {
        getSocket().emit('group:broadcastMove', { roomCode, fen: newFen });
        setBroadcast({ active: true, fen: newFen });
      }
      return true;
    },
    [roomCode, liveBroadcast]
  );

  function sendExercise() {
    getSocket().emit('group:setExercise', { roomCode, fen: exerciseFen });
    setSolutionFen(exerciseFen);
    solutionRef.current.load(exerciseFen);
    setTeacherPhase('students');
  }

  function showSolutionToAll() {
    getSocket().emit('group:broadcast', { roomCode, fen: solutionFen, active: true });
    setTeacherPhase('solution');
  }

  function broadcastStudentBoard(sid) {
    const b = studentBoards[sid];
    if (!b?.fen) return;
    getSocket().emit('group:broadcast', { roomCode, fen: b.fen, active: true });
  }

  function stopBroadcast() {
    if (isTeacher) {
      getSocket().emit('group:broadcast', { roomCode, fen: '', active: false });
    } else {
      setBroadcastDismissed(true);
    }
  }

  function nextRound() {
    getSocket().emit('group:nextRound', { roomCode });
    setTeacherPhase('tournament');
  }

  function startGames() {
    getSocket().emit('group:startGames', { roomCode });
  }

  function startPoll() {
    getSocket().emit('group:startPoll', { roomCode, question: t('group_poll_question') });
  }

  function votePoll() {
    getSocket().emit('group:votePoll', { roomCode });
  }

  function endPoll() {
    getSocket().emit('group:endPoll', { roomCode });
  }

  function saveSession() {
    getSocket().emit('group:saveSession', { roomCode, summary: t('group_session_default_title') });
  }

  const nameOf = (id) => studentNames[id] || studentNames[Number(id)] || `#${id}`;

  const studentIds = useMemo(() => room?.group_student_ids || [], [room?.group_student_ids]);

  useEffect(() => {
    if (!studentIds.length) return;
    setFocusedStudentId((prev) => {
      if (prev != null && studentIds.some((id) => Number(id) === Number(prev))) return prev;
      return studentIds[0];
    });
  }, [studentIds, teacherPhase]);

  const boardFen = (raw) => {
    if (!raw || raw === 'start') return START_FEN;
    return raw;
  };

  const studentBoardFen = (sid) => {
    const b = studentBoards[sid] || studentBoards[String(sid)] || {};
    return boardFen(b.fen || room?.exercise_fen);
  };

  const standingsRows = useMemo(() => {
    const st = pairings.standings || {};
    return Object.entries(st)
      .map(([id, pts]) => ({ id: Number(id), pts, name: nameOf(id) }))
      .sort((a, b) => b.pts - a.pts);
  }, [pairings.standings, studentNames]);

  const myPair = pairings.pairs?.find(
    (p) => Number(p.a) === Number(user.id) || Number(p.b) === Number(user.id)
  );

  if (!room) {
    return (
      <div className="group-study-page page-wrap">
        <p>{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="group-study-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <header className="game-hud">
        <span className="game-hud__badge">GROUP CLASS</span>
        <h1>{t('group_title')} · {roomCode}</h1>
        <div className="group-phase-bar">
          {['exercise', 'solving', 'solution', 'tournament'].map((p) => (
            <span key={p} className={`group-phase-pill${phase === p ? ' active' : ''}`}>
              {t(`group_phase_${p}`)}
            </span>
          ))}
        </div>
      </header>

      {roomCode && room?.teacher_id && (
        <StudyVideoRoom roomCode={roomCode} teacherId={room.teacher_id} layout="group" />
      )}

      {poll?.active && (
        <div className="group-poll-panel game-panel">
          <h3>{poll.question}</h3>
          {!isTeacher && (
            <button type="button" className="btn btn-primary btn-sm" onClick={votePoll}>
              {t('group_poll_vote')}
            </button>
          )}
          <ul className="group-poll-votes">
            {Object.entries(poll.votes || {}).map(([uid, name]) => (
              <li key={uid}>✓ {name}</li>
            ))}
          </ul>
          {isTeacher && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={endPoll}>
              {t('group_poll_end')}
            </button>
          )}
        </div>
      )}

      {isTeacher && (
        <div className="group-teacher-tools">
          <button type="button" className="btn btn-secondary btn-sm" onClick={startPoll}>
            {t('group_poll_start')}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={saveSession}>
            {t('group_session_save')}
          </button>
        </div>
      )}

      {isTeacher ? (
        <>
          <div className="group-teacher-tabs">
            {['exercise', 'students', 'solution', 'tournament'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={teacherPhase === tab ? 'active' : ''}
                onClick={() => setTeacherPhase(tab)}
              >
                {t(`group_tab_${tab}`)}
              </button>
            ))}
          </div>

          {teacherPhase === 'exercise' && (
            <div className="group-panel game-panel">
              <h3>{t('group_tab_exercise')}</h3>
              <p className="subtitle">{t('group_exercise_hint')}</p>
              <div className="group-student-stage">
                <GroupBoardArena
                  toolbar={
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLibOpen(true)}>
                        📚 {t('study_library')}
                      </button>
                      <button type="button" className="btn-game group-action-btn" onClick={sendExercise}>
                        {t('group_send_exercise')}
                      </button>
                    </>
                  }
                >
                  {(boardSize) => (
                    <Board
                      id="group-exercise-set"
                      fen={exerciseFen}
                      boardWidth={boardSize}
                      showNotation={false}
                      onDrop={(s, tgt) => {
                        const g = new Chess(exerciseFen === 'start' ? START_FEN : exerciseFen);
                        const p = g.get(s);
                        if (!p) return false;
                        g.remove(s);
                        g.put(p, tgt);
                        setExerciseFen(g.fen());
                        return true;
                      }}
                      allowDragging
                    />
                  )}
                </GroupBoardArena>
              </div>
            </div>
          )}

          {teacherPhase === 'students' && (
            <div className="group-panel">
              <h3>{t('group_student_boards')}</h3>
              <p className="subtitle">{t('group_students_hint')}</p>

              <div className="group-student-picker" role="tablist" aria-label={t('group_student_boards')}>
                {studentIds.map((sid) => {
                  const b = studentBoards[sid] || studentBoards[String(sid)] || {};
                  const mc = moveCount(b);
                  const active = Number(focusedStudentId) === Number(sid);
                  return (
                    <button
                      key={sid}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`group-student-chip${active ? ' active' : ''}`}
                      onClick={() => setFocusedStudentId(sid)}
                    >
                      <span className="group-student-chip__name">{nameOf(sid)}</span>
                      <span className="group-student-chip__moves">
                        {mc} {t('group_moves')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {focusedStudentId != null && (
                <div className="group-spotlight group-student-stage">
                  <h4 className="group-spotlight__title">
                    {t('group_focus_student')}: {nameOf(focusedStudentId)}
                  </h4>
                  <GroupBoardArena
                    toolbar={
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => broadcastStudentBoard(focusedStudentId)}
                      >
                        {t('group_show_student')}
                      </button>
                    }
                  >
                    {(boardSize) => (
                      <Board
                        id={`group-focus-${focusedStudentId}`}
                        fen={studentBoardFen(focusedStudentId)}
                        boardWidth={boardSize}
                        showNotation={false}
                        allowDragging={false}
                        canDragPiece={() => false}
                      />
                    )}
                  </GroupBoardArena>
                </div>
              )}

              <div className="group-mosaic-section">
                <h4>{t('group_mosaic_overview')}</h4>
                <div className="group-teacher-grid">
                  {studentIds.map((sid) => {
                    const b = studentBoards[sid] || studentBoards[String(sid)] || {};
                    const mc = moveCount(b);
                    const active = Number(focusedStudentId) === Number(sid);
                    return (
                      <div
                        key={sid}
                        className={`group-mini-board${active ? ' group-mini-board--active' : ''}`}
                      >
                        <h4>
                          {nameOf(sid)}
                          <span className="group-move-badge">{mc} {t('group_moves')}</span>
                        </h4>
                        <button
                          type="button"
                          className="group-mini-click"
                          onClick={() => setFocusedStudentId(sid)}
                          title={t('group_focus_pick')}
                        >
                          <GroupBoardArena variant="mini" miniSize={120}>
                            {(boardSize) => (
                              <Board
                                id={`group-mini-${sid}`}
                                fen={studentBoardFen(sid)}
                                boardWidth={boardSize}
                                showNotation={false}
                                allowDragging={false}
                                canDragPiece={() => false}
                              />
                            )}
                          </GroupBoardArena>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button type="button" className="btn btn-secondary mt-2" onClick={() => setTeacherPhase('solution')}>
                {t('group_go_solution')} →
              </button>
            </div>
          )}

          {teacherPhase === 'solution' && (
            <div className="group-panel game-panel">
              <h3>{t('group_solution_board')}</h3>
              <p className="subtitle">{t('group_solution_hint')}</p>
              <label className="group-live-bc">
                <input type="checkbox" checked={liveBroadcast} onChange={(e) => setLiveBroadcast(e.target.checked)} />
                {t('group_live_broadcast')}
              </label>
              <div className="group-student-stage">
                <GroupBoardArena
                  toolbar={
                    <>
                      <button type="button" className="btn-game group-action-btn" onClick={showSolutionToAll}>
                        {t('group_broadcast')}
                      </button>
                      <button type="button" className="btn btn-ghost" onClick={stopBroadcast}>
                        {t('group_broadcast_stop')}
                      </button>
                    </>
                  }
                >
                  {(boardSize) => (
                    <Board
                      id="group-solution-board"
                      fen={solutionFen}
                      boardWidth={boardSize}
                      showNotation={false}
                      onDrop={onSolutionDrop}
                      allowDragging
                    />
                  )}
                </GroupBoardArena>
              </div>
            </div>
          )}

          {teacherPhase === 'tournament' && (
            <div className="group-panel game-panel">
              <h3>{t('group_phase_tournament')}</h3>
              <p className="subtitle">{t('group_tournament_hint')}</p>
              <div className="group-toolbar">
                <button type="button" className="btn btn-primary" onClick={nextRound}>
                  {t('group_pairings')}
                </button>
                {pairings.pairs?.length > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={startGames}>
                    {t('group_start_games')}
                  </button>
                )}
              </div>
              {pairings.pairs?.length > 0 && (
                <div className="group-pairings">
                  <strong>{t('group_round', { n: pairings.round })}</strong>
                  {pairings.pairs.map((pair, i) => (
                    <div key={i} className="group-pair-item">
                      {nameOf(pair.a)} vs {pair.b ? nameOf(pair.b) : 'BYE'}
                      {pair.result && <span className="group-pair-result"> · {pair.result}</span>}
                      {pair.gameId && !pair.result && (
                        <span className="group-pair-live"> · {t('group_game_live')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {standingsRows.length > 0 && (
                <div className="group-standings game-panel" style={{ padding: 12, marginTop: 12 }}>
                  <strong>{t('group_standings')}</strong>
                  <table className="group-standings-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('tournament_player')}</th>
                        <th>{t('tournament_points')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standingsRows.map((row, i) => (
                        <tr key={row.id}>
                          <td>{i + 1}</td>
                          <td>{row.name}</td>
                          <td><strong>{row.pts}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="subtitle">{t('group_student_hint')}</p>
          <div className="group-student-stage">
            <GroupBoardArena>
              {(boardSize) => (
                <Board
                  id="group-student-board"
                  fen={fen}
                  boardWidth={boardSize}
                  showNotation={false}
                  onDrop={onStudentDrop}
                />
              )}
            </GroupBoardArena>
          </div>
          {myPair && (
            <div className="group-pairings game-panel" style={{ padding: 16, marginTop: 16 }}>
              <strong>{t('group_your_pairings')}</strong>
              <div className="group-pair-item">
                {t('group_play_vs', { name: nameOf(myPair.a === Number(user.id) ? myPair.b : myPair.a) })}
                {myPair.result && <span> — {myPair.result}</span>}
                {myPair.gameId && !myPair.result && (
                  <Link to={`/game/${myPair.gameId}?returnGroup=${roomCode}`} className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}>
                    {t('group_play_now')}
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {broadcast.active && broadcast.fen && !broadcastDismissed && (
        <div className="group-broadcast-overlay" onClick={stopBroadcast}>
          <div className="group-broadcast-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{t('group_solution')}</h3>
            <GroupBoardArena>
              {(boardSize) => (
                <Board
                  id="group-broadcast-board"
                  fen={broadcast.fen}
                  boardWidth={boardSize}
                  showNotation={false}
                  allowDragging={false}
                />
              )}
            </GroupBoardArena>
            <button type="button" className="btn btn-ghost btn-block mt-2" onClick={stopBroadcast}>
              {isTeacher ? t('group_broadcast_stop') : t('cancel')}
            </button>
          </div>
        </div>
      )}
      <LibraryPickerModal
        open={libOpen}
        onClose={() => setLibOpen(false)}
        onPick={(f) => {
          const fenVal = f === 'start' ? START_FEN : f;
          setExerciseFen(fenVal);
        }}
      />
    </div>
  );
}
