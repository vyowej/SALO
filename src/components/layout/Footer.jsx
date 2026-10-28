import { Camera, Globe, MapPin, MessageCircle, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../../assets/Salo_logo.png';

export function Footer() {
  const logoUrl = logo || '/Salo_logo.png';

  return (
    <footer className="site-footer">
      <div className="section-shell footer-shell">
        <div className="footer-brand">
          <img src={logoUrl} alt="SALO logo" className="footer-brand__logo" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          {!logoUrl ? null : <span className="brand-wordmark" aria-label="SALO">SALO</span>}
          <p>Order. Reserve. Gather.</p>
        </div>

        <div className="footer-columns">
          <div>
            <h4>Explore</h4>
            <ul>
              <li><Link to="/restaurants">Restaurants</Link></li>
              <li><Link to="/reserve">Reserve a Table</Link></li>
              <li><Link to="/orders">Orders</Link></li>
            </ul>
          </div>
          <div>
            <h4>Partners</h4>
            <ul>
              <li><Link to="/partner/apply">Add Your Restaurant</Link></li>
              <li><Link to="/rider/apply">Ride with SALO</Link></li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/admin">Admin</Link></li>
            </ul>
          </div>
          <div>
            <h4>Help</h4>
            <ul>
              <li><Link to="/login">Login</Link></li>
              <li><Link to="/forgot-password">Reset Password</Link></li>
              <li><Link to="/profile">Support</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-meta">
          <div className="social-row" aria-label="Social links">
            <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook"><Globe size={16} /></a>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Camera size={16} /></a>
            <a href="https://www.google.com" target="_blank" rel="noreferrer" aria-label="Chat"><MessageCircle size={16} /></a>
          </div>
          <p className="footer-note"><Sparkles size={14} /> Mabuhay!</p>
          <p className="footer-address"><MapPin size={14} /> Pasig City, Philippines</p>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="section-shell footer-bottom__inner">
          <span>© 2026 SALO</span>
          <span>Made for gatherings.</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
