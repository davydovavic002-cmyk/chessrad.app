// ---------------------------------
// 1. ИМПОРТЫ И НАСТРОЙКА
// ---------------------------------
import 'dotenv/config';
import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cookie from 'cookie';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { Chess } from 'chess.js'; // Добавили импорт для проверки ходов на сервере
import session from 'express-session'; // или const session = require('express-session');
import sqliteStore from 'connect-sqlite3';
import {
    db,
    initDb,
    addUser,
    findUserByUsername,
    findUserById,
    updateUserStats,
    createStudyRoom,
    findStudyRoomByCode,
    joinStudentToRoom,
    updateStudyRoomFen,
    getTeacherRooms,
    deleteStudyRoom,
    attachRatingFields,
    updateTabNotes,
    createHomework,
    getHomeworkForStudent,
    getHomeworkForTeacher,
    getHomeworkById,
    completeHomework,
    getJournalEntries,
    getJournalEntriesForStudent,
    getJournalEntryById,
    getJournalByToken,
    upsertJournalEntry,
    ensureJournalShareToken,
    markJournalSentToParents,
    getPlanItems,
    upsertPlanItem,
    deletePlanItem,
    createNotification,
    getNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    updateUserSettings,
    getUpcomingLessonsForUser,
    getStudentsList,
    getPendingScheduleRequests,
    getLessonTemplates,
    saveLessonTemplate,
    deleteLessonTemplate,
    savePgnArchive,
    getPgnArchive,
    getStudentTopicProgress,
    getStudentCalendar,
    getWeeklyReportData,
    markWeeklyReportSent,
    getStudentsForWeeklyReports,
    joinGroupStudent,
    updateGroupStudentBoard,
    setGroupExercise,
    setGroupBroadcast,
    setGroupPairings,
    parseGroupRoom,
    updateScheduleLessonMeta,
    enrichGroupRoom,
    generateGroupPairings,
    updateGroupPairingGame,
    getTournamentSchedule,
    getTournamentById,
    ensureTournamentSchedulePopulated,
    applyGroupGameStandings,
    getLessonsInMinutesWindow,
    getTournamentsInMinutesWindow,
    getAllUserIds,
    saveGroupSessionLog,
    getParentChildren,
    linkParentToStudent,
    findParentByEmail,
    setGroupPollState,
    getGroupPollState,
    ensureUserLinkCode,
    formatLinkCode,
    findUserByLinkCode,
    linkStudentToTeacher,
    unlinkStudentFromTeacher,
    getTeacherStudents,
    getStudentTeachers,
    canActorAccessStudent,
    countStudentTeachers,
    teacherLinkedToStudent,
} from './db.js';
import { Game } from './gamelogic.js';
import { Tournament } from './server/tournament.js';
import { startGroupPairingGames } from './server/group-games.js';
import { checkAchievements, getBadgeSummary } from './server/achievements.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.join(__dirname, 'db');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const app = express();


const AUTH_BYPASS = process.env.AUTH_BYPASS === 'true';

const ALLOWED_ORIGINS = new Set([
    'https://chessrad.app',
    'https://www.chessrad.app',
    'http://127.0.0.1:3011',
    'http://localhost:3011',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:3569',
    'http://localhost:3569',
]);
if (process.env.PUBLIC_ORIGIN) ALLOWED_ORIGINS.add(String(process.env.PUBLIC_ORIGIN).replace(/\/$/, ''));

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.has(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));

// Создаем ОДИН сервер для всего (API + Sockets)
const httpServer = http.createServer(app);

// Привязываем сокеты к этому серверу
const io = new Server(httpServer, {
    cors: corsOptions
});

const SQLiteStore = sqliteStore(session);
app.set('trust proxy', 1); // Позволяет Express доверять Nginx и передавать Cookie

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || process.env.JWT_SECRET || '').trim();

if (isProd) {
    if (!JWT_SECRET || JWT_SECRET.length < 16) {
        console.error('[FATAL] JWT_SECRET must be set (≥16 chars) in production');
        process.exit(1);
    }
    if (!SESSION_SECRET || SESSION_SECRET.length < 16) {
        console.error('[FATAL] SESSION_SECRET must be set (≥16 chars) in production');
        process.exit(1);
    }
} else if (!JWT_SECRET || JWT_SECRET.length < 16) {
    console.warn('[auth] JWT_SECRET missing/short — using insecure DEV fallback. Set JWT_SECRET before production.');
}

const EFFECTIVE_JWT_SECRET = JWT_SECRET.length >= 16
    ? JWT_SECRET
    : 'dev-only-insecure-jwt-secret-change-me';
const EFFECTIVE_SESSION_SECRET = SESSION_SECRET.length >= 16
    ? SESSION_SECRET
    : 'dev-only-insecure-session-secret';

// Защита от слишком частых запросов (регистрация/логин)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 20, // Лимит 20 запросов с одного IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Слишком много попыток. Попробуйте позже." }
});

const studyJoinHits = new Map();
function studyJoinAllowed(userId) {
    const now = Date.now();
    const key = String(userId || 'anon');
    let bucket = studyJoinHits.get(key);
    if (!bucket || now - bucket.windowStart > 60_000) {
        bucket = { windowStart: now, count: 0 };
        studyJoinHits.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= 30;
}

app.use(session({
    // Указываем SQLite в качестве хранилища
    store: new SQLiteStore({
        db: 'chess-app.db',
        dir: DB_DIR
    }),
    secret: EFFECTIVE_SESSION_SECRET,
    resave: false,
    saveUninitialized: false, // Ставим false, чтобы не плодить пустые сессии
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
    }
}));
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || 'http://127.0.0.1:3011';

async function sendEmailOptional(to, subject, html) {
    if (!to || !process.env.SMTP_HOST) {
        console.log(`[Email] skipped → ${to}: ${subject}`);
        return false;
    }
    try {
        const nm = await import('nodemailer');
        const transport = nm.default.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER
                ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
                : undefined,
        });
        await transport.sendMail({
            from: process.env.SMTP_FROM || 'ChessRad <noreply@chessrad.app>',
            to,
            subject,
            html,
        });
        return true;
    } catch (e) {
        console.error('[Email] error:', e.message);
        return false;
    }
}

async function pushNotification(userId, type, title, body, payload = {}) {
    const id = await createNotification(userId, type, title, body, payload);
    const sockets = onlineUsers;
    for (const [, entry] of sockets) {
        if (Number(entry.id) === Number(userId) && entry.socket) {
            entry.socket.emit('notification:new', { id, type, title, body, payload });
        }
    }
    return id;
}

// ---------------------------------
// 2. ГЛОБАЛЬНОЕ СОСТОЯНИЕ СЕРВЕРА
// ---------------------------------
const activeGames = new Map();
const onlineUsers = new Map();
const matchmakingQueue = [];
const videoRooms = new Map();
const studyRoomSettings = new Map();
const DEFAULT_STUDY_SETTINGS = { studentMoveColor: 'b', activeMoveColor: 'b', boardFlipped: false };

function getStudySettings(roomCode) {
  if (!studyRoomSettings.has(roomCode)) {
    studyRoomSettings.set(roomCode, { ...DEFAULT_STUDY_SETTINGS });
  }
  return studyRoomSettings.get(roomCode);
}
const sentReminderKeys = new Set();

let mainTournament;
const tournamentInstances = new Map();

async function ensureTournamentInstance(id) {
    if (tournamentInstances.has(id)) return tournamentInstances.get(id);
    const meta = await getTournamentById(id);
    const t = new Tournament({
        io,
        games: activeGames,
        id,
        name: meta?.name || id,
    });
    if (meta?.status === 'finished') {
        t.status = 'finished';
    } else if (meta?.status === 'running') {
        t.status = 'running';
        t.currentRound = 1;
        t.totalRounds = 3;
    }
    tournamentInstances.set(id, t);
    if (id === 'main-tournament-1') mainTournament = t;
    return t;
}

function tournamentPlayerCount(row, live) {
    if (live) return live.players?.size ?? 0;
    return row.demo_players || 0;
}

async function initTournamentInstances() {
    const rows = await getTournamentSchedule();
    for (const row of rows) {
        if (row.status === 'registration' || row.status === 'running') {
            const t = await ensureTournamentInstance(row.id);
            if (row.status === 'running' && t.status === 'waiting') {
                t.status = 'running';
                t.currentRound = 1;
                t.totalRounds = 3;
            }
        }
    }
    if (!mainTournament) {
        mainTournament = await ensureTournamentInstance('main-tournament-1');
    }
}

function getTournamentByIdLive(id) {
    return tournamentInstances.get(id) || null;
}

