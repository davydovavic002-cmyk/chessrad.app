import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export let db;

const DB_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'db');

const LEVEL_THRESHOLDS = [
    { name: 'Большой мастер', min: 7500 },
    { name: 'Мастер', min: 4500 },
    { name: 'Опытный', min: 2500 },
    { name: 'Любитель', min: 1500 },
    { name: 'Новичок', min: 0 }
];

function getLevelByRating(rating) {
    const level = LEVEL_THRESHOLDS.find(l => rating >= l.min);
    return level ? level.name : 'Новичок';
}

export async function getDbConnection() {
    if (!db) {
        const dbDir = DB_DIR;
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        db = await open({
            filename: path.join(dbDir, 'chess-app.db'),
            driver: sqlite3.Database
        });

        try {
            await db.run('PRAGMA journal_mode = WAL');
            await db.run('PRAGMA busy_timeout = 5000');
            console.log('[DB] Настройки оптимизации применены: WAL mode и Busy Timeout.');
        } catch (err) {
            console.error('[DB] Ошибка при настройке PRAGMA:', err);
        }
    }
    return db;
}

export const initDb = async () => {
    const db = await getDbConnection();

    // Таблица пользователей
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            wins INTEGER NOT NULL DEFAULT 0,
            losses INTEGER NOT NULL DEFAULT 0,
            draws INTEGER NOT NULL DEFAULT 0,
            level TEXT NOT NULL DEFAULT 'Новичок',
            rating INTEGER NOT NULL DEFAULT 500,
            win_streak INTEGER NOT NULL DEFAULT 0,
            daily_streak INTEGER NOT NULL DEFAULT 0,
            previous_streak INTEGER NOT NULL DEFAULT 0,
            last_puzzle_date TEXT DEFAULT NULL,
            puzzle_level INTEGER NOT NULL DEFAULT 1,
            trophies TEXT DEFAULT '[]',
            avatar_url TEXT DEFAULT "",
            must_change_password INTEGER DEFAULT 0
        );
    `);

    // История игр
    await db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player1_id INTEGER,
            player2_id INTEGER,
            winner_id INTEGER,
            result TEXT,
            game_type TEXT DEFAULT 'Обычный',
            date TEXT,
            FOREIGN KEY(player1_id) REFERENCES users(id),
            FOREIGN KEY(player2_id) REFERENCES users(id)
        );
    `);

    // Учебные комнаты
    await db.exec(`
        CREATE TABLE IF NOT EXISTS study_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_code TEXT UNIQUE NOT NULL,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER,
            fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            pgn TEXT DEFAULT '',
            tabs TEXT DEFAULT '[{"id":"play","type":"play","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","shapes":[]}]',
            active_tab_id TEXT DEFAULT 'play',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    // Библиотека позиций

// Библиотека позиций (Обновленная версия)
await db.exec(`
    CREATE TABLE IF NOT EXISTS position_library (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        big_folder TEXT DEFAULT 'Без категории', -- Надпапка
        category TEXT DEFAULT 'Общее',           -- Папка
        fen TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,           -- Позиция в списке для тасования
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(teacher_id) REFERENCES users(id)
    );
`);

    // ТАБЛИЦА РЕШЕННЫХ ПАЗЛОВ
    await db.exec(`
        CREATE TABLE IF NOT EXISTS user_puzzles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            puzzle_id TEXT,
            solved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);

// --- ТАБЛИЦЫ ДЛЯ НЕМЕЦКОГО ЯЗЫКА ---
    await db.exec(`
        CREATE TABLE IF NOT EXISTS german_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            teacher_id INTEGER NOT NULL,
            original_text TEXT,          -- Текст ученика
            corrected_text TEXT,         -- Твои правки
            teacher_comment TEXT,        -- Твой комментарий
            topic TEXT,                  -- Тема (например, "Konjunktiv II")
            status TEXT DEFAULT 'new',   -- 'new', 'reviewed'
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES users(id),
            FOREIGN KEY(teacher_id) REFERENCES users(id)
        );
    `);

    // Таблица для хранения общих заметок или плана урока
    await db.exec(`
        CREATE TABLE IF NOT EXISTS german_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lesson_id TEXT UNIQUE,       -- ID комнаты (для Socket.io)
            content TEXT DEFAULT '',     -- Общий текст на доске
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Расписание занятий
    await db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            lesson_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            student_ids TEXT NOT NULL DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(teacher_id, lesson_date, time_slot),
            FOREIGN KEY(teacher_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS schedule_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            teacher_id INTEGER,
            lesson_date TEXT NOT NULL,
            time_slot TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(student_id) REFERENCES users(id),
            FOREIGN KEY(teacher_id) REFERENCES users(id)
        );
    `);

    // Миграции
    const userTableInfo = await db.all("PRAGMA table_info(users)");
    const userColumns = userTableInfo.map(c => c.name);
    if (!userColumns.includes('daily_streak')) await db.exec('ALTER TABLE users ADD COLUMN daily_streak INTEGER DEFAULT 0');
    if (!userColumns.includes('previous_streak')) await db.exec('ALTER TABLE users ADD COLUMN previous_streak INTEGER DEFAULT 0');
    if (!userColumns.includes('last_puzzle_date')) await db.exec('ALTER TABLE users ADD COLUMN last_puzzle_date TEXT DEFAULT NULL');
    if (!userColumns.includes('puzzle_level')) await db.exec('ALTER TABLE users ADD COLUMN puzzle_level INTEGER DEFAULT 1');

    const roomTableInfo = await db.all("PRAGMA table_info(study_rooms)");
    const roomColumns = roomTableInfo.map(c => c.name);
    if (!roomColumns.includes('tabs')) {
        await db.exec('ALTER TABLE study_rooms ADD COLUMN tabs TEXT DEFAULT \'[{"id":"play","type":"play","fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1","shapes":[]}]\'');
    }
    if (!roomColumns.includes('active_tab_id')) {
        await db.exec('ALTER TABLE study_rooms ADD COLUMN active_tab_id TEXT DEFAULT "play"');
    }
    if (!roomColumns.includes('pgn')) {
        await db.exec('ALTER TABLE study_rooms ADD COLUMN pgn TEXT DEFAULT ""');
    }

    await db.exec(`
        CREATE TABLE IF NOT EXISTS homework_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            room_code TEXT,
            title TEXT NOT NULL,
            fen TEXT NOT NULL,
            pgn TEXT DEFAULT '',
            instructions TEXT DEFAULT '',
            due_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at TEXT,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS lesson_journals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            lesson_date TEXT NOT NULL,
            room_code TEXT,
            title TEXT DEFAULT '',
            content TEXT DEFAULT '',
            topics_done TEXT DEFAULT '[]',
            topics_planned TEXT DEFAULT '[]',
            parent_message TEXT DEFAULT '',
            parent_email TEXT DEFAULT '',
            share_token TEXT UNIQUE,
            sent_to_parents_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS student_plan_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            plan_date TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'planned',
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT DEFAULT '',
            payload TEXT DEFAULT '{}',
            read_flag INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
    `);

    const userCols2 = (await db.all('PRAGMA table_info(users)')).map((c) => c.name);
    if (!userCols2.includes('parent_email')) await db.exec("ALTER TABLE users ADD COLUMN parent_email TEXT DEFAULT ''");
    if (!userCols2.includes('onboarding_done')) await db.exec('ALTER TABLE users ADD COLUMN onboarding_done INTEGER DEFAULT 0');
    if (!userCols2.includes('theme')) await db.exec("ALTER TABLE users ADD COLUMN theme TEXT DEFAULT 'light'");
    if (!userCols2.includes('notify_email')) await db.exec('ALTER TABLE users ADD COLUMN notify_email INTEGER DEFAULT 1');
    if (!userCols2.includes('notify_push')) await db.exec('ALTER TABLE users ADD COLUMN notify_push INTEGER DEFAULT 1');
    if (!userCols2.includes('tz_primary')) await db.exec("ALTER TABLE users ADD COLUMN tz_primary TEXT DEFAULT 'Asia/Yerevan'");
    if (!userCols2.includes('tz_secondary')) await db.exec("ALTER TABLE users ADD COLUMN tz_secondary TEXT DEFAULT 'Europe/Berlin'");
    if (!userCols2.includes('display_name')) await db.exec('ALTER TABLE users ADD COLUMN display_name TEXT DEFAULT ""');
    if (!userCols2.includes('link_code')) await db.exec('ALTER TABLE users ADD COLUMN link_code TEXT DEFAULT ""');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_student_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(teacher_id, student_id),
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    const allUsers = await db.all('SELECT id FROM users WHERE link_code IS NULL OR link_code = ""');
    for (const row of allUsers) {
        await ensureUserLinkCode(row.id);
    }

    const schedCols = (await db.all('PRAGMA table_info(schedule_lessons)')).map((c) => c.name);
    if (!schedCols.includes('video_url')) await db.exec("ALTER TABLE schedule_lessons ADD COLUMN video_url TEXT DEFAULT ''");

    if (!roomColumns.includes('room_type')) await db.exec("ALTER TABLE study_rooms ADD COLUMN room_type TEXT DEFAULT 'duo'");
    if (!roomColumns.includes('group_student_ids')) await db.exec("ALTER TABLE study_rooms ADD COLUMN group_student_ids TEXT DEFAULT '[]'");
    if (!roomColumns.includes('student_boards')) await db.exec("ALTER TABLE study_rooms ADD COLUMN student_boards TEXT DEFAULT '{}'");
    if (!roomColumns.includes('exercise_fen')) await db.exec("ALTER TABLE study_rooms ADD COLUMN exercise_fen TEXT DEFAULT ''");
    if (!roomColumns.includes('broadcast_fen')) await db.exec("ALTER TABLE study_rooms ADD COLUMN broadcast_fen TEXT DEFAULT ''");
    if (!roomColumns.includes('broadcast_active')) await db.exec('ALTER TABLE study_rooms ADD COLUMN broadcast_active INTEGER DEFAULT 0');
    if (!roomColumns.includes('pairing_state')) await db.exec("ALTER TABLE study_rooms ADD COLUMN pairing_state TEXT DEFAULT '{}'");
    if (!roomColumns.includes('poll_state')) await db.exec("ALTER TABLE study_rooms ADD COLUMN poll_state TEXT DEFAULT ''");

    await db.exec(`
        CREATE TABLE IF NOT EXISTS parent_student_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            parent_user_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(parent_user_id, student_id),
            FOREIGN KEY(parent_user_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS group_session_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            room_code TEXT,
            student_ids TEXT DEFAULT '[]',
            summary TEXT DEFAULT '',
            exercise_fen TEXT DEFAULT '',
            pairing_state TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(teacher_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS lesson_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            tabs TEXT NOT NULL DEFAULT '[]',
            notes TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(teacher_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS lesson_pgn_archive (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER,
            student_id INTEGER,
            room_code TEXT,
            title TEXT DEFAULT '',
            pgn TEXT DEFAULT '',
            fen TEXT DEFAULT '',
            lesson_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS weekly_parent_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            teacher_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            week_start TEXT NOT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(teacher_id, student_id, week_start),
            FOREIGN KEY(teacher_id) REFERENCES users(id),
            FOREIGN KEY(student_id) REFERENCES users(id)
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS tournament_schedule (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'registration',
            starts_at TEXT NOT NULL,
            registration_opens_at TEXT,
            time_control TEXT DEFAULT '5+0',
            max_players INTEGER DEFAULT 32,
            format TEXT DEFAULT 'swiss',
            sort_order INTEGER DEFAULT 0
        );
    `);

    const tourneyCols = (await db.all('PRAGMA table_info(tournament_schedule)')).map((c) => c.name);
    if (!tourneyCols.includes('league')) await db.exec("ALTER TABLE tournament_schedule ADD COLUMN league TEXT DEFAULT 'open'");
    if (!tourneyCols.includes('format_type')) await db.exec("ALTER TABLE tournament_schedule ADD COLUMN format_type TEXT DEFAULT 'swiss'");
    if (!tourneyCols.includes('demo_players')) await db.exec('ALTER TABLE tournament_schedule ADD COLUMN demo_players INTEGER DEFAULT 0');

    const tourneyCount = await db.get('SELECT COUNT(*) as c FROM tournament_schedule');
    if (!tourneyCount?.c) {
        await seedCoreTournaments(db);
    }

    await seedDemoTournaments(db);

    console.log('[DB] База данных инициализирована.');
};

