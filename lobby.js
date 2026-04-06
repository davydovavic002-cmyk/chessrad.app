document.addEventListener('DOMContentLoaded', async () => {

    try {

        const response = await fetch('/api/profile', {

            method: 'GET',

            credentials: 'include'

        });



        if (response.ok) {

            const user = await response.json();

            setupLobbyUI(user);

        } else {

            window.location.href = '/';

        }

    } catch (error) {

        console.error('Сетевая ошибка:', error);

        window.location.href = '/';

    }

});



async function setupLobbyUI(user) {

    const userStatusDiv = document.getElementById('user-status');

    const findGameBtn = document.getElementById('find-game-btn');

    const profileBtn = document.getElementById('profile-btn');

    const tournamentsBtn = document.getElementById('tournaments-btn');

    const lobbyContainer = document.querySelector('.lobby-container');



    if (lobbyContainer) { lobbyContainer.style.visibility = 'visible'; }



    // Отображение общего стрика в шапке

    const streakHtml = (user.daily_streak > 0)

        ? `<span class="win-streak-badge streak-active">🔥 ${user.daily_streak} дн.</span>`

        : '';



    userStatusDiv.innerHTML = `

        <span>Привет, <strong id="welcome-username">${user.username}</strong>! ${streakHtml}</span>

        <button id="logout-btn" style="margin-left: 15px; cursor:pointer;">Выйти</button>

    `;



    // Логика карточки ежедневного задания

    setupDailyTaskCard();



    if (profileBtn) profileBtn.onclick = () => { window.location.href = 'profile.html'; };

    if (findGameBtn) findGameBtn.onclick = () => { window.location.href = 'game.html'; };

    if (tournamentsBtn) tournamentsBtn.onclick = () => { window.location.href = 'tournament.html'; };



    // --- ADMIN / TEACHER LOGIC ---

    const role = (user.role || '').toLowerCase();

    if (role === 'admin') {

        const adminContainer = document.getElementById('admin-card-container');

        if (adminContainer) {

            adminContainer.innerHTML = `

                <div class="menu-card" id="admin-btn" style="border: 2px solid #e74c3c; background: #fff5f5;">

                    <div class="card-icon">⚙️</div>

                    <div class="card-text">

                        <h3 style="color: #e74c3c;">Админ-панель</h3>

                        <p>Управление игроками</p>

                    </div>

                </div>

            `;

            document.getElementById('admin-btn').onclick = () => { window.location.href = '/admin.html'; };

        }

    }



    setupStudySection(role);



    const logoutBtn = document.getElementById('logout-btn');

    if (logoutBtn) {

        logoutBtn.onclick = async () => {

            if (window.socket) window.socket.disconnect();

            await fetch('/api/logout', { method: 'POST', credentials: 'include' });

            window.location.href = '/index.html';

        };

    }



    connectWebSocket();

}



async function setupDailyTaskCard() {

    const card = document.getElementById('puzzles-btn');

    const title = document.getElementById('streak-title');

    const subtitle = document.getElementById('streak-subtitle');

    const bar = document.getElementById('streak-bar-fill');

    const icon = document.getElementById('streak-icon');



    if (!card) return;



    try {

        const res = await fetch('/api/user/puzzle-status');

        const data = await res.json();



        const currentProgress = data.solvedToday || 0;



        // СБРОС КЛАССОВ ПЕРЕД УСТАНОВКОЙ

        card.classList.remove('streak-completed', 'streak-urgent', 'streak-broken');



        // ЛОГИКА: СТРИК СГОРЕЛ

        if (data.canRestore) {

            card.classList.add('streak-broken');

            if (title) title.innerText = "Стрик под угрозой!";

            if (subtitle) subtitle.innerText = `Верни свои ${data.previousStreak} дн.`;

            if (bar) bar.style.width = "0%";

            if (icon) icon.innerText = "💔";



            // При клике открываем модалку восстановления

            card.onclick = (e) => {

                e.preventDefault();

                if (typeof openRestoreModal === 'function') {

                    openRestoreModal(data.previousStreak);

                }

            };

        }

        // ЛОГИКА: ЗАДАНИЕ ВЫПОЛНЕНО

        else if (data.completedToday) {

            card.classList.add('streak-completed');

            if (title) title.innerText = "Задание выполнено!";

            if (subtitle) subtitle.innerText = "Серия продлена, заходи завтра!";

            if (bar) bar.style.width = "100%";

            if (icon) icon.innerText = "✅";

            card.onclick = () => { window.location.href = '/puzzle.html'; };

        }

        // ЛОГИКА: НУЖНО РЕШАТЬ

        else {

            card.classList.add('streak-urgent');

            if (title) title.innerText = "10 быстрых задач";

            if (subtitle) subtitle.innerText = `Твой прогресс: ${currentProgress}/10`;

            if (bar) bar.style.width = (currentProgress * 10) + "%";

            if (icon) icon.innerText = "🔥";

            card.onclick = () => { window.location.href = '/puzzle.html'; };

        }

    } catch (e) {

        console.error("Ошибка обновления карточки задач:", e);

        if (subtitle) subtitle.innerText = "Нажми, чтобы начать";

        card.onclick = () => { window.location.href = '/puzzle.html'; };

    }

}



