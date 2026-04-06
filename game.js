$(document).ready(async function() {
    // --- ПРОВЕРКА АУТЕНТИФИКАЦИИ ---
    let currentUser = null;
    try {
        const response = await fetch('/api/profile');
        if (!response.ok) throw new Error('Unauthorized');
        currentUser = await response.json();
    } catch (error) {
        window.location.href = '/';
        return;
    }

    // --- Глобальные переменные ---
    let board = null;
    const game = new Chess();
    let myColor = 'white';
    let gameRoomId = null;
    let myWinStreak = currentUser.win_streak || 0;

    const socket = io();

    // --- Логика шахматной доски ---
    function onDragStart(source, piece) {
        if (game.game_over()) return false;

        const globalTurn = game.turn();
        const playerColorChar = myColor.charAt(0);

        // Запрещаем ходить чужими фигурами или не в свой ход
        if (globalTurn !== playerColorChar) return false;
        if (piece.charAt(0) !== playerColorChar) return false;
        return true;
    }

    function onDrop(source, target) {
        let moveObject = { from: source, to: target, promotion: 'q' };
        const move = game.move(moveObject);

        if (move === null) return 'snapback';

        // Визуально фиксируем ход у себя сразу для плавности
        updateGameDisplay();

        // Отправляем ход на сервер
        socket.emit('move', {
            move: move,
            roomId: gameRoomId // Теперь это значение точно будет заполнено
        });
    }

    function onSnapEnd() {
        if (board) board.position(game.fen());
    }

    function updateGameDisplay() {
        if (!board) return;
        $('#fen').text(game.fen());
        $('#pgn').html(game.pgn());

        const isMyTurn = game.turn() === myColor.charAt(0);
        $('#turn-info').text(isMyTurn ? 'Ваш ход' : 'Ход соперника')
                       .toggleClass('my-turn', isMyTurn);
    }

    // --- Обработка событий сервера ---

    socket.on('gameStart', (data) => {
        console.log("Игра началась. Данные сервера:", data);

        // ВАЖНО: Твой класс Game шлет roomId: this.gameId
        gameRoomId = data.roomId;
        myColor = (data.color === 'w') ? 'white' : 'black';

        // Настройка доски
        const boardConfig = {
            draggable: true,
            position: data.fen || 'start',
            orientation: myColor,
            onDragStart,
            onDrop,
            onSnapEnd,
            pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
        };

        board = Chessboard('myBoard', boardConfig);
        game.load(data.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

        // Управление UI (согласно твоему HTML)
        $('#find-game-btn').hide();
        $('#game-controls').show();
        $('#resign-btn').show().prop('disabled', false);
        $('#rematch-btn').hide();

        // Отображение серии побед
        if (myWinStreak >= 3) {
            $('#streak-count').text(myWinStreak);
            $('#player-streak').css('display', 'inline-block');
        }

        $('#status').html(`Игра против <b>${data.opponent.username}</b>`);
        updateGameDisplay();
    });

    socket.on('gameStateUpdate', (data) => {
        // УСТРАНЕНИЕ ДЕРГАНЬЯ:
        // Обновляем только если FEN с сервера отличается от текущего
        if (data?.fen && data.fen !== game.fen()) {
            game.load(data.fen);
            board.position(data.fen, true); // true = плавная анимация переката
            updateGameDisplay();
        }
    });

    socket.on('gameOver', (data) => {
        if (data.fen) {
            game.load(data.fen);
            board.position(data.fen);
        }

        Swal.fire({
            title: data.winner === currentUser.username ? 'Победа!' : 'Игра окончена',
            text: `Результат: ${data.reason || data.type}`,
            icon: data.winner === currentUser.username ? 'success' : 'info'
        });

        $('#status').text(`Окончено: ${data.reason || data.type}`);
        $('#resign-btn').hide();
        $('#rematch-btn').show().prop('disabled', false).text('Реванш');
        updateGameDisplay();
    });

    socket.on('rematchOffered', () => {
        $('#status').html('<b>Соперник предлагает реванш!</b>');
        $('#rematch-btn').text('Принять реванш').addClass('glowing-button');
    });

    // --- Обработчики кнопок ---

    $('#find-game-btn').on('click', function() {
        $(this).prop('disabled', true).text('Поиск...');
        socket.emit('findGame');
    });

    // Обработчик СДАЧИ
    $('#resign-btn').off('click').on('click', async function() {
        if (!gameRoomId) return;

        const res = await Swal.fire({
            title: 'Сдаться?',
            text: "Серия побед будет сброшена!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Да, сдаться',
            cancelButtonText: 'Отмена'
        });

        if (res.isConfirmed) {
            socket.emit('surrender', { roomId: gameRoomId });
        }
    });

    // Обработчик РЕВАНША
    $('#rematch-btn').on('click', function() {
        const isAccepting = $(this).text().includes('Принять');
        if (isAccepting) {
            socket.emit('rematchAccepted', { roomId: gameRoomId });
        } else {
            socket.emit('rematch', { roomId: gameRoomId });
        }
        $(this).prop('disabled', true).text('Ожидание...');
    });
});
