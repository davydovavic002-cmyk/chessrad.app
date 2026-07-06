import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { apiJson } from '../api';

export default function ThemeSync() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (user?.theme === 'dark' || user?.theme === 'light') {
      setTheme(user.theme);
    }
  }, [user?.theme, setTheme]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      apiJson('/api/profile/settings', {
        method: 'PATCH',
        body: JSON.stringify({ theme }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [theme, user]);

  return null;
}
