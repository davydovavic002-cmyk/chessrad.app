import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import LanguageToggle from '../components/LanguageToggle';
import '../styles/auth.css';

export default function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('login');
  const [selectedRole, setSelectedRole] = useState('student');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginNotice, setLoginNotice] = useState('');
  const [registerMsg, setRegisterMsg] = useState('');
  const [registerOk, setRegisterOk] = useState(false);

  function navigateAfterAuth(authUser) {
    const pending = sessionStorage.getItem('pendingLinkCode');
    if (pending) {
      sessionStorage.removeItem('pendingLinkCode');
      navigate(`/link/${encodeURIComponent(pending)}`, { replace: true });
      return;
    }
    const dest = authUser?.role === 'parent'
      ? '/parent'
      : authUser?.mustChangePassword
        ? '/profile'
        : '/lobby';
    navigate(dest, { replace: true });
  }

  useEffect(() => {
    const linkCode = searchParams.get('link');
    if (linkCode) {
      sessionStorage.setItem('pendingLinkCode', linkCode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      const pending = sessionStorage.getItem('pendingLinkCode');
      if (pending) {
        sessionStorage.removeItem('pendingLinkCode');
        navigate(`/link/${encodeURIComponent(pending)}`, { replace: true });
        return;
      }
      const dest = user.role === 'parent' ? '/parent' : '/lobby';
      navigate(dest, { replace: true });
    }
  }, [user, loading, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoginNotice('');
    const form = new FormData(e.target);
    const username = String(form.get('username') || loginUsername || '').trim();
    const password = String(form.get('password') || '');
    const result = await login(username, password);
    if (result.ok) {
      navigateAfterAuth(result.user);
    } else {
      setLoginError(result.message || t('auth_bad_creds'));
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegisterMsg('');
    setRegisterOk(false);
    const form = new FormData(e.target);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    const result = await register(username, password, selectedRole, {
      displayName: form.get('displayName'),
      teacherLinkCode: selectedRole === 'student' ? form.get('teacherLinkCode') : undefined,
      teacherInviteCode: selectedRole === 'teacher' ? form.get('teacherInviteCode') : undefined,
    });
    if (result.ok) {
      const loginResult = await login(username, password);
      if (loginResult.ok) {
        navigateAfterAuth(loginResult.user);
        return;
      }
      setLoginUsername(username);
      setLoginNotice(t('auth_created_manual'));
      setTab('login');
      setRegisterOk(true);
      setRegisterMsg(t('auth_created_manual'));
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
              onClick={() => {
                setTab('login');
                setLoginError('');
              }}
            >
              {t('auth_login_tab')}
            </button>
            <button
              type="button"
              className={`auth-tab${tab === 'register' ? ' active' : ''}`}
              onClick={() => {
                setTab('register');
                setRegisterMsg('');
                setRegisterOk(false);
              }}
            >
              {t('auth_register_tab')}
            </button>
          </div>

          {tab === 'login' ? (
            <form className="auth-form active" onSubmit={handleLogin} autoComplete="on">
              <div className="form-group">
                <label htmlFor="login-username">{t('auth_username')}</label>
                <input
                  id="login-username"
                  name="username"
                  className="form-input"
                  placeholder={t('auth_login_placeholder')}
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
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
              {loginNotice ? <div className="auth-success">{loginNotice}</div> : null}
              <div className="auth-error">{loginError}</div>
            </form>
          ) : (
            <form className="auth-form active" onSubmit={handleRegister} autoComplete="off">
              <div className="form-group">
                <label htmlFor="reg-display-name">{t('auth_display_name')}</label>
                <input
                  id="reg-display-name"
                  name="displayName"
                  className="form-input"
                  placeholder={t('auth_display_name_ph')}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="reg-username">{t('auth_username')}</label>
                <input
                  id="reg-username"
                  name="username"
                  className="form-input"
                  placeholder={t('auth_reg_username_ph')}
                  required
                  autoComplete="off"
                />
                <p className="auth-hint">{t('auth_login_hint')}</p>
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
                <div className="role-select role-select--two">
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
              {selectedRole === 'teacher' && (
                <div className="form-group">
                  <label htmlFor="reg-teacher-invite">{t('auth_teacher_invite')}</label>
                  <input
                    id="reg-teacher-invite"
                    name="teacherInviteCode"
                    className="form-input"
                    placeholder={t('auth_teacher_invite_ph')}
                    required
                  />
                  <p className="auth-hint">{t('auth_teacher_invite_hint')}</p>
                </div>
              )}
              {selectedRole === 'student' && (
                <div className="form-group">
                  <label htmlFor="reg-teacher-code">{t('auth_teacher_code')}</label>
                  <input
                    id="reg-teacher-code"
                    name="teacherLinkCode"
                    className="form-input"
                    placeholder={t('auth_teacher_code_ph')}
                  />
                  <p className="auth-hint">{t('auth_teacher_code_hint')}</p>
                </div>
              )}
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
