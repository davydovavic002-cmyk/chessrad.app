import {
    findUserById,
    getStudentHomeworkSummary,
    getNextLessonForStudent,
    getStudentTopicProgress,
    getTodayLessonsForTeacher,
    getPendingScheduleRequests,
    getTeacherStudentSnapshots,
    getTeacherHomeworkPendingTotal,
    getPlayerGameHistory,
    summarizePlayerForm,
    buildRatingSparkline,
    computeRatingDeltaWeek,
    getFeaturedTournaments,
    analyzePlayerExtras,
    buildChessArmy,
    buildLearningArmy,
    attachRatingFields,
} from '../db.js';
import { getBadgeSummary } from './achievements.js';

async function buildPlayStatsBlock(userId, user) {
    const history = await getPlayerGameHistory(userId, 10);
    const historyDeep = await getPlayerGameHistory(userId, 40);
    const form = summarizePlayerForm(history);
    const totalGames = (Number(user?.wins) || 0) + (Number(user?.losses) || 0) + (Number(user?.draws) || 0);
    const allTimeWinRate = totalGames
        ? Math.round(((Number(user?.wins) || 0) / totalGames) * 100)
        : 0;
    return {
        history,
        form,
        stats: {
            wins: Number(user?.wins) || 0,
            losses: Number(user?.losses) || 0,
            draws: Number(user?.draws) || 0,
            allTimeWinRate,
        },
        ratingSparkline: buildRatingSparkline(user?.rating, history),
        ratingDeltaWeek: computeRatingDeltaWeek(historyDeep, user?.rating),
        playArmy: buildChessArmy(user?.wins),
        tournaments: await getFeaturedTournaments(3),
        extras: analyzePlayerExtras(historyDeep, user, form),
    };
}

export async function buildProfileDashboard(userId, role) {
    const badges = await getBadgeSummary(userId);
    const user = attachRatingFields(await findUserById(userId));
    const tournamentElo = Number(user?.tournamentElo ?? user?.rating) || 0;
    const academicXp = Number(user?.academicXp ?? user?.academic_xp) || 0;
    const base = {
        role,
        badges,
        tournamentElo,
        academicXp,
        ratings: {
            tournamentElo,
            academicXp,
        },
        xpTierKey: user?.xpTierKey || null,
    };

    if (role === 'student' || role === 'player') {
        const progress = await getStudentTopicProgress(userId);
        const play = await buildPlayStatsBlock(userId, user);
        return {
            ...base,
            nextLesson: await getNextLessonForStudent(userId),
            homework: await getStudentHomeworkSummary(userId),
            progress,
            learnArmy: buildLearningArmy(academicXp),
            play,
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

    return { ...base };
}