async function seedCoreTournaments(db) {
    const now = new Date();
    const nextSat = new Date(now);
    nextSat.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
    nextSat.setHours(18, 0, 0, 0);
    const nextWed = new Date(now);
    nextWed.setDate(now.getDate() + ((3 - now.getDay() + 7) % 7 || 7));
    nextWed.setHours(19, 0, 0, 0);
    const rows = [
        {
            id: 'main-tournament-1',
            name: 'Главный еженедельный турнир',
            description: 'Швейцарская система, 5+0. Регистрация открыта — заходите и играйте!',
            status: 'registration',
            starts_at: nextSat.toISOString(),
            time_control: '5+0',
            format: 'swiss',
            league: 'open',
            max_players: 32,
            sort_order: 1,
        },
        {
            id: 'blitz-wednesday',
            name: 'Среда — блиц 3+2',
            description: 'Быстрые партии для тренировки реакции. Формат: швейцарка на 3 раунда.',
            status: 'registration',
            starts_at: nextWed.toISOString(),
            time_control: '3+2',
            format: 'swiss',
            league: 'open',
            max_players: 24,
            sort_order: 2,
        },
        {
            id: 'student-championship',
            name: 'Чемпионат учеников',
            description: 'Ежемесячный турнир для учеников школы. Призы — медали в профиле.',
            status: 'scheduled',
            starts_at: new Date(now.getFullYear(), now.getMonth() + 1, 1, 17, 0, 0).toISOString(),
            time_control: '10+0',
            format: 'swiss',
            league: 'novice',
            max_players: 20,
            sort_order: 3,
        },
    ];
    for (const row of rows) {
        await db.run(
            `INSERT INTO tournament_schedule (id, name, description, status, starts_at, registration_opens_at, time_control, format, format_type, league, demo_players, sort_order, max_players)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.id,
                row.name,
                row.description,
                row.status,
                row.starts_at,
                now.toISOString(),
                row.time_control,
                row.format,
                row.format,
                row.league,
                0,
                row.sort_order,
                row.max_players,
            ]
        );
    }
}

export async function ensureTournamentSchedulePopulated() {
    const db = await getDbConnection();
    const tourneyCount = await db.get('SELECT COUNT(*) as c FROM tournament_schedule');
    if (!tourneyCount?.c) {
        await seedCoreTournaments(db);
    }
    await seedDemoTournaments(db);
}

async function upsertTournamentRow(db, row, now) {
    const startsAt = row.startsAt instanceof Date
        ? row.startsAt
        : row.startsAt
            ? new Date(row.startsAt)
            : new Date(now.getTime() + (row.startsInMin ?? 180) * 60000);
    const formatType = row.format_type || 'swiss';
    const format = formatType === 'team' ? 'team' : (row.format || 'swiss');
    await db.run(
        `INSERT INTO tournament_schedule (
            id, name, description, status, starts_at, registration_opens_at,
            time_control, format, format_type, league, demo_players, sort_order, max_players
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            description = excluded.description,
            status = excluded.status,
            starts_at = excluded.starts_at,
            registration_opens_at = excluded.registration_opens_at,
            time_control = excluded.time_control,
            format = excluded.format,
            format_type = excluded.format_type,
            league = excluded.league,
            demo_players = excluded.demo_players,
            sort_order = excluded.sort_order,
            max_players = excluded.max_players`,
        [
            row.id,
            row.name,
            row.description,
            row.status,
            startsAt.toISOString(),
            (row.registrationOpensAt ? new Date(row.registrationOpensAt) : now).toISOString(),
            row.time_control,
            format,
            formatType,
            row.league || 'open',
            row.demo_players ?? 0,
            row.sort_order ?? 50,
            row.max_players ?? 32,
        ]
    );
}

async function seedDemoTournaments(db) {
    const now = new Date();
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
    nextFriday.setHours(20, 0, 0, 0);
    const nextSaturday = new Date(now);
    nextSaturday.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
    nextSaturday.setHours(11, 0, 0, 0);
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + ((7 - now.getDay() + 7) % 7 || 7));
    nextSunday.setHours(16, 0, 0, 0);

    const demos = [
        {
            id: 'demo-novice-open',
            name: 'Лига новичков ChessRad',
            description: 'Открытая швейцарка для игроков до 1500. 5 раундов, контроль 5+3. Медаль в профиль за топ-3.',
            status: 'registration',
            league: 'novice',
            format_type: 'swiss',
            time_control: '5+3',
            demo_players: 14,
            max_players: 24,
            sort_order: 10,
            startsInMin: 60 * 36,
        },
        {
            id: 'demo-advanced-live',
            name: 'Швейцарка Pro — идёт сейчас',
            description: 'Лига 1500+. Сейчас 2-й раунд из 5. Блиц 3+2, таблица обновляется после каждой партии.',
            status: 'running',
            league: 'advanced',
            format_type: 'swiss',
            time_control: '3+2',
            demo_players: 22,
            max_players: 32,
            sort_order: 11,
            startsInMin: -45,
        },
        {
            id: 'demo-team-class',
            name: 'Командный матч: класс 7Б vs учитель',
            description: 'Ученики одной группы играют против преподавателя. Очки команд суммируются — побеждает сильнейший состав.',
            status: 'registration',
            league: 'open',
            format_type: 'team',
            time_control: '5+0',
            demo_players: 18,
            max_players: 20,
            sort_order: 12,
            startsInMin: 60 * 72,
        },
        {
            id: 'demo-finished-cup',
            name: 'Кубок ChessRad — весенний финал',
            description: 'Завершённый турнир: 16 участников, 5 раундов швейцарки 10+0. Итоговая таблица и медали уже в профилях.',
            status: 'finished',
            league: 'open',
            format_type: 'swiss',
            time_control: '10+0',
            demo_players: 16,
            max_players: 16,
            sort_order: 13,
            startsInMin: -60 * 24 * 12,
        },
        {
            id: 'demo-blitz-now',
            name: 'Вечерний блиц 3+2',
            description: 'Быстрый турнир после учёбы: регистрация открыта, старт через час. Подходит для разминки перед рейтинговой игрой.',
            status: 'registration',
            league: 'open',
            format_type: 'swiss',
            time_control: '3+2',
            demo_players: 11,
            max_players: 28,
            sort_order: 14,
            startsInMin: 55,
        },
        {
            id: 'demo-rapid-weekend',
            name: 'Рапид — воскресный тур',
            description: 'Спокойный контроль 15+10, 4 раунда. Регистрация заранее — успей занять место в таблице.',
            status: 'scheduled',
            league: 'advanced',
            format_type: 'swiss',
            time_control: '15+10',
            demo_players: 9,
            max_players: 20,
            sort_order: 15,
            startsAt: nextSunday,
        },
        {
            id: 'demo-kids-club',
            name: 'Детский клуб — суббота',
            description: 'Турнир для юных шахматистов: контроль 8+2, дружеская атмосфера, призы за fair play и лучший прогресс.',
            status: 'registration',
            league: 'novice',
            format_type: 'swiss',
            time_control: '8+2',
            demo_players: 12,
            max_players: 16,
            sort_order: 16,
            startsAt: nextSaturday,
        },
        {
            id: 'demo-arena-bullet',
            name: 'Арена Bullet 1+0',
            description: 'Нон-стоп партии на скорость реакции. Побеждает тот, кто наберёт больше очков за 45 минут.',
            status: 'running',
            league: 'open',
            format_type: 'arena',
            time_control: '1+0',
            demo_players: 31,
            max_players: 64,
            sort_order: 17,
            startsInMin: -20,
        },
        {
            id: 'demo-rating-band',
            name: 'Лига 1200–1600',
            description: 'Закрытая по рейтингу лига: комфортные соперники своего уровня. Швейцарка 5+0, 5 раундов.',
            status: 'registration',
            league: 'novice',
            format_type: 'swiss',
            time_control: '5+0',
            demo_players: 10,
            max_players: 24,
            sort_order: 18,
            startsInMin: 60 * 24,
        },
        {
            id: 'demo-masters-series',
            name: 'Серия Masters 10+5',
            description: 'Ежемесячный турнир сильнейших: контроль 10+5, только для рейтинга 1800+. Приз — золотая медаль в профиль.',
            status: 'scheduled',
            league: 'advanced',
            format_type: 'swiss',
            time_control: '10+5',
            demo_players: 8,
            max_players: 16,
            sort_order: 19,
            startsInMin: 60 * 24 * 5,
        },
        {
            id: 'demo-friday-marathon',
            name: 'Пятничный марафон блиц',
            description: 'Классика ChessRad: каждую пятницу в 20:00 — блиц 3+2, до 32 участников, быстрые раунды без пауз.',
            status: 'registration',
            league: 'open',
            format_type: 'swiss',
            time_control: '3+2',
            demo_players: 19,
            max_players: 32,
            sort_order: 20,
            startsAt: nextFriday,
        },
        {
            id: 'demo-school-league',
            name: 'Межшкольная лига — тур 2',
            description: 'Школы соревнуются между собой: каждая команда из 4 учеников. Сейчас идёт второй тур группового этапа.',
            status: 'running',
            league: 'open',
            format_type: 'team',
            time_control: '10+0',
            demo_players: 24,
            max_players: 32,
            sort_order: 21,
            startsInMin: -90,
        },
        {
            id: 'demo-night-owl',
            name: 'Night Owl — поздний блиц',
            description: 'Для тех, кто играет после 22:00. 2+1, 6 раундов, уютный формат без спешки на старте.',
            status: 'registration',
            league: 'open',
            format_type: 'swiss',
            time_control: '2+1',
            demo_players: 7,
            max_players: 20,
            sort_order: 22,
            startsInMin: 60 * 5,
        },
        {
            id: 'demo-holiday-rapid',
            name: 'Праздничный рапид',
            description: 'Тематический турнир к каникулам: 12+3, приветственные призы всем участникам, топ-3 — медали.',
            status: 'finished',
            league: 'open',
            format_type: 'swiss',
            time_control: '12+3',
            demo_players: 20,
            max_players: 24,
            sort_order: 23,
            startsInMin: -60 * 24 * 30,
        },
        {
            id: 'demo-open-championship',
            name: 'Открытый чемпионат ChessRad',
            description: 'Главный рейтинговый турнир месяца: 7 раундов швейцарки 5+3, регистрация до начала 1-го раунда.',
            status: 'registration',
            league: 'open',
            format_type: 'swiss',
            time_control: '5+3',
            demo_players: 26,
            max_players: 48,
            sort_order: 24,
            startsInMin: 60 * 24 * 3,
        },
    ];

    for (const row of demos) {
        await upsertTournamentRow(db, row, now);
    }
}

// --- LINK CODES & TEACHER↔STUDENT ---

const LINK_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeLinkCode(raw) {
    if (!raw) return '';
    return String(raw).toUpperCase().replace(/^CR-?/i, '').replace(/\s/g, '').trim();
}

export function formatLinkCode(code) {
    const norm = normalizeLinkCode(code);
    return norm ? `CR-${norm}` : '';
}

function randomLinkCode() {
    let s = '';
    for (let i = 0; i < 8; i += 1) {
        s += LINK_CODE_CHARS[Math.floor(Math.random() * LINK_CODE_CHARS.length)];
    }
    return s;
}

export const ensureUserLinkCode = async (userId) => {
    const db = await getDbConnection();
    const user = await db.get('SELECT link_code FROM users WHERE id = ?', [userId]);
    if (user?.link_code) return user.link_code;
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const code = randomLinkCode();
        const existing = await db.get('SELECT id FROM users WHERE link_code = ?', [code]);
        if (existing) continue;
        await db.run('UPDATE users SET link_code = ? WHERE id = ?', [code, userId]);
        return code;
    }
    throw new Error('Failed to generate link code');
};

export const findUserByLinkCode = async (rawCode) => {
    const code = normalizeLinkCode(rawCode);
    if (!code) return null;
    const db = await getDbConnection();
    return db.get(
        'SELECT id, username, role, display_name, link_code FROM users WHERE link_code = ?',
        [code]
    );
};

export const linkStudentToTeacher = async (teacherId, studentId) => {
    if (Number(teacherId) === Number(studentId)) {
        return { ok: false, reason: 'self' };
    }
    const db = await getDbConnection();
    const teacher = await db.get('SELECT id, role FROM users WHERE id = ?', [teacherId]);
    const student = await db.get('SELECT id, role FROM users WHERE id = ?', [studentId]);
    if (!teacher || (teacher.role !== 'teacher' && teacher.role !== 'admin')) {
        return { ok: false, reason: 'not_teacher' };
    }
    if (!student || student.role !== 'student') {
        return { ok: false, reason: 'not_student' };
    }
    await db.run(
        'INSERT OR IGNORE INTO teacher_student_links (teacher_id, student_id) VALUES (?, ?)',
        [teacherId, studentId]
    );
    return { ok: true };
};

export const unlinkStudentFromTeacher = async (teacherId, studentId) => {
    const db = await getDbConnection();
    const r = await db.run(
        'DELETE FROM teacher_student_links WHERE teacher_id = ? AND student_id = ?',
        [teacherId, studentId]
    );
    return r.changes > 0;
};

export const getTeacherStudents = async (teacherId) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT u.id, u.username, u.display_name, u.rating, u.level, l.created_at AS linked_at
         FROM teacher_student_links l
         JOIN users u ON u.id = l.student_id
         WHERE l.teacher_id = ?
         ORDER BY u.username COLLATE NOCASE ASC`,
        [teacherId]
    );
};

export const getStudentTeachers = async (studentId) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT u.id, u.username, u.display_name, u.link_code, l.created_at AS linked_at
         FROM teacher_student_links l
         JOIN users u ON u.id = l.teacher_id
         WHERE l.student_id = ?
         ORDER BY u.username COLLATE NOCASE ASC`,
        [studentId]
    );
};

export const countStudentTeachers = async (studentId) => {
    const db = await getDbConnection();
    const row = await db.get(
        'SELECT COUNT(*) AS c FROM teacher_student_links WHERE student_id = ?',
        [studentId]
    );
    return row?.c || 0;
};

// --- УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ---

export const addUser = async (username, password, role = 'student', displayName = '') => {
    const db = await getDbConnection();
    const password_hash = await bcrypt.hash(password, 10);
    const safeDisplay = (displayName || '').trim() || username;
    const result = await db.run(
        'INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
        [username, password_hash, role, safeDisplay]
    );
    await ensureUserLinkCode(result.lastID);
    return result.lastID;
};

export const findUserByUsername = async (username) => {
    const db = await getDbConnection();
    return db.get('SELECT * FROM users WHERE username = ?', username);
};

export const findUserById = async (id) => {
    const db = await getDbConnection();
    const user = await db.get(`
        SELECT id, username, role, wins, losses, draws, level, rating,
               win_streak, daily_streak, previous_streak, last_puzzle_date, puzzle_level,
               trophies, must_change_password, avatar_url,
               parent_email, onboarding_done, theme, notify_email, notify_push,
               tz_primary, tz_secondary, display_name, link_code
        FROM users WHERE id = ?
    `, id);

    if (!user) return null;

    const history = await db.all(`
        SELECT
            CASE WHEN g.player1_id = ? THEN u2.username ELSE u1.username END as opponent,
            g.result,
            g.game_type as type
        FROM games g
        LEFT JOIN users u1 ON g.player1_id = u1.id
        LEFT JOIN users u2 ON g.player2_id = u2.id
        WHERE g.player1_id = ? OR g.player2_id = ?
        ORDER BY g.id DESC LIMIT 10
    `, [id, id, id]);

    return { ...user, history: history || [] };
};

// --- ПАЗЛЫ И СТРИКИ ---

export async function initPuzzlesTable() {
    const database = await getDbConnection();
    await database.exec(`
        CREATE TABLE IF NOT EXISTS puzzles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fen TEXT NOT NULL,
            solution TEXT NOT NULL,
            theme TEXT NOT NULL,
            description TEXT
        )
    `);
}

/**
 * Проверяет, не протух ли стрик (более 48 часов с последней задачи).
 * Если протух — сохраняет его в previous_streak и обнуляет основной.
 */
export const checkAndResetStreak = async (userId) => {
    const database = await getDbConnection();
    const user = await database.get('SELECT last_puzzle_date, daily_streak FROM users WHERE id = ?', [userId]);

    if (!user || !user.last_puzzle_date || user.daily_streak === 0) return;

    const today = new Date();
    const lastDate = new Date(user.last_puzzle_date);
    const diffTime = Math.abs(today - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        // Стрик потерян. Сохраняем его для возможности восстановления и обнуляем.
        await database.run(
            'UPDATE users SET previous_streak = daily_streak, daily_streak = 0 WHERE id = ?',
            [userId]
        );
        console.log(`[Streak] Стрик пользователя ${userId} сброшен (пропущено дней: ${diffDays})`);
    }
};

/**
 * Восстанавливает стрик из резервной копии.
 */
export const restoreStreak = async (userId) => {
    const database = await getDbConnection();
    await database.run(`
        UPDATE users
        SET daily_streak = previous_streak, previous_streak = 0
        WHERE id = ? AND daily_streak = 0 AND previous_streak > 0
    `, [userId]);
    return true;
};

export async function getNextPuzzleForUser(userId) {
    const database = await getDbConnection();
    const user = await database.get('SELECT puzzle_level FROM users WHERE id = ?', [userId]);
    if (!user) return await database.get('SELECT * FROM puzzles ORDER BY RANDOM() LIMIT 1');

    let puzzle = await database.get('SELECT * FROM puzzles WHERE id >= ? ORDER BY id ASC LIMIT 1', [user.puzzle_level]);
    if (!puzzle) puzzle = await database.get('SELECT * FROM puzzles ORDER BY RANDOM() LIMIT 1');
    return puzzle;
}

export const solvePuzzleUpdate = async (userId, puzzleId, points = 5) => {
    const database = await getDbConnection();
    await database.run('INSERT INTO user_puzzles (user_id, puzzle_id) VALUES (?, ?)', [userId, puzzleId]);
    await database.run(`
        UPDATE users
        SET rating = rating + ?, puzzle_level = puzzle_level + 1
        WHERE id = ?`, [points, userId]
    );
    const user = await database.get('SELECT rating FROM users WHERE id = ?', [userId]);
    if (user) {
        const newLevel = getLevelByRating(user.rating);
        await database.run('UPDATE users SET level = ? WHERE id = ?', [newLevel, userId]);
        return { success: true, newRating: user.rating, level: newLevel };
    }
    return { success: true };
};

export const completeDailyPuzzles = async (userId) => {
    const database = await getDbConnection();
    const today = new Date().toISOString().split('T')[0];

    // Перед начислением проверяем, не нужно ли сбросить старый стрик
    await checkAndResetStreak(userId);

    const user = await database.get('SELECT last_puzzle_date, daily_streak, rating FROM users WHERE id = ?', [userId]);

    let newStreak = 1;
    if (user && user.last_puzzle_date === today) {
        newStreak = user.daily_streak; // Уже решено сегодня
    } else if (user && user.last_puzzle_date) {
        const lastDate = new Date(user.last_puzzle_date);
        const currentDate = new Date(today);
        const diffDays = Math.ceil(Math.abs(currentDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            newStreak = user.daily_streak + 1;
        } else {
            newStreak = 1;
        }
    }

    await database.run(`
        UPDATE users SET rating = rating + 50, daily_streak = ?, last_puzzle_date = ?, previous_streak = 0 WHERE id = ?`,
        [newStreak, today, userId]
    );

    const updatedUser = await database.get('SELECT rating FROM users WHERE id = ?', [userId]);
    if (updatedUser) {
        const newLevel = getLevelByRating(updatedUser.rating);
        await database.run('UPDATE users SET level = ? WHERE id = ?', [newLevel, userId]);
        return { success: true, newStreak, newRating: updatedUser.rating };
    }
    return { success: true, newStreak };
};

// --- ОБУЧАЮЩИЕ КЛАССЫ ---

export const createStudyRoom = async (teacherId, roomCode, roomType = 'duo') => {
    const db = await getDbConnection();
    await db.run(
        'INSERT INTO study_rooms (teacher_id, room_code, room_type) VALUES (?, ?, ?)',
        [teacherId, roomCode, roomType]
    );
    return { teacherId, roomCode, roomType };
};

export const findStudyRoomByCode = async (code) => {
    const db = await getDbConnection();
    return await db.get(`
        SELECT r.*, tu.username as teacher_name, su.username as student_name
        FROM study_rooms r
        JOIN users tu ON r.teacher_id = tu.id
        LEFT JOIN users su ON r.student_id = su.id
        WHERE r.room_code = ?`, [code]);
};

export const countTeacherRooms = async (teacherId) => {
    const db = await getDbConnection();
    const result = await db.get('SELECT COUNT(*) as count FROM study_rooms WHERE teacher_id = ?', [teacherId]);
    return result ? result.count : 0;
};

export const getTeacherRooms = async (teacherId) => {
    const db = await getDbConnection();
    return await db.all('SELECT * FROM study_rooms WHERE teacher_id = ? ORDER BY created_at DESC', [teacherId]);
};

export const joinStudentToRoom = async (roomCode, studentId) => {
    const db = await getDbConnection();
    const room = await db.get('SELECT teacher_id FROM study_rooms WHERE room_code = ?', [roomCode]);
    await db.run('UPDATE study_rooms SET student_id = ? WHERE room_code = ?', [studentId, roomCode]);
    if (room?.teacher_id) {
        await linkStudentToTeacher(room.teacher_id, studentId);
    }
};

export const deleteStudyRoom = async (roomCode, teacherId) => {
    const db = await getDbConnection();
    return await db.run('DELETE FROM study_rooms WHERE room_code = ? AND teacher_id = ?', [roomCode, teacherId]);
};

// --- ВКЛАДКИ ---

export const updateRoomTabs = async (roomCode, tabs, activeTabId) => {
    const db = await getDbConnection();
    const tabsJson = JSON.stringify(tabs);
    return await db.run('UPDATE study_rooms SET tabs = ?, active_tab_id = ? WHERE room_code = ?',
        [tabsJson, activeTabId, roomCode]);
};

export const updateActiveTab = async (roomCode, activeTabId) => {
    const db = await getDbConnection();
    return await db.run('UPDATE study_rooms SET active_tab_id = ? WHERE room_code = ?', [activeTabId, roomCode]);
};


export const updateStudyRoomFen = async (roomCode, fen, tabId = 'play', pgn = '', customHistory = []) => {
    const db = await getDbConnection();
    const room = await db.get('SELECT tabs FROM study_rooms WHERE room_code = ?', [roomCode]);

    if (!room || !room.tabs) {
        return await db.run(
            'UPDATE study_rooms SET fen = ?, pgn = ? WHERE room_code = ?',
            [fen, pgn, roomCode]
        );
    }

    let tabs = JSON.parse(room.tabs);
    tabs = tabs.map(t => {
        if (t.id === tabId) {
            return {
                ...t,
                fen: fen,
                pgn: pgn,
                customHistory: customHistory || []
            };
        }
        return t;
    });

    const tabsJson = JSON.stringify(tabs);
    return await db.run(
        'UPDATE study_rooms SET fen = ?, pgn = ?, tabs = ? WHERE room_code = ?',
        [fen, pgn, tabsJson, roomCode]
    );
};

// --- ТРОФЕИ ---

export const addTrophyToUser = async (userId, trophy) => {
    const db = await getDbConnection();
    try {
        const user = await db.get('SELECT trophies FROM users WHERE id = ?', [userId]);
        let trophies = [];
        try { trophies = (user && user.trophies) ? JSON.parse(user.trophies) : []; } catch (e) { trophies = []; }
        trophies.unshift({ ...trophy, date: new Date().toLocaleDateString('ru-RU') });
        await db.run('UPDATE users SET trophies = ? WHERE id = ?', [JSON.stringify(trophies), userId]);
        return true;
    } catch (e) { return false; }
};

export const userHasBadge = async (userId, badgeId) => {
    const db = await getDbConnection();
    const user = await db.get('SELECT trophies FROM users WHERE id = ?', [userId]);
    try {
        const trophies = JSON.parse(user?.trophies || '[]');
        return trophies.some((t) => t.badgeId === badgeId || t.id === badgeId);
    } catch {
        return false;
    }
};

export const awardBadge = async (userId, badgeId, meta = {}) => {
    if (await userHasBadge(userId, badgeId)) return false;
    await addTrophyToUser(userId, {
        type: 'badge',
        badgeId,
        title: meta.title || badgeId,
        icon: meta.icon || '🏅',
        color: meta.color || '#ffb347',
        tournamentName: meta.title || badgeId,
        place: meta.place || '',
    });
    return true;
};

export const getJournalCountForStudent = async (studentId) => {
    const db = await getDbConnection();
    const row = await db.get('SELECT COUNT(*) as c FROM lesson_journals WHERE student_id = ?', [studentId]);
    return row?.c || 0;
};

export const getHomeworkDoneCount = async (studentId) => {
    const db = await getDbConnection();
    const row = await db.get(
        `SELECT COUNT(*) as c FROM homework_assignments WHERE student_id = ? AND status IN ('completed','late')`,
        [studentId]
    );
    return row?.c || 0;
};

export const getPuzzlesByTheme = async (theme, limit = 10) => {
    const db = await getDbConnection();
    const like = `%${theme}%`;
    return db.all(
        `SELECT * FROM puzzles WHERE theme LIKE ? OR description LIKE ? ORDER BY RANDOM() LIMIT ?`,
        [like, like, limit]
    );
};

export const saveGroupSessionLog = async ({ teacherId, roomCode, studentIds, summary, exerciseFen, pairingState }) => {
    const db = await getDbConnection();
    const r = await db.run(
        `INSERT INTO group_session_logs (teacher_id, room_code, student_ids, summary, exercise_fen, pairing_state)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            teacherId,
            roomCode,
            JSON.stringify(studentIds || []),
            summary || '',
            exerciseFen || '',
            JSON.stringify(pairingState || {}),
        ]
    );
    return r.lastID;
};

