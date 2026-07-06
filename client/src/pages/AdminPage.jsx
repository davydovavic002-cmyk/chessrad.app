import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { api, apiJson } from '../api';
import BackButton from '../components/BackButton';
import { useI18n } from '../i18n/I18nContext';
import '../styles/admin.css';

export default function AdminPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [sortMode, setSortMode] = useState('new');

  const loadUsers = useCallback(async () => {
    const { data } = await apiJson(`/api/admin/users?sort=${sortMode}`);
    if (!data.success) {
      await Swal.fire({ icon: 'error', title: t('admin_denied') });
      navigate('/lobby');
      return;
    }
    setUsers(data.users || []);
  }, [sortMode, navigate, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function updateRole(userId, newRole) {
    const result = await Swal.fire({
      title: t('admin_role_q'),
      text: t('admin_role_text', { role: newRole }),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3498db',
      cancelButtonText: t('cancel'),
    });
    if (!result.isConfirmed) {
      loadUsers();
      return;
    }
    await api('/api/admin/update-role', {
      method: 'POST',
      body: JSON.stringify({ userId, newRole }),
    });
    loadUsers();
  }

  async function resetPassword(userId, username) {
    const { value: newPassword } = await Swal.fire({
      title: t('admin_reset_title', { name: username }),
      input: 'text',
      inputValue: '123456',
      showCancelButton: true,
      confirmButtonColor: '#3498db',
      cancelButtonText: t('cancel'),
      inputValidator: (value) => {
        if (!value || value.length < 4) return t('auth_reg_password_ph');
      },
    });
    if (!newPassword) return;

    const { data } = await apiJson('/api/admin/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPassword }),
    });
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: t('admin_reset_ok'),
        text: t('admin_reset_hint', { name: username }),
      });
    } else {
      Swal.fire({ icon: 'error', text: data.message || t('error') });
    }
  }

  async function confirmDelete(userId, username) {
    const result = await Swal.fire({
      title: t('admin_delete_q'),
      text: username,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e74c3c',
      confirmButtonText: t('delete'),
      cancelButtonText: t('cancel'),
    });
    if (!result.isConfirmed) return;
    await api(`/api/admin/delete-user/${userId}`, { method: 'DELETE' });
    loadUsers();
  }

  return (
    <div className="admin-page page-wrap">
      <BackButton to="/lobby" title={t('back_to_lobby')} />
      <div className="admin-container glass-strong">
        <header>
          <h1>{t('admin_title')}</h1>
        </header>

        <div className="admin-controls">
          <label htmlFor="sort-mode">
            <strong>{t('admin_sort')}:</strong>
          </label>
          <select
            id="sort-mode"
            className="form-input"
            style={{ width: 'auto', minWidth: 180 }}
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
          >
            <option value="new">{t('admin_sort_new')}</option>
            <option value="old">{t('admin_sort_old')}</option>
            <option value="rating">{t('admin_sort_rating')}</option>
            <option value="alphabet">{t('admin_sort_alpha')}</option>
          </select>
        </div>

        <div className="admin-table-wrap">
          <table className="table-glass">
            <thead>
              <tr>
                <th>{t('admin_id')}</th>
                <th>{t('admin_user')}</th>
                <th>{t('admin_role')}</th>
                <th>{t('admin_rating')}</th>
                <th>{t('admin_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    {t('admin_loading')}
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  let displayRole = user.role;
                  if (displayRole === '0' || displayRole === 0) displayRole = 'student';
                  if (displayRole === '1' || displayRole === 1) displayRole = 'admin';
                  const displayRating = typeof user.rating === 'number' ? user.rating : '500';
                  return (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>
                        <span className={`badge-role role-${displayRole}`}>{displayRole}</span>
                      </td>
                      <td>{displayRating}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <select
                            value={displayRole}
                            onChange={(e) => updateRole(user.id, e.target.value)}
                          >
                            <option value="student">{t('admin_student')}</option>
                            <option value="teacher">{t('admin_teacher')}</option>
                            <option value="admin">{t('admin_admin')}</option>
                          </select>
                          <button
                            type="button"
                            className="btn-action btn-reset"
                            onClick={() => resetPassword(user.id, user.username)}
                          >
                            {t('admin_reset')}
                          </button>
                          <button
                            type="button"
                            className="btn-action btn-delete"
                            onClick={() => confirmDelete(user.id, user.username)}
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
