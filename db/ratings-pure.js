/** Pure dual-rating helpers (no DB I/O). Re-exported from db.js for backwards compatibility. */

/** Post-split tournament Elo bands (start ~500, ±10–25 per match). */
const LEVEL_THRESHOLDS = [
    { name: 'Большой мастер', min: 2000 },
    { name: 'Мастер', min: 1400 },
    { name: 'Опытный', min: 1000 },
    { name: 'Любитель', min: 700 },
    { name: 'Новичок', min: 0 },
];

/** Shared with client ProfilePage LEVEL_KEYS */
export const ELO_LEVEL_BANDS = [
    { key: 'profile_level_novice', min: 0, next: 700 },
    { key: 'profile_level_amateur', min: 700, next: 1000 },
    { key: 'profile_level_skilled', min: 1000, next: 1400 },
    { key: 'profile_level_master', min: 1400, next: 2000 },
    { key: 'profile_level_grandmaster', min: 2000, next: Infinity },
];

const XP_TIERS = [
    { key: 'learn_army_pawn', min: 0, next: 100 },
    { key: 'learn_army_knight', min: 100, next: 300 },
    { key: 'learn_army_bishop', min: 300, next: 700 },
    { key: 'learn_army_rook', min: 700, next: 1500 },
    { key: 'learn_army_queen', min: 1500, next: 3000 },
    { key: 'learn_army_king', min: 3000, next: Infinity },
];

export const PUZZLE_XP = 5;
export const DAILY_BONUS_XP = 50;
export const HW_XP_ON_TIME = 100;
export const HW_XP_LATE = 70;

export function getLevelByRating(rating) {
    const level = LEVEL_THRESHOLDS.find((l) => rating >= l.min);
    return level ? level.name : 'Новичок';
}

/** Pure: academic XP from countable sources (excludes unverifiable daily bonuses). */
export function computeAcademicXpFromParts({ puzzleSolves = 0, hwCompleted = 0, hwLate = 0 } = {}) {
    return (
        Math.max(0, Number(puzzleSolves) || 0) * PUZZLE_XP
        + Math.max(0, Number(hwCompleted) || 0) * HW_XP_ON_TIME
        + Math.max(0, Number(hwLate) || 0) * HW_XP_LATE
    );
}

/** Pure: strip historical per-solve puzzle points that were wrongly mixed into tournament Elo. */
export function decontaminateTournamentElo(rating, puzzleSolves = 0) {
    const elo = Number(rating) || 0;
    const inflation = Math.max(0, Number(puzzleSolves) || 0) * PUZZLE_XP;
    return Math.max(0, elo - inflation);
}

export function getXpTier(academicXp = 0) {
    const xp = Number(academicXp) || 0;
    return XP_TIERS.find((t) => xp >= t.min && xp < t.next) || XP_TIERS[XP_TIERS.length - 1];
}

/** Attach canonical dual-rating fields used by API + UI. */
export function attachRatingFields(user) {
    if (!user) return user;
    const tournamentElo = Number(user.rating) || 0;
    const academicXp = Number(user.academic_xp) || 0;
    const xpTier = getXpTier(academicXp);
    return {
        ...user,
        tournamentElo,
        academicXp,
        xpTierKey: xpTier.key,
        xpTierMin: xpTier.min,
        xpTierNext: xpTier.next === Infinity ? null : xpTier.next,
    };
}

/** Sparkline reconstruction from event deltas (newest first). Pure. */
export function buildXpSparklineFromEvents(currentXp, eventsNewestFirst = [], limit = 12) {
    const xp = Number(currentXp) || 0;
    if (!eventsNewestFirst.length) return [xp];
    let cursor = xp;
    const points = [cursor];
    for (const ev of eventsNewestFirst) {
        cursor = Math.max(0, cursor - (Number(ev.delta) || 0));
        points.unshift(cursor);
        if (points.length >= limit) break;
    }
    return points.slice(-limit);
}

const RATING_DELTA_BACKWARD = {
    Победа: -15,
    Win: -15,
    Поражение: 10,
    Loss: 10,
    Ничья: -5,
    Draw: -5,
};

export function buildRatingSparkline(currentRating, games = []) {
    const rating = Number(currentRating) || 0;
    if (!games.length) return [rating];
    let cursor = rating;
    const points = [cursor];
    for (const game of games) {
        cursor += RATING_DELTA_BACKWARD[game.result] ?? 0;
        points.unshift(Math.max(0, cursor));
    }
    return points.slice(-12);
}

export function computeRatingDeltaWeek(games = [], currentRating = 0) {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let delta = 0;
    let hasWeekGames = false;
    for (const game of games) {
        const ts = game.date ? new Date(game.date).getTime() : NaN;
        if (Number.isFinite(ts) && ts >= weekAgo) {
            hasWeekGames = true;
            delta -= RATING_DELTA_BACKWARD[game.result] ?? 0;
        }
    }
    if (hasWeekGames) return delta;
    const sparkline = buildRatingSparkline(currentRating, games.slice(0, 12));
    if (sparkline.length >= 2) {
        return sparkline[sparkline.length - 1] - sparkline[0];
    }
    return 0;
}

export function pickPlayerFunTitle(user) {
    const rating = Number(user?.rating) || 0;
    const winStreak = Number(user?.win_streak) || 0;
    if (winStreak >= 5) return 'player_title_unstoppable';
    if (rating >= 2000) return 'player_title_master';
    if (rating >= 1400) return 'player_title_sniper';
    if (rating >= 1000) return 'player_title_fighter';
    return 'player_title_rising';
}

export function buildChessArmy(wins = 0) {
    const w = Number(wins) || 0;
    const tiers = [
        { piece: '♙', min: 0, label: 'player_army_pawn' },
        { piece: '♘', min: 3, label: 'player_army_knight' },
        { piece: '♗', min: 8, label: 'player_army_bishop' },
        { piece: '♖', min: 15, label: 'player_army_rook' },
        { piece: '♕', min: 30, label: 'player_army_queen' },
        { piece: '♔', min: 50, label: 'player_army_king' },
    ];
    return tiers.map((tier) => ({ ...tier, unlocked: w >= tier.min }));
}

/** Learning arsenal unlocked by academic XP (stable; never drops from tournament losses). */
export function buildLearningArmy(academicXp = 0) {
    const xp = Number(academicXp) || 0;
    const tiers = [
        { piece: '♙', min: 0, label: 'learn_army_pawn' },
        { piece: '♘', min: 100, label: 'learn_army_knight' },
        { piece: '♗', min: 300, label: 'learn_army_bishop' },
        { piece: '♖', min: 700, label: 'learn_army_rook' },
        { piece: '♕', min: 1500, label: 'learn_army_queen' },
        { piece: '♔', min: 3000, label: 'learn_army_king' },
    ];
    return tiers.map((tier) => ({ ...tier, unlocked: xp >= tier.min }));
}

export function puzzleMoveMatches(submitted, solution) {
    const a = String(submitted || '')
        .trim()
        .toLowerCase()
        .replace(/[+#!?]/g, '');
    const b = String(solution || '')
        .trim()
        .toLowerCase()
        .replace(/[+#!?]/g, '');
    if (!a || !b) return false;
    return a === b;
}