export const getParentChildren = async (parentUserId) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT u.id, u.username, u.rating, u.level, l.student_id
         FROM parent_student_links l
         JOIN users u ON u.id = l.student_id
         WHERE l.parent_user_id = ?`,
        [parentUserId]
    );
};

export const linkParentToStudent = async (parentUserId, studentId) => {
    const db = await getDbConnection();
    await db.run(
        `INSERT OR IGNORE INTO parent_student_links (parent_user_id, student_id) VALUES (?, ?)`,
        [parentUserId, studentId]
    );
};

export const findParentByEmail = async (email) => {
    const db = await getDbConnection();
    return db.get(`SELECT * FROM users WHERE username = ? AND role = 'parent'`, [email]);
};

export const setGroupPollState = async (roomCode, pollState) => {
    const db = await getDbConnection();
    await db.run(`UPDATE study_rooms SET poll_state = ? WHERE room_code = ?`, [
        pollState ? JSON.stringify(pollState) : '',
        roomCode,
    ]);
};

export const getGroupPollState = async (roomCode) => {
    const db = await getDbConnection();
    const row = await db.get(`SELECT poll_state FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!row?.poll_state) return null;
    try {
        return JSON.parse(row.poll_state);
    } catch {
        return null;
    }
};

// --- БИБЛИОТЕКА ПОЗИЦИЙ ---


