import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import LanguageToggle from '../components/LanguageToggle';
import '../styles/auth.css';

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [selectedRole, setSelectedRole] = useState('student');
  const [loginError, setLoginError] = useState('');
  const [registerMsg, setRegisterMsg] = useState('');
  const [registerOk, setRegisterOk] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const dest = user.role === 'parent' ? '/parent' : '/lobby';
      navigate(dest, { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    const form = new FormData(e.target);
    const result = await login(form.get('username'), form.get('password'));
    if (result.ok) {
      const dest = result.user?.role === 'parent'
        ? '/parent'
        : result.user?.mustChangePassword
          ? '/profile'
          : '/lobby';
      navigate(dest);
    } else {
      setLoginError(result.message || t('auth_bad_creds'));
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegisterMsg('');
    setRegisterOk(false);
    const form = new FormData(e.target);
    const result = await register(form.get('username'), form.get('password'), selectedRole);
    if (result.ok) {
      setRegisterOk(true);
      setRegisterMsg(t('auth_created'));
      setTab('login');
    } else {
      setRegisterMsg(result.message || t('error'));
    }
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-container">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 2 }}>
        <LanguageToggle />
      </div>
      <div className="auth-container">
        <div className="auth-brand">
          <h1>{t('app_name')}</h1>
          <p>{t('auth_brand_sub')}</p>
        </div>

        <div className="auth-card glass-strong">
          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab${tab === 'login' ? ' active' : ''}`}
              onClick={() => setTab('login')}
            >
              {t('auth_login_tab')}
            </button>
            <button
              type="button"
              className={`auth-tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => setTab('register')}
            >
              {t('auth_register_tab')}
            </button>
          </div>

          {tab === 'login' ? (
            <form className="auth-form active" onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="login-username">{t('auth_username')}</label>
                <input
                  id="login-username"
                  name="username"
                  className="form-input"
                  placeholder={t('auth_login_placeholder')}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label htmlFor="login-password">{t('auth_password')}</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder={t('auth_password_placeholder')}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                {t('auth_login_btn')}
              </button>
              <div className="auth-error">{loginError}</div>
            </form>
          ) : (
            <form className="auth-form active" onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg-username">{t('auth_username')}</label>
                <input
                  id="reg-username"
                  name="username"
                  className="form-input"
                  placeholder={t('auth_reg_username_ph')}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-password">{t('auth_password')}</label>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  className="form-input"
                  placeholder={t('auth_reg_password_ph')}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>{t('auth_role')}</label>
                <div className="role-select">
                  <div
                    className={`role-option${selectedRole === 'student' ? ' selected' : ''}`}
                    onClick={() => setSelectedRole('student')}
                  >
                    <span className="role-icon">🎓</span>
                    {t('auth_student')}
                  </div>
                  <div
                    className={`role-option${selectedRole === 'teacher' ? ' selected' : ''}`}
                    onClick={() => setSelectedRole('teacher')}
                  >
                    <span className="role-icon">📚</span>
                    {t('auth_teacher')}
                  </div>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-block">
                {t('auth_register_btn')}
              </button>
              <div className={registerOk ? 'auth-success' : 'auth-error'}>{registerMsg}</div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