function setupStudySection(role) {

    const studyControls = document.getElementById('study-controls');

    if (!studyControls) return;



    if (role === 'teacher' || role === 'admin') {

        studyControls.innerHTML = `

            <div class="menu-card primary study-card" id="btn-create-study" style="cursor: pointer; padding: 15px;">

                <div class="card-icon">👨‍🏫</div>

                <div class="card-text">

                    <h3>Учебный класс</h3>

                    <p>Создать комнату и передать код ученику</p>

                </div>

            </div>

        `;

        document.getElementById('btn-create-study').onclick = async () => {

            try {

                const res = await fetch('/api/study/create', { method: 'POST', credentials: 'include' });

                const data = await res.json();

                if (data.success) {

                    if (window.Swal) {

                        await Swal.fire({

                            icon: 'success',

                            title: 'Комната создана!',

                            html: `Код для ученика: <b style="font-size: 1.5em; color: #3498db;">${data.roomCode}</b>`,

                            confirmButtonText: 'Войти в комнату'

                        });

                    }

                    window.location.href = `/study.html?room=${data.roomCode}`;

                } else {

                    if (window.Swal) Swal.fire({ icon: 'error', title: 'Ошибка', text: data.message });

                }

            } catch (err) {

                console.error('Ошибка создания комнаты:', err);

            }

        };

    } else {

        studyControls.innerHTML = `

            <div class="menu-card study-card" style="cursor: default; padding: 15px; min-height: auto;">

                <div class="card-icon">🎓</div>

                <div class="card-text" style="width: 100%;">

                    <h3>Вход на обучение</h3>

                    <div style="display: flex; flex-direction: row; gap: 8px; margin-top: 10px; align-items: center;">

                        <input type="text" id="study-code-input" placeholder="Код комнаты"

                            style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; width: 180px; color: #333;">

                        <button id="btn-join-study"

                            style="padding: 10px 15px; background: #2ecc71; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">

                            Войти

                        </button>

                    </div>

                </div>

            </div>

        `;

        const inputEl = document.getElementById('study-code-input');

        const joinBtn = document.getElementById('btn-join-study');



        const handleJoin = async () => {

            const roomCode = inputEl.value.trim().toUpperCase();

            if (!roomCode) return window.Swal && Swal.fire({ icon: 'info', text: 'Введите код!' });

            try {

                const res = await fetch('/api/study/join', {

                    method: 'POST',

                    headers: { 'Content-Type': 'application/json' },

                    body: JSON.stringify({ roomCode }),

                    credentials: 'include'

                });

                const data = await res.json();

                if (data.success) {

                    window.location.href = `/study.html?room=${data.roomCode}`;

                } else {

                    if (window.Swal) Swal.fire({ icon: 'error', text: data.message || 'Комната не найдена' });

                }

            } catch (err) {

                if (window.Swal) Swal.fire({ icon: 'error', text: 'Ошибка сети' });

            }

        };



        if (joinBtn) joinBtn.onclick = handleJoin;

        if (inputEl) inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleJoin(); });

    }

}



function connectWebSocket() {

    if (typeof io !== 'undefined') {

        window.socket = io({ withCredentials: true });

    }

}