// --- БИБЛИОТЕКА ПОЗИЦИЙ ---

export const addPosition = async (teacherId, title, category, fen, big_folder) => {
    const db = await getDbConnection();
    // Добавлена колонка big_folder в INSERT
    return await db.run(
        'INSERT INTO position_library (teacher_id, title, category, fen, big_folder) VALUES (?, ?, ?, ?, ?)',
        [teacherId, title, category || 'Общее', fen, big_folder || 'Без раздела']
    );
};

export const getTeacherPositions = async () => {
    const db = await getDbConnection();
    // Добавлен ORDER BY по big_folder для правильной группировки
    return await db.all(`
        SELECT pl.*, u.username as author_name FROM position_library pl
        JOIN users u ON pl.teacher_id = u.id ORDER BY big_folder, category, title`);
};

export const deletePosition = async (posId) => {
    const db = await getDbConnection();
    return await db.run('DELETE FROM position_library WHERE id = ?', [posId]);
};

export const updatePosition = async (posId, teacherId, data) => {
    const db = await getDbConnection();
    // Добавлено обновление big_folder
    return await db.run(
        'UPDATE position_library SET title = ?, category = ?, fen = ?, big_folder = ? WHERE id = ?',
        [data.title, data.category, data.fen, data.big_folder, posId]
    );
};

// --- СТАТИСТИКА ИГР ---

// --- ИСПРАВЛЕННАЯ СТАТИСТИКА ИГР ---

export const saveGameResult = async (p1_id, p2_id, winner_id, type = 'Обычный') => {
    const db = await getDbConnection();
    const date = new Date().toLocaleDateString('ru-RU');

    // Безопасная проверка результата для текста
    let resText = 'Ничья';
    if (winner_id !== null) {
        resText = (String(winner_id) === String(p1_id)) ? 'Победа' : 'Поражение';
    }

    try {
        await db.run(
            'INSERT INTO games (player1_id, player2_id, winner_id, result, game_type, date) VALUES (?, ?, ?, ?, ?, ?)',
            [p1_id, p2_id, winner_id, resText, type, date]
        );
    } catch (e) {
        console.error('[DB] Ошибка сохранения игры:', e);
    }
};

