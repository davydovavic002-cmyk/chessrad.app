import {
    awardBadge,
    findUserById,
    getHomeworkDoneCount,
    getJournalCountForStudent,
    userHasBadge,
} from '../db.js';

export const BADGE_CATALOG = {
    lessons_10: { title: '10 уроков', icon: '📚', color: '#34d399' },
    first_homework: { title: 'Первая домашка', icon: '✅', color: '#6366f1' },
    puzzle_streak_7: { title: 'Стрик 7 дней', icon: '🔥', color: '#ff7043' },
    group_class: { title: 'Групповой класс', icon: '👥', color: '#8b5cf6' },
    pgn_saved: { title: 'Архив PGN', icon: '💾', color: '#0ea5e9' },
};

export async function checkAchievements(userId, trigger = 'all') {
    const user = await findUserById(userId);
    if (!user) return [];
    const awarded = [];

    const tryAward = async (id) => {
        const meta = BADGE_CATALOG[id];
        if (!meta) return;
        const ok = await awardBadge(userId, id, meta);
        if (ok) awarded.push({ id, ...meta });
    };

    if (trigger === 'all' || trigger === 'journal') {
        const lessons = await getJournalCountForStudent(userId);
        if (lessons >= 10) await tryAward('lessons_10');
    }

    if (trigger === 'all' || trigger === 'homework') {
        const hw = await getHomeworkDoneCount(userId);
        if (hw >= 1) await tryAward('first_homework');
    }

    if (trigger === 'all' || trigger === 'puzzle') {
        if ((user.daily_streak || 0) >= 7) await tryAward('puzzle_streak_7');
    }

    if (trigger === 'group') await tryAward('group_class');
    if (trigger === 'pgn') await tryAward('pgn_saved');

    return awarded;
}

export async function getBadgeSummary(userId) {
    const user = await findUserById(userId);
    if (!user) return [];
    try {
        const trophies = JSON.parse(user.trophies || '[]');
        return trophies.filter((t) => t.type === 'badge' || t.badgeId);
    } catch {
        return [];
    }
}
