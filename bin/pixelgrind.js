#!/usr/bin/env node

import fs from 'fs';
import { mkdirpSync} from 'mkdirp';
import path from 'path';
import {PNG} from 'pngjs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { antialiased, doesPixelRGBDirectlyMatch } from '../src/index.js';

const AA_PIXEL_RED = 245;
const AA_PIXEL_GREEN = 93;
const AA_PIXEL_BLUE = 230;
const AA_PIXEL_ALPHA_OVERLAY = 130;
const AA_PIXEL_ALPHA_OUTPUT = 255;

const argv = yargs(hideBin(process.argv))
  .option('overlay', {
    describe: 'A path to the image file that will be a combination of the original image and the overlay highlighting antialiased pixels.'
  })
  .option('output', {
    describe: 'A path to the output image file.'
  })
  .option('without-aa', {
    describe: 'If set, this will contain a path to the image file that is a representation of the original image without any antialiased pixels.'
  })
  .option('image', {
    name: 'image',
    alias: 'i',
    describe: 'A path to a possibly antialiased image file'
  })
  .demandOption(['image'])
  .default('output', 'out/output.png')
  .default('overlay', 'out/overlay.png')
  .parse();

const imgPath = argv.image;
const outputPath = argv.output;
const overlayPath = argv.overlay;
const withoutAAPath = argv['without-aa'];

const options = {
  outputPath: outputPath || 'out/output.png',
  overlayPath: overlayPath || 'out/overlay.png',
  noAaPath: withoutAAPath || null,
};

const img = PNG.sync.read(fs.readFileSync(imgPath));

const {width, height} = img;

// If an image without antialiasing is given, let's import that to
// a png.
let imgNoAa = null;
let groundTruth = null;

if (options.noAaPath) {
  imgNoAa = PNG.sync.read(fs.readFileSync(options.noAaPath));

  // Create a boolean array of the results of whether each pixel is antialiased (ground truth).
  groundTruth = new Uint8Array(width * height);
}

const output = new PNG({ width, height });
// Set to all white for output image
output.data.fill(255);

const overlay = new PNG({ width, height });

// Make sure directories exist
mkdirpSync(path.dirname(options.outputPath));
mkdirpSync(path.dirname(options.overlayPath));

// Loop through all pixels and determine if they are anti-aliased
let aaPixels = 0;
let expectedAaPixels = 0;
console.time('detected aa pixels in');
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    const pixelIdx = (img.width * y + x) << 2;

    // Determine if we have a direct difference between the image and
    // it's corresponding version without AA. If there is, then this should
    // be registered as an antialiased pixel in the "ground truth".
    if (!!imgNoAa) {
      const noAaPixelIdx = (imgNoAa.width * y + x);
      const isSame = doesPixelRGBDirectlyMatch(img, imgNoAa, x, y);
      groundTruth[noAaPixelIdx] = isSame ? 0 : 1;
      expectedAaPixels += isSame ? 0 : 1;
    }

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
console.log(`Expected ${expectedAaPixels} anti-aliased pixels.`);

if (output) {
  fs.writeFileSync(options.outputPath, PNG.sync.write(output));
  fs.writeFileSync(options.overlayPath, PNG.sync.write(overlay));
}
