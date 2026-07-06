import { Chess } from 'chess.js';
import { randomUUID } from 'crypto';

export class TournamentGame {
    constructor({ playerWhite, playerBlack, io, tournament, timeLimit }) {
        this.gameId = randomUUID();
        this.io = io;
        this.tournament = tournament;
        this.playerWhite = playerWhite;
        this.playerBlack = playerBlack;
        this.chess = Chess();
        this.isGameOver = false;
        this.timeLimit = timeLimit || 5 * 60 * 1000;
        this.onComplete = null;
        this.whiteTime = this.timeLimit;
        this.blackTime = this.timeLimit;
        this.lastTick = Date.now();
        this.timerInterval = null;
    }

    start() {
        this.lastTick = Date.now();
        this.timerInterval = setInterval(() => this.tick(), 1000);
        this.emitTimer();
    }

    getPlayerColor(userId) {
        if (this.playerWhite.id === userId) return 'w';
        if (this.playerBlack.id === userId) return 'b';
        return null;
    }

    emitTimer() {
        this.io.to(this.gameId).emit('game:timer', {
            white: Math.max(0, Math.ceil(this.whiteTime / 1000)),
            black: Math.max(0, Math.ceil(this.blackTime / 1000)),
            turn: this.chess.turn()
        });
    }

    tick() {
        if (this.isGameOver) return;

        const now = Date.now();
        const elapsed = now - this.lastTick;
        this.lastTick = now;

        if (this.chess.turn() === 'w') this.whiteTime -= elapsed;
        else this.blackTime -= elapsed;

        if (this.whiteTime <= 0) return this.endByTime('b');
        if (this.blackTime <= 0) return this.endByTime('w');

        this.emitTimer();
    }

    makeMove(move, userId) {
        if (this.isGameOver) return;

        const color = this.getPlayerColor(userId);
        const turn = this.chess.turn() === 'w' ? 'w' : 'b';
        if (color !== turn) return;

        const result = this.chess.move(move);
        if (!result) return;

        this.io.to(this.gameId).emit('game:move', move);
        this.checkGameOver();
    }

    resign(userId) {
        if (this.isGameOver) return;

        const color = this.getPlayerColor(userId);
        if (!color) return;

        const winner = color === 'w' ? this.playerBlack : this.playerWhite;
        const loser = color === 'w' ? this.playerWhite : this.playerBlack;
        this.finish({ winner, loser, draw: false, reason: `${loser.username} сдался` });
    }

    endByTime(winnerColor) {
        const winner = winnerColor === 'w' ? this.playerWhite : this.playerBlack;
        const loser = winnerColor === 'w' ? this.playerBlack : this.playerWhite;
        this.finish({ winner, loser, draw: false, reason: 'Время вышло' });
    }

    checkGameOver() {
        if (!this.chess.game_over()) return;

        if (this.chess.in_checkmate()) {
            const winnerColor = this.chess.turn() === 'w' ? 'b' : 'w';
            const winner = winnerColor === 'w' ? this.playerWhite : this.playerBlack;
            const loser = winnerColor === 'w' ? this.playerBlack : this.playerWhite;
            this.finish({ winner, loser, draw: false, reason: 'Мат' });
        } else {
            this.finish({
                winner: this.playerWhite,
                loser: this.playerBlack,
                draw: true,
                reason: 'Ничья'
            });
        }
    }

    finish({ winner, loser, draw, reason }) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        clearInterval(this.timerInterval);

        this.io.to(this.gameId).emit('tournament:game:over', {
            winner: winner.username,
            draw,
            reason
        });

        if (this.tournament) {
            this.tournament.handleMatchCompletion({
                gameId: this.gameId,
                winner,
                loser,
                draw
            });
        } else if (this.onComplete) {
            this.onComplete({
                gameId: this.gameId,
                winner,
                loser,
                draw,
                reason
            });
        }
    }
}