function broadcastTournamentState(tournament) {
    if (!tournament) return;
    io.to(tournament.id).emit('tournament:stateUpdate', tournament.getState());
    broadcastTournamentSchedule();
}

async function broadcastTournamentSchedule() {
    try {
        const rows = await getTournamentSchedule();
        const updates = rows.map((row) => {
            const live = getTournamentByIdLive(row.id);
            return {
                id: row.id,
                liveStatus: live?.status || row.status,
                playerCount: live ? (live.players?.size ?? 0) : (row.demo_players || 0),
                currentRound: live?.currentRound || 0,
            };
        });
        io.emit('tournament:scheduleUpdate', updates);
    } catch (e) {
        console.error('[Tournament schedule broadcast]', e);
    }
}

async function notifyAchievementBadges(userId, trigger) {
    const awarded = await checkAchievements(userId, trigger);
    for (const b of awarded) {
        await pushNotification(userId, 'badge', b.title, b.icon, { badgeId: b.id });
    }
    return awarded;
}

async function emailReminderToUser(userId, subject, html) {
    const user = await findUserById(userId);
    if (!user || !user.notify_email) return false;
    const to = user.parent_email || (user.username?.includes('@') ? user.username : null);
    if (!to) return false;
    return sendEmailOptional(to, subject, html);
}

function createAndAssignTournament() {
    tournamentInstances.delete('main-tournament-1');
    return ensureTournamentInstance('main-tournament-1');
}

// ---------------------------------
// 3. MIDDLEWARE
// ---------------------------------

// ---------------------------------
// 3. MIDDLEWARE
// ---------------------------------
app.use(express.json());
app.use(cookieParser());


app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');

    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; " +
        // script-src: разрешаем скрипты, CDN и blob для воркеров (конфетти)
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://code.jquery.com https://unpkg.com https://cdnjs.cloudflare.com blob:; " +

        // worker-src: критично для анимаций и движков
        "worker-src 'self' blob:; " +

        // style-src: шрифты Google и стили библиотек
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com https://cdnjs.cloudflare.com; " +

        // font-src: ИСПРАВЛЕНО - добавили cdnjs для FontAwesome и gstatic/googleapis для шрифтов
        "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +

        // img-src: фигуры, аватарки и дата-урлы
        "img-src 'self' data: https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +

        // connect-src: сокеты и API (убедись, что домен совпадает)
        "connect-src 'self' wss://chessrad.app https://chessrad.app https://cdn.jsdelivr.net https://cdnjs.cloudflare.com;"
    );

    next();
});

// ---------------------------------
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ---------------------------------
const DEV_USERNAME = 'dev';

async function getOrCreateDevUser() {
    let user = await findUserByUsername(DEV_USERNAME);
    if (!user) {
        await addUser(DEV_USERNAME, 'dev-local-only', 'teacher');
        user = await findUserByUsername(DEV_USERNAME);
    }
    return user;
}

function buildAuthPayload(user) {
    return { id: user.id, username: user.username, role: user.role };
}

function setAuthCookie(res, user) {
    const token = jwt.sign(buildAuthPayload(user), EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'Lax',
        secure: process.env.NODE_ENV === 'production' && !AUTH_BYPASS,
        path: '/'
    });
    return token;
}

async function attachDevUser(req, res, next) {
    try {
        const user = await getOrCreateDevUser();
        req.user = buildAuthPayload(user);
        setAuthCookie(res, user);
        next();
    } catch (err) {
        console.error('[AUTH_BYPASS] Не удалось создать dev-пользователя:', err);
        res.status(500).json({ message: 'Ошибка AUTH_BYPASS' });
    }
}

const verifyAuthToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        if (AUTH_BYPASS) return attachDevUser(req, res, next);
        return res.status(401).json({ message: 'Доступ запрещен' });
    }

    jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, user) => {
        if (err) {
            if (AUTH_BYPASS) return attachDevUser(req, res, next);
            return res.status(403).json({ message: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

const MUST_CHANGE_ALLOW = new Set([
    'GET:/api/profile',
    'POST:/api/profile/change-password',
    'POST:/api/logout',
]);

/** Block API use until forced password change is done. */
const rejectIfMustChangePassword = async (req, res, next) => {
    try {
        if (!req.user?.id) return next();
        const key = `${req.method}:${req.path}`;
        if (MUST_CHANGE_ALLOW.has(key)) return next();
        const fresh = await findUserById(req.user.id);
        if (fresh?.must_change_password) {
            return res.status(403).json({
                success: false,
                mustChangePassword: true,
                message: 'Требуется смена пароля',
            });
        }
        next();
    } catch (e) {
        next(e);
    }
};

const authenticateToken = [verifyAuthToken, rejectIfMustChangePassword];

// Локальный обход логина: сразу в лобби под пользователем "dev"
app.get('/', async (req, res, next) => {
    if (!AUTH_BYPASS) return next();
    try {
        const user = await getOrCreateDevUser();
        setAuthCookie(res, user);
        res.redirect('/lobby');
    } catch (err) {
        console.error('[AUTH_BYPASS] redirect failed:', err);
        next(err);
    }
});

const requireAdmin = async (req, res, next) => {
    try {
        const user = await findUserById(req.user.id);
        if (user && user.role === 'admin') {
            next();
        } else {
            res.status(403).json({ message: 'Требуются права администратора' });
        }
    } catch (e) {
        res.status(500).json({ message: 'Ошибка проверки прав' });
    }
};

app.get('/reset-tournament', authenticateToken, requireAdmin, async (req, res) => {
    await createAndAssignTournament();
    if (mainTournament) broadcastTournamentState(mainTournament);
    res.redirect('/tournaments');
});

app.post('/api/admin/reset-tournament', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await createAndAssignTournament();
        if (mainTournament) broadcastTournamentState(mainTournament);
        res.json({ success: true });
    } catch (e) {
        console.error('reset-tournament', e);
        res.status(500).json({ success: false });
    }
});

async function comparePasswords(password, hash) {
    try { return await bcrypt.compare(password, hash); }
    catch (error) { return false; }
}

async function handleGameResultUpdate(winnerId, loserId, isDraw) {
    try {
        await updateUserStats(winnerId, loserId, isDraw);
    } catch (error) {
        console.error('[Stats] Ошибка обновления статистики:', error);
    }
}

function createAndStartGame(player1Socket, player2Socket) {
    if (!player1Socket.user || !player2Socket.user) {
        console.error('❌ Ошибка: Попытка создать игру для неавторизованных сокетов');
        return;
    }

    const isPlayer1White = Math.random() < 0.5;
    const white = isPlayer1White ? player1Socket : player2Socket;
    const black = isPlayer1White ? player2Socket : player1Socket;

    const game = new Game({
        io: io,
        playerWhite: { socket: white, user: white.user },
        playerBlack: { socket: black, user: black.user },
        onGameResult: handleGameResultUpdate,
        onGameEnd: (gameId) => activeGames.delete(gameId)
    });

    activeGames.set(game.getId(), game);
    game.start();
}

// ---------------------------------
// 5. API РОУТЫ
// ---------------------------------

app.post('/api/register', authLimiter, async (req, res) => {
    let { username, password, role, displayName, teacherLinkCode, teacherInviteCode } = req.body;
    if (username) username = username.replace(/<\/?[^>]+(>|$)/g, '').trim();
    displayName = (displayName || '').replace(/<\/?[^>]+(>|$)/g, '').trim();

    if (!username || !password || password.length < 4) {
        return res.status(400).json({ message: 'Ошибка валидации' });
    }

    try {
        const existingUser = await findUserByUsername(username);
        if (existingUser) return res.status(409).json({ message: 'Пользователь существует' });

        let userRole = 'student';
        if (role === 'teacher') {
            const invite = String(process.env.TEACHER_INVITE_CODE || '').trim();
            const provided = String(teacherInviteCode || '').trim();
            if (!invite || provided !== invite) {
                return res.status(403).json({
                    message: 'Регистрация учителя только по коду приглашения',
                });
            }
            userRole = 'teacher';
        }

        const userId = await addUser(username, password, userRole, displayName || username);

        if (userRole === 'student' && teacherLinkCode) {
            const teacher = await findUserByLinkCode(teacherLinkCode);
            if (teacher && (teacher.role === 'teacher' || teacher.role === 'admin')) {
                await linkStudentToTeacher(teacher.id, userId);
            }
        }

        res.status(201).json({ message: 'Успех' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await findUserByUsername(username);

        // 1. Безопасная проверка пароля
        if (!user || !(await comparePasswords(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Неверные данные' });
        }

        // 2. Генерация токена
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            EFFECTIVE_JWT_SECRET,
            { expiresIn: '1d' }
        );

        // 3. Установка Cookie
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 86400000, // 24 часа
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/'
        });

        // 4. Возвращаем важные флаги и данные
        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                // Передаем флаг принудительной смены пароля
                mustChangePassword: !!user.must_change_password
            }
        });
    } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
        await ensureUserLinkCode(req.user.id);
        const fresh = await findUserById(req.user.id);
        const { password_hash, ...raw } = fresh;
        const profileData = attachRatingFields(raw);
        profileData.display_name = fresh.display_name || fresh.username;
        profileData.link_code_formatted = formatLinkCode(fresh.link_code);
        if (fresh.role === 'student') {
            profileData.teachers = await getStudentTeachers(req.user.id);
            profileData.needs_teacher_link = profileData.teachers.length === 0;
        }
        if (fresh.role === 'teacher' || fresh.role === 'admin') {
            profileData.students = await getTeacherStudents(req.user.id);
        }
        res.json(profileData);
    } catch (e) {
        res.status(500).json({ message: 'Ошибка сервера при загрузке профиля' });
    }
});

