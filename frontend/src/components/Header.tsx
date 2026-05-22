import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plane, Menu, X } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useIsCallerAdmin } from '../hooks/useQueries';

export default function Header() {
  const { login, clear, loginStatus, identity } = useInternetIdentity();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: isAdmin } = useIsCallerAdmin();

  const isAuthenticated = !!identity;
  const disabled = loginStatus === 'logging-in';
  const buttonText = loginStatus === 'logging-in' ? 'Logging in...' : isAuthenticated ? 'Logout' : 'Login';

  const handleAuth = async () => {
    if (isAuthenticated) {
      await clear();
      queryClient.clear();
      navigate({ to: '/' });
    } else {
      try {
        await login();
      } catch (error: unknown) {
        console.error('Login error:', error);
        if (error instanceof Error && error.message === 'User is already authenticated') {
          await clear();
          setTimeout(() => login(), 300);
        }
      }
    }
  };

  const handleNavigation = (path: string) => {
    navigate({ to: path });
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleNavigation('/')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
            SkyBooker
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Button variant="ghost" onClick={() => handleNavigation('/')}>
            Home
          </Button>
          {isAuthenticated && (
            <Button variant="ghost" onClick={() => handleNavigation('/my-bookings')}>
              My Bookings
            </Button>
          )}
          {isAdmin && (
            <Button variant="ghost" onClick={() => handleNavigation('/admin')}>
              Admin
            </Button>
          )}
          <Button onClick={handleAuth} disabled={disabled} className="bg-blue-600 hover:bg-blue-700">
            {buttonText}
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background">
          <nav className="container flex flex-col gap-2 py-4">
            <Button variant="ghost" onClick={() => handleNavigation('/')} className="justify-start">
              Home
            </Button>
            {isAuthenticated && (
              <Button variant="ghost" onClick={() => handleNavigation('/my-bookings')} className="justify-start">
                My Bookings
              </Button>
            )}
            {isAdmin && (
              <Button variant="ghost" onClick={() => handleNavigation('/admin')} className="justify-start">
                Admin
              </Button>
            )}
            <Button onClick={handleAuth} disabled={disabled} className="bg-blue-600 hover:bg-blue-700">
              {buttonText}
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
