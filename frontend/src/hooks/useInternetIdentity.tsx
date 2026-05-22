import { createContext, useContext, useEffect, useState } from 'react';

type LoginStatus = 'idle' | 'logging-in';
type Identity = { userId: string };

type InternetIdentityContextValue = {
  identity: Identity | null;
  loginStatus: LoginStatus;
  login: () => Promise<void>;
  clear: () => Promise<void>;
};

const STORAGE_KEY = 'skybooker-dev-identity';

const InternetIdentityContext = createContext<InternetIdentityContextValue | null>(null);

const loadIdentity = (): Identity | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Identity;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export function InternetIdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loginStatus, setLoginStatus] = useState<LoginStatus>('idle');

  useEffect(() => {
    setIdentity(loadIdentity());
  }, []);

  const login = async () => {
    if (identity) {
      throw new Error('User is already authenticated');
    }

    setLoginStatus('logging-in');
    try {
      const nextIdentity = { userId: crypto.randomUUID() };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIdentity));
      setIdentity(nextIdentity);
    } finally {
      setLoginStatus('idle');
    }
  };

  const clear = async () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setIdentity(null);
  };

  return (
    <InternetIdentityContext.Provider value={{ identity, loginStatus, login, clear }}>
      {children}
    </InternetIdentityContext.Provider>
  );
}

export function useInternetIdentity() {
  const context = useContext(InternetIdentityContext);
  if (!context) {
    throw new Error('useInternetIdentity must be used within InternetIdentityProvider');
  }
  return context;
}
