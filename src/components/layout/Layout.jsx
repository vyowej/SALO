import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '../../context/AuthContext';

export function Layout({ children }) {
  const { isLoggedIn } = useAuth();

  return (
    <div className={`app-shell ${isLoggedIn ? 'app-shell--app-mode' : ''}`}>
      <Navbar />
      <main id="main-content" className="page-shell">
        {children}
      </main>
      {!isLoggedIn ? <Footer /> : null}
    </div>
  );
}

export default Layout;
