/**
 * Check if a pixel is likely a part of anti-aliasing;
 * based on "Anti-aliased Pixel and Intensity Slope Detector" paper by V. Vysniauskas, 2009
 * @param {Uint8Array | Uint8ClampedArray} img The image, in Uint8Array format.
 * @param {number} x The x coordinate of the pixel to check for anti-aliasing.
 * @param {number} y The y coordinate of the pixel to check for anti-aliasing.
 * @param {number} width The width of the image, in pixels.
 * @param {number} height The height of the image, in pixels.
 */
export function antialiased(img, x, y, width, height) {
  const x0 = Math.max(x - 1, 0);
  const y0 = Math.max(y - 1, 0);
  const x2 = Math.min(x + 1, width - 1);
  const y2 = Math.min(y + 1, height - 1);
  const pos = y * width + x;
  let zeroes = x === x0 || x === x2 || y === y0 || y === y2 ? 1 : 0;
  let min = 0;
  let max = 0;
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;

  // go through 8 adjacent pixels
  for (let nx = x0; nx <= x2; nx++) {
    for (let ny = y0; ny <= y2; ny++) {
      if (nx === x && ny === y) continue;

      // brightness delta between the center pixel and adjacent one
      const delta = colorDelta(img, img, pos * 4, (ny * width + nx) * 4, true);

      // count the number of equal, darker and brighter adjacent pixels
      if (delta === 0) {
        zeroes++;
        // if found more than 2 equal siblings, it's definitely not anti-aliasing
        if (zeroes > 2) return false;

        // remember the darkest pixel
      } else if (delta < min) {
        min = delta;
        minX = nx;
        minY = ny;

        // remember the brightest pixel
      } else if (delta > max) {
        max = delta;
        maxX = nx;
        maxY = ny;
      }
    }
  }

  // if there are no both darker and brighter pixels among siblings, it's not anti-aliasing
  if (min === 0 || max === 0) return false;

  // according to the paper, a pixel is anti-aliased if it has both darker and brighter neighbors
  // and represents a smooth intensity transition between them
  const centerR = img[pos * 4];
  const centerG = img[pos * 4 + 1];
  const centerB = img[pos * 4 + 2];

  const minPos = minY * width + minX;
  const maxPos = maxY * width + maxX;

  const minR = img[minPos * 4];
  const minG = img[minPos * 4 + 1];
  const minB = img[minPos * 4 + 2];

  const maxR = img[maxPos * 4];
  const maxG = img[maxPos * 4 + 1];
  const maxB = img[maxPos * 4 + 2];

  // check if the center pixel's RGB values are between min and max (indicating gradient)
  const isIntermediate = (
    (centerR >= Math.min(minR, maxR) && centerR <= Math.max(minR, maxR))
    && (centerG >= Math.min(minG, maxG) && centerG <= Math.max(minG, maxG))
    && (centerB >= Math.min(minB, maxB) && centerB <= Math.max(minB, maxB))
  );

  // anti-aliasing is detected when pixel forms intermediate color between extremes
  return isIntermediate;
}

/**
 * Check if a pixel has 3+ adjacent pixels of the same color.
 * @param {Uint32Array} img
 * @param {number} x1
 * @param {number} y1
 * @param {number} width
 * @param {number} height
 */
function hasManySiblings(img, x1, y1, width, height) {
  const x0 = Math.max(x1 - 1, 0);
  const y0 = Math.max(y1 - 1, 0);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  const val = img[y1 * width + x1];
  let zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;

  // go through 8 adjacent pixels
  for (let x = x0; x <= x2; x++) {
    for (let y = y0; y <= y2; y++) {
      if (x === x1 && y === y1) continue;
      zeroes += +(val === img[y * width + x]);
      if (zeroes > 2) return true;
    }
  }
  return false;
}

/**
 * Calculate color difference according to the paper "Measuring perceived color difference
 * using YIQ NTSC transmission color space in mobile applications" by Y. Kotsarenko and F. Ramos
 * @param {Uint8Array | Uint8ClampedArray} img1
 * @param {Uint8Array | Uint8ClampedArray} img2
 * @param {number} k
 * @param {number} m
 * @param {boolean} yOnly
 */
function colorDelta(img1, img2, k, m, yOnly) {
  const r1 = img1[k];
  const g1 = img1[k + 1];
  const b1 = img1[k + 2];
  const a1 = img1[k + 3];
  const r2 = img2[m];
  const g2 = img2[m + 1];
  const b2 = img2[m + 2];
  const a2 = img2[m + 3];

  let dr = r1 - r2;
  let dg = g1 - g2;
  let db = b1 - b2;
  const da = a1 - a2;

  if (!dr && !dg && !db && !da) return 0;

  if (a1 < 255 || a2 < 255) { // blend pixels with background
    const rb = 48 + 159 * (k % 2);
    const gb = 48 + 159 * ((k / 1.618033988749895 | 0) % 2);
    const bb = 48 + 159 * ((k / 2.618033988749895 | 0) % 2);
    dr = (r1 * a1 - r2 * a2 - rb * da) / 255;
    dg = (g1 * a1 - g2 * a2 - gb * da) / 255;
    db = (b1 * a1 - b2 * a2 - bb * da) / 255;
  }

  const y = dr * 0.29889531 + dg * 0.58662247 + db * 0.11448223;

  if (yOnly) return y; // brightness difference only

  const i = dr * 0.59597799 - dg * 0.27417610 - db * 0.32180189;
  const q = dr * 0.21147017 - dg * 0.52261711 + db * 0.31114694;

  const delta = 0.5053 * y * y + 0.299 * i * i + 0.1957 * q * q;

  // encode whether the pixel lightens or darkens in the sign
  return y > 0 ? -delta : delta;
}

/**
 * @param {Uint8Array | Uint8ClampedArray} output The data array of raw pixels.
 * @param {number} pos The index of the pixel in the data array.
 * @param {number} r The red component of the pixel.
 * @param {number} g The green component of the pixel.
 * @param {number} b The blue component of the pixel.
 * @param {number} a The alpha component of the pixel.
 */
function drawPixel(output, pos, r, g, b, a) {
  output[pos + 0] = r;
  output[pos + 1] = g;
  output[pos + 2] = b;
  output[pos + 3] = a;
}

export function doesPixelRGBDirectlyMatch(img1, img2, x, y) {
  if (img1.width != img2.width || img1.height != img2.height) {
    throw new Error('Images must have the same width and height')
  }

  const pixelIdx = (img1.width * y + x) << 2;

  let img1Red = img1.data[pixelIdx];
  let img2Red = img2.data[pixelIdx];

  let img1Green = img1.data[pixelIdx + 1];
  let img2Green = img2.data[pixelIdx + 1];

  let img1Blue = img1.data[pixelIdx + 2];
  let img2Blue = img2.data[pixelIdx + 2];

  return img1Red === img2Red && img1Green === img2Green && img1Blue === img2Blue;
}
