import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export function DashboardShell({ title, sections, activeSection, onSelect, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const select = (section) => {
    onSelect(section);
    setDrawerOpen(false);
  };

  return (
    <div className="dashboard-layout">
      {drawerOpen ? <button type="button" className="dashboard-sidebar-backdrop" aria-label="Close dashboard navigation" onClick={() => setDrawerOpen(false)} /> : null}
      <aside className={`dashboard-sidebar ${drawerOpen ? 'is-open' : ''}`}>
        <div className="dashboard-sidebar__heading"><strong>{title}</strong><button type="button" aria-label="Close dashboard navigation" onClick={() => setDrawerOpen(false)}><X size={17} /></button></div>
        <nav aria-label={`${title} sections`}>
          {sections.map((section) => <button type="button" key={section} className={activeSection === section ? 'is-active' : ''} onClick={() => select(section)}>{section}</button>)}
        </nav>
      </aside>
      <section className="dashboard-main">
        <div className="dashboard-mobile-heading"><button type="button" aria-label="Open dashboard navigation" onClick={() => setDrawerOpen(true)}><Menu size={18} /></button><strong>{activeSection || title}</strong></div>
        {children}
      </section>
    </div>
  );
}

export default DashboardShell;