app.get('/api/profile/dashboard', authenticateToken, async (req, res) => {
    try {
        const { buildProfileDashboard } = await import('./server/profileDashboard.js');
        const dashboard = await buildProfileDashboard(req.user.id, req.user.role);
        res.json({ success: true, dashboard });
    } catch (e) {
        console.error('profile/dashboard', e);
        res.status(500).json({ success: false });
    }
});

app.post('/api/profile/change-password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: 'Пароль слишком короткий' });
        }

        const user = await findUserById(userId);

        // Проверяем старый (временный) пароль
        const match = await bcrypt.compare(oldPassword, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Текущий или временный пароль неверный' });
        }

        // Хешируем новый пароль
        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);

        // Вызываем обновление.
        // ВАЖНО: В db.js функция должна ставить must_change_password = 0
        const { updateOwnPassword } = await import('./db.js');
        await updateOwnPassword(userId, newHash);

        res.json({ success: true, message: 'Пароль успешно обновлен' });
    } catch (e) {
        console.error('Ошибка смены пароля:', e);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// --- АДМИН-ПАНЕЛЬ ---


app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const sortMode = req.query.sort || 'new';
        const { getAllUsers } = await import('./db.js');
        const users = await getAllUsers(sortMode);
        res.json({ success: true, users });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/update-role', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, newRole } = req.body;
        const { updateUserRole } = await import('./db.js');
        await updateUserRole(userId, newRole);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/delete-user/:userId', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { deleteUser } = await import('./db.js');
        await deleteUser(req.params.userId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/admin/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { userId, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Пароль короткий (мин. 6)' });
        }
        const { resetUserPassword } = await import('./db.js');
        const hashed = await bcrypt.hash(String(newPassword), 10);
        await resetUserPassword(userId, hashed);
        res.json({ success: true, message: 'Пароль сброшен' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- ОБУЧЕНИЕ ---

app.post('/api/study/create', authenticateToken, async (req, res) => {
    try {
        const user = await findUserById(req.user.id);
        if (user.role !== 'teacher' && user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Нужна роль учителя' });
        }
        const { countTeacherRooms } = await import('./db.js');
        const roomCount = await countTeacherRooms(user.id);
        if (roomCount >= 5) {
            return res.status(429).json({ success: false, message: 'Лимит комнат' });
        }
        const roomCode = 'CH-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const roomType = req.body.roomType === 'group' ? 'group' : 'duo';
        await createStudyRoom(user.id, roomCode, roomType);
        res.json({ success: true, roomCode, roomType });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/study/join', authenticateToken, async (req, res) => {
    try {
        const { roomCode } = req.body;
        const room = await findStudyRoomByCode(roomCode);
        if (!room) return res.status(404).json({ success: false });
        if (Number(room.teacher_id) !== Number(req.user.id)) {
            if (req.user.role === 'student') {
                const linked = await teacherLinkedToStudent(room.teacher_id, req.user.id);
                if (!linked) {
                    return res.status(403).json({
                        success: false,
                        message: 'teacher_link_required',
                    });
                }
            } else if (req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'no_access' });
            }
            if (room.room_type === 'group') {
                await joinGroupStudent(roomCode, req.user.id);
            } else {
                await joinStudentToRoom(roomCode, req.user.id);
            }
        }
        const parsed = parseGroupRoom(await findStudyRoomByCode(roomCode));
        res.json({ success: true, roomCode, roomType: parsed?.room_type || 'duo' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/study/my-rooms', authenticateToken, async (req, res) => {
    try {
        const rooms = await getTeacherRooms(req.user.id);
        res.json({ success: true, rooms: rooms || [] });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/study/:roomCode', authenticateToken, async (req, res) => {
    try {
        const result = await deleteStudyRoom(req.params.roomCode, req.user.id);
        if (result && result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(403).json({ success: false });
        }
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/positions', authenticateToken, async (req, res) => {
    try {
        const { getTeacherPositions } = await import('./db.js');
        const isAdmin = req.user.role === 'admin';
        if (req.user.role !== 'teacher' && !isAdmin) {
            return res.status(403).json({ message: 'Нужна роль учителя' });
        }
        const positions = await getTeacherPositions(isAdmin ? null : req.user.id);
        res.json(positions);
    } catch (e) {
        res.status(500).json({ message: 'Ошибка при получении библиотеки' });
    }
});

app.post('/api/positions', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Нужна роль учителя' });
        }
        const { title, big_folder, category, fen } = req.body;
        if (!title || !fen) return res.status(400).json({ message: 'Данные обязательны' });

        const { addPosition } = await import('./db.js');
        await addPosition(req.user.id, title, category, fen, big_folder);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка при добавлении' });
    }
});
app.delete('/api/positions/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Нужна роль учителя' });
        }
        const { deletePosition } = await import('./db.js');
        const ownerId = req.user.role === 'admin' ? null : req.user.id;
        const result = await deletePosition(req.params.id, ownerId);
        if (!result?.changes) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: 'Ошибка при удалении' });
    }
});

app.put('/api/positions/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Нужна роль учителя' });
        }
        const positionId = req.params.id;
        const { title, big_folder, category, fen } = req.body;
        const { updatePosition } = await import('./db.js');
        const ownerId = req.user.role === 'admin' ? null : req.user.id;
        const result = await updatePosition(positionId, ownerId, { title, big_folder, category, fen });

        if (result && result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Позиция не найдена' });
        }
    } catch (e) {
        res.status(500).json({ message: 'Ошибка при обновлении' });
    }
});
app.post('/api/positions/reorder', authenticateToken, async (req, res) => {
    const { positions } = req.body;
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Нужна роль учителя' });
        }
        if (!Array.isArray(positions)) return res.status(400).json({ message: 'Bad payload' });
        await db.run('BEGIN TRANSACTION');
        for (const item of positions) {
            if (req.user.role === 'admin') {
                await db.run(
                    'UPDATE position_library SET order_index = ? WHERE id = ?',
                    [item.order_index, item.id]
                );
            } else {
                await db.run(
                    'UPDATE position_library SET order_index = ? WHERE id = ? AND teacher_id = ?',
                    [item.order_index, item.id, req.user.id]
                );
            }
        }
        await db.run('COMMIT');
        res.sendStatus(200);
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).send(err.message);
    }
});

/** Puzzles temporarily removed from the product — all puzzle endpoints are gone. */
const puzzleGone = (_req, res) => {
    res.status(410).json({ success: false, message: 'puzzles_disabled' });
};
app.all('/api/puzzle', puzzleGone);
app.all('/api/puzzle/*', puzzleGone);
app.get('/api/user/puzzle-status', puzzleGone);

// --- РАСПИСАНИЕ ---
app.get('/api/schedule', authenticateToken, async (req, res) => {
    try {
        const { weekStart, weekEnd } = req.query;
        if (!weekStart || !weekEnd) {
            return res.status(400).json({ success: false, message: 'Нужны weekStart и weekEnd' });
        }
        const {
            getScheduleLessons,
        } = await import('./db.js');
        const lessons = await getScheduleLessons(weekStart, weekEnd, req.user.id, req.user.role);
        res.json({ success: true, lessons });
    } catch (e) {
        console.error('schedule list:', e);
        res.status(500).json({ success: false });
    }
});

app.get('/api/schedule/students', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Только для учителей' });
        }
        const students = await getStudentsList(req.user.id);
        res.json({ success: true, students });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/schedule', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Только для учителей' });
        }
        const { lessonDate, timeSlot, studentIds, videoUrl } = req.body;
        if (!lessonDate || !timeSlot) {
            return res.status(400).json({ success: false, message: 'Нужны дата и время' });
        }
        const ids = Array.isArray(studentIds) ? studentIds : [];
        for (const sid of ids) {
            if (!(await canActorAccessStudent(req.user, sid))) {
                return res.status(403).json({ success: false, message: 'Нет доступа к ученику' });
            }
        }
        const { upsertScheduleLesson } = await import('./db.js');
        const id = await upsertScheduleLesson(req.user.id, lessonDate, timeSlot, ids, videoUrl || '');
        res.json({ success: true, id });
    } catch (e) {
        console.error('schedule save:', e);
        res.status(500).json({ success: false });
    }
});

