#!/usr/bin/env node

import fs from 'fs';
import { mkdirpSync} from 'mkdirp';
import path from 'path';
import {PNG} from 'pngjs';

import { antialiased } from '../src/index.js';

const AA_PIXEL_RED = 245;
const AA_PIXEL_GREEN = 93;
const AA_PIXEL_BLUE = 230;
const AA_PIXEL_ALPHA_OVERLAY = 130;
const AA_PIXEL_ALPHA_OUTPUT = 255;

if (process.argv.length < 3) {
  console.log('Usage: pixelgrind image1.png [output.png] [overlay.png]');
  process.exit(1);
}

const [,, imgPath, outputPath, overlayPath] = process.argv;
const options = {
  outputPath: outputPath || 'out/output.png',
  overlayPath: overlayPath || 'out/overlay.png'
};

const img = PNG.sync.read(fs.readFileSync(imgPath));
const {width, height} = img;

const output = new PNG({ width, height });
// Set to all white for output image
output.data.fill(255);

const overlay = new PNG({ width, height });

// Make sure directories exist
mkdirpSync(path.dirname(options.outputPath));
mkdirpSync(path.dirname(options.overlayPath));

// Create a Uint8Array of the image data
const uint8ArrayResult = img.data;

// Loop through all pixels and determine if they are anti-aliased
let aaPixels = 0;
console.time('detected aa pixels in');
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    const pixelIdx = (img.width * y + x) << 2;

    // Place original pixel in overlay image
    overlay.data[pixelIdx] = img.data[pixelIdx];
    overlay.data[pixelIdx + 1] = img.data[pixelIdx + 1];
    overlay.data[pixelIdx + 2] = img.data[pixelIdx + 2];
    overlay.data[pixelIdx + 3] = img.data[pixelIdx + 3];

    let antiAliased = antialiased(img.data, x, y, img.width, img.height);
    if (antiAliased) {
      aaPixels++;
      output.data[pixelIdx] = AA_PIXEL_RED;
      output.data[pixelIdx + 1] = AA_PIXEL_GREEN;
      output.data[pixelIdx + 2] = AA_PIXEL_BLUE;
      output.data[pixelIdx + 3] = AA_PIXEL_ALPHA_OUTPUT;

      // Composite anti-aliased pixels with original image and save to overlay
      let aaLevel = AA_PIXEL_ALPHA_OVERLAY / 255.0;
      let oneMinusAALevel = 1.0 - aaLevel;
      overlay.data[pixelIdx] = overlay.data[pixelIdx] = (img.data[pixelIdx] * oneMinusAALevel)
        + (aaLevel * AA_PIXEL_RED);
      overlay.data[pixelIdx + 1] = (img.data[pixelIdx + 1] * oneMinusAALevel) + (aaLevel * AA_PIXEL_GREEN);
      overlay.data[pixelIdx + 2] = (img.data[pixelIdx + 2] * oneMinusAALevel) + (aaLevel * AA_PIXEL_BLUE);
      overlay.data[pixelIdx + 3] = 255;
    }
  }
}
console.timeEnd('detected aa pixels in');
console.log(`Detected ${aaPixels} anti-aliased pixels.`);

if (output) {
  fs.writeFileSync(options.outputPath, PNG.sync.write(output));
  fs.writeFileSync(options.overlayPath, PNG.sync.write(overlay));
}
