import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '../auth/AuthContext';
import { apiJson } from '../api';
import { useI18n } from '../i18n/I18nContext';
import BackButton from '../components/BackButton';

export default function LinkPage() {
  const { code } = useParams();
  const { user, loading, refreshUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user || !code || busy) return;
    setBusy(true);
    (async () => {
      const { res, data } = await apiJson('/api/link/connect', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (res.ok && data.success) {
        await refreshUser();
        await Swal.fire({
          icon: 'success',
          title: t('link_success'),
          timer: 1800,
          showConfirmButton: false,
        });
        navigate('/profile', { replace: true });
      } else {
        const msg =
          data.message === 'link_not_found'
            ? t('link_not_found')
            : data.message === 'link_invalid_roles'
              ? t('link_invalid_roles')
              : t('error');
        await Swal.fire({ icon: 'error', title: msg });
        navigate('/profile', { replace: true });
      }
    })();
  }, [loading, user, code, busy, navigate, refreshUser, t]);

  useEffect(() => {
    if (!loading && !user && code) {
      navigate(`/?link=${encodeURIComponent(code)}`, { replace: true });
    }
  }, [loading, user, code, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="page-wrap" style={{ padding: 40, textAlign: 'center' }}>
      <BackButton to="/profile" title={t('back_to_lobby')} />
      <p>{t('link_processing')}</p>
    </div>
  );
}
