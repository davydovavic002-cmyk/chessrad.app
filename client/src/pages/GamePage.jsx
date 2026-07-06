import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { getSocket } from '../socket';
import Board from '../components/Board';
import PromotionModal from '../components/PromotionModal';
import BackButton from '../components/BackButton';
import '../styles/game.css';

export default function GamePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState('start');
  const [myColor, setMyColor] = useState('white');
  const [gameRoomId, setGameRoomId] = useState(null);
  const [status, setStatus] = useState(() => t('game_connecting'));
  const [turnInfo, setTurnInfo] = useState(() => t('game_waiting'));
  const [pgn, setPgn] = useState('-');
  const [searching, setSearching] = useState(false);
  const [inGame, setInGame] = useState(false);
  const [showRematch, setShowRematch] = useState(false);
  const [rematchAccepting, setRematchAccepting] = useState(false);
  const [rematchDisabled, setRematchDisabled] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const myWinStreak = user?.win_streak || 0;
  const tRef = useRef(t);
  tRef.current = t;

  const updateDisplay = useCallback(() => {
    const game = gameRef.current;
    const tr = tRef.current;
    setFen(game.fen());
    setPgn(game.pgn() || '-');
    const isMyTurn = game.turn() === myColor.charAt(0);
    setTurnInfo(isMyTurn ? tr('game_your_turn') : tr('game_opp_turn'));
  }, [myColor]);

  useEffect(() => {
    const socket = getSocket();

    const onStart = (data) => {
      const tr = tRef.current;
      setGameRoomId(data.roomId);
      const color = data.color === 'w' ? 'white' : 'black';
      setMyColor(color);
      const startFen = data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      gameRef.current = new Chess(startFen);
      setFen(startFen);
      setInGame(true);
      setSearching(false);
      setShowRematch(false);
      setRematchAccepting(false);
      setRematchDisabled(false);
      if (myWinStreak >= 3) setShowStreak(true);
      setStatus(`${tr('game_vs')} ${data.opponent.username}`);
      const isMyTurn = gameRef.current.turn() === color.charAt(0);
      setTurnInfo(isMyTurn ? tr('game_your_turn') : tr('game_opp_turn'));
      setPgn(gameRef.current.pgn() || '-');
    };

    const onState = (data) => {
      if (data?.fen && data.fen !== gameRef.current.fen()) {
        gameRef.current.load(data.fen);
        updateDisplay();
      }
    };

    const onOver = (data) => {
      const tr = tRef.current;
      if (data.fen) {
        gameRef.current.load(data.fen);
        setFen(data.fen);
      }
      const reason = data.reason || data.type;
      Swal.fire({
        title: data.winner === user.username ? tr('game_win') : tr('game_over'),
        text: tr('game_result', { reason }),
        icon: data.winner === user.username ? 'success' : 'info',
      });
      setStatus(tr('game_ended', { reason }));
      setInGame(false);
      setShowRematch(true);
      setRematchAccepting(false);
      setRematchDisabled(false);
      updateDisplay();
    };

    const onRematchOffered = () => {
      const tr = tRef.current;
      setStatus(tr('game_rematch_offer'));
      setRematchAccepting(true);
      setShowRematch(true);
      setRematchDisabled(false);
    };

    socket.on('gameStart', onStart);
    socket.on('gameStateUpdate', onState);
    socket.on('gameOver', onOver);
    socket.on('rematchOffered', onRematchOffered);

    return () => {
      socket.off('gameStart', onStart);
      socket.off('gameStateUpdate', onState);
      socket.off('gameOver', onOver);
      socket.off('rematchOffered', onRematchOffered);
    };
  }, [user.username, myWinStreak, updateDisplay]);

  const applyMove = useCallback(
    (from, to, promotion = 'q') => {
      const game = gameRef.current;
      const move = game.move({ from, to, promotion });
      if (!move) return false;
      updateDisplay();
      getSocket().emit('move', { move, roomId: gameRoomId });
      return true;
    },
    [gameRoomId, updateDisplay]
  );

  const onDrop = useCallback(
    (source, target) => {
      const game = gameRef.current;
      if (game.game_over() || pendingMove) return false;
      const playerColorChar = myColor.charAt(0);
      if (game.turn() !== playerColorChar) return false;

      const piece = game.get(source);
      const isPawn = piece && piece.type === 'p';
      const isPromotionRank = target[1] === '8' || target[1] === '1';
      if (isPawn && isPromotionRank) {
        const temp = new Chess(game.fen());
        if (!temp.move({ from: source, to: target, promotion: 'q' })) return false;
        setPendingMove({ from: source, to: target });
        return false;
      }

      return applyMove(source, target, 'q');
    },
    [myColor, pendingMove, applyMove]
  );

  function choosePromotion(piece) {
    if (!pendingMove) return;
    const { from, to } = pendingMove;
    setPendingMove(null);
    applyMove(from, to, piece);
  }

  const canDragPiece = useCallback(
    ({ piece }) => {
      const game = gameRef.current;
      if (game.game_over()) return false;
      const playerColorChar = myColor.charAt(0);
      if (game.turn() !== playerColorChar) return false;
      return piece.pieceType?.charAt(0) === playerColorChar;
    },
    [myColor]
  );

  function findGame() {
    setSearching(true);
    setStatus(t('game_searching_status'));
    getSocket().emit('findGame');
  }

  async function resign() {
    if (!gameRoomId) return;
    const res = await Swal.fire({
      title: t('game_resign_q'),
      text: t('game_resign_text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('game_yes_resign'),
      cancelButtonText: t('cancel'),
    });
    if (res.isConfirmed) getSocket().emit('surrender', { roomId: gameRoomId });
  }

  function rematch() {
    const socket = getSocket();
    if (rematchAccepting) socket.emit('rematchAccepted', { roomId: gameRoomId });
    else socket.emit('rematch', { roomId: gameRoomId });
    setRematchDisabled(true);
  }

  return (
    <div className="game-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <div className="game-layout">
        <div className="game-area">
          {showStreak && (
            <div id="player-streak" className="streak-fire" style={{ display: 'inline-block' }}>
              🔥 {t('game_streak')}: <span>{myWinStreak}</span>
            </div>
          )}
          <div id="turn-info" className={turnInfo === t('game_your_turn') ? 'my-turn' : ''}>
            {turnInfo}
          </div>
          <div className="board-wrap">
            <Board
              id="game-board"
              fen={fen}
              orientation={myColor}
              onDrop={onDrop}
              canDragPiece={canDragPiece}
              allowDragging={inGame}
            />
          </div>
        </div>

        <aside className="game-sidebar">
          <div className="panel glass-card">
            <h3>{t('game_status')}</h3>
            <p>{status}</p>
          </div>

          <div className="panel glass-card">
            <div className="game-controls">
              {!inGame && !showRematch && (
                <button className="btn btn-primary" disabled={searching} onClick={findGame}>
                  {searching ? t('game_searching') : t('game_find')}
                </button>
              )}
              {inGame && (
                <button className="btn btn-danger" onClick={resign}>
                  {t('game_resign')}
                </button>
              )}
              {showRematch && (
                <button className="btn btn-secondary" disabled={rematchDisabled} onClick={rematch}>
                  {rematchDisabled
                    ? t('game_waiting_opp')
                    : rematchAccepting
                      ? t('game_accept_rematch')
                      : t('game_rematch')}
                </button>
              )}
            </div>
          </div>

          <div className="panel glass-card debug-box">
            <h3>{t('game_debug')}</h3>
            <p>
              FEN: <code>{fen}</code>
            </p>
            <p>PGN:</p>
            <pre>{pgn}</pre>
          </div>
        </aside>
      </div>

      {pendingMove && (
        <PromotionModal
          color={myColor.charAt(0)}
          onSelect={choosePromotion}
          onCancel={() => setPendingMove(null)}
        />
      )}
    </div>
  );
}
