export function Stepper({ steps, currentStep = 0 }) {
  return (
    <ol className="stepper" aria-label="Progress steps">
      {steps.map((step, index) => (
        <li key={step} className={['stepper__item', index <= currentStep ? 'is-active' : ''].filter(Boolean).join(' ')}>
          <span>{index + 1}</span>
          <small>{step}</small>
        </li>
      ))}
    </ol>
  );
}

export default Stepper;
