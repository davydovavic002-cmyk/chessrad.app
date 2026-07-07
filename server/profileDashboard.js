import {
    findUserById,
    getStudentHomeworkSummary,
    getNextLessonForStudent,
    getStudentTopicProgress,
    getTodayLessonsForTeacher,
    getPendingScheduleRequests,
    getTeacherStudentSnapshots,
    getTeacherHomeworkPendingTotal,
    getPuzzleStatusForUser,
    getPlayerGameHistory,
    summarizePlayerForm,
    buildRatingSparkline,
    pickPlayerFunTitle,
    getFeaturedTournaments,
} from '../db.js';
import { getBadgeSummary } from './achievements.js';

export async function buildProfileDashboard(userId, role) {
    const badges = await getBadgeSummary(userId);
    const base = { role, badges };

    if (role === 'student') {
        const puzzle = await getPuzzleStatusForUser(userId);
        return {
            ...base,
            puzzle,
            nextLesson: await getNextLessonForStudent(userId),
            homework: await getStudentHomeworkSummary(userId),
            progress: await getStudentTopicProgress(userId),
        };
    }

    if (role === 'teacher' || role === 'admin') {
        const pendingRequests = await getPendingScheduleRequests(userId, role === 'admin');
        return {
            ...base,
            todayLessons: await getTodayLessonsForTeacher(userId),
            pendingRequests: pendingRequests.slice(0, 5),
            pendingRequestsCount: pendingRequests.length,
            studentSnapshots: await getTeacherStudentSnapshots(userId),
            homeworkPendingTotal: await getTeacherHomeworkPendingTotal(userId),
        };
    }

    if (role === 'player') {
        const puzzle = await getPuzzleStatusForUser(userId);
        const user = await findUserById(userId);
        const history = await getPlayerGameHistory(userId, 10);
        const form = summarizePlayerForm(history);
        const totalGames = (Number(user?.wins) || 0) + (Number(user?.losses) || 0) + (Number(user?.draws) || 0);
        const allTimeWinRate = totalGames
            ? Math.round(((Number(user?.wins) || 0) / totalGames) * 100)
            : 0;
        let trophyCount = 0;
        try {
            const trophies = JSON.parse(user?.trophies || '[]');
            trophyCount = trophies.filter((tr) => tr.type !== 'badge' && !tr.badgeId).length;
        } catch {
            trophyCount = 0;
        }
        return {
            ...base,
            puzzle,
            history,
            form,
            funTitle: pickPlayerFunTitle(user, puzzle?.streak || 0),
            streaks: {
                win: Number(user?.win_streak) || 0,
                daily: Number(user?.daily_streak) || 0,
            },
            stats: {
                wins: Number(user?.wins) || 0,
                losses: Number(user?.losses) || 0,
                draws: Number(user?.draws) || 0,
                allTimeWinRate,
                trophyCount,
            },
            ratingSparkline: buildRatingSparkline(user?.rating, history),
            tournaments: await getFeaturedTournaments(4),
        };
    }

    const puzzle = await getPuzzleStatusForUser(userId);
    return { ...base, puzzle };
}
