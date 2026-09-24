// Converts a selected image file into a base64 data URL, small enough
// to store directly in the database as text. We resize/compress on a
// canvas first so a phone screenshot (often 2-4MB) shrinks to a
// reasonable size before being turned into base64.
const MAX_DIMENSION = 1280
const JPEG_QUALITY = 0.72
const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024 // ~1.5MB of base64 text

export function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.onload = () => {
        let { width, height } = img
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const scale = MAX_DIMENSION / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
        if (dataUrl.length > MAX_OUTPUT_BYTES) {
          reject(new Error('That image is too large even after compressing — try a smaller screenshot.'))
          return
        }
        resolve(dataUrl)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