app.put('/api/schedule/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Только для учителей' });
        }
        const ids = Array.isArray(req.body.studentIds) ? req.body.studentIds : [];
        for (const sid of ids) {
            if (!(await canActorAccessStudent(req.user, sid))) {
                return res.status(403).json({ success: false, message: 'Нет доступа к ученику' });
            }
        }
        const { updateScheduleLessonMeta } = await import('./db.js');
        const id = await updateScheduleLessonMeta(
            req.params.id,
            req.user.id,
            ids,
            req.body.videoUrl || '',
            req.user.role === 'admin'
        );
        if (!id) return res.status(404).json({ success: false, message: 'Урок не найден' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/schedule/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Только для учителей' });
        }
        const { deleteScheduleLesson } = await import('./db.js');
        const ok = await deleteScheduleLesson(req.params.id, req.user.id, req.user.role === 'admin');
        if (!ok) return res.status(404).json({ success: false, message: 'Урок не найден' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/schedule/requests', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const { getPendingScheduleRequests } = await import('./db.js');
        const requests = await getPendingScheduleRequests(req.user.id, req.user.role === 'admin');
        res.json({ success: true, requests });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/schedule/requests', authenticateToken, async (req, res) => {
    try {
        const { lessonDate, timeSlot, teacherId } = req.body;
        if (!lessonDate || !timeSlot) {
            return res.status(400).json({ success: false, message: 'Нужны дата и время' });
        }
        const myTeachers = await getStudentTeachers(req.user.id);
        const linkedTeacherIds = new Set(myTeachers.map((t) => Number(t.id)));
        if (teacherId) {
            if (!linkedTeacherIds.has(Number(teacherId)) && req.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Нет связи с учителем' });
            }
        } else if (!linkedTeacherIds.size) {
            return res.status(403).json({ success: false, message: 'teacher_link_required' });
        }
        const { createScheduleRequest } = await import('./db.js');
        const result = await createScheduleRequest(
            req.user.id,
            lessonDate,
            timeSlot,
            teacherId ? Number(teacherId) : null
        );
        if (!result.ok) return res.status(409).json({ success: false, message: result.message });

        const student = await findUserById(req.user.id);
        const teacherIds = teacherId
            ? [Number(teacherId)]
            : [...linkedTeacherIds];
        for (const tid of [...new Set(teacherIds)]) {
            await pushNotification(
                tid,
                'schedule_request',
                'Новая заявка на урок',
                `${student?.username || 'Ученик'} — ${lessonDate} ${timeSlot}`,
                { lessonDate, timeSlot, studentId: req.user.id }
            );
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/schedule/requests/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const { approveScheduleRequest } = await import('./db.js');
        const result = await approveScheduleRequest(req.params.id, req.user.id, req.user.role === 'admin');
        if (!result.ok) return res.status(400).json({ success: false, message: result.message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/schedule/requests/:id/reject', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const { rejectScheduleRequest } = await import('./db.js');
        const ok = await rejectScheduleRequest(req.params.id, req.user.id, req.user.role === 'admin');
        if (!ok) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/link/connect', authenticateToken, async (req, res) => {
    try {
        const target = await findUserByLinkCode(req.body?.code || '');
        if (!target) {
            return res.status(404).json({ success: false, message: 'link_not_found' });
        }
        const me = await findUserById(req.user.id);
        if (!me) return res.status(401).json({ success: false });

        if (me.role === 'student' && (target.role === 'teacher' || target.role === 'admin')) {
            const result = await linkStudentToTeacher(target.id, me.id);
            if (!result.ok) return res.status(400).json({ success: false, message: result.reason });
            const teachers = await getStudentTeachers(me.id);
            return res.json({ success: true, linkedAs: 'teacher', teachers });
        }
        if ((me.role === 'teacher' || me.role === 'admin') && target.role === 'student') {
            const result = await linkStudentToTeacher(me.id, target.id);
            if (!result.ok) return res.status(400).json({ success: false, message: result.reason });
            const students = await getTeacherStudents(me.id);
            return res.json({ success: true, linkedAs: 'student', students });
        }
        return res.status(400).json({ success: false, message: 'link_invalid_roles' });
    } catch (e) {
        console.error('link/connect', e);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/link/student/:studentId', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        await unlinkStudentFromTeacher(req.user.id, Number(req.params.studentId));
        const students = await getTeacherStudents(req.user.id);
        res.json({ success: true, students });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- НАСТРОЙКИ ПРОФИЛЯ ---
app.patch('/api/profile/settings', authenticateToken, async (req, res) => {
    try {
        await updateUserSettings(req.user.id, {
            parentEmail: req.body.parentEmail,
            onboardingDone: req.body.onboardingDone,
            theme: req.body.theme,
            notifyEmail: req.body.notifyEmail,
            notifyPush: req.body.notifyPush,
            tzPrimary: req.body.tzPrimary,
            tzSecondary: req.body.tzSecondary,
            displayName: req.body.displayName,
            username: req.body.username,
        });
        const user = await findUserById(req.user.id);
        const { password_hash, ...profileData } = user;
        res.json(profileData);
    } catch (e) {
        if (e.code === 'username_taken') {
            return res.status(409).json({ success: false, message: 'username_taken' });
        }
        if (e.code === 'username_invalid') {
            return res.status(400).json({ success: false, message: 'username_invalid' });
        }
        res.status(500).json({ success: false });
    }
});

// --- УВЕДОМЛЕНИЯ ---
app.get('/api/notifications', authenticateToken, async (req, res) => {
    try {
        const items = await getNotifications(req.user.id);
        const unread = await getUnreadNotificationCount(req.user.id);
        res.json({ success: true, items, unread });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/notifications/read-all', authenticateToken, async (req, res) => {
    try {
        await markAllNotificationsRead(req.user.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
    try {
        await markNotificationRead(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/notifications/check-upcoming', authenticateToken, async (req, res) => {
    try {
        const lessons = await getUpcomingLessonsForUser(req.user.id, req.user.role, 1);
        let created = 0;
        for (const lesson of lessons) {
            const title = 'Напоминание о занятии';
            const body = `${lesson.lesson_date} в ${lesson.time_slot}`;
            const existing = await getNotifications(req.user.id, 50);
            const dup = existing.some(
                (n) =>
                    n.type === 'lesson_reminder' &&
                    n.payload?.lessonDate === lesson.lesson_date &&
                    n.payload?.timeSlot === lesson.time_slot
            );
            if (!dup) {
                await pushNotification(req.user.id, 'lesson_reminder', title, body, {
                    lessonDate: lesson.lesson_date,
                    timeSlot: lesson.time_slot,
                });
                const user = await findUserById(req.user.id);
                if (user?.notify_email && user.parent_email) {
                    await sendEmailOptional(user.parent_email, title, `<p>${body}</p>`);
                }
                created++;
            }
        }
        res.json({ success: true, created });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- ДОМАШНИЕ ЗАДАНИЯ ---
app.get('/api/homework', authenticateToken, async (req, res) => {
    try {
        const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
        const items = isTeacher
            ? await getHomeworkForTeacher(req.user.id)
            : await getHomeworkForStudent(req.user.id);
        res.json({ success: true, items });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/homework', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const { studentId, roomCode, title, fen, pgn, instructions, dueDate } = req.body;
        if (!studentId || !title || !fen || !dueDate) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }
        if (!(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false, message: 'Нет доступа к ученику' });
        }
        const id = await createHomework({
            teacherId: req.user.id,
            studentId,
            roomCode,
            title,
            fen,
            pgn,
            instructions,
            dueDate,
        });
        await pushNotification(
            studentId,
            'homework',
            'Новое домашнее задание',
            `${title} — до ${dueDate}`,
            { homeworkId: id }
        );
        const student = await findUserById(studentId);
        if (student?.notify_email && student.parent_email) {
            await sendEmailOptional(
                student.parent_email,
                'Новое домашнее задание ChessRad',
                `<p>${title}</p><p>Срок: ${dueDate}</p>`
            );
        }
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/homework/:id', authenticateToken, async (req, res) => {
    try {
        const hw = await getHomeworkById(req.params.id);
        if (!hw) return res.status(404).json({ success: false });
        const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
        if (!isTeacher && Number(hw.student_id) !== Number(req.user.id)) {
            return res.status(403).json({ success: false });
        }
        if (isTeacher && Number(hw.teacher_id) !== Number(req.user.id) && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        res.json({ success: true, homework: hw });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/homework/:id/complete', authenticateToken, async (req, res) => {
    try {
        const ok = await completeHomework(req.params.id, req.user.id);
        if (!ok) return res.status(404).json({ success: false });
        const hw = await getHomeworkById(req.params.id);
        if (hw) {
            await pushNotification(
                hw.teacher_id,
                'homework_done',
                'Домашнее задание выполнено',
                `${hw.student_name}: ${hw.title}`,
                { homeworkId: hw.id }
            );
        }
        await notifyAchievementBadges(req.user.id, 'homework');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- ЖУРНАЛ УЧИТЕЛЯ ---
app.get('/api/journal', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const studentId = req.query.studentId ? Number(req.query.studentId) : null;
        if (studentId && !(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false });
        }
        const entries = await getJournalEntries(req.user.id, studentId);
        res.json({ success: true, entries });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/journal', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        if (req.body.studentId && !(await canActorAccessStudent(req.user, req.body.studentId))) {
            return res.status(403).json({ success: false, message: 'Нет доступа к ученику' });
        }
        const id = await upsertJournalEntry(req.user.id, req.body);
        if (!id) return res.status(400).json({ success: false });
        if (req.body.studentId) await notifyAchievementBadges(Number(req.body.studentId), 'journal');
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/journal/public/:token', async (req, res) => {
    try {
        const entry = await getJournalByToken(req.params.token);
        if (!entry) return res.status(404).json({ success: false });
        res.json({ success: true, entry });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/journal/:id/share', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const entry = await getJournalEntryById(req.params.id);
        if (!entry || Number(entry.teacher_id) !== Number(req.user.id)) {
            return res.status(404).json({ success: false });
        }
        const token = await ensureJournalShareToken(entry.id, req.user.id);
        const shareUrl = `${PUBLIC_ORIGIN}/parent-report/${token}`;
        const email = req.body.parentEmail || entry.parent_email;
        let emailed = false;
        if (email) {
            const html = `
                <h2>Отчёт об уроке — ${entry.student_name}</h2>
                <p><strong>Дата:</strong> ${entry.lesson_date}</p>
                <p>${entry.parent_message || entry.content || ''}</p>
                <p><a href="${shareUrl}">Полный отчёт</a></p>`;
            emailed = await sendEmailOptional(email, `Урок ChessRad — ${entry.lesson_date}`, html);
            await markJournalSentToParents(entry.id);
        }
        res.json({ success: true, shareUrl, token, emailed });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- ПЛАН ОБУЧЕНИЯ ---
app.get('/api/plan', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const { studentId, from, to } = req.query;
        if (!studentId || !from || !to) {
            return res.status(400).json({ success: false });
        }
        if (!(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false });
        }
        const items = await getPlanItems(req.user.id, Number(studentId), from, to);
        res.json({ success: true, items });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/plan', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        if (req.body.studentId && !(await canActorAccessStudent(req.user, req.body.studentId))) {
            return res.status(403).json({ success: false });
        }
        const id = await upsertPlanItem(req.user.id, req.body);
        if (!id) return res.status(400).json({ success: false });
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/plan/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const ok = await deletePlanItem(req.params.id, req.user.id);
        if (!ok) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// --- ШАБЛОНЫ, PGN, ПРОГРЕСС, КАЛЕНДАРЬ ---

app.get('/api/templates', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const items = await getLessonTemplates(req.user.id);
        res.json({ success: true, items });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/templates', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const id = await saveLessonTemplate(req.user.id, req.body);
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
    try {
        const ok = await deleteLessonTemplate(req.params.id, req.user.id);
        if (!ok) return res.status(404).json({ success: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/pgn-archive', authenticateToken, async (req, res) => {
    try {
        const studentId = req.query.studentId ? Number(req.query.studentId) : null;
        if (studentId && !(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false });
        }
        const items = await getPgnArchive(req.user.id, req.user.role, studentId);
        res.json({ success: true, items });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/pgn-archive', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        if (req.body.studentId && !(await canActorAccessStudent(req.user, req.body.studentId))) {
            return res.status(403).json({ success: false, message: 'Нет доступа к ученику' });
        }
        const id = await savePgnArchive({
            teacherId: req.user.id,
            studentId: req.body.studentId,
            roomCode: req.body.roomCode,
            title: req.body.title,
            pgn: req.body.pgn,
            fen: req.body.fen,
            lessonDate: req.body.lessonDate,
        });
        if (req.body.studentId) await notifyAchievementBadges(Number(req.body.studentId), 'pgn');
        res.json({ success: true, id });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/student/progress', authenticateToken, async (req, res) => {
    try {
        const studentId = req.query.studentId ? Number(req.query.studentId) : req.user.id;
        if (!(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false });
        }
        const progress = await getStudentTopicProgress(studentId);
        res.json({ success: true, progress, weakTopics: progress.topicsPlanned || [] });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/achievements', authenticateToken, async (req, res) => {
    try {
        const badges = await getBadgeSummary(req.user.id);
        res.json({ success: true, badges });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/parent/dashboard', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'parent') return res.status(403).json({ success: false });
        const children = await getParentChildren(req.user.id);
        const dashboard = [];
        for (const child of children) {
            const progress = await getStudentTopicProgress(child.student_id || child.id);
            const from = new Date();
            from.setDate(from.getDate() - 7);
            const to = new Date();
            to.setDate(to.getDate() + 14);
            const cal = await getStudentCalendar(child.id, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
            const entries = await getJournalEntriesForStudent(child.id, 3);
            dashboard.push({
                student: attachRatingFields({
                    id: child.id,
                    username: child.username,
                    display_name: child.display_name,
                    rating: child.rating,
                    academic_xp: child.academic_xp,
                    level: child.level,
                }),
                progress,
                lessons: cal.lessons.slice(0, 5),
                homework: cal.homework.slice(0, 5),
                recentJournal: entries.slice(0, 3),
            });
        }
        res.json({ success: true, children: dashboard });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/parent/link', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const { studentId, parentEmail } = req.body;
        if (!studentId || !parentEmail) return res.status(400).json({ success: false });
        if (!(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false, message: 'Нет доступа к ученику' });
        }
        let parent = await findParentByEmail(parentEmail);
        if (!parent) {
            const tempPass = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
            const parentId = await addUser(parentEmail, tempPass, 'parent', '', { mustChangePassword: true });
            parent = await findUserById(parentId);
            await sendEmailOptional(
                parentEmail,
                'Доступ родителя ChessRad',
                `<p>Временный пароль: <strong>${tempPass}</strong></p><p>При входе потребуется смена пароля.</p>`
            );
        }
        await linkParentToStudent(parent.id, Number(studentId));
        res.json({ success: true, parentId: parent.id, message: 'Parent linked' });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/student/calendar', authenticateToken, async (req, res) => {
    try {
        const { from, to } = req.query;
        if (!from || !to) return res.status(400).json({ success: false });
        const studentId = req.user.role === 'student' ? req.user.id : Number(req.query.studentId);
        if (!studentId) return res.status(400).json({ success: false });
        if (!(await canActorAccessStudent(req.user, studentId))) {
            return res.status(403).json({ success: false });
        }
        const data = await getStudentCalendar(studentId, from, to);
        res.json({ success: true, ...data });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/tournaments', authenticateToken, async (req, res) => {
    try {
        let rows = await getTournamentSchedule();
        if (!rows.length) {
            await ensureTournamentSchedulePopulated();
            rows = await getTournamentSchedule();
        }
        const tournaments = rows.map((row) => {
            const live = getTournamentByIdLive(row.id);
            return {
                ...row,
                league: row.league || 'open',
                format_type: row.format_type || row.format || 'swiss',
                liveStatus: live?.status || row.status,
                playerCount: tournamentPlayerCount(row, live),
                currentRound: live?.currentRound || 0,
            };
        });
        res.json({ success: true, tournaments });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/tournaments/:id', authenticateToken, async (req, res) => {
    try {
        const meta = await getTournamentById(req.params.id);
        if (!meta) return res.status(404).json({ success: false });
        const live = getTournamentByIdLive(req.params.id);
        res.json({
            success: true,
            tournament: {
                ...meta,
                league: meta.league || 'open',
                format_type: meta.format_type || meta.format || 'swiss',
                liveStatus: live?.status || meta.status,
                playerCount: live ? (live.players?.size ?? 0) : (meta.demo_players || 0),
                currentRound: live?.currentRound || 0,
            },
        });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.get('/api/lobby/spotlight', authenticateToken, async (req, res) => {
    try {
        let leaders = [];
        let liveGame = null;
        for (const t of tournamentInstances.values()) {
            if (t.status === 'running') {
                leaders = t.getState().players.slice(0, 3).map((p, i) => ({
                    rank: i + 1,
                    username: p.username,
                    score: p.score,
                    tournamentName: t.name,
                }));
                for (const [, game] of t.activeGames || []) {
                    const gid = [...t.activeGames.keys()][0];
                    const g = activeGames.get(gid);
                    if (g?.chess) {
                        liveGame = {
                            gameId: gid,
                            fen: g.chess.fen(),
                            white: g.playerWhite?.username,
                            black: g.playerBlack?.username,
                            tournamentName: t.name,
                        };
                        break;
                    }
                }
                if (!liveGame) {
                    for (const [gid] of t.activeGames) {
                        const g = activeGames.get(gid);
                        if (g?.chess) {
                            liveGame = {
                                gameId: gid,
                                fen: g.chess.fen(),
                                white: g.playerWhite?.username,
                                black: g.playerBlack?.username,
                                tournamentName: t.name,
                            };
                            break;
                        }
                    }
                }
                break;
            }
        }
        res.json({ success: true, leaders, liveGame });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

app.post('/api/journal/weekly-reports', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false });
        }
        const weekStart = req.body.weekStart || (() => {
            const d = new Date();
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            d.setDate(d.getDate() + diff);
            return d.toISOString().slice(0, 10);
        })();
        const students = await getStudentsForWeeklyReports(req.user.id);
        let sent = 0;
        for (const s of students) {
            if (!s.parent_email) continue;
            const data = await getWeeklyReportData(req.user.id, s.student_id, weekStart);
            const topics = [...data.progress.topicsDone].slice(0, 8).join(', ') || '—';
            const html = `<h2>Еженедельный отчёт — ${s.username}</h2>
                <p>Неделя с ${weekStart}</p>
                <p><strong>Пройдено:</strong> ${topics}</p>
                <p><strong>Домашка:</strong> ${data.progress.homeworkDone}/${data.progress.homeworkTotal}</p>
                <p>Уроков записано: ${data.entries.length}</p>`;
            const ok = await sendEmailOptional(s.parent_email, `ChessRad — неделя ${weekStart}`, html);
            if (ok) {
                await markWeeklyReportSent(req.user.id, s.student_id, weekStart);
                sent++;
            }
        }
        res.json({ success: true, sent });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});

// ---------------------------------
// 6. ЛОГИКА SOCKET.IO
// ---------------------------------
io.use(async (socket, next) => {
    const cookieString = socket.handshake.headers.cookie;
    const cookies = cookieString ? cookie.parse(cookieString) : {};

    if (cookies.token) {
        try {
            socket.user = jwt.verify(cookies.token, EFFECTIVE_JWT_SECRET);
            const fresh = await findUserById(socket.user.id);
            if (fresh?.must_change_password) {
                return next(new Error('must_change_password'));
            }
            return next();
        } catch {
            // fall through to AUTH_BYPASS or error
        }
    }

    if (AUTH_BYPASS) {
        try {
            const user = await getOrCreateDevUser();
            socket.user = buildAuthPayload(user);
            return next();
        } catch (err) {
            return next(err);
        }
    }

    if (!cookieString) return next(new Error('No cookies'));
    if (!cookies.token) return next(new Error('No token'));
    return next(new Error('Auth error'));
});

io.on('connection', (socket) => {
    // ПРОВЕРКА: Если пользователь не определен, отключаем сразу
    if (!socket.user || !socket.user.id) {
        console.warn('⚠️ Подключение сокета без данных пользователя прервано');
        return socket.disconnect();
    }

    const userId = socket.user.id; // Удобная константа для использования ниже

    function parseGroupStudentIds(room) {
        try {
            return JSON.parse(room.group_student_ids || '[]').map(Number);
        } catch {
            return [];
        }
    }

    /** Owner of the room or platform admin — not every teacher. */
    function isStudyRoomOwner(room, uid, role) {
        return Number(room.teacher_id) === Number(uid) || role === 'admin';
    }

    function isStudyRoomMember(room, uid) {
        if (Number(room.teacher_id) === Number(uid)) return true;
        if (Number(room.student_id) === Number(uid)) return true;
        return parseGroupStudentIds(room).includes(Number(uid));
    }

    onlineUsers.set(userId, { id: userId, username: socket.user.username, socket: socket });

// --- ОБУЧЕНИЕ (С ВКЛАДКАМИ) ---
socket.on('study:join', async ({ roomCode }) => {
    try {
        if (!studyJoinAllowed(userId)) {
            socket.emit('study:error', { message: 'rate_limited' });
            return;
        }
        const room = await findStudyRoomByCode(roomCode);
        if (!room) return;
        if (!isStudyRoomMember(room, userId)) {
            socket.emit('study:error', { message: 'no_access' });
            return;
        }
            socket.join(roomCode);
            // Если в БД есть вкладки (в виде JSON), парсим их, иначе отправляем стандарт
            const tabsData = room.tabs ? (typeof room.tabs === 'string' ? JSON.parse(room.tabs) : room.tabs) : null;

            socket.emit('study:roomData', {
                ...room,
                tabs: tabsData,
                activeTabId: room.active_tab_id || 'play',
                pgn: room.pgn || '',
                studySettings: getStudySettings(roomCode),
            });
    } catch (error) {
        console.error('Ошибка в study:join:', error);
    }
});

// --- ОБНОВЛЕННЫЙ БЛОК ХОДОВ (STUDY) ---
socket.on('study:move', async ({ roomCode, tabId, fen, pgn, customHistory }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room) return;

        const isTeacher = isStudyRoomOwner(room, userId, socket.user.role);
        const isStudent = isStudyRoomMember(room, userId) && !isTeacher;

        if (!isTeacher && !isStudent) return;

        // ВАЖНО: Обновляем данные в базе данных.
        await updateStudyRoomFen(roomCode, fen, tabId, pgn, customHistory);

        if (fen && tabId === 'play') {
            const turn = fen.split(' ')[1] === 'b' ? 'b' : 'w';
            const merged = { ...getStudySettings(roomCode), activeMoveColor: turn };
            studyRoomSettings.set(roomCode, merged);
            io.to(roomCode).emit('study:syncSettings', { settings: merged });
        }

        io.to(roomCode).emit('study:syncMove', {
            tabId,
            fen,
            pgn,
            customHistory: customHistory || []
        });

        // Study games do NOT affect tournament Elo — academic training only.
        if (tabId === 'play') {
            const game = new Chess(fen);
            if (game.game_over()) {
                if (room.teacher_id && room.student_id) {
                    let winnerId = null, loserId = null, isDraw = false;

                    if (game.in_checkmate()) {
                        if (game.turn() === 'w') {
                            winnerId = room.student_id;
                            loserId = room.teacher_id;
                        } else {
                            winnerId = room.teacher_id;
                            loserId = room.student_id;
                        }
                    } else {
                        isDraw = true;
                    }

                    await updateUserStats(winnerId, loserId, isDraw, {
                        affectsRating: false,
                        gameType: 'Учёба',
                    });
                    io.to(roomCode).emit('study:gameFinished', { winnerId, isDraw });
                }
            }
        }
    } catch (error) {
        console.error('Ошибка в study:move:', error);
    }
});

// --- ОБНОВЛЕНИЕ ВКЛАДОК ---
socket.on('study:updateTabs', async ({ roomCode, tabs, activeTabId }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);

        if (room && isStudyRoomOwner(room, userId, socket.user.role)) {
            const { updateRoomTabs } = await import('./db.js');
            await updateRoomTabs(roomCode, tabs, activeTabId);
            io.to(roomCode).emit('study:syncTabs', { tabs, activeTabId });
        }
    } catch (error) {
        console.error('Ошибка в study:updateTabs:', error);
    }
});

socket.on('study:importPgn', async ({ roomCode, pgn, title }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room) return;
        if (!isStudyRoomMember(room, userId)) return;
        if (!pgn || typeof pgn !== 'string') return;

        let tabs = [];
        try {
            tabs = JSON.parse(room.tabs || '[]');
        } catch {
            tabs = [];
        }
        const replay = new Chess();
        try {
            replay.load_pgn(pgn);
        } catch {
            socket.emit('study:error', { message: 'Invalid PGN' });
            return;
        }
        const hist = replay.history();
        replay.reset();
        const customHistory = [];
        for (const san of hist) {
            const m = replay.move(san);
            if (m) customHistory.push({ san, fen: replay.fen() });
        }
        const tabId = `demo-pgn-${Date.now()}`;
        tabs.push({
            id: tabId,
            type: 'demo',
            fen: replay.fen(),
            initialFen: replay.fen(),
            shapes: [],
            pgn,
            customHistory,
            notes: title || 'Imported PGN',
        });
        const { updateRoomTabs } = await import('./db.js');
        await updateRoomTabs(roomCode, tabs, tabId);
        io.to(roomCode).emit('study:syncTabs', { tabs, activeTabId: tabId });
        if (room.student_id) await notifyAchievementBadges(room.student_id, 'pgn');
    } catch (error) {
        console.error('study:importPgn', error);
    }
});

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДКИ ---
socket.on('study:switchTab', async ({ roomCode, tabId }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);

        if (room && isStudyRoomOwner(room, userId, socket.user.role)) {
            const { updateActiveTab } = await import('./db.js');
            await updateActiveTab(roomCode, tabId);
            socket.to(roomCode).emit('study:syncSwitchTab', { tabId });
        }
    } catch (error) {
        console.error('Ошибка в study:switchTab:', error);
    }
});

// --- РИСОВАНИЕ ---
socket.on('study:draw', async ({ roomCode, tabId, shapes }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);

        // Рисовать может только учитель/админ
        if (room && isStudyRoomOwner(room, userId, socket.user.role)) {
            // Сохраняем shapes во вкладке, чтобы не терялись при перезагрузке
            if (room.tabs) {
                let tabs = typeof room.tabs === 'string' ? JSON.parse(room.tabs) : room.tabs;
                tabs = tabs.map((t) => (t.id === tabId ? { ...t, shapes: shapes || [] } : t));
                const { updateRoomTabs } = await import('./db.js');
                await updateRoomTabs(roomCode, tabs, room.active_tab_id || tabId);
            }
            socket.to(roomCode).emit('study:syncDraw', { tabId, shapes });
        }
    } catch (error) {
        console.error('Ошибка в study:draw:', error);
    }
});

socket.on('study:notes', async ({ roomCode, tabId, notes }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room) return;
        if (!isStudyRoomOwner(room, userId, socket.user.role)) return;
        await updateTabNotes(roomCode, tabId, notes || '');
        io.to(roomCode).emit('study:syncNotes', { tabId, notes: notes || '' });
    } catch (error) {
        console.error('Ошибка в study:notes:', error);
    }
});

socket.on('study:updateSettings', async ({ roomCode, settings }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room) return;
        if (!isStudyRoomOwner(room, userId, socket.user.role) || !settings) return;
        const merged = { ...getStudySettings(roomCode), ...settings };
        studyRoomSettings.set(roomCode, merged);
        io.to(roomCode).emit('study:syncSettings', { settings: merged });
    } catch (error) {
        console.error('Ошибка в study:updateSettings:', error);
    }
});


// --- ГРУППОВОЙ КЛАСС ---
socket.on('group:join', async ({ roomCode }) => {
    try {
        const raw = await findStudyRoomByCode(roomCode);
        const room = await enrichGroupRoom(raw);
        if (!room || room.room_type !== 'group') return;
        const userId = socket.user.id;
        const isOwner = Number(room.teacher_id) === Number(userId) || socket.user.role === 'admin';
        let ids = [];
        try {
            ids = JSON.parse(raw.group_student_ids || '[]').map(Number);
        } catch { /* ignore */ }
        if (!isOwner && !ids.includes(Number(userId))) {
            const { getStudentTeachers } = await import('./db.js');
            const teachers = await getStudentTeachers(userId);
            const linked = teachers.some((t) => Number(t.id) === Number(room.teacher_id));
            if (!linked) {
                socket.emit('group:error', { message: 'no_access' });
                return;
            }
            await joinGroupStudent(roomCode, userId);
        }
        socket.join(roomCode);
        const fresh = await enrichGroupRoom(await findStudyRoomByCode(roomCode));
        socket.emit('group:roomData', fresh);
        io.to(roomCode).emit('group:presence', {
            roster: fresh.student_names,
            userId,
            username: socket.user.username,
        });
    } catch (e) {
        console.error('group:join', e);
    }
});

socket.on('group:move', async ({ roomCode, fen, pgn, customHistory }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || room.room_type !== 'group') return;
        const isTeacher = Number(room.teacher_id) === Number(userId);
        if (!isTeacher) {
            await updateGroupStudentBoard(roomCode, userId, { fen, pgn, customHistory: customHistory || [] });
        }
        io.to(roomCode).emit('group:syncBoard', { studentId: userId, fen, pgn, customHistory });
    } catch (e) {
        console.error('group:move', e);
    }
});

socket.on('group:setExercise', async ({ roomCode, fen }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        await setGroupExercise(roomCode, fen);
        io.to(roomCode).emit('group:exercise', { fen });
        const fresh = await enrichGroupRoom(await findStudyRoomByCode(roomCode));
        io.to(roomCode).emit('group:roomData', fresh);
    } catch (e) {
        console.error('group:setExercise', e);
    }
});

socket.on('group:broadcast', async ({ roomCode, fen, active }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        await setGroupBroadcast(roomCode, fen, active);
        io.to(roomCode).emit('group:broadcast', { fen, active: !!active });
    } catch (e) {
        console.error('group:broadcast', e);
    }
});

socket.on('group:broadcastMove', async ({ roomCode, fen }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        await setGroupBroadcast(roomCode, fen, true);
        io.to(roomCode).emit('group:broadcast', { fen, active: true });
    } catch (e) {
        console.error('group:broadcastMove', e);
    }
});

socket.on('group:nextRound', async ({ roomCode }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        const state = await generateGroupPairings(roomCode);
        if (state) io.to(roomCode).emit('group:pairings', state);
    } catch (e) {
        console.error('group:nextRound', e);
    }
});

socket.on('group:startGames', async ({ roomCode }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        const parsed = parseGroupRoom(room);
        const onPairingUpdate = (updated) => io.to(roomCode).emit('group:pairings', updated);
        await startGroupPairingGames({
            io,
            activeGames,
            onlineUsers,
            roomCode,
            pairingState: parsed.pairing_state,
            onPairingUpdate,
        });
        const fresh = parseGroupRoom(await findStudyRoomByCode(roomCode));
        io.to(roomCode).emit('group:pairings', fresh.pairing_state);
    } catch (e) {
        console.error('group:startGames', e);
    }
});

socket.on('group:pairings', async ({ roomCode, round, pairs }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        await setGroupPairings(roomCode, { round, pairs });
        io.to(roomCode).emit('group:pairings', { round, pairs });
    } catch (e) {
        console.error('group:pairings', e);
    }
});

socket.on('group:saveSession', async ({ roomCode, summary }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        const parsed = parseGroupRoom(room);
        const studentIds = parsed.group_student_ids || [];
        await saveGroupSessionLog({
            teacherId: userId,
            roomCode,
            studentIds,
            summary: summary || 'Групповое занятие',
            exerciseFen: parsed.exercise_fen,
            pairingState: parsed.pairing_state,
        });
        for (const sid of studentIds) {
            await upsertJournalEntry(userId, {
                studentId: sid,
                lessonDate: new Date().toISOString().slice(0, 10),
                title: summary || 'Групповое занятие',
                content: `Комната ${roomCode}. Упражнение и мини-турнир.`,
                topicsDone: ['Групповой класс'],
                topicsPlanned: [],
            });
            await notifyAchievementBadges(sid, 'group');
        }
        socket.emit('group:sessionSaved', { success: true });
    } catch (e) {
        console.error('group:saveSession', e);
    }
});

socket.on('group:startPoll', async ({ roomCode, question }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        const poll = { question: question || 'Кто нашёл тактику?', votes: {}, active: true };
        await setGroupPollState(roomCode, poll);
        io.to(roomCode).emit('group:poll', poll);
    } catch (e) {
        console.error('group:startPoll', e);
    }
});

socket.on('group:votePoll', async ({ roomCode }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || room.room_type !== 'group') return;
        const poll = await getGroupPollState(roomCode);
        if (!poll?.active) return;
        poll.votes[String(userId)] = socket.user.username;
        await setGroupPollState(roomCode, poll);
        io.to(roomCode).emit('group:poll', poll);
    } catch (e) {
        console.error('group:votePoll', e);
    }
});

socket.on('group:endPoll', async ({ roomCode }) => {
    try {
        const userId = socket.user.id;
        const room = await findStudyRoomByCode(roomCode);
        if (!room || Number(room.teacher_id) !== Number(userId)) return;
        await setGroupPollState(roomCode, null);
        io.to(roomCode).emit('group:poll', null);
    } catch (e) {
        console.error('group:endPoll', e);
    }
});

socket.on('group:requestState', async ({ roomCode }) => {
    try {
        const fresh = await enrichGroupRoom(await findStudyRoomByCode(roomCode));
        if (fresh) socket.emit('group:roomData', fresh);
    } catch (e) {
        console.error('group:requestState', e);
    }
});

socket.on('video:join', ({ roomCode }) => {
    if (!roomCode) return;
    const channel = `video-${roomCode}`;
    socket.join(channel);
    if (!videoRooms.has(roomCode)) videoRooms.set(roomCode, new Map());
    videoRooms.get(roomCode).set(userId, { username: socket.user.username });
    const peers = [...videoRooms.get(roomCode).entries()].map(([id, v]) => ({
        userId: id,
        username: v.username,
    }));
    socket.emit('video:peers', { peers });
    socket.to(channel).emit('video:joined', { userId, username: socket.user.username });
});

socket.on('video:signal', ({ roomCode, targetUserId, data }) => {
    const target = onlineUsers.get(Number(targetUserId));
    if (target?.socket) {
        target.socket.emit('video:signal', {
            fromUserId: userId,
            fromUsername: socket.user.username,
            data,
        });
    }
});

socket.on('video:leave', ({ roomCode }) => {
    if (!roomCode) return;
    videoRooms.get(roomCode)?.delete(userId);
    socket.to(`video-${roomCode}`).emit('video:left', { userId });
});


    socket.on('findGame', () => {
        const currentUserId = userId;
        if (!currentUserId) return;

        const idx = matchmakingQueue.findIndex(s => s.user?.id === currentUserId);
        if (idx !== -1) matchmakingQueue.splice(idx, 1);
        matchmakingQueue.push(socket);
        if (matchmakingQueue.length >= 2) {
            createAndStartGame(matchmakingQueue.shift(), matchmakingQueue.shift());
        }
    });

    socket.on('tournament:getState', async (tournamentId) => {
        const id = tournamentId || 'main-tournament-1';
        const t = (await ensureTournamentInstance(id)) || getTournamentByIdLive(id);
        if (t) {
            socket.join(t.id);
            socket.emit('tournament:stateUpdate', t.getState());
        }
    });

    socket.on('tournament:register', async (tournamentId) => {
        if (!socket.user) return;
        const id = tournamentId || 'main-tournament-1';
        const t = await ensureTournamentInstance(id);
        if (!t) return;
        const result = t.register(socket.user, socket);
        if (result.success) broadcastTournamentState(t);
        else socket.emit('tournament:error', { message: result.message });
    });

    socket.on('tournament:leave', async (tournamentId) => {
        if (!socket.user) return;
        const id = tournamentId || 'main-tournament-1';
        const t = getTournamentByIdLive(id);
        if (t) {
            t.removePlayer(socket);
            broadcastTournamentState(t);
        }
    });

    socket.on('tournament:start', async (tournamentId) => {
        const id = tournamentId || 'main-tournament-1';
        const t = getTournamentByIdLive(id);
        if (!t) return;
        if (socket.user.role !== 'admin' && socket.user.role !== 'teacher') return;
        if (t.start()) broadcastTournamentState(t);
    });

    socket.on('tournament:game:join', ({ gameId }) => {
        const game = activeGames.get(gameId);
        if (!game || !socket.user) return;
        socket.join(gameId);
        socket.emit('game:state', {
            fen: game.chess.fen(),
            color: game.getPlayerColor(userId),
            playerWhite: { username: game.playerWhite?.username || '?' },
            playerBlack: { username: game.playerBlack?.username || '?' }
        });
    });

    socket.on('tournament:game:move', ({ gameId, move }) => {
        const game = activeGames.get(gameId);
        if (game && socket.user) game.makeMove(move, userId);
    });

    socket.on('tournament:game:resign', ({ gameId }) => {
        const game = activeGames.get(gameId);
        if (game && socket.user) game.resign(userId);
    });

    socket.on('disconnect', () => {
        if (userId) {
            onlineUsers.delete(userId);
            videoRooms.forEach((members, roomCode) => {
                if (members.has(userId)) {
                    members.delete(userId);
                    io.to(`video-${roomCode}`).emit('video:left', { userId });
                }
            });
        }
    });

    // --- ОБРАБОТКА ИГРОВЫХ СОБЫТИЙ В SERVER.JS ---

    socket.on('move', ({ move, roomId }) => {
        const gameInstance = activeGames.get(roomId);
        if (gameInstance) {
            gameInstance.makeMove(socket.id, move);
        }
    });

    socket.on('surrender', ({ roomId }) => {
        const gameInstance = activeGames.get(roomId);
        if (gameInstance) {
            gameInstance.handleSurrender(socket.id);
        }
    });

    socket.on('rematch', ({ roomId }) => {
        const gameInstance = activeGames.get(roomId);
        if (gameInstance) {
            gameInstance.handleRematchRequest(socket.id);
        }
    });

    socket.on('rematchAccepted', ({ roomId }) => {
        const gameInstance = activeGames.get(roomId);
        if (gameInstance) {
            gameInstance.handleRematchAccept(socket.id);
        }
    });
});
// ---------------------------------
// 7. SPA (React client/dist) + fallback на старый public
// ---------------------------------
const clientDist = path.join(__dirname, 'client', 'dist');
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(clientDist)) {
    app.get('/puzzle.html', (_req, res) => res.redirect(302, '/lobby'));
    app.use(express.static(clientDist));
    app.get(/^(?!\/api(?:\/|$)|\/socket\.io(?:\/|$)).*/, (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
} else {
    app.get('/puzzle.html', (_req, res) => res.redirect(302, '/lobby'));
    app.use(express.static(publicDir));
}

// ---------------------------------
// 8. ЗАПУСК
// ---------------------------------

async function runReminderCheck() {
    try {
        const hourBucket = new Date().toISOString().slice(0, 13);
        const tournaments = await getTournamentsInMinutesWindow(55, 65);
        for (const t of tournaments) {
            const users = await getAllUserIds();
            for (const u of users) {
                const key = `t:${t.id}:${u.id}:${hourBucket}`;
                if (sentReminderKeys.has(key)) continue;
                sentReminderKeys.add(key);
                await createNotification(
                    u.id,
                    'reminder',
                    `Турнир через час: ${t.name}`,
                    `Старт в ${new Date(t.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
                    { kind: 'tournament', refId: t.id }
                );
                await emailReminderToUser(
                    u.id,
                    `ChessRad — турнир через час: ${t.name}`,
                    `<p>Турнир <strong>${t.name}</strong> начнётся через час.</p><p><a href="${PUBLIC_ORIGIN}/tournaments/${t.id}">Открыть турнир</a></p>`
                );
            }
        }
        const lessons = await getLessonsInMinutesWindow(55, 65);
        for (const l of lessons) {
            let studentIds = [];
            try {
                studentIds = JSON.parse(l.student_ids || '[]');
            } catch {
                studentIds = [];
            }
            for (const sid of studentIds) {
                const key = `l:${l.id}:${sid}:${hourBucket}`;
                if (sentReminderKeys.has(key)) continue;
                sentReminderKeys.add(key);
                await createNotification(
                    sid,
                    'reminder',
                    `Урок через час`,
                    `${l.lesson_date} ${l.time_slot} · ${l.teacher_name}. Видео в учебном кабинете.`,
                    { kind: 'lesson', refId: l.id, lessonDate: l.lesson_date, timeSlot: l.time_slot }
                );
                await emailReminderToUser(
                    sid,
                    `ChessRad — урок через час`,
                    `<p>Урок ${l.lesson_date} ${l.time_slot} с ${l.teacher_name}.</p><p><a href="${PUBLIC_ORIGIN}/calendar">Открыть календарь</a></p>`
                );
            }
        }
    } catch (e) {
        console.error('[Reminders]', e);
    }
}

const startServer = async () => {
    try {
        // Подготовка базы
        await initDb();
        await initTournamentInstances();
        broadcastTournamentSchedule();
        runReminderCheck();
        setInterval(runReminderCheck, 5 * 60 * 1000);

        console.log('[DB] Все таблицы проверены и готовы.');

        // ВАЖНО: Слушаем именно httpServer, к которому привязаны сокеты!
        const PORT = Number(process.env.PORT) || 3011;
        const HOST = process.env.HOST || '127.0.0.1';
        httpServer.listen(PORT, HOST, () => {
            console.log(`🚀 Шахматный сервер (API + Sockets) запущен на ${HOST}:${PORT}`);
            if (AUTH_BYPASS) {
                console.warn('⚠️  AUTH_BYPASS=true — логин отключён, вход как пользователь "dev"');
            }
        });

    } catch (err) {
        console.error("КРИТИЧЕСКАЯ ОШИБКА ЗАПУСКА:", err);
    }
}
startServer();
