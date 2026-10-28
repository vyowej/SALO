import GenericPage from '../GenericPage';
import '../Page.css';

export default function NotFoundPage() {
  return (
    <GenericPage
      title="Page Not Found"
      description="This page does not exist yet, but you can always head back to SALO’s home and discover what’s next."
      eyebrow="404"
    />
  );
}
