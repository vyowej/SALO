import { useState } from 'react';

export function ImageWithFallback({ src, srcSet, fallbackSrc = '/food-placeholder.svg', alt = '', ...props }) {
  const [failedSource, setFailedSource] = useState('');
  const imageSource = src || '';
  const failed = failedSource === `${imageSource}|${fallbackSrc}`;

  return (
    <img
      {...props}
      src={!src || failed ? fallbackSrc : src}
      srcSet={failed || !src ? undefined : srcSet}
      alt={alt}
      onError={() => setFailedSource(`${imageSource}|${fallbackSrc}`)}
    />
  );
}

export default ImageWithFallback;
