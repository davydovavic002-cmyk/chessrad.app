import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    computeAcademicXpFromParts,
    decontaminateTournamentElo,
    buildXpSparklineFromEvents,
    buildRatingSparkline,
    buildLearningArmy,
    getXpTier,
    attachRatingFields,
    puzzleMoveMatches,
    PUZZLE_XP,
    HW_XP_ON_TIME,
    HW_XP_LATE,
    DAILY_BONUS_XP,
    ELO_LEVEL_BANDS,
} from '../db.js';

describe('dual ratings pure helpers', () => {
    it('computeAcademicXpFromParts sums puzzles and homework correctly', () => {
        assert.equal(
            computeAcademicXpFromParts({ puzzleSolves: 10, hwCompleted: 2, hwLate: 1 }),
            10 * PUZZLE_XP + 2 * HW_XP_ON_TIME + 1 * HW_XP_LATE
        );
        assert.equal(computeAcademicXpFromParts({}), 0);
    });

    it('decontaminateTournamentElo strips puzzle inflation only', () => {
        assert.equal(decontaminateTournamentElo(650, 30), 650 - 30 * PUZZLE_XP);
        assert.equal(decontaminateTournamentElo(40, 20), 0);
        assert.equal(decontaminateTournamentElo(null, 5), 0);
    });

    it('decontaminate twice without a flag would over-subtract', () => {
        const once = decontaminateTournamentElo(650, 30);
        const twice = decontaminateTournamentElo(once, 30);
        assert.notEqual(once, twice);
        assert.equal(once, 650 - 30 * PUZZLE_XP);
    });

    it('buildXpSparklineFromEvents walks backwards from current XP', () => {
        const points = buildXpSparklineFromEvents(250, [
            { delta: 100 },
            { delta: 50 },
            { delta: 5 },
        ]);
        assert.deepEqual(points, [95, 100, 150, 250]);
    });

    it('buildXpSparklineFromEvents includes daily bonus deltas', () => {
        const points = buildXpSparklineFromEvents(150, [
            { delta: DAILY_BONUS_XP },
            { delta: PUZZLE_XP },
        ]);
        assert.deepEqual(points, [95, 100, 150]);
    });

    it('buildRatingSparkline reconstructs match rating trail', () => {
        const points = buildRatingSparkline(1500, [{ result: 'Победа' }, { result: 'Поражение' }]);
        assert.ok(points.length >= 2);
        assert.equal(points[points.length - 1], 1500);
    });

    it('getXpTier and attachRatingFields expose canonical dual fields', () => {
        const tier = getXpTier(350);
        assert.equal(tier.key, 'learn_army_bishop');
        const user = attachRatingFields({ id: 1, rating: 1200, academic_xp: 350, username: 'ilya' });
        assert.equal(user.tournamentElo, 1200);
        assert.equal(user.academicXp, 350);
        assert.equal(user.xpTierKey, 'learn_army_bishop');
    });

    it('buildLearningArmy unlocks by XP thresholds', () => {
        const army = buildLearningArmy(350);
        assert.equal(army.filter((t) => t.unlocked).length, 3);
        assert.equal(army.find((t) => t.label === 'learn_army_rook').unlocked, false);
    });

    it('puzzleMoveMatches accepts SAN or UCI-style solutions', () => {
        assert.equal(puzzleMoveMatches('Nf3', 'Nf3'), true);
        assert.equal(puzzleMoveMatches('Nf3+', 'Nf3'), true);
        assert.equal(puzzleMoveMatches('e2e4', 'e2e4'), true);
        assert.equal(puzzleMoveMatches('e2e4', 'Nf3'), false);
        assert.equal(puzzleMoveMatches('', 'Nf3'), false);
    });

    it('ELO_LEVEL_BANDS match post-split tournament Elo scale', () => {
        assert.equal(ELO_LEVEL_BANDS[0].min, 0);
        assert.equal(ELO_LEVEL_BANDS[0].next, 700);
        assert.equal(ELO_LEVEL_BANDS.at(-1).min, 2000);
    });
});
