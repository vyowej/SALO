import Navbar from './Navbar';
import Footer from './Footer';
import DashboardShell from '../dashboard/DashboardShell';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';

export function Layout({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (isLoggedIn) {
    return (
      <div className="app-shell app-shell--app-mode">
        <DashboardShell>
          {({ toggleSidebar, sidebarOpen }) => (
            <div className="dashboard-workspace__inner">
              <Navbar onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
              <main id="main-content" className="page-shell app-workspace__content" key={location.pathname}>
                {children}
              </main>
            </div>
          )}
        </DashboardShell>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <main id="main-content" className="page-shell">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default Layout;
