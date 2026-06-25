let board = null;
let game = new Chess();
let currentPuzzle = null;
let solvedCount = 0; // Реально решенные за сегодня
let puzzlesAttempted = 0; // Попыток в текущей сессии (до 10)
const TOTAL_PUZZLES = 10;
let timeLeft = 60;
let timerId = null;
let lozzaWorker = null;

let failedPuzzles = [];
let isReviewMode = false;

$(document).ready(function() {
    initBoard();
    initEngine();
    // UX: Не ждем клика, сразу проверяем статус и запускаем
    startDailySession();

    $('#description').css('cursor', 'pointer').on('click', getHint);
});

function initEngine() {
    try {
        lozzaWorker = new Worker('/js/stockfish/lozza.js');
        lozzaWorker.onmessage = function(e) {
            if (e.data.includes('bestmove')) {
                const bestMove = e.data.split(' ')[1];
                $('#description').html(`💡 <b>Подсказка:</b> лучший ход — <b>${bestMove}</b>`);
                showHintOnBoard(bestMove);
            }
        };
        lozzaWorker.postMessage('uci');
    } catch (e) { console.warn("Engine offline"); }
}

function initBoard() {
    board = Chessboard('board', {
        draggable: true,
        dropOffBoard: 'snapback',
        onDragStart: onDragStart,
        onDrop: onDrop,
        position: 'start',
        orientation: 'white',
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
    });
}

function startTimer() {
    if (timerId) clearInterval(timerId);
    timeLeft = 60;
    updateTimerDisplay();
    timerId = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) handleFailure("Время вышло!");
    }, 1000);
}

function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const sec = (timeLeft % 60).toString().padStart(2, '0');
    $('#timer').text(`${min}:${sec}`);
}

async function startDailySession() {
    try {
        const res = await fetch('/api/user/puzzle-status');
        const data = await res.json();

        // Если норма уже выполнена, уведомляем и уходим в лобби
        if (data.completedToday) {
            Swal.fire('Норма выполнена!', 'Вы уже решили 10 задач сегодня.', 'info')
                .then(() => { window.location.href = '/lobby'; });
            return;
        }

        solvedCount = data.solvedToday || 0;
        puzzlesAttempted = solvedCount;

        $('#streak-info').text(`🔥 Серия: ${data.streak} дн.`);
        updateProgress();
        loadNextPuzzle();
    } catch (e) { console.error(e); }
}

async function loadNextPuzzle() {
    // Если мы сделали 10 попыток (решили или ошиблись)
    if (!isReviewMode && puzzlesAttempted >= TOTAL_PUZZLES) {
        if (failedPuzzles.length > 0) return startReviewMode();
        return victory();
    }

    try {
        const res = await fetch(`/api/puzzle/next?t=${Date.now()}`);
        if (!res.ok) {
            if (failedPuzzles.length > 0) return startReviewMode();
            return victory();
        }

        currentPuzzle = await res.json();
        setupBoard();
        startTimer();
    } catch (e) { console.error(e); }
}

function setupBoard() {
    game.load(currentPuzzle.fen);
    board.orientation(game.turn() === 'w' ? 'white' : 'black');
    board.position(currentPuzzle.fen);

    $('#description').html(currentPuzzle.description || "Найдите лучший ход за " + (game.turn() === 'w' ? "белых" : "черных"));
    $('.square-55d63').css({'box-shadow': 'none', 'background': ''});

    const txt = isReviewMode ? `Отработка ошибок: ${failedPuzzles.length}` : `Задача ${puzzlesAttempted + 1} из ${TOTAL_PUZZLES}`;
    $('#status').text(txt);
}

function handleFailure(reason) {
    clearInterval(timerId);

    // Добавляем в список на перерешивание, если её там еще нет
    if (!failedPuzzles.find(p => p.id === currentPuzzle.id)) {
        failedPuzzles.push(currentPuzzle);
    }

    // Тряска доски вместо блокирующего окна (UX)
    $('#board').addClass('shake');
    setTimeout(() => $('#board').removeClass('shake'), 500);

    if (!isReviewMode) {
        puzzlesAttempted++; // Счетчик попыток растет
        updateProgress();
    }

    // Авто-переход к следующей задаче через секунду
    setTimeout(isReviewMode ? nextReviewPuzzle : loadNextPuzzle, 1000);
}

function onDrop(source, target) {
    const move = game.move({ from: source, to: target, promotion: 'q' });
    if (move === null) return 'snapback';

    const isCorrect = (move.san === currentPuzzle.solution || (source + target) === currentPuzzle.solution);

    if (isCorrect) {
        clearInterval(timerId);
        $(`.square-${target}`).css('background', 'rgba(46, 204, 113, 0.6)');

        if (!isReviewMode) {
            solvedCount++;
            puzzlesAttempted++;
            updateProgress();

            // Сообщаем серверу только о ПРАВИЛЬНОМ решении для прогресса уровня
            fetch('/api/puzzle/solve', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ puzzleId: currentPuzzle.id })
            });
        }

        // Авто-переход к следующей задаче
        setTimeout(isReviewMode ? nextReviewPuzzle : loadNextPuzzle, 600);
    } else {
        game.undo();
        handleFailure("Неверный ход!");
        return 'snapback';
    }
}

function startReviewMode() {
    isReviewMode = true;
    Swal.fire({
        title: 'Работа над ошибками',
        text: 'Давай закрепим те задачи, где ты ошибся',
        icon: 'warning',
        timer: 2000,
        showConfirmButton: false
    }).then(() => { nextReviewPuzzle(); });
}

function nextReviewPuzzle() {
    if (failedPuzzles.length === 0) return victory();
    currentPuzzle = failedPuzzles.shift();
    setupBoard();
    startTimer();
}

function updateProgress() {
    const p = Math.min((puzzlesAttempted / TOTAL_PUZZLES) * 100, 100);
    $('#progress-fill').stop().animate({ width: p + '%' }, 400);
}

function victory() {
    clearInterval(timerId);
    fetch('/api/puzzle/complete-daily', { method: 'POST' }).then(() => {
        if (window.confetti) confetti({ particleCount: 150, spread: 70 });
        Swal.fire({
            title: 'Браво!',
            text: 'Дневная норма выполнена. Стрик сохранен!',
            icon: 'success'
        }).then(() => { window.location.href = '/lobby'; });
    });
}

function getHint() {
    if (!lozzaWorker) return;
    lozzaWorker.postMessage(`position fen ${game.fen()}`);
    lozzaWorker.postMessage('go movetime 1000');
}

function showHintOnBoard(move) {
    const from = move.substring(0, 2), to = move.substring(2, 4);
    $(`.square-${from}`).css('background', 'rgba(52, 152, 219, 0.4)');
    $(`.square-${to}`).css('background', 'rgba(46, 204, 113, 0.4)');
}

function onDragStart(source, piece) {
    if (game.game_over()) return false;
    const turn = game.turn();
    if ((turn === 'w' && piece.search(/^b/) !== -1) || (turn === 'b' && piece.search(/^w/) !== -1)) return false;
}
