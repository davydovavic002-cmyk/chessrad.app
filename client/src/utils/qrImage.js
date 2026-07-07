/** Load a QR code image for canvas compositing (no heavy qrcode npm bundle). */
export function loadQrImage(data, size = 200) {
  const src =
    `https://quickchart.io/qr?text=${encodeURIComponent(data)}` +
    `&size=${size}&margin=1&dark=2d1f1a&light=ffffff`;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('qr_load_failed'));
    img.src = src;
  });
}
