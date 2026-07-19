import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    initDb,
    addUser,
    findUserById,
    updateUserStats,
    getPlayerGameHistory,
    canActorAccessStudent,
    linkStudentToTeacher,
    getDbConnection,
} from '../db.js';

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
let teacherId;
let studentA;
let studentB;

describe('senior invariants (db)', () => {
    before(async () => {
        await initDb();
        teacherId = await addUser(`t_${suffix}`, 'pass12345', 'teacher');
        studentA = await addUser(`sa_${suffix}`, 'pass12345', 'student');
        studentB = await addUser(`sb_${suffix}`, 'pass12345', 'student');
    });

    after(async () => {
        const db = await getDbConnection();
        await db.run('DELETE FROM academic_xp_events WHERE user_id IN (?, ?)', [studentA, studentB]);
        await db.run('DELETE FROM games WHERE player1_id IN (?, ?) OR player2_id IN (?, ?)', [
            studentA,
            studentB,
            studentA,
            studentB,
        ]);
        await db.run('DELETE FROM teacher_student_links WHERE teacher_id = ? OR student_id IN (?, ?)', [
            teacherId,
            studentA,
            studentB,
        ]);
        await db.run('DELETE FROM users WHERE id IN (?, ?, ?)', [teacherId, studentA, studentB]);
    });

    it('study games do not change Elo, W-L-D, or history', async () => {
        const beforeA = await findUserById(studentA);
        const beforeB = await findUserById(studentB);
        const histBefore = (await getPlayerGameHistory(studentA, 50)).length;

        await updateUserStats(studentA, studentB, false, {
            affectsRating: false,
            gameType: 'Учёба',
        });

        const afterA = await findUserById(studentA);
        const afterB = await findUserById(studentB);
        assert.equal(afterA.rating, beforeA.rating);
        assert.equal(afterA.wins, beforeA.wins);
        assert.equal(afterA.losses, beforeA.losses);
        assert.equal(afterB.rating, beforeB.rating);
        assert.equal(afterB.losses, beforeB.losses);
        assert.equal((await getPlayerGameHistory(studentA, 50)).length, histBefore);
    });

    it('competitive games change Elo and are viewer-relative in history', async () => {
        const beforeA = await findUserById(studentA);
        const beforeB = await findUserById(studentB);

        await updateUserStats(studentA, studentB, false, { affectsRating: true });

        const afterA = await findUserById(studentA);
        const afterB = await findUserById(studentB);
        assert.ok(afterA.rating > beforeA.rating);
        assert.ok(afterB.rating < beforeB.rating || afterB.rating === 0);
        assert.equal(afterA.wins, beforeA.wins + 1);
        assert.equal(afterB.losses, beforeB.losses + 1);

        const histA = await getPlayerGameHistory(studentA, 5);
        const histB = await getPlayerGameHistory(studentB, 5);
        assert.equal(histA[0].result, 'Победа');
        assert.equal(histB[0].result, 'Поражение');

        const profileA = await findUserById(studentA);
        assert.equal(profileA.history[0].result, 'Победа');
    });

    it('canActorAccessStudent requires teacher↔student link', async () => {
        assert.equal(await canActorAccessStudent({ id: studentA, role: 'student' }, studentA), true);
        assert.equal(
            await canActorAccessStudent({ id: teacherId, role: 'teacher' }, studentA),
            false
        );
        await linkStudentToTeacher(teacherId, studentA);
        assert.equal(
            await canActorAccessStudent({ id: teacherId, role: 'teacher' }, studentA),
            true
        );
        assert.equal(
            await canActorAccessStudent({ id: teacherId, role: 'teacher' }, studentB),
            false
        );
    });
});
