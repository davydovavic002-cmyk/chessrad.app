import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import Swal from 'sweetalert2';
import Board from '../components/Board';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import '../styles/play-bot.css';

function botMove(fen) {
  const game = new Chess(fen);
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));
  const move = moves[Math.floor(Math.random() * Math.min(moves.length, 3))];
  return move.from + move.to;
}

export default function PlayBotPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const inIframe = typeof window !== 'undefined' && window.parent !== window;
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState('start');
  const [status, setStatus] = useState('Твой ход (Белые)');

  const finishWin = useCallback(async () => {
    await Swal.fire('Победа!', 'Отличная игра!', 'success');
    if (window.parent !== window) window.parent.postMessage({ type: 'BOT_GAME_DONE' }, '*');
    else navigate('/lobby');
  }, [navigate]);

  const updateStatus = useCallback(async () => {
    const game = gameRef.current;
    if (game.in_checkmate()) {
      if (game.turn() === 'b') finishWin();
      else Swal.fire('Поражение', 'Бот оказался сильнее!', 'error').then(() => window.location.reload());
    } else if (game.in_draw()) {
      Swal.fire('Ничья', 'Нужна только победа!', 'info').then(() => window.location.reload());
    } else {
      const color = game.turn() === 'b' ? 'Черные' : 'Белые';
      setStatus(color + ' ходят' + (game.in_check() ? ', ШАХ!' : ''));
    }
  }, [finishWin]);

  const makeBotMove = useCallback(() => {
    const game = gameRef.current;
    if (game.game_over()) return;
    const best = botMove(game.fen());
    if (best) {
      game.move({ from: best.substring(0, 2), to: best.substring(2, 4), promotion: 'q' });
      setFen(game.fen());
      updateStatus();
    }
  }, [updateStatus]);

  const onDrop = useCallback(
    (source, target) => {
      const game = gameRef.current;
      if (!game.move({ from: source, to: target, promotion: 'q' })) return false;
      setFen(game.fen());
      updateStatus();
      setTimeout(makeBotMove, 250);
      return true;
    },
    [makeBotMove, updateStatus]
  );

  const canDragPiece = useCallback(({ piece }) => {
    const game = gameRef.current;
    if (game.game_over()) return false;
    return piece.pieceType?.charAt(0) === 'w';
  }, []);

  return (
    <div className="play-bot-page page-wrap">
      {!inIframe && <BackButton to="/lobby" title={t('back_to_lobby')} />}
      <div className="play-bot-container">
        <div className="play-bot-badge">🔥 Режим восстановления стрика</div>
        <h2>Победи бота, чтобы вернуть серию!</h2>
        <div style={{ width: 360, maxWidth: '100%' }}>
          <Board id="bot-board" fen={fen} orientation="white" onDrop={onDrop} canDragPiece={canDragPiece} />
        </div>
        <div className="play-bot-status">
          <p>{status}</p>
        </div>
      </div>
    </div>
  );
}
