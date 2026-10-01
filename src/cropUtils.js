/**
 * Crops a specific region from an image element using percentage coordinates.
 * @param {HTMLImageElement} imageElement - Loaded DOM Image object.
 * @param {Object} cropPercent - Bounding box { x, y, width, height } in percentage (0 to 100).
 * @returns {string} Base64 Data URL of the cropped image.
 */
export function cropImageRegion(imageElement, cropPercent) {
  const canvas = document.createElement("canvas");
  const scaleX = imageElement.naturalWidth / 100;
  const scaleY = imageElement.naturalHeight / 100;

  const pixelCrop = {
    x: cropPercent.x * scaleX,
    y: cropPercent.y * scaleY,
    width: cropPercent.width * scaleX,
    height: cropPercent.height * scaleY,
  };

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(
    imageElement,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL("image/png");
}

/**
 * Converts a File object to a raw Base64 string for API payloads.
 */
export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = (error) => reject(error);
  });