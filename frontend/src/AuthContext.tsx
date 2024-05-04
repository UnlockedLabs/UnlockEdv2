import '@/bootstrap';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

interface AuthProviderProps {
  children: ReactNode;
}
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await window.axios.get(`/api/auth`);
        setUser(data.data[0]);
      } catch (error) {
        navigate("/login");
        console.log('Authentication check failed', error);
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={user}>
      {children}
    </AuthContext.Provider>
  );
};

export const handleLogout = async () => {
  try {
    await window.axios.post('/api/logout');
    window.location.href = '/login';
  } catch (error) {
    console.log('Logout failed', error);
  }
}

export const useAuth = () => useContext(AuthContext);
