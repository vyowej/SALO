export function ErrorState({ title = 'Something went wrong', message = 'Please try again.' }) {
  return (
    <div className="empty-state empty-state--error">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default ErrorState;
