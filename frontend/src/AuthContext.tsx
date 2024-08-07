import '@/bootstrap';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  Dispatch,
  SetStateAction
} from 'react';
import { User } from './types';
import axios from 'axios';

interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`/api/auth`);
        setUser(response.data);
      } catch (error) {
        console.log('Authentication check failed', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }
  if (!user) {
    return null;
  } else if (
    user.password_reset === true &&
    window.location.pathname !== '/reset-password'
  ) {
    window.location.href = '/reset-password';
    return null;
  }
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const handleLogout = async () => {
  try {
    const resp = await axios.post("/api/logout");
    if (resp.status === 200) {
      const logout = await axios.get(resp.data.redirect_to);
      if (logout.status === 200) {
        window.location.href = logout.data.logout_url;
      }
    }
  } catch (error) {
    window.location.href = "/self-service/login/browser";
    console.log("Logout failed", error);
  }
};
