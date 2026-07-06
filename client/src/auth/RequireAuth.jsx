import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-wrap" style={{ padding: 40, textAlign: 'center' }}>
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
