// Claude rejects base64 images over 5 MB, and resizes anything over ~1568px
// anyway. Shrink large photos before upload so phone pictures always parse.

const MAX_EDGE = 2400;
const MAX_BYTES = 3.5 * 1024 * 1024;

export function canvasToJpegFile(canvas, name, quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], name, { type: 'image/jpeg' })) : reject(new Error('Image encode failed'))),
      'image/jpeg',
      quality
    );
  });
}

function scaledCanvas(source, width, height) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function shrinkImage(file) {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const tooBig = file.size > MAX_BYTES || Math.max(bitmap.width, bitmap.height) > MAX_EDGE;
  if (!tooBig) {
    bitmap.close();
    return file;
  }
  const canvas = scaledCanvas(bitmap, bitmap.width, bitmap.height);
  bitmap.close();
  return canvasToJpegFile(canvas, file.name.replace(/\.\w+$/, '') + '.jpg');
}

export function captureVideoFrame(video) {
  const canvas = scaledCanvas(video, video.videoWidth, video.videoHeight);
  return canvasToJpegFile(canvas, `bill-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.jpg`);
}
