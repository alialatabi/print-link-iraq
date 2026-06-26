import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ScrollToTop = (): null => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Expose the router's navigate to the native deep-link handler (src/lib/native.ts) so an App Link
  // routes in-app without a full reload, keeping the back stack intact.
  useEffect(() => {
    (window as unknown as { __appNavigate?: (to: string) => void }).__appNavigate = (to) => navigate(to);
    return () => { delete (window as unknown as { __appNavigate?: unknown }).__appNavigate; };
  }, [navigate]);

  return null;
};

export default ScrollToTop;
