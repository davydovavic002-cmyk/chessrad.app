
// Переносим applyLibPos и renderLibraryFolders в начало, чтобы они были доступны везде
window.applyLibPos = null;
window.renderLibraryFolders = null;

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    if (!roomCode) { window.location.href = '/lobby.html'; return; }

    let user, board = null, game = new Chess(), isTeacher = false;
    let tabs = [{ id: 'play', type: 'play', fen: 'start', shapes: [], pgn: '', customHistory: [] }];
    let activeTabId = 'play';
    let editorBoard = null;
    let allLibraryPositions = [];

    const canvas = document.getElementById('drawing-canvas');
    const ctx = canvas.getContext('2d');
    let isDrawing = false, startSquarePoint = null, shapes = [];

    // --- АУТЕНТИФИКАЦИЯ ---
    try {
        const res = await fetch('/api/profile');
        if (!res.ok) throw new Error();
        user = await res.json();
        document.getElementById('user-status').innerHTML = `Вы: <strong>${user.username}</strong>`;
    } catch (e) { window.location.href = '/'; return; }

    const socket = io({ transports: ['websocket'], withCredentials: true });

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
    function getCellCenter(pixelX, pixelY) {
        const size = boardEl.offsetWidth / 8;
        const col = Math.floor(pixelX / size);
        const row = Math.floor(pixelY / size);
        const isBlack = board.orientation() === 'black';
        return {
            col: isBlack ? 7 - col : col,
            row: isBlack ? 7 - row : row
        };
    }

    function getCanvasCoords(col, row) {
        const size = boardEl.offsetWidth / 8;
        let finalCol = col;
        let finalRow = row;
        if (board.orientation() === 'black') {
            finalCol = 7 - col;
            finalRow = 7 - row;
        }
        return { x: finalCol * size + size / 2, y: finalRow * size + size / 2 };
    }

    // --- КЛИКАБЕЛЬНАЯ ИСТОРИЯ ХОДОВ ---
    window.goToMove = (index) => {
        if (!isTeacher) return;
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab || !tab.customHistory || !tab.customHistory[index]) return;

        const target = tab.customHistory[index];
        tab.customHistory = tab.customHistory.slice(0, index + 1);

        game.load(target.fen);
        tab.fen = target.fen;
        tab.pgn = game.pgn();
        board.position(target.fen);

        socket.emit('study:move', {
            roomCode,
            tabId: activeTabId,
            fen: target.fen,
            pgn: tab.pgn,
            customHistory: tab.customHistory
        });
        updateUI();
    };

    // Очистка всей истории до начального состояния вкладки
    window.resetFullHistory = () => {
        if (!isTeacher) return;
        const tab = tabs.find(t => t.id === activeTabId);
        if (!tab) return;

        // Если это вкладка 'play', начальный FEN - стандартный, иначе - тот, с которого создали демо
        const initialFen = (tab.id === 'play') ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : tab.initialFen || '8/8/8/8/8/8/8/8 w - - 0 1';

        tab.customHistory = [];
        tab.fen = initialFen;
        tab.pgn = '';
        game.load(initialFen);
        board.position(initialFen);

        socket.emit('study:move', {
            roomCode,
            tabId: activeTabId,
            fen: tab.fen,
            pgn: '',
            customHistory: []
        });
        updateUI();
    };

    // --- УПРАВЛЕНИЕ ВКЛАДКАМИ ---
    document.getElementById('add-tab-btn').onclick = () => {
        if (!isTeacher) return;

        // Лимит: 1 основная + 20 демо = 21
        if (tabs.length >= 21) {
            alert('Максимальное количество демо-вкладок (20) достигнуто.');
            return;
        }

        const newId = 'tab_' + Date.now();
        const startFen = '8/8/8/8/8/8/8/8 w - - 0 1';
        const newTab = {
            id: newId,
            type: 'demo',
            fen: startFen,
            initialFen: startFen, // Сохраняем точку отсчета для сброса
            shapes: [],
            pgn: '',
            customHistory: []
        };
        tabs.push(newTab);
        socket.emit('study:updateTabs', { roomCode, tabs, activeTabId: newId });
        window.switchTab(newId);
    };

    window.removeTab = (id, event) => {
        if (event) event.stopPropagation();
        if (!isTeacher || id === 'play') return;
        tabs = tabs.filter(t => t.id !== id);
        if (activeTabId === id) activeTabId = 'play';
        socket.emit('study:updateTabs', { roomCode, tabs, activeTabId });
        window.switchTab(activeTabId);
    };

    window.switchTab = (id) => {
        const tab = tabs.find(t => t.id === id);
        if (!tab) return;
        activeTabId = id;

        if (board) board.destroy();
        board = Chessboard('myBoard', {
            ...config,
            sparePieces: false,
            dropOffBoard: (tab.type === 'play' ? 'snapback' : 'trash')
        });

        const currentFen = (tab.fen === 'start') ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' : tab.fen;
        game.load(currentFen);

        if (tab.type === 'play') {
            board.orientation(isTeacher ? 'white' : 'black');
        } else {
            board.orientation('white');
        }

        board.position(currentFen);
        shapes = tab.shapes || [];
        if (isTeacher) socket.emit('study:switchTab', { roomCode, tabId: id });

        setTimeout(() => {
            resizeCanvas();
            redrawAllShapes();
        }, 50);
        updateUI();
    };

    function renderTabs() {
        const tabsList = document.getElementById('tabs-list');
        if (!tabsList) return;

        tabsList.innerHTML = tabs.map(t => {
            const isActive = t.id === activeTabId ? 'active' : '';
            const icon = t.type === 'play' ? 'fa-gamepad' : 'fa-chalkboard';
            const label = t.type === 'play' ? 'Игра' : 'Демо';

            return `
                <div class="tab-item ${isActive}" onclick="window.switchTab('${t.id}')">
                    <div class="tab-icon-wrapper">
                        <i class="fas ${icon}"></i>
                    </div>
                    <span class="tab-label">${label}</span>
                    ${isTeacher && t.id !== 'play' ?
                        `<div class="delete-tab" onclick="window.removeTab('${t.id}', event)">
                            <i class="fas fa-times"></i>
                        </div>` : ''}
                </div>`;
        }).join('');
    }

    // --- КНОПКИ УПРАВЛЕНИЯ ---
    document.getElementById('flip-btn').onclick = () => { if(board) board.flip(); redrawAllShapes(); };
    document.getElementById('reset-btn').onclick = () => {
        if (!isTeacher) return;
        window.applyLibPos('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    };
    document.getElementById('clear-btn').onclick = () => {
        if (!isTeacher) return;
        window.applyLibPos('8/8/8/8/8/8/8/8 w - - 0 1');
    };

    // --- БИБЛИОТЕКА ---

// --- БИБЛИОТЕКА ---
    document.getElementById('lib-btn').onclick = async () => {
        const res = await fetch('/api/positions');
        allLibraryPositions = await res.json();
        document.getElementById('lib-modal').style.display = 'flex';
        window.renderLibraryFolders(); // Показываем Разделы (big_folder)
    };

    // УРОВЕНЬ 1: Рендерим Разделы (big_folder)
    window.renderLibraryFolders = () => {
        const content = document.getElementById('lib-content');
        // Группируем по big_folder
        const bigFolders = [...new Set(allLibraryPositions.map(p => p.big_folder || 'Без раздела'))].sort();

        content.innerHTML = bigFolders.map(bf => {
            const count = allLibraryPositions.filter(p => (p.big_folder || 'Без раздела') === bf).length;
            return `
            <div class="folder-card" onclick="window.renderLibrarySubFolders('${bf}')" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 15px 10px; text-align: center; cursor: pointer;">
                <div style="font-size: 30px; margin-bottom: 5px;">📁</div>
                <strong style="display:block; font-size:14px;">${bf}</strong>
                <div style="font-size: 11px; color: #7f8c8d;">${count} поз.</div>
            </div>`;
        }).join('');
    };

    // УРОВЕНЬ 2: Рендерим Папки (category) внутри Раздела
    window.renderLibrarySubFolders = (bigFolderName) => {
        const content = document.getElementById('lib-content');
        const filteredByBig = allLibraryPositions.filter(p => (p.big_folder || 'Без раздела') === bigFolderName);
        const categories = [...new Set(filteredByBig.map(p => p.category || 'Общее'))].sort();

        content.innerHTML = `<div style="grid-column: 1 / -1; margin-bottom: 10px;"><button onclick="window.renderLibraryFolders()">← Назад к разделам</button> <b style="margin-left:10px;">Раздел: ${bigFolderName}</b></div>`;

        content.innerHTML += categories.map(cat => {
            const count = filteredByBig.filter(p => (p.category || 'Общее') === cat).length;
            return `
            <div class="folder-card" onclick="window.renderLibraryCategory('${bigFolderName}', '${cat}')" style="background: #fdfdfd; border: 1px dashed #3498db; border-radius: 12px; padding: 15px 10px; text-align: center; cursor: pointer;">
                <div style="font-size: 30px; margin-bottom: 5px;">📂</div>
                <strong style="display:block; font-size:14px;">${cat}</strong>
                <div style="font-size: 11px; color: #7f8c8d;">${count} поз.</div>
            </div>`;
        }).join('');
    };

    // УРОВЕНЬ 3: Список позиций
    window.renderLibraryCategory = (bigFolderName, categoryName) => {
        const filtered = allLibraryPositions.filter(p =>
            (p.big_folder || 'Без раздела') === bigFolderName &&
            (p.category || 'Общее') === categoryName
        );
        renderPositionGrid(filtered, bigFolderName, categoryName);
    };

    function renderPositionGrid(positions, big, cat) {
        const content = document.getElementById('lib-content');
        content.innerHTML = `
            <div style="grid-column: 1 / -1; margin-bottom: 10px;">
                <button onclick="window.renderLibrarySubFolders('${big}')">← Назад к папкам</button>
                <b style="margin-left:10px;">${big} / ${cat}</b>
            </div>`;

        positions.forEach(pos => {
            const boardId = `lib-mini-${pos.id}`;
            const div = document.createElement('div');
            div.className = 'lib-pos-card';
            div.innerHTML = `<div id="${boardId}" style="width: 100%; aspect-ratio: 1/1;"></div><div style="padding:5px; font-size:12px; text-align:center;">${pos.title}</div>`;
            div.onclick = () => window.applyLibPos(pos.fen);
            content.appendChild(div);

            setTimeout(() => {
                if(document.getElementById(boardId)) {
                    Chessboard(boardId, {
                        position: pos.fen,
                        showNotation: false,
                        draggable: false,
                        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
                    });
                }
            }, 50);
        });
    }

    // --- РЕДАКТОР ---
    document.getElementById('editor-btn').onclick = () => {
        document.getElementById('editor-modal').style.display = 'flex';
        if (!editorBoard) {
            editorBoard = Chessboard('board-editor', {
                draggable: true, dropOffBoard: 'trash', sparePieces: true,
                position: board.fen(), pieceTheme: '/img/chesspieces/wikipedia/{piece}.png'
            });
        } else { editorBoard.position(board.fen()); }
    };

    document.getElementById('editor-start-btn').onclick = () => { if(editorBoard) editorBoard.start(); };
    document.getElementById('editor-clear-btn').onclick = () => { if(editorBoard) editorBoard.clear(); };
    document.getElementById('apply-editor-btn').onclick = () => {
        const fen = editorBoard.fen() + ' w - - 0 1';
        window.applyLibPos(fen);
        document.getElementById('editor-modal').style.display = 'none';
    };

    window.applyLibPos = (fen) => {
        const tab = tabs.find(t => t.id === activeTabId);
        tab.fen = fen;
        tab.initialFen = fen; // Запоминаем новый FEN как стартовый для этой вкладки
        tab.pgn = '';
        tab.customHistory = [];
        game.load(fen);
        board.position(fen);
        socket.emit('study:move', { roomCode, tabId: activeTabId, fen, pgn: '', customHistory: [] });
        document.getElementById('lib-modal').style.display = 'none';
        updateUI();
    };


function updateUI() {
    const historyBlock = document.getElementById('moves-history-block');
    const gameBlock = document.getElementById('game-info-block');
    const demoBlock = document.getElementById('demo-controls-block');
    const statusMsg = document.getElementById('status-msg');
    const tab = tabs.find(t => t.id === activeTabId);

    gameBlock.style.display = 'flex';
    demoBlock.style.display = (isTeacher && tab.type !== 'play') ? 'flex' : 'none';

    if (tab.type === 'play') {
        const turn = game.turn() === 'w' ? 'Белых' : 'Черных';
        statusMsg.innerHTML = `<span style="color: #2ecc71;">● ХОД ${turn.toUpperCase()}</span>`;
    } else {
        statusMsg.innerHTML = `<span style="color: #3498db;">● РЕЖИМ ДЕМОНСТРАЦИИ</span>`;
    }

    const history = tab.customHistory || [];
    const moveClass = isTeacher ? 'pgn-move' : 'pgn-move-static';
    const currentFen = game.fen(); // Текущая позиция на доске

    if (history.length > 0) {
        let html = '<div class="pgn-container">';

        if (isTeacher) {
            html += `<span class="pgn-reset-btn" onclick="window.resetFullHistory()" title="Очистить историю"><i class="fas fa-times-circle"></i></span>`;
        }

        const pieceNames = { 'P': 'пешка', 'N': 'конь', 'B': 'слон', 'R': 'ладья', 'Q': 'ферзь', 'K': 'король' };

        const formatSan = (san) => {
            if (!san) return "";
            if (san.includes('O-O')) return 'рокировка';
            if (san.includes('(') && san.includes(')-')) {
                const pieceLetter = san[0];
                const movePath = san.substring(1).replace('(', '').replace(')', '');
                return `${pieceNames[pieceLetter] || 'фигура'} ${movePath}`;
            }
            const firstChar = san[0];
            if (pieceNames[firstChar]) return `${pieceNames[firstChar]} ${san.substring(1)}`;
            return `пешка ${san}`;
        };

        // Находим индекс последнего хода, который совпадает с текущим FEN
        // Идем с конца, чтобы найти самое актуальное положение
        let activeIndex = -1;
        for (let j = history.length - 1; j >= 0; j--) {
            if (history[j].fen === currentFen) {
                activeIndex = j;
                break;
            }
        }

        for (let i = 0; i < history.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = history[i];
            const blackMove = history[i + 1];

            html += `<div class="move-row">`;
            html += `<span class="move-number">${moveNumber}.</span> `;

            // Полуход белых
            const whiteActive = (i === activeIndex) ? 'active-move' : '';
            html += `<span class="${moveClass} ${whiteActive}" onclick="goToMove(${i})">${formatSan(whiteMove.san)}</span>`;

            if (blackMove) {
                html += ` <span class="move-separator">—</span> `;
                // Полуход черных
                const blackActive = (i + 1 === activeIndex) ? 'active-move' : '';
                html += `<span class="${moveClass} ${blackActive}" onclick="goToMove(${i + 1})">${formatSan(blackMove.san)}</span>`;
            }
            html += `</div>`;
        }

        html += '</div>';
        historyBlock.innerHTML = html;

const activeEl = historyBlock.querySelector('.active-move');
        if (activeEl) {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        // =========================================

    } else {
        historyBlock.innerHTML = '<em>История пуста</em>';
    }

    renderTabs();
}
// Авто-скролл к активному ходу

    const config = {
        draggable: true,
        pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
        onDragStart: (source, piece) => {
            if (activeTabId === 'play') {
                if (!isTeacher && piece.search(/^w/) !== -1) return false;
                if (isTeacher && piece.search(/^b/) !== -1) return false;
            }
            return true;
        },
        onDrop: (source, target) => {
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab.customHistory) tab.customHistory = [];

            if (game.fen() !== tab.fen) {
                game.load(tab.fen);
            }

            const move = game.move({ from: source, to: target, promotion: 'q' });
            let moveNotation = "";

            if (move) {
                moveNotation = move.san;
            } else if (tab.type !== 'play') {
                const piece = game.get(source);
                if (!piece) return 'snapback';
                moveNotation = `${piece.type.toUpperCase()}(${source})-${target}`;
                game.remove(source);
                game.put(piece, target);
                let fenParts = game.fen().split(' ');
                fenParts[1] = (game.turn() === 'w') ? 'b' : 'w';
                game.load(fenParts.join(' '));
            } else {
                return 'snapback';
            }

            tab.customHistory.push({ san: moveNotation, fen: game.fen() });
            tab.fen = game.fen();
            tab.pgn = game.pgn();
        },
        onSnapEnd: () => {
            const tab = tabs.find(t => t.id === activeTabId);
            socket.emit('study:move', {
                roomCode,
                tabId: activeTabId,
                fen: tab.fen,
                pgn: tab.pgn,
                customHistory: tab.customHistory
            });
            updateUI();
        }
    };

    board = Chessboard('myBoard', config);

    // --- СОКЕТЫ ---
    socket.emit('study:join', { roomCode });

    socket.on('study:roomData', (d) => {
        isTeacher = (Number(d.teacher_id) === Number(user.id) || user.role === 'admin' || user.role === 'teacher');
        document.getElementById('teacher-tools').style.display = isTeacher ? 'flex' : 'none';
        document.getElementById('add-tab-btn').style.display = isTeacher ? 'block' : 'none';
        if (d.tabs && d.tabs.length > 0) tabs = d.tabs;
        window.switchTab(d.activeTabId || activeTabId);
    });

    socket.on('study:syncMove', (d) => {
        const t = tabs.find(x => x.id === d.tabId);
        if (t) {
            t.fen = d.fen;
            t.pgn = d.pgn || '';
            t.customHistory = d.customHistory || [];
            if (d.tabId === activeTabId) {
                game.load(d.fen);
                board.position(d.fen, false);
                updateUI();
            }
        }
    });

    socket.on('study:syncDraw', (d) => {
        const t = tabs.find(x => x.id === d.tabId);
        if (t) t.shapes = d.shapes || [];
        if (d.tabId === activeTabId) {
            shapes = d.shapes || [];
            redrawAllShapes();
        }
    });

    socket.on('study:syncTabs', (d) => {
        tabs = d.tabs;
        if (!tabs.find(t => t.id === activeTabId)) {
            activeTabId = 'play';
            window.switchTab('play');
        }
        renderTabs();
    });

    socket.on('study:syncSwitchTab', (d) => { if (!isTeacher) window.switchTab(d.tabId); });

    // --- РИСОВАНИЕ ---
    function redrawAllShapes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        shapes.forEach(s => {
            ctx.lineWidth = 4;
            const start = getCanvasCoords(s.startCol, s.startRow);
            if (s.type === 'circle') {
                ctx.strokeStyle = 'rgba(46, 204, 113, 0.8)';
                ctx.beginPath(); ctx.arc(start.x, start.y, 20, 0, Math.PI * 2); ctx.stroke();
            } else {
                const end = getCanvasCoords(s.endCol, s.endRow);
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
                drawArrowhead(ctx, start.x, start.y, end.x, end.y, 18);
            }
        });
    }

    function drawArrowhead(context, fromX, fromY, toX, toY, radius = 15) {
        const angle = Math.atan2(toY - fromY, toX - fromX);
        context.save();
        context.fillStyle = context.strokeStyle;
        context.beginPath();
        context.translate(toX, toY);
        context.rotate(angle);
        context.moveTo(0, 0);
        context.lineTo(-radius, -radius / 1.5);
        context.lineTo(-radius, radius / 1.5);
        context.closePath();
        context.fill();
        context.restore();
    }

    const boardEl = document.getElementById('myBoard');
    boardEl.oncontextmenu = (e) => e.preventDefault();
    boardEl.addEventListener('mousedown', (e) => {
        if (!isTeacher) return;
        const rect = canvas.getBoundingClientRect();
        const gridPos = getCellCenter(e.clientX - rect.left, e.clientY - rect.top);
        if (e.button === 0) {
            shapes = [];
            socket.emit('study:draw', { roomCode, tabId: activeTabId, shapes: [] });
            redrawAllShapes();
        } else if (e.button === 2) {
            isDrawing = true;
            startSquarePoint = gridPos;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isDrawing && e.button === 2) {
            const rect = canvas.getBoundingClientRect();
            const gridPos = getCellCenter(e.clientX - rect.left, e.clientY - rect.top);
            if (startSquarePoint.col === gridPos.col && startSquarePoint.row === gridPos.row) {
                shapes.push({ type: 'circle', startCol: startSquarePoint.col, startRow: startSquarePoint.row });
            } else {
                shapes.push({ type: 'arrow', startCol: startSquarePoint.col, startRow: startSquarePoint.row, endCol: gridPos.col, endRow: gridPos.row });
            }
            socket.emit('study:draw', { roomCode, tabId: activeTabId, shapes });
            isDrawing = false;
            redrawAllShapes();
        }
    });

    function resizeCanvas() {
        const b = document.getElementById('myBoard');
        if (b && canvas) { canvas.width = b.offsetWidth; canvas.height = b.offsetHeight; redrawAllShapes(); }
    }
    window.addEventListener('resize', () => { if(board) board.resize(); resizeCanvas(); });
    setTimeout(resizeCanvas, 500);
});
