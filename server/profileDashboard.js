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
        let history = [];
        try {
            history = typeof user?.history === 'string' ? JSON.parse(user.history) : user?.history || [];
        } catch {
            history = [];
        }
        return { ...base, puzzle, history };
    }

    const puzzle = await getPuzzleStatusForUser(userId);
    return { ...base, puzzle };
}