export const updateUserStats = async (winnerId, loserId, isDraw = false) => {
    const db = await getDbConnection();
    // Приводим к числам, чтобы избежать ошибок сравнения строк и чисел
    const wId = winnerId ? Number(winnerId) : null;
    const lId = loserId ? Number(loserId) : null;

    try {
        if (isDraw && wId && lId) {
            // Ничья: +5 обоим, сброс стрика
            await db.run('UPDATE users SET draws = draws + 1, rating = rating + 5, win_streak = 0 WHERE id = ? OR id = ?', [wId, lId]);
            await saveGameResult(wId, lId, null);
        } else if (wId && lId) {
            // Победа/Поражение
            const winner = await db.get('SELECT win_streak, rating FROM users WHERE id = ?', [wId]);
            const newStreak = (winner ? winner.win_streak : 0) + 1;

            // Бонус за серию побед
            const points = newStreak >= 3 ? 25 : 15;

            await db.run('UPDATE users SET wins = wins + 1, rating = rating + ?, win_streak = ? WHERE id = ?', [points, newStreak, wId]);
            await db.run('UPDATE users SET losses = losses + 1, rating = MAX(0, rating - 10), win_streak = 0 WHERE id = ?', [lId]);

            await saveGameResult(wId, lId, wId);
        }

        // ВАЖНО: Обновляем текстовые уровни (звания) после изменения рейтинга
        const affectedUsers = isDraw ? [wId, lId] : [wId, lId];
        for (const uId of affectedUsers) {
            if (uId) {
                const user = await db.get('SELECT rating FROM users WHERE id = ?', [uId]);
                if (user) {
                    const newLevelName = getLevelByRating(user.rating);
                    await db.run('UPDATE users SET level = ? WHERE id = ?', [newLevelName, uId]);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('[DB] Ошибка в updateUserStats:', error);
        return false;
    }
};
export async function getAllUsers(sortBy = 'new') {
    const db = await getDbConnection();
    let orderBy = (sortBy === 'old') ? 'id ASC' : (sortBy === 'rating') ? 'rating DESC' : (sortBy === 'alphabet') ? 'username COLLATE NOCASE ASC' : 'id DESC';
    return db.all(`SELECT id, username, role, rating, win_streak, daily_streak FROM users ORDER BY ${orderBy}`);
}

export async function updateUserRole(userId, newRole) {
    const db = await getDbConnection();
    return db.run('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
}

export async function deleteUser(userId) {
    const db = await getDbConnection();
    return await db.run('DELETE FROM users WHERE id = ?', [userId]);
}

export async function resetUserPassword(userId, hashedPassword) {
    const db = await getDbConnection();
    // Мы принимаем уже готовый hashedPassword из контроллера
    const result = await db.run(
        'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
        [hashedPassword, userId]
    );
    return result.changes > 0;
}

export async function updateOwnPassword(userId, hashedPassword) {
    const db = await getDbConnection();
    // Убираем внутренний bcrypt.hash, так как хешируем в server.js
    return db.run(
        'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?',
        [hashedPassword, userId]
    );
}

export const getSolvedCountToday = async (userId) => {
    const db = await getDbConnection();
    const result = await db.get(`
        SELECT COUNT(DISTINCT puzzle_id) as count
        FROM user_puzzles
        WHERE user_id = ? AND date(solved_at) = date('now')
    `, [userId]);
    return result ? result.count : 0;
};

export const checkDailyGoalReached = async (userId) => {
    const count = await getSolvedCountToday(userId);
    return count >= 10;
};

// Сохранение текста ученика
export const saveGermanSubmission = async (studentId, teacherId, text, topic) => {
    const db = await getDbConnection();
    return await db.run(
        'INSERT INTO german_submissions (student_id, teacher_id, original_text, topic) VALUES (?, ?, ?, ?)',
        [studentId, teacherId, text, topic]
    );
};

// Получение всех работ для учителя (для тебя)
export const getSubmissionsForTeacher = async (teacherId) => {
    const db = await getDbConnection();
    return await db.all(`
        SELECT s.*, u.username as student_name
        FROM german_submissions s
        JOIN users u ON s.student_id = u.id
        WHERE s.teacher_id = ? ORDER BY s.created_at DESC
    `, [teacherId]);
};

// Обновление урока (тот самый текст, который синхронизируется)
export const updateLessonContent = async (lessonId, content) => {
    const db = await getDbConnection();
    return await db.run(
        'INSERT INTO german_lessons (lesson_id, content) VALUES (?, ?) ON CONFLICT(lesson_id) DO UPDATE SET content = ?, last_updated = CURRENT_TIMESTAMP',
        [lessonId, content, content]
    );
};

// --- РАСПИСАНИЕ ---

export const getStudentsList = async (teacherId = null) => {
    const db = await getDbConnection();
    if (teacherId) {
        return db.all(
            `SELECT u.id, u.username, COALESCE(NULLIF(u.display_name, ''), u.username) AS display_name
             FROM teacher_student_links l
             JOIN users u ON u.id = l.student_id
             WHERE l.teacher_id = ?
             ORDER BY u.username COLLATE NOCASE ASC`,
            [teacherId]
        );
    }
    return db.all(
        `SELECT id, username, COALESCE(NULLIF(display_name, ''), username) AS display_name
         FROM users WHERE role = 'student' ORDER BY username COLLATE NOCASE ASC`
    );
};

export const getScheduleLessons = async (weekStart, weekEnd, userId, role) => {
    const db = await getDbConnection();
    const lessons = await db.all(
        `SELECT l.*, u.username as teacher_name
         FROM schedule_lessons l
         JOIN users u ON u.id = l.teacher_id
         WHERE l.lesson_date >= ? AND l.lesson_date <= ?
         ORDER BY l.lesson_date, l.time_slot`,
        [weekStart, weekEnd]
    );

    const isTeacher = role === 'teacher' || role === 'admin';
    const allUsers = await db.all(`SELECT id, username FROM users`);
    const nameById = new Map(allUsers.map((u) => [Number(u.id), u.username]));

    return lessons
        .map((l) => {
            let studentIds = [];
            try {
                studentIds = typeof l.student_ids === 'string' ? JSON.parse(l.student_ids) : l.student_ids || [];
            } catch {
                studentIds = [];
            }
            const student_names = studentIds.map((id) => nameById.get(Number(id)) || `#${id}`);
            return { ...l, student_ids: studentIds, student_names };
        })
        .filter((l) => {
            if (isTeacher) return Number(l.teacher_id) === Number(userId) || role === 'admin';
            return l.student_ids.map(Number).includes(Number(userId));
        });
};

export const upsertScheduleLesson = async (teacherId, lessonDate, timeSlot, studentIds, videoUrl = '') => {
    const db = await getDbConnection();
    const idsJson = JSON.stringify(studentIds || []);
    const existing = await db.get(
        `SELECT id FROM schedule_lessons WHERE teacher_id = ? AND lesson_date = ? AND time_slot = ?`,
        [teacherId, lessonDate, timeSlot]
    );
    if (existing) {
        await db.run(`UPDATE schedule_lessons SET student_ids = ?, video_url = ? WHERE id = ?`, [
            idsJson,
            videoUrl || '',
            existing.id,
        ]);
        return existing.id;
    }
    const result = await db.run(
        `INSERT INTO schedule_lessons (teacher_id, lesson_date, time_slot, student_ids, video_url) VALUES (?, ?, ?, ?, ?)`,
        [teacherId, lessonDate, timeSlot, idsJson, videoUrl || '']
    );
    return result.lastID;
};

export const updateScheduleLessonMeta = async (lessonId, teacherId, studentIds, videoUrl, isAdmin = false) => {
    const db = await getDbConnection();
    const lesson = await db.get(`SELECT * FROM schedule_lessons WHERE id = ?`, [lessonId]);
    if (!lesson) return null;
    if (!isAdmin && Number(lesson.teacher_id) !== Number(teacherId)) return null;
    await db.run(`UPDATE schedule_lessons SET student_ids = ?, video_url = ? WHERE id = ?`, [
        JSON.stringify(studentIds || []),
        videoUrl || '',
        lessonId,
    ]);
    return lessonId;
};

export const updateScheduleLessonById = async (lessonId, teacherId, studentIds, isAdmin = false) => {
    const db = await getDbConnection();
    const lesson = await db.get(`SELECT * FROM schedule_lessons WHERE id = ?`, [lessonId]);
    if (!lesson) return null;
    if (!isAdmin && Number(lesson.teacher_id) !== Number(teacherId)) return null;
    await db.run(`UPDATE schedule_lessons SET student_ids = ? WHERE id = ?`, [
        JSON.stringify(studentIds || []),
        lessonId,
    ]);
    return lessonId;
};

export const deleteScheduleLesson = async (lessonId, teacherId, isAdmin = false) => {
    const db = await getDbConnection();
    const lesson = await db.get(`SELECT * FROM schedule_lessons WHERE id = ?`, [lessonId]);
    if (!lesson) return false;
    if (!isAdmin && Number(lesson.teacher_id) !== Number(teacherId)) return false;
    await db.run(`DELETE FROM schedule_lessons WHERE id = ?`, [lessonId]);
    return true;
};

export const createScheduleRequest = async (studentId, lessonDate, timeSlot, teacherId = null) => {
    const db = await getDbConnection();
    const existing = await db.get(
        `SELECT id FROM schedule_requests
         WHERE student_id = ? AND lesson_date = ? AND time_slot = ? AND status = 'pending'`,
        [studentId, lessonDate, timeSlot]
    );
    if (existing) return { ok: false, message: 'Заявка уже отправлена' };

    await db.run(
        `INSERT INTO schedule_requests (student_id, teacher_id, lesson_date, time_slot, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [studentId, teacherId, lessonDate, timeSlot]
    );
    return { ok: true };
};

export const getPendingScheduleRequests = async (teacherId, isAdmin = false) => {
    const db = await getDbConnection();
    if (isAdmin) {
        return db.all(
            `SELECT r.*, u.username as student_name
             FROM schedule_requests r
             JOIN users u ON u.id = r.student_id
             WHERE r.status = 'pending'
             ORDER BY r.created_at DESC`
        );
    }
    return db.all(
        `SELECT r.*, u.username as student_name
         FROM schedule_requests r
         JOIN users u ON u.id = r.student_id
         WHERE r.status = 'pending' AND (r.teacher_id IS NULL OR r.teacher_id = ?)
         ORDER BY r.created_at DESC`,
        [teacherId]
    );
};

export const approveScheduleRequest = async (requestId, teacherId, isAdmin = false) => {
    const db = await getDbConnection();
    const req = await db.get(`SELECT * FROM schedule_requests WHERE id = ? AND status = 'pending'`, [requestId]);
    if (!req) return { ok: false, message: 'Заявка не найдена' };
    if (!isAdmin && req.teacher_id && Number(req.teacher_id) !== Number(teacherId)) {
        return { ok: false, message: 'Нет доступа' };
    }

    const ownerId = isAdmin && req.teacher_id ? req.teacher_id : teacherId;
    const existing = await db.get(
        `SELECT * FROM schedule_lessons WHERE teacher_id = ? AND lesson_date = ? AND time_slot = ?`,
        [ownerId, req.lesson_date, req.time_slot]
    );

    let studentIds = [];
    if (existing) {
        try {
            studentIds = JSON.parse(existing.student_ids || '[]');
        } catch {
            studentIds = [];
        }
        if (!studentIds.map(Number).includes(Number(req.student_id))) {
            studentIds.push(req.student_id);
        }
        await db.run(`UPDATE schedule_lessons SET student_ids = ? WHERE id = ?`, [
            JSON.stringify(studentIds),
            existing.id,
        ]);
    } else {
        await db.run(
            `INSERT INTO schedule_lessons (teacher_id, lesson_date, time_slot, student_ids) VALUES (?, ?, ?, ?)`,
            [ownerId, req.lesson_date, req.time_slot, JSON.stringify([req.student_id])]
        );
    }

    await db.run(`UPDATE schedule_requests SET status = 'approved', teacher_id = ? WHERE id = ?`, [
        ownerId,
        requestId,
    ]);
    return { ok: true };
};

export const rejectScheduleRequest = async (requestId, teacherId, isAdmin = false) => {
    const db = await getDbConnection();
    const req = await db.get(`SELECT * FROM schedule_requests WHERE id = ? AND status = 'pending'`, [requestId]);
    if (!req) return false;
    if (!isAdmin && req.teacher_id && Number(req.teacher_id) !== Number(teacherId)) return false;
    await db.run(`UPDATE schedule_requests SET status = 'rejected' WHERE id = ?`, [requestId]);
    return true;
};

// --- ЗАМЕТКИ НА ВКЛАДКЕ УЧЕБНОЙ КОМНАТЫ ---

export const updateTabNotes = async (roomCode, tabId, notes) => {
    const db = await getDbConnection();
    const room = await db.get('SELECT tabs FROM study_rooms WHERE room_code = ?', [roomCode]);
    if (!room?.tabs) return;
    let tabs = JSON.parse(room.tabs);
    tabs = tabs.map((t) => (t.id === tabId ? { ...t, notes: notes || '' } : t));
    await db.run('UPDATE study_rooms SET tabs = ? WHERE room_code = ?', [JSON.stringify(tabs), roomCode]);
};

// --- ДОМАШНИЕ ЗАДАНИЯ ---

export const createHomework = async (data) => {
    const db = await getDbConnection();
    const result = await db.run(
        `INSERT INTO homework_assignments
         (teacher_id, student_id, room_code, title, fen, pgn, instructions, due_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.teacherId,
            data.studentId,
            data.roomCode || null,
            data.title,
            data.fen,
            data.pgn || '',
            data.instructions || '',
            data.dueDate,
        ]
    );
    return result.lastID;
};

export const getHomeworkForStudent = async (studentId) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT h.*, u.username as teacher_name
         FROM homework_assignments h
         JOIN users u ON u.id = h.teacher_id
         WHERE h.student_id = ?
         ORDER BY h.due_date ASC, h.created_at DESC`,
        [studentId]
    );
};

export const getHomeworkForTeacher = async (teacherId) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT h.*, u.username as student_name
         FROM homework_assignments h
         JOIN users u ON u.id = h.student_id
         WHERE h.teacher_id = ?
         ORDER BY h.due_date ASC, h.created_at DESC`,
        [teacherId]
    );
};

export const getHomeworkById = async (id) => {
    const db = await getDbConnection();
    return db.get(
        `SELECT h.*, t.username as teacher_name, s.username as student_name
         FROM homework_assignments h
         JOIN users t ON t.id = h.teacher_id
         JOIN users s ON s.id = h.student_id
         WHERE h.id = ?`,
        [id]
    );
};

export const completeHomework = async (id, studentId) => {
    const db = await getDbConnection();
    const hw = await db.get('SELECT * FROM homework_assignments WHERE id = ? AND student_id = ?', [id, studentId]);
    if (!hw) return false;
    const today = new Date().toISOString().slice(0, 10);
    const status = hw.due_date < today ? 'late' : 'completed';
    await db.run(
        `UPDATE homework_assignments SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [status, id]
    );
    return true;
};

// --- ЖУРНАЛ УЧИТЕЛЯ ---

function parseJsonArray(val) {
    try {
        return typeof val === 'string' ? JSON.parse(val) : val || [];
    } catch {
        return [];
    }
}

function mapJournal(row) {
    if (!row) return null;
    return {
        ...row,
        topics_done: parseJsonArray(row.topics_done),
        topics_planned: parseJsonArray(row.topics_planned),
    };
}

export const getJournalEntriesForStudent = async (studentId, limit = 10) => {
    const db = await getDbConnection();
    const rows = await db.all(
        `SELECT j.*, u.username as student_name
         FROM lesson_journals j
         JOIN users u ON u.id = j.student_id
         WHERE j.student_id = ?
         ORDER BY j.lesson_date DESC, j.id DESC
         LIMIT ?`,
        [studentId, limit]
    );
    return rows.map(mapJournal);
};

export const getJournalEntries = async (teacherId, studentId = null) => {
    const db = await getDbConnection();
    let rows;
    if (studentId) {
        rows = await db.all(
            `SELECT j.*, u.username as student_name
             FROM lesson_journals j
             JOIN users u ON u.id = j.student_id
             WHERE j.teacher_id = ? AND j.student_id = ?
             ORDER BY j.lesson_date DESC, j.id DESC`,
            [teacherId, studentId]
        );
    } else {
        rows = await db.all(
            `SELECT j.*, u.username as student_name
             FROM lesson_journals j
             JOIN users u ON u.id = j.student_id
             WHERE j.teacher_id = ?
             ORDER BY j.lesson_date DESC, j.id DESC`,
            [teacherId]
        );
    }
    return rows.map(mapJournal);
};

export const getJournalEntryById = async (id) => {
    const db = await getDbConnection();
    const row = await db.get(
        `SELECT j.*, u.username as student_name, t.username as teacher_name
         FROM lesson_journals j
         JOIN users u ON u.id = j.student_id
         JOIN users t ON t.id = j.teacher_id
         WHERE j.id = ?`,
        [id]
    );
    return mapJournal(row);
};

export const getJournalByToken = async (token) => {
    const db = await getDbConnection();
    const row = await db.get(
        `SELECT j.*, u.username as student_name, t.username as teacher_name
         FROM lesson_journals j
         JOIN users u ON u.id = j.student_id
         JOIN users t ON t.id = j.teacher_id
         WHERE j.share_token = ?`,
        [token]
    );
    return mapJournal(row);
};

export const upsertJournalEntry = async (teacherId, data) => {
    const db = await getDbConnection();
    const topicsDone = JSON.stringify(data.topicsDone || []);
    const topicsPlanned = JSON.stringify(data.topicsPlanned || []);

    if (data.id) {
        const existing = await db.get('SELECT * FROM lesson_journals WHERE id = ? AND teacher_id = ?', [
            data.id,
            teacherId,
        ]);
        if (!existing) return null;
        await db.run(
            `UPDATE lesson_journals SET
             student_id = ?, lesson_date = ?, room_code = ?, title = ?, content = ?,
             topics_done = ?, topics_planned = ?, parent_message = ?, parent_email = ?,
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                data.studentId,
                data.lessonDate,
                data.roomCode || null,
                data.title || '',
                data.content || '',
                topicsDone,
                topicsPlanned,
                data.parentMessage || '',
                data.parentEmail || '',
                data.id,
            ]
        );
        return data.id;
    }

    const result = await db.run(
        `INSERT INTO lesson_journals
         (teacher_id, student_id, lesson_date, room_code, title, content, topics_done, topics_planned, parent_message, parent_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            teacherId,
            data.studentId,
            data.lessonDate,
            data.roomCode || null,
            data.title || '',
            data.content || '',
            topicsDone,
            topicsPlanned,
            data.parentMessage || '',
            data.parentEmail || '',
        ]
    );
    return result.lastID;
};

export const ensureJournalShareToken = async (journalId, teacherId) => {
    const db = await getDbConnection();
    const entry = await db.get('SELECT * FROM lesson_journals WHERE id = ? AND teacher_id = ?', [
        journalId,
        teacherId,
    ]);
    if (!entry) return null;
    if (entry.share_token) return entry.share_token;
    const token = `jr_${journalId}_${Date.now().toString(36)}`;
    await db.run('UPDATE lesson_journals SET share_token = ? WHERE id = ?', [token, journalId]);
    return token;
};

export const markJournalSentToParents = async (journalId) => {
    const db = await getDbConnection();
    await db.run(
        `UPDATE lesson_journals SET sent_to_parents_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [journalId]
    );
};

