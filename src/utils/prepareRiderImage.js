const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1600;

function canvasBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('This image could not be prepared for upload.'));
    }, 'image/jpeg', quality);
  });
}

async function loadOrientedImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall back to the browser's image decoder when this option is unsupported.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareRiderImage(file) {
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!acceptedTypes.includes(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  const image = await loadOrientedImage(file);
  let width = image.width;
  let height = image.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the image.');

  let blob;
  for (let resize = 0; resize < 5; resize += 1) {
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || 'white';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_FILE_BYTES) break;
    }
    if (blob.size <= MAX_FILE_BYTES) break;
    width = Math.max(1, Math.round(width * 0.82));
    height = Math.max(1, Math.round(height * 0.82));
  }
  if (typeof image.close === 'function') image.close();
  if (!blob || blob.size > MAX_FILE_BYTES) {
    throw new Error('This image could not be compressed below 2 MB. Choose a smaller image.');
  }

  return new File([blob], 'rider-upload.jpg', {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}
