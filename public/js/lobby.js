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



    // --- ADMIN / TEACHER LOGIC ---

    const role = (user.role || '').toLowerCase();

    if (role === 'admin') {

        const adminContainer = document.getElementById('admin-card-container');

        if (adminContainer) {

            adminContainer.innerHTML = `
                <div class="menu-card glass-card" id="admin-btn" style="border-color:rgba(255,107,107,0.4);background:rgba(255,107,107,0.1);">
                    <div class="card-icon">⚙️</div>
                    <div class="card-text">
                        <h3>Админ-панель</h3>
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

            window.location.href = '/';

        };

    }



    connectWebSocket();

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
