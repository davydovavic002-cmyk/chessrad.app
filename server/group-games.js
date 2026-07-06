import { TournamentGame } from './tournament-game-logic.js';
import { findUserById, updateGroupPairingGame, applyGroupGameStandings } from '../db.js';

const GROUP_GAME_TIME = 3 * 60 * 1000;

export async function startGroupPairingGames({ io, activeGames, onlineUsers, roomCode, pairingState, onPairingUpdate }) {
    const pairs = pairingState?.pairs || [];
    const created = [];

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if (!pair.b || pair.gameId || pair.result === 'BYE') continue;

        const pA = onlineUsers.get(Number(pair.a));
        const pB = onlineUsers.get(Number(pair.b));
        if (!pA?.socket || !pB?.socket) continue;

        const userA = await findUserById(pair.a);
        const userB = await findUserById(pair.b);
        if (!userA || !userB) continue;

        const isAWhite = Math.random() > 0.5;
        const white = isAWhite ? userA : userB;
        const black = isAWhite ? userB : userA;
        const whiteSocket = isAWhite ? pA.socket : pB.socket;
        const blackSocket = isAWhite ? pB.socket : pA.socket;

        const game = new TournamentGame({
            playerWhite: white,
            playerBlack: black,
            io,
            tournament: null,
            timeLimit: GROUP_GAME_TIME,
        });
        game.onComplete = async ({ gameId, winner, loser, draw }) => {
            const resultText = draw ? '½-½' : `1-0 (${winner.username})`;
            await updateGroupPairingGame(roomCode, i, gameId, resultText);
            const updated = await applyGroupGameStandings(roomCode, i, {
                winnerId: draw ? null : winner.id,
                loserId: loser?.id,
                draw,
            });
            if (updated && onPairingUpdate) onPairingUpdate(updated);
            activeGames.delete(gameId);
        };

        activeGames.set(game.gameId, game);
        game.start();

        await updateGroupPairingGame(roomCode, i, game.gameId, null);
        pair.gameId = game.gameId;

        whiteSocket.emit('group:gameCreated', {
            gameId: game.gameId,
            color: 'w',
            returnGroup: roomCode,
            opponent: black.username,
        });
        blackSocket.emit('group:gameCreated', {
            gameId: game.gameId,
            color: 'b',
            returnGroup: roomCode,
            opponent: white.username,
        });

        created.push({ pairIndex: i, gameId: game.gameId });
    }

    return created;
}
