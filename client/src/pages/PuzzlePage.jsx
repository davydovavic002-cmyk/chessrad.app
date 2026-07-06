import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import Swal from 'sweetalert2';
import { api, apiJson } from '../api';
import Board from '../components/Board';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import '../styles/puzzle.css';

const TOTAL = 10;

export default function PuzzlePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themeFilter = searchParams.get('theme');
  const { t } = useI18n();
  const gameRef = useRef(new Chess());
  const lozzaRef = useRef(null);
  const timerRef = useRef(null);

  const [fen, setFen] = useState('start');
  const [orientation, setOrientation] = useState('white');
  const [description, setDescription] = useState(() => t('puzzle_loading'));
  const [status, setStatus] = useState('');
  const [streakInfo, setStreakInfo] = useState('');
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [squareStyles, setSquareStyles] = useState({});
  const [shake, setShake] = useState(false);

  const currentPuzzle = useRef(null);
  const solvedCount = useRef(0);
  const puzzlesAttempted = useRef(0);
  const failedPuzzles = useRef([]);
  const isReviewMode = useRef(false);
  const tRef = useRef(t);
  tRef.current = t;

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const updateProgress = () => {
    setProgress(Math.min((puzzlesAttempted.current / TOTAL) * 100, 100));
  };

  const startTimer = useCallback(() => {
    clearTimer();
    setTimeLeft(60);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimer();
          handleFailure();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  const victory = useCallback(async () => {
    clearTimer();
    await api('/api/puzzle/complete-daily', { method: 'POST' });
    const tr = tRef.current;
    await Swal.fire({
      title: tr('puzzle_bravo'),
      text: tr('puzzle_bravo_text'),
      icon: 'success',
    });
    navigate('/lobby');
  }, [navigate]);

  const setupBoard = useCallback(
    (puzzle) => {
      const tr = tRef.current;
      currentPuzzle.current = puzzle;
      gameRef.current.load(puzzle.fen);
      const orient = gameRef.current.turn() === 'w' ? 'white' : 'black';
      setOrientation(orient);
      setFen(puzzle.fen);
      setSquareStyles({});
      setDescription(
        puzzle.description ||
          tr('puzzle_find_best', {
            side: gameRef.current.turn() === 'w' ? tr('puzzle_white') : tr('puzzle_black'),
          })
      );
      setStatus(
        isReviewMode.current
          ? tr('puzzle_review', { n: failedPuzzles.current.length })
          : tr('puzzle_task', { n: puzzlesAttempted.current + 1, total: TOTAL })
      );
      startTimer();
    },
    [startTimer]
  );

  const loadNextPuzzle = useCallback(async () => {
    if (!isReviewMode.current && puzzlesAttempted.current >= TOTAL) {
      if (failedPuzzles.current.length > 0) return startReviewMode();
      return victory();
    }
    try {
      const themeQ = themeFilter ? `&theme=${encodeURIComponent(themeFilter)}` : '';
      const res = await api(`/api/puzzle/next?t=${Date.now()}${themeQ}`);
      if (!res.ok) {
        if (failedPuzzles.current.length > 0) return startReviewMode();
        return victory();
      }
      const puzzle = await res.json();
      setupBoard(puzzle);
    } catch (e) {
      console.error(e);
    }
  }, [setupBoard, victory, themeFilter]);

  function startReviewMode() {
    isReviewMode.current = true;
    const tr = tRef.current;
    Swal.fire({
      title: tr('puzzle_review_title'),
      text: tr('puzzle_review_text'),
      icon: 'warning',
      timer: 2000,
      showConfirmButton: false,
    }).then(() => nextReviewPuzzle());
  }

  function nextReviewPuzzle() {
    if (failedPuzzles.current.length === 0) return victory();
    setupBoard(failedPuzzles.current.shift());
  }

  function handleFailure() {
    clearTimer();
    const puzzle = currentPuzzle.current;
    if (puzzle && !failedPuzzles.current.find((p) => p.id === puzzle.id)) {
      failedPuzzles.current.push(puzzle);
    }
    setShake(true);
    setTimeout(() => setShake(false), 500);
    if (!isReviewMode.current) {
      puzzlesAttempted.current++;
      updateProgress();
    }
    setTimeout(isReviewMode.current ? nextReviewPuzzle : loadNextPuzzle, 1000);
  }

  useEffect(() => {
    try {
      const worker = new Worker('/js/stockfish/lozza.js');
      worker.onmessage = (e) => {
        if (String(e.data).includes('bestmove')) {
          const bestMove = String(e.data).split(' ')[1];
          setDescription(tRef.current('puzzle_hint_best', { move: bestMove }));
          const from = bestMove.substring(0, 2);
          const to = bestMove.substring(2, 4);
          setSquareStyles({
            [from]: { background: 'rgba(52, 152, 219, 0.4)' },
            [to]: { background: 'rgba(46, 204, 113, 0.4)' },
          });
        }
      };
      worker.postMessage('uci');
      lozzaRef.current = worker;
    } catch {
      console.warn('Engine offline');
    }

    (async () => {
      const tr = tRef.current;
      const { data } = await apiJson('/api/user/puzzle-status');
      if (data.completedToday) {
        await Swal.fire(tr('puzzle_done_title'), tr('puzzle_done_text'), 'info');
        navigate('/lobby');
        return;
      }
      solvedCount.current = data.solvedToday || 0;
      puzzlesAttempted.current = solvedCount.current;
      setStreakInfo(tr('puzzle_streak', { n: data.streak }));
      updateProgress();
      loadNextPuzzle();
    })();

    return () => {
      clearTimer();
      lozzaRef.current?.terminate();
    };
  }, [loadNextPuzzle, navigate]);

  const onDrop = useCallback(
    (source, target) => {
      const game = gameRef.current;
      const move = game.move({ from: source, to: target, promotion: 'q' });
      if (!move) return false;

      const puzzle = currentPuzzle.current;
      const isCorrect =
        move.san === puzzle.solution || `${source}${target}` === puzzle.solution;

      if (isCorrect) {
        clearTimer();
        setFen(game.fen());
        setSquareStyles({ [target]: { background: 'rgba(46, 204, 113, 0.6)' } });
        if (!isReviewMode.current) {
          solvedCount.current++;
          puzzlesAttempted.current++;
          updateProgress();
          api('/api/puzzle/solve', {
            method: 'POST',
            body: JSON.stringify({ puzzleId: puzzle.id }),
          });
        }
        setTimeout(isReviewMode.current ? nextReviewPuzzle : loadNextPuzzle, 600);
        return true;
      }

      game.undo();
      handleFailure();
      return false;
    },
    [loadNextPuzzle]
  );

  const canDragPiece = useCallback(({ piece }) => {
    const game = gameRef.current;
    if (game.game_over()) return false;
    return piece.pieceType?.charAt(0) === game.turn();
  }, []);

  function getHint() {
    if (!lozzaRef.current) return;
    lozzaRef.current.postMessage(`position fen ${gameRef.current.fen()}`);
    lozzaRef.current.postMessage('go movetime 1000');
  }

  const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const sec = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className="puzzle-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      {themeFilter && (
        <p className="puzzle-theme-banner subtitle">
          {t('weak_topics_training')}: <strong>{themeFilter}</strong>
        </p>
      )}
      <div className="puzzle-container glass-strong">
        <div className={`puzzle-board-wrap${shake ? ' shake' : ''}`}>
          <Board
            id="puzzle-board"
            fen={fen}
            orientation={orientation}
            onDrop={onDrop}
            canDragPiece={canDragPiece}
            squareStyles={squareStyles}
          />
        </div>

        <div className="puzzle-panel">
          <div className="puzzle-streak">{streakInfo || '🔥 Загрузка...'}</div>
          <div className="puzzle-timer">
            {min}:{sec}
          </div>
          <div className="puzzle-progress">
            <div id="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="puzzle-status">{status || t('puzzle_ready')}</div>
          <div className="puzzle-description" style={{ cursor: 'pointer' }} onClick={getHint} title={t('puzzle_hint')}>
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}
