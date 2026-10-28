import { useEffect } from 'react';

export function useReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll('[data-reveal]');

    if (!elements.length) return undefined;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      elements.forEach((element) => {
        element.classList.add('is-visible');
      });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = Number(entry.target.dataset.revealDelay || 0);
            entry.target.style.transitionDelay = `${delay}ms`;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);
}
