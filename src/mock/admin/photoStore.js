const MAX_IMAGE_BYTES = 300 * 1024;
const MAX_DIMENSION = 1200;

const readStoredImage = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error('Unable to read a saved admin photo.', error);
    return null;
  }
};

const dataUrlFromBlob = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('The image could not be read.'));
  reader.readAsDataURL(blob);
});

export async function savePhoto(file, photoRef) {
  if (!(file instanceof Blob) || !photoRef) throw new Error('A photo file and reference key are required.');
  const image = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo compression is not available in this browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();

  let quality = 0.82;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  while (blob && blob.size > MAX_IMAGE_BYTES && quality > 0.35) {
    quality -= 0.1;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  }
  if (!blob) throw new Error('The image could not be compressed.');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('The compressed photo is larger than 300 KB.');
  const dataUrl = await dataUrlFromBlob(blob);
  try {
    window.localStorage.setItem(photoRef, dataUrl);
  } catch (error) {
    console.error('Unable to save the compressed admin photo.', error);
    throw new Error('Browser storage is full. Remove saved photos and try again.', { cause: error });
  }
  return photoRef;
}

export function resolvePhoto(photoRef) {
  if (!photoRef) return null;
  return readStoredImage(photoRef);
}

export function seedPlaceholderPhotos(photoRefs) {
  const uniqueRefs = [...new Set(photoRefs.filter(Boolean))];
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 120;
  const context = canvas.getContext('2d');
  if (!context) return;
  const style = getComputedStyle(document.documentElement);
  context.fillStyle = style.getPropertyValue('--brand-logo-plate').trim() || style.getPropertyValue('--cream').trim();
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = style.getPropertyValue('--brand').trim();
  context.beginPath();
  context.arc(canvas.width / 2, canvas.height / 2, 24, 0, Math.PI * 2);
  context.fill();
  const placeholder = canvas.toDataURL('image/jpeg', 0.68);
  uniqueRefs.forEach((key) => {
    if (readStoredImage(key)) return;
    try {
      window.localStorage.setItem(key, placeholder);
    } catch (error) {
      console.error(`Unable to seed placeholder photo ${key}.`, error);
    }
  });
}
