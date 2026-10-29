export function Table({ children, className = '', ...props }) {
  return (
    <div className="table-wrap">
      <table className={['ui-table', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, ...props }) {
  return <thead {...props}>{children}</thead>;
}

export function TableBody({ children, ...props }) {
  return <tbody {...props}>{children}</tbody>;
}

export function TableRow({ children, ...props }) {
  return <tr {...props}>{children}</tr>;
}

export function TableHeader({ children, ...props }) {
  return <th scope="col" {...props}>{children}</th>;
}

export function TableCell({ children, ...props }) {
  return <td {...props}>{children}</td>;
}

export function TableCaption({ children, ...props }) {
  return <caption className="ui-table__caption" {...props}>{children}</caption>;
}
