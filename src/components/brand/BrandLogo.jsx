import { Link } from 'react-router-dom';
import logo from '../../assets/brand/salo-logo.png';
import logo2x from '../../assets/brand/salo-logo@2x.png';
import darkLogo from '../../assets/brand/salo-logo-dark.png';
import darkLogo2x from '../../assets/brand/salo-logo-dark@2x.png';
import icon from '../../assets/brand/salo-icon.png';
import icon2x from '../../assets/brand/salo-icon@2x.png';
import { useTheme } from '../../context/ThemeContext';

export function BrandLogo({ to = '/', variant = 'full', className = '', onClick }) {
  const { isDarkMode } = useTheme();
  const logoSrc = isDarkMode ? darkLogo : logo;
  const logoSrcSet = isDarkMode
    ? `${darkLogo} 1x, ${darkLogo2x} 2x`
    : `${logo} 1x, ${logo2x} 2x`;
  const classes = ['brand-logo-link', className].filter(Boolean).join(' ');

  return (
    <Link to={to} className={classes} aria-label="SALO" onClick={onClick}>
      {variant !== 'icon' ? (
        <img
          className="brand-logo-link__full"
          src={logoSrc}
          srcSet={logoSrcSet}
          width="140"
          height="52"
          alt="SALO"
        />
      ) : null}
      {variant !== 'full' ? (
        <img
          className="brand-logo-link__icon"
          src={icon}
          srcSet={`${icon} 1x, ${icon2x} 2x`}
          width="32"
          height="38"
          alt="SALO"
        />
      ) : null}
    </Link>
  );
}

export default BrandLogo;
