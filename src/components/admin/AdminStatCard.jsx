export function AdminStatCard({ label, value, detail, icon: Icon }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-card__top">
        <span>{label}</span>
        {Icon ? <Icon aria-hidden="true" size={19} /> : null}
      </div>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export default AdminStatCard;
