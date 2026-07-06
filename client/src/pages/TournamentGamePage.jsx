import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Chess } from 'chess.js';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { getSocket } from '../socket';
import Board from '../components/Board';
import PromotionModal from '../components/PromotionModal';
import BackButton from '../components/BackButton';
import '../styles/tournament-game.css';

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function TournamentGamePage() {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const returnGroup = searchParams.get('returnGroup');
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState('start');
  const [myColor, setMyColor] = useState('w');
  const [isGameOver, setIsGameOver] = useState(false);
  const [status, setStatus] = useState(() => t('game_connecting_short'));
  const [turnInfo, setTurnInfo] = useState('');
  const [pgn, setPgn] = useState('');
  const [oppName, setOppName] = useState(() => t('tg_opponent'));
  const [meName, setMeName] = useState(user.username);
  const [meTimer, setMeTimer] = useState('00:00');
  const [oppTimer, setOppTimer] = useState('00:00');
  const [meActive, setMeActive] = useState(false);
  const [oppActive, setOppActive] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const tRef = useRef(t);
  tRef.current = t;

  const updateDisplay = useCallback(() => {
    const game = gameRef.current;
    const tr = tRef.current;
    setFen(game.fen());
    setPgn(game.pgn());
    const myTurn = game.turn() === myColor;
    setTurnInfo(myTurn ? tr('tg_your_turn') : tr('tg_opp_turn'));
    setStatus(game.in_check() ? tr('tg_check') : tr('tg_playing'));
  }, [myColor]);

  useEffect(() => {
    const socket = getSocket({ transports: ['websocket'] });

    const onConnect = () => socket.emit('tournament:game:join', { gameId });
    const onTimer = (data) => {
      if (isGameOver) return;
      if (myColor === 'w') {
        setMeTimer(formatTime(data.white));
        setOppTimer(formatTime(data.black));
        setMeActive(data.turn === 'w');
        setOppActive(data.turn === 'b');
      } else {
        setOppTimer(formatTime(data.white));
        setMeTimer(formatTime(data.black));
        setOppActive(data.turn === 'w');
        setMeActive(data.turn === 'b');
      }
    };
    const onState = (data) => {
      const tr = tRef.current;
      setMyColor(data.color);
      gameRef.current.load(data.fen);
      const whiteName = data.playerWhite?.username || tr('tg_white');
      const blackName = data.playerBlack?.username || tr('tg_black');
      if (data.color === 'w') {
        setOppName(`${blackName} (${tr('tg_black')})`);
        setMeName(`${user.username} (${tr('tg_you')})`);
      } else {
        setOppName(`${whiteName} (${tr('tg_white')})`);
        setMeName(`${user.username} (${tr('tg_you')})`);
      }
      setFen(data.fen);
      const myTurn = gameRef.current.turn() === data.color;
      setTurnInfo(myTurn ? tr('tg_your_turn') : tr('tg_opp_turn'));
      setStatus(gameRef.current.in_check() ? tr('tg_check') : tr('tg_playing'));
      setPgn(gameRef.current.pgn());
    };
    const onMove = (move) => {
      gameRef.current.move(move);
      updateDisplay();
    };
    const onOver = (data) => {
      const tr = tRef.current;
      setIsGameOver(true);
      const isWinner = data.winner === user.username;
      const resultText = data.draw ? tr('tg_draw') : isWinner ? tr('tg_win') : tr('tg_loss');
      setStatus(`${resultText}: ${data.reason}`);
      Swal.fire({
        title: resultText,
        text: tr('tg_reason', { reason: data.reason }),
        icon: data.draw ? 'info' : isWinner ? 'success' : 'error',
        confirmButtonText: returnGroup ? tr('group_back_class') : tr('tg_to_tournament'),
      }).then(() => {
        if (returnGroup) navigate(`/group-study?room=${returnGroup}`);
        else navigate('/tournaments');
      });
    };

    socket.on('connect', onConnect);
    socket.on('game:timer', onTimer);
    socket.on('game:state', onState);
    socket.on('game:move', onMove);
    socket.on('tournament:game:over', onOver);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('game:timer', onTimer);
      socket.off('game:state', onState);
      socket.off('game:move', onMove);
      socket.off('tournament:game:over', onOver);
    };
  }, [gameId, user.username, myColor, isGameOver, navigate, updateDisplay, returnGroup]);

  const applyMove = useCallback(
    (moveData) => {
      const game = gameRef.current;
      const move = game.move(moveData);
      if (!move) return false;
      getSocket().emit('tournament:game:move', { gameId, move: moveData });
      updateDisplay();
      return true;
    },
    [gameId, updateDisplay]
  );

  const onDrop = useCallback(
    (source, target) => {
      if (isGameOver || pendingMove) return false;
      const game = gameRef.current;
      const piece = game.get(source);
      const isPawn = piece && piece.type === 'p';
      const isPromotionRank = target[1] === '8' || target[1] === '1';

      if (isPawn && isPromotionRank) {
        const temp = new Chess(game.fen());
        if (!temp.move({ from: source, to: target, promotion: 'q' })) return false;
        setPendingMove({ from: source, to: target });
        return false;
      }

      return applyMove({ from: source, to: target, promotion: 'q' });
    },
    [isGameOver, pendingMove, applyMove]
  );

  function choosePromotion(piece) {
    if (!pendingMove) return;
    const moveData = { ...pendingMove, promotion: piece };
    setPendingMove(null);
    applyMove(moveData);
  }

  const canDragPiece = useCallback(
    ({ piece }) => {
      const game = gameRef.current;
      if (isGameOver || game.game_over()) return false;
      if (game.turn() !== myColor) return false;
      return piece.pieceType?.charAt(0) === myColor;
    },
    [isGameOver, myColor]
  );

  async function resign() {
    const res = await Swal.fire({
      title: t('game_resign_q'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('yes'),
      cancelButtonText: t('no'),
    });
    if (res.isConfirmed) getSocket().emit('tournament:game:resign', { gameId });
  }

  return (
    <div className="tournament-game-page page-wrap">
      <BackButton to="/tournament" title={t('back_to_tournament')} />
      <div className="tournament-game-layout game-layout">
        <div className="game-area">
          <div id="opponent-info" className="player-panel">
            <span className="player-name">{oppName}</span>
            <div className={`timer${oppActive ? ' active-timer' : ''}`}>{oppTimer}</div>
          </div>
          <div className="board-wrap">
            <Board
              id="tg-board"
              fen={fen}
              orientation={myColor === 'w' ? 'white' : 'black'}
              onDrop={onDrop}
              canDragPiece={canDragPiece}
              allowDragging={!isGameOver}
            />
          </div>
          <div id="me-info" className="player-panel">
            <span className="player-name">{meName}</span>
            <div className={`timer${meActive ? ' active-timer' : ''}`}>{meTimer}</div>
          </div>
          <div id="turn-info" className={turnInfo === t('tg_your_turn') ? 'active-turn' : 'waiting-turn'}>
            {turnInfo || t('tg_waiting')}
          </div>
        </div>

        <aside className="game-sidebar">
          <div className="panel glass-card">
            <h3>{t('game_status')}</h3>
            <p id="status">{status}</p>
          </div>
          <div className="panel glass-card">
            <div className="game-controls">
              <button type="button" id="resign-btn" className="btn btn-danger" onClick={resign}>
                {t('game_resign')}
              </button>
            </div>
          </div>
          <div className="panel glass-card debug-box">
            <h3>{t('tg_history')}</h3>
            <pre id="pgn">{pgn || '-'}</pre>
            <p>
              FEN: <span id="fen">{fen}</span>
            </p>
          </div>
        </aside>
      </div>

      {pendingMove && (
        <PromotionModal
          color={myColor}
          onSelect={choosePromotion}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </div>
  );
}