// --- ПЛАН ОБУЧЕНИЯ ---

export const getPlanItems = async (teacherId, studentId, fromDate, toDate) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT * FROM student_plan_items
         WHERE teacher_id = ? AND student_id = ? AND plan_date >= ? AND plan_date <= ?
         ORDER BY plan_date ASC, sort_order ASC, id ASC`,
        [teacherId, studentId, fromDate, toDate]
    );
};

export const upsertPlanItem = async (teacherId, data) => {
    const db = await getDbConnection();
    if (data.id) {
        const existing = await db.get('SELECT * FROM student_plan_items WHERE id = ? AND teacher_id = ?', [
            data.id,
            teacherId,
        ]);
        if (!existing) return null;
        await db.run(
            `UPDATE student_plan_items SET
             student_id = ?, plan_date = ?, title = ?, description = ?, status = ?, sort_order = ?
             WHERE id = ?`,
            [
                data.studentId,
                data.planDate,
                data.title,
                data.description || '',
                data.status || 'planned',
                data.sortOrder || 0,
                data.id,
            ]
        );
        return data.id;
    }
    const result = await db.run(
        `INSERT INTO student_plan_items (teacher_id, student_id, plan_date, title, description, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            teacherId,
            data.studentId,
            data.planDate,
            data.title,
            data.description || '',
            data.status || 'planned',
            data.sortOrder || 0,
        ]
    );
    return result.lastID;
};

export const deletePlanItem = async (id, teacherId) => {
    const db = await getDbConnection();
    const result = await db.run('DELETE FROM student_plan_items WHERE id = ? AND teacher_id = ?', [id, teacherId]);
    return result.changes > 0;
};

// --- УВЕДОМЛЕНИЯ ---

export const createNotification = async (userId, type, title, body, payload = {}) => {
    const db = await getDbConnection();
    const result = await db.run(
        `INSERT INTO notifications (user_id, type, title, body, payload) VALUES (?, ?, ?, ?, ?)`,
        [userId, type, title, body, JSON.stringify(payload)]
    );
    return result.lastID;
};

export const getNotifications = async (userId, limit = 30) => {
    const db = await getDbConnection();
    const rows = await db.all(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        [userId, limit]
    );
    return rows.map((r) => ({
        ...r,
        read: r.read_flag === 1,
        payload: (() => {
            try {
                return JSON.parse(r.payload || '{}');
            } catch {
                return {};
            }
        })(),
    }));
};

export const getUnreadNotificationCount = async (userId) => {
    const db = await getDbConnection();
    const row = await db.get(
        `SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND read_flag = 0`,
        [userId]
    );
    return row?.c || 0;
};

export const markNotificationRead = async (id, userId) => {
    const db = await getDbConnection();
    await db.run('UPDATE notifications SET read_flag = 1 WHERE id = ? AND user_id = ?', [id, userId]);
};

export const markAllNotificationsRead = async (userId) => {
    const db = await getDbConnection();
    await db.run('UPDATE notifications SET read_flag = 1 WHERE user_id = ?', [userId]);
};

