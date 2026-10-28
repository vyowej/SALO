export function PageHeader({ title, description, actions, children }) {
  return (
    <header className="dashboard-page-header">
      <div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
      {actions || children ? <div className="dashboard-page-header__actions">{actions || children}</div> : null}
    </header>
  );
}

export default PageHeader;
