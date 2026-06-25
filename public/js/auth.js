document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        if (res.ok) {
            window.location.href = '/lobby';
            return;
        }
    } catch (_) { /* not logged in */ }

    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const roleOptions = document.querySelectorAll('.role-option');
    let selectedRole = 'student';

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-form`).classList.add('active');
        });
    });

    roleOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            roleOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedRole = opt.dataset.role;
        });
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = document.getElementById('login-error');
        errEl.textContent = '';

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: document.getElementById('login-username').value,
                    password: document.getElementById('login-password').value
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.user?.mustChangePassword) {
                    window.location.href = '/profile.html';
                } else {
                    window.location.href = '/lobby';
                }
            } else {
                errEl.textContent = data.message || 'Неверный логин или пароль';
            }
        } catch {
            errEl.textContent = 'Ошибка соединения с сервером';
        }
    });

    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('register-msg');
        msgEl.textContent = '';
        msgEl.className = 'auth-error';

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: document.getElementById('reg-username').value,
                    password: document.getElementById('reg-password').value,
                    role: selectedRole
                })
            });
            const data = await res.json();
            if (res.ok) {
                msgEl.className = 'auth-success';
                msgEl.textContent = 'Аккаунт создан! Теперь войдите.';
                document.querySelector('.auth-tab[data-tab="login"]').click();
            } else {
                msgEl.textContent = data.message || 'Ошибка регистрации';
            }
        } catch {
            msgEl.textContent = 'Ошибка соединения с сервером';
        }
    });
});
