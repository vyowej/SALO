import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function GenericPage({ title, description, eyebrow = 'Coming in the next stage' }) {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-card">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link to="/" className="btn btn--primary">
          <ArrowLeft size={16} /> Back home
        </Link>
      </div>
    </div>
  );
}

export default GenericPage;