export const updateUserSettings = async (userId, settings) => {
    const db = await getDbConnection();
    const fields = [];
    const values = [];
    if (settings.parentEmail !== undefined) {
        fields.push('parent_email = ?');
        values.push(settings.parentEmail);
    }
    if (settings.onboardingDone !== undefined) {
        fields.push('onboarding_done = ?');
        values.push(settings.onboardingDone ? 1 : 0);
    }
    if (settings.theme !== undefined) {
        fields.push('theme = ?');
        values.push(settings.theme);
    }
    if (settings.notifyEmail !== undefined) {
        fields.push('notify_email = ?');
        values.push(settings.notifyEmail ? 1 : 0);
    }
    if (settings.notifyPush !== undefined) {
        fields.push('notify_push = ?');
        values.push(settings.notifyPush ? 1 : 0);
    }
    if (settings.tzPrimary !== undefined) {
        fields.push('tz_primary = ?');
        values.push(settings.tzPrimary);
    }
    if (settings.tzSecondary !== undefined) {
        fields.push('tz_secondary = ?');
        values.push(settings.tzSecondary);
    }
    if (settings.displayName !== undefined) {
        fields.push('display_name = ?');
        values.push(String(settings.displayName).replace(/<\/?[^>]+(>|$)/g, '').trim().slice(0, 64));
    }
    if (settings.username !== undefined) {
        const un = String(settings.username).replace(/<\/?[^>]+(>|$)/g, '').trim();
        if (un.length < 3 || un.length > 24 || !/^[a-zA-Z0-9_]+$/.test(un)) {
            const err = new Error('username_invalid');
            err.code = 'username_invalid';
            throw err;
        }
        const existing = await db.get('SELECT id FROM users WHERE username = ? AND id != ?', [un, userId]);
        if (existing) {
            const err = new Error('username_taken');
            err.code = 'username_taken';
            throw err;
        }
        fields.push('username = ?');
        values.push(un);
    }
    if (!fields.length) return;
    values.push(userId);
    await db.run(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const getUpcomingLessonsForUser = async (userId, role, daysAhead = 1) => {
    const db = await getDbConnection();
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + daysAhead);
    const from = today.toISOString().slice(0, 10);
    const to = end.toISOString().slice(0, 10);

    const lessons = await db.all(
        `SELECT l.*, u.username as teacher_name
         FROM schedule_lessons l
         JOIN users u ON u.id = l.teacher_id
         WHERE l.lesson_date >= ? AND l.lesson_date <= ?
         ORDER BY l.lesson_date, l.time_slot`,
        [from, to]
    );

    const isTeacher = role === 'teacher' || role === 'admin';
    return lessons.filter((l) => {
        let studentIds = [];
        try {
            studentIds = JSON.parse(l.student_ids || '[]');
        } catch {
            studentIds = [];
        }
        if (isTeacher) return Number(l.teacher_id) === Number(userId) || role === 'admin';
        return studentIds.map(Number).includes(Number(userId));
    });
};

// --- ШАБЛОНЫ УРОКОВ ---

export const getLessonTemplates = async (teacherId) => {
    const db = await getDbConnection();
    const rows = await db.all(
        `SELECT * FROM lesson_templates WHERE teacher_id = ? ORDER BY created_at DESC`,
        [teacherId]
    );
    return rows.map((r) => ({
        ...r,
        tabs: (() => {
            try {
                return JSON.parse(r.tabs || '[]');
            } catch {
                return [];
            }
        })(),
    }));
};

export const saveLessonTemplate = async (teacherId, data) => {
    const db = await getDbConnection();
    const tabsJson = JSON.stringify(data.tabs || []);
    if (data.id) {
        await db.run(
            `UPDATE lesson_templates SET name = ?, tabs = ?, notes = ? WHERE id = ? AND teacher_id = ?`,
            [data.name, tabsJson, data.notes || '', data.id, teacherId]
        );
        return data.id;
    }
    const result = await db.run(
        `INSERT INTO lesson_templates (teacher_id, name, tabs, notes) VALUES (?, ?, ?, ?)`,
        [teacherId, data.name, tabsJson, data.notes || '']
    );
    return result.lastID;
};

export const deleteLessonTemplate = async (id, teacherId) => {
    const db = await getDbConnection();
    const result = await db.run(`DELETE FROM lesson_templates WHERE id = ? AND teacher_id = ?`, [id, teacherId]);
    return result.changes > 0;
};

// --- АРХИВ PGN ---

export const savePgnArchive = async (data) => {
    const db = await getDbConnection();
    const result = await db.run(
        `INSERT INTO lesson_pgn_archive (teacher_id, student_id, room_code, title, pgn, fen, lesson_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.teacherId,
            data.studentId || null,
            data.roomCode || null,
            data.title || '',
            data.pgn || '',
            data.fen || '',
            data.lessonDate || new Date().toISOString().slice(0, 10),
        ]
    );
    return result.lastID;
};

export const getPgnArchive = async (userId, role, studentId = null) => {
    const db = await getDbConnection();
    if (role === 'teacher' || role === 'admin') {
        if (studentId) {
            return db.all(
                `SELECT a.*, u.username as student_name FROM lesson_pgn_archive a
                 LEFT JOIN users u ON u.id = a.student_id
                 WHERE a.teacher_id = ? AND a.student_id = ? ORDER BY a.created_at DESC LIMIT 100`,
                [userId, studentId]
            );
        }
        return db.all(
            `SELECT a.*, u.username as student_name FROM lesson_pgn_archive a
             LEFT JOIN users u ON u.id = a.student_id
             WHERE a.teacher_id = ? ORDER BY a.created_at DESC LIMIT 100`,
            [userId]
        );
    }
    return db.all(
        `SELECT a.*, t.username as teacher_name FROM lesson_pgn_archive a
         LEFT JOIN users t ON t.id = a.teacher_id
         WHERE a.student_id = ? ORDER BY a.created_at DESC LIMIT 100`,
        [userId]
    );
};

// --- ПРОГРЕСС УЧЕНИКА ПО ТЕМАМ ---

export const getStudentTopicProgress = async (studentId) => {
    const db = await getDbConnection();
    const entries = await db.all(
        `SELECT topics_done, topics_planned FROM lesson_journals WHERE student_id = ?`,
        [studentId]
    );
    const done = new Set();
    const planned = new Set();
    for (const e of entries) {
        try {
            JSON.parse(e.topics_done || '[]').forEach((t) => done.add(t));
            JSON.parse(e.topics_planned || '[]').forEach((t) => {
                if (!done.has(t)) planned.add(t);
            });
        } catch {
            /* ignore */
        }
    }
    const hwTotal = await db.get(
        `SELECT COUNT(*) as c FROM homework_assignments WHERE student_id = ?`,
        [studentId]
    );
    const hwDone = await db.get(
        `SELECT COUNT(*) as c FROM homework_assignments WHERE student_id = ? AND status IN ('completed','late')`,
        [studentId]
    );
    return {
        topicsDone: [...done],
        topicsPlanned: [...planned].filter((t) => !done.has(t)),
        homeworkTotal: hwTotal?.c || 0,
        homeworkDone: hwDone?.c || 0,
    };
};

// --- КАЛЕНДАРЬ УЧЕНИКА ---

export const getStudentCalendar = async (studentId, from, to) => {
    const db = await getDbConnection();
    const allLessons = await db.all(
        `SELECT l.*, u.username as teacher_name FROM schedule_lessons l
         JOIN users u ON u.id = l.teacher_id
         WHERE l.lesson_date >= ? AND l.lesson_date <= ?`,
        [from, to]
    );
    const lessons = allLessons.filter((l) => {
        try {
            return JSON.parse(l.student_ids || '[]').map(Number).includes(Number(studentId));
        } catch {
            return false;
        }
    });
    const homework = await db.all(
        `SELECT h.*, u.username as teacher_name FROM homework_assignments h
         JOIN users u ON u.id = h.teacher_id
         WHERE h.student_id = ? AND h.due_date >= ? AND h.due_date <= ?
         ORDER BY h.due_date`,
        [studentId, from, to]
    );
    return { lessons, homework };
};

// --- ЕЖЕНЕДЕЛЬНЫЕ ОТЧЁТЫ РОДИТЕЛЯМ ---

export const getWeeklyReportData = async (teacherId, studentId, weekStart) => {
    const db = await getDbConnection();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const to = weekEnd.toISOString().slice(0, 10);
    const entries = await db.all(
        `SELECT * FROM lesson_journals
         WHERE teacher_id = ? AND student_id = ? AND lesson_date >= ? AND lesson_date <= ?
         ORDER BY lesson_date`,
        [teacherId, studentId, weekStart, to]
    );
    const progress = await getStudentTopicProgress(studentId);
    const student = await db.get(`SELECT username, parent_email FROM users WHERE id = ?`, [studentId]);
    return { entries: entries.map(mapJournal), progress, student };
};

export const markWeeklyReportSent = async (teacherId, studentId, weekStart) => {
    const db = await getDbConnection();
    await db.run(
        `INSERT OR IGNORE INTO weekly_parent_reports (teacher_id, student_id, week_start) VALUES (?, ?, ?)`,
        [teacherId, studentId, weekStart]
    );
};

export const getStudentsForWeeklyReports = async (teacherId) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT DISTINCT j.student_id, u.username, u.parent_email
         FROM lesson_journals j JOIN users u ON u.id = j.student_id
         WHERE j.teacher_id = ?`,
        [teacherId]
    );
};

// --- ГРУППОВОЙ КЛАСС ---

const EMPTY_BOARD = { fen: '', pgn: '', customHistory: [], shapes: [] };

export const joinGroupStudent = async (roomCode, studentId) => {
    const db = await getDbConnection();
    const room = await db.get(`SELECT * FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!room || room.room_type !== 'group') return false;
    let ids = [];
    try {
        ids = JSON.parse(room.group_student_ids || '[]');
    } catch {
        ids = [];
    }
    if (!ids.map(Number).includes(Number(studentId))) ids.push(studentId);
    let boards = {};
    try {
        boards = JSON.parse(room.student_boards || '{}');
    } catch {
        boards = {};
    }
    if (!boards[studentId]) boards[studentId] = { ...EMPTY_BOARD, fen: room.exercise_fen || '' };
    await db.run(`UPDATE study_rooms SET group_student_ids = ?, student_boards = ? WHERE room_code = ?`, [
        JSON.stringify(ids),
        JSON.stringify(boards),
        roomCode,
    ]);
    if (room.teacher_id) {
        await linkStudentToTeacher(room.teacher_id, studentId);
    }
    return true;
};

export const updateGroupStudentBoard = async (roomCode, studentId, boardData) => {
    const db = await getDbConnection();
    const room = await db.get(`SELECT student_boards FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!room) return;
    let boards = {};
    try {
        boards = JSON.parse(room.student_boards || '{}');
    } catch {
        boards = {};
    }
    boards[studentId] = { ...boards[studentId], ...boardData };
    await db.run(`UPDATE study_rooms SET student_boards = ? WHERE room_code = ?`, [
        JSON.stringify(boards),
        roomCode,
    ]);
};

export const setGroupExercise = async (roomCode, fen) => {
    const db = await getDbConnection();
    const room = await db.get(`SELECT group_student_ids, student_boards FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!room) return;
    let boards = {};
    try {
        boards = JSON.parse(room.student_boards || '{}');
    } catch {
        boards = {};
    }
    let ids = [];
    try {
        ids = JSON.parse(room.group_student_ids || '[]');
    } catch {
        ids = [];
    }
    for (const sid of ids) {
        boards[sid] = { fen, pgn: '', customHistory: [], shapes: [] };
    }
    await db.run(
        `UPDATE study_rooms SET exercise_fen = ?, student_boards = ?, broadcast_active = 0 WHERE room_code = ?`,
        [fen, JSON.stringify(boards), roomCode]
    );
};

export const setGroupBroadcast = async (roomCode, fen, active) => {
    const db = await getDbConnection();
    await db.run(`UPDATE study_rooms SET broadcast_fen = ?, broadcast_active = ? WHERE room_code = ?`, [
        fen || '',
        active ? 1 : 0,
        roomCode,
    ]);
};

export const setGroupPairings = async (roomCode, pairingState) => {
    const db = await getDbConnection();
    await db.run(`UPDATE study_rooms SET pairing_state = ? WHERE room_code = ?`, [
        JSON.stringify(pairingState),
        roomCode,
    ]);
};

export const parseGroupRoom = (room) => {
    if (!room) return null;
    const parse = (v, fb) => {
        try {
            return typeof v === 'string' ? JSON.parse(v) : v ?? fb;
        } catch {
            return fb;
        }
    };
    const pairing = parse(room.pairing_state, {});
    const pairs = (pairing.pairs || []).map((p) => {
        if (Array.isArray(p)) return { a: p[0], b: p[1] ?? null, gameId: null, result: p[1] ? null : 'BYE' };
        return p;
    });
    return {
        ...room,
        group_student_ids: parse(room.group_student_ids, []).map(Number),
        student_boards: parse(room.student_boards, {}),
        pairing_state: { round: pairing.round || 0, pairs, history: pairing.history || [], standings: pairing.standings || {} },
        broadcast_active: !!room.broadcast_active,
        poll_state: room.poll_state ? (() => { try { return JSON.parse(room.poll_state); } catch { return null; } })() : null,
        student_names: parse(room._student_names, {}),
    };
};

export const enrichGroupRoom = async (room) => {
    const parsed = parseGroupRoom(room);
    if (!parsed) return null;
    const db = await getDbConnection();
    const ids = [...new Set([...parsed.group_student_ids, Number(parsed.teacher_id)].filter(Boolean))];
    const names = {};
    for (const id of ids) {
        const u = await db.get('SELECT id, username FROM users WHERE id = ?', [id]);
        if (u) names[u.id] = u.username;
    }
    parsed.student_names = names;
    return parsed;
};

export const updateGroupPairingGame = async (roomCode, pairIndex, gameId, result) => {
    const db = await getDbConnection();
    const room = await db.get(`SELECT pairing_state FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!room) return;
    let state = {};
    try {
        state = JSON.parse(room.pairing_state || '{}');
    } catch {
        state = {};
    }
    const pairs = state.pairs || [];
    if (pairs[pairIndex]) {
        pairs[pairIndex] = { ...pairs[pairIndex], gameId: gameId || pairs[pairIndex].gameId, result: result ?? pairs[pairIndex].result };
    }
    state.pairs = pairs;
    await db.run(`UPDATE study_rooms SET pairing_state = ? WHERE room_code = ?`, [JSON.stringify(state), roomCode]);
    return state;
};

export const applyGroupGameStandings = async (roomCode, pairIndex, { winnerId, loserId, draw }) => {
    const db = await getDbConnection();
    const room = await db.get(`SELECT pairing_state FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!room) return null;
    let state = {};
    try {
        state = JSON.parse(room.pairing_state || '{}');
    } catch {
        state = {};
    }
    const pair = state.pairs?.[pairIndex];
    if (!pair) return state;
    const standings = state.standings || {};
    const add = (id, pts) => {
        if (id == null) return;
        const k = String(id);
        standings[k] = (standings[k] || 0) + pts;
    };
    if (draw) {
        add(pair.a, 0.5);
        add(pair.b, 0.5);
    } else if (winnerId) {
        add(winnerId, 1);
    }
    state.standings = standings;
    await db.run(`UPDATE study_rooms SET pairing_state = ? WHERE room_code = ?`, [JSON.stringify(state), roomCode]);
    return state;
};

export const generateGroupPairings = async (roomCode) => {
    const db = await getDbConnection();
    const room = await db.get(`SELECT group_student_ids, pairing_state FROM study_rooms WHERE room_code = ?`, [roomCode]);
    if (!room) return null;
    let ids = [];
    try {
        ids = JSON.parse(room.group_student_ids || '[]').map(Number);
    } catch {
        ids = [];
    }
    let state = {};
    try {
        state = JSON.parse(room.pairing_state || '{}');
    } catch {
        state = {};
    }
    const history = state.history || [];
    const played = new Set(history.flat().filter(Boolean).map(String));
    const round = (state.round || 0) + 1;
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const pairs = [];
    const used = new Set();
    for (const id of shuffled) {
        if (used.has(id)) continue;
        let opponent = shuffled.find(
            (oid) => oid !== id && !used.has(oid) && !history.some((h) => h.includes(id) && h.includes(oid))
        );
        if (!opponent) {
            opponent = shuffled.find((oid) => oid !== id && !used.has(oid));
        }
        if (opponent) {
            pairs.push({ a: id, b: opponent, gameId: null, result: null });
            history.push([id, opponent]);
            used.add(id);
            used.add(opponent);
        } else {
            pairs.push({ a: id, b: null, gameId: null, result: 'BYE' });
            used.add(id);
        }
    }
    state = { ...state, round, pairs, history, standings: state.standings || {} };
    for (const p of pairs) {
        if (p.result === 'BYE') {
            state.standings[String(p.a)] = (state.standings[String(p.a)] || 0) + 1;
        }
    }
    await db.run(`UPDATE study_rooms SET pairing_state = ? WHERE room_code = ?`, [JSON.stringify(state), roomCode]);
    return state;
};

export const getTournamentSchedule = async () => {
    const db = await getDbConnection();
    return db.all(`SELECT * FROM tournament_schedule ORDER BY sort_order ASC, starts_at ASC`);
};

export const getTournamentById = async (id) => {
    const db = await getDbConnection();
    return db.get(`SELECT * FROM tournament_schedule WHERE id = ?`, [id]);
};

export const getAllUserIds = async () => {
    const db = await getDbConnection();
    return db.all('SELECT id FROM users');
};

export const getLessonsInMinutesWindow = async (minFrom, minTo) => {
    const db = await getDbConnection();
    const lessons = await db.all(`SELECT l.*, u.username as teacher_name FROM schedule_lessons l JOIN users u ON u.id = l.teacher_id`);
    const now = new Date();
    return lessons.filter((l) => {
        const [y, mo, d] = l.lesson_date.split('-').map(Number);
        const [h, mi] = l.time_slot.split(':').map(Number);
        const start = new Date(y, mo - 1, d, h, mi);
        const diffMin = (start - now) / 60000;
        return diffMin >= minFrom && diffMin <= minTo;
    });
};

export const getTournamentsInMinutesWindow = async (minFrom, minTo) => {
    const db = await getDbConnection();
    const rows = await db.all(`SELECT * FROM tournament_schedule WHERE status IN ('registration','scheduled','running')`);
    const now = Date.now();
    return rows.filter((t) => {
        const diffMin = (new Date(t.starts_at).getTime() - now) / 60000;
        return diffMin >= minFrom && diffMin <= minTo;
    });
};

// --- ПРОФИЛЬ / ДАШБОРД ---

export const getStudentHomeworkSummary = async (studentId) => {
    const db = await getDbConnection();
    const today = new Date().toISOString().slice(0, 10);
    const pending = await db.get(
        `SELECT COUNT(*) as c FROM homework_assignments WHERE student_id = ? AND status = 'pending'`,
        [studentId]
    );
    const overdue = await db.get(
        `SELECT COUNT(*) as c FROM homework_assignments WHERE student_id = ? AND status = 'pending' AND due_date < ?`,
        [studentId, today]
    );
    const latest = await db.get(
        `SELECT h.*, u.username as teacher_name
         FROM homework_assignments h
         JOIN users u ON u.id = h.teacher_id
         WHERE h.student_id = ? AND h.status = 'pending'
         ORDER BY h.due_date ASC LIMIT 1`,
        [studentId]
    );
    return { pending: pending?.c || 0, overdue: overdue?.c || 0, latest: latest || null };
};

export const getNextLessonForStudent = async (studentId) => {
    const db = await getDbConnection();
    const today = new Date().toISOString().slice(0, 10);
    const lessons = await db.all(
        `SELECT l.*, u.username as teacher_name,
                COALESCE(NULLIF(u.display_name, ''), u.username) as teacher_display
         FROM schedule_lessons l
         JOIN users u ON u.id = l.teacher_id
         WHERE l.lesson_date >= ?
         ORDER BY l.lesson_date, l.time_slot
         LIMIT 80`,
        [today]
    );
    for (const lesson of lessons) {
        try {
            const ids = JSON.parse(lesson.student_ids || '[]').map(Number);
            if (ids.includes(Number(studentId))) return lesson;
        } catch {
            /* ignore */
        }
    }
    return null;
};

export const getTodayLessonsForTeacher = async (teacherId) => {
    const db = await getDbConnection();
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.all(
        `SELECT * FROM schedule_lessons WHERE teacher_id = ? AND lesson_date = ? ORDER BY time_slot`,
        [teacherId, today]
    );
    return rows.map((row) => {
        let studentIds = [];
        try {
            studentIds = JSON.parse(row.student_ids || '[]');
        } catch {
            studentIds = [];
        }
        return { ...row, studentIds };
    });
};

export const getTeacherStudentSnapshots = async (teacherId) => {
    const db = await getDbConnection();
    const students = await getTeacherStudents(teacherId);
    const snapshots = [];
    for (const st of students) {
        const pendingHw = await db.get(
            `SELECT COUNT(*) as c FROM homework_assignments
             WHERE student_id = ? AND teacher_id = ? AND status = 'pending'`,
            [st.id, teacherId]
        );
        const lastJournal = await db.get(
            `SELECT lesson_date FROM lesson_journals
             WHERE student_id = ? AND teacher_id = ?
             ORDER BY lesson_date DESC LIMIT 1`,
            [st.id, teacherId]
        );
        const progress = await getStudentTopicProgress(st.id);
        snapshots.push({
            ...st,
            pendingHomework: pendingHw?.c || 0,
            lastLessonDate: lastJournal?.lesson_date || null,
            weakTopicsCount: progress.topicsPlanned?.length || 0,
        });
    }
    return snapshots;
};

export const getTeacherHomeworkPendingTotal = async (teacherId) => {
    const db = await getDbConnection();
    const row = await db.get(
        `SELECT COUNT(*) as c FROM homework_assignments WHERE teacher_id = ? AND status = 'pending'`,
        [teacherId]
    );
    return row?.c || 0;
};

export const getPuzzleStatusForUser = async (userId) => {
    await checkAndResetStreak(userId);
    const user = await findUserById(userId);
    const solvedToday = await getSolvedCountToday(userId);
    return {
        solvedToday: solvedToday || 0,
        streak: user?.daily_streak || 0,
        completedToday: solvedToday >= 10,
        canRestore: user?.daily_streak === 0 && (user?.previous_streak || 0) > 0,
        previousStreak: user?.previous_streak || 0,
    };
};

const RESULT_WIN = new Set(['Победа', 'Win']);
const RESULT_DRAW = new Set(['Ничья', 'Draw']);
const RESULT_LOSS = new Set(['Поражение', 'Loss']);

export const getPlayerGameHistory = async (userId, limit = 10) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT
            CASE WHEN g.player1_id = ? THEN u2.username ELSE u1.username END as opponent,
            g.result,
            g.game_type as type,
            g.date,
            g.id
        FROM games g
        LEFT JOIN users u1 ON g.player1_id = u1.id
        LEFT JOIN users u2 ON g.player2_id = u2.id
        WHERE g.player1_id = ? OR g.player2_id = ?
        ORDER BY g.id DESC
        LIMIT ?`,
        [userId, userId, userId, limit]
    );
};

export function summarizePlayerForm(games = []) {
    let wins = 0;
    let draws = 0;
    let losses = 0;
    for (const game of games) {
        if (RESULT_WIN.has(game.result)) wins += 1;
        else if (RESULT_DRAW.has(game.result)) draws += 1;
        else if (RESULT_LOSS.has(game.result)) losses += 1;
    }
    const total = games.length;
    return {
        wins,
        draws,
        losses,
        total,
        winRate: total ? Math.round((wins / total) * 100) : 0,
    };
}

export function buildRatingSparkline(currentRating, games = []) {
    const rating = Number(currentRating) || 0;
    if (!games.length) return [rating];
    const deltas = {
        Победа: -15,
        Win: -15,
        Поражение: 10,
        Loss: 10,
        Ничья: -5,
        Draw: -5,
    };
    let cursor = rating;
    const points = [cursor];
    for (const game of games) {
        cursor += deltas[game.result] ?? 0;
        points.unshift(Math.max(0, cursor));
    }
    return points.slice(-12);
}

export function pickPlayerFunTitle(user, puzzleStreak = 0) {
    const rating = Number(user?.rating) || 0;
    const winStreak = Number(user?.win_streak) || 0;
    const dailyStreak = Number(user?.daily_streak) || 0;
    if (winStreak >= 5) return 'player_title_unstoppable';
    if (dailyStreak >= 7 || puzzleStreak >= 7) return 'player_title_puzzle_king';
    if (rating >= 4500) return 'player_title_master';
    if (rating >= 2500) return 'player_title_sniper';
    if (rating >= 1500) return 'player_title_fighter';
    return 'player_title_rising';
}

export const getFeaturedTournaments = async (limit = 4) => {
    const db = await getDbConnection();
    return db.all(
        `SELECT id, name, description, status, starts_at, time_control, league, demo_players, max_players
         FROM tournament_schedule
         WHERE status IN ('registration', 'scheduled', 'running')
         ORDER BY
            CASE status WHEN 'running' THEN 0 WHEN 'registration' THEN 1 ELSE 2 END,
            starts_at ASC
         LIMIT ?`,
        [limit]
    );
};
