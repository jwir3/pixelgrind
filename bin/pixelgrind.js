#!/usr/bin/env node

import chalk from 'chalk';
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
const AA_PIXEL_ALPHA_OVERLAY = 255;
const AA_PIXEL_ALPHA_OUTPUT = 255;

const AA_FALSE_POSITIVE_RED = 255;
const AA_FALSE_POSITIVE_GREEN = 0;
const AA_FALSE_POSITIVE_BLUE = 0;
const AA_FALSE_POSITIVE_ALPHA = 255;

const AA_FALSE_NEGATIVE_RED = 0;
const AA_FALSE_NEGATIVE_GREEN = 0;
const AA_FALSE_NEGATIVE_BLUE = 255;
const AA_FALSE_NEGATIVE_ALPHA = 255;

const AA_GROUND_TRUTH_RED = 0;
const AA_GROUND_TRUTH_GREEN = 153;
const AA_GROUND_TRUTH_BLUE = 255;
const AA_GROUND_TRUTH_ALPHA = 255;

const argv = yargs(hideBin(process.argv))
  .option('overlay', {
    describe: 'A path to the image file that will be a combination of the original image and the overlay highlighting antialiased pixels.'
  })
  .option('output', {
    describe: 'A path to the output directory.'
  })
  .option('without-aa', {
    describe: 'If set, this will contain a path to the image file that is a representation of the original image without any antialiased pixels.'
  })
  .option('image', {
    name: 'image',
    alias: 'i',
    describe: 'A path to a possibly antialiased image file'
  })
  .demandOption(['image', 'without-aa'])
  .default('output', 'out')
  .parse();

const imgPath = argv.image;
const imagePrefix = path.basename(imgPath, path.extname(imgPath));
const outputDirectory = argv.output;
const resultFilename = imagePrefix + "-result.png";
const resultPath = path.join(outputDirectory, resultFilename);
const overlayFilename = imagePrefix + "-overlay.png";
const overlayPath = path.join(outputDirectory, overlayFilename);
const differentialFilename = imagePrefix + "-differential.png";
const differentialPath = path.join(outputDirectory, differentialFilename);
const groundTruthFilename = imagePrefix + "-groundTruth.png";
const groundTruthPath = path.join(outputDirectory, groundTruthFilename);

const withoutAAPath = argv['without-aa'];

const options = {
  outputDirectory: outputDirectory,
  resultPath: resultPath,
  overlayPath: overlayPath,
  differentialPath: differentialPath,
  groundTruthPath: groundTruthPath,
  noAaPath: withoutAAPath,
};

const img = PNG.sync.read(fs.readFileSync(imgPath));

const {width, height} = img;

// If an image without antialiasing is given, let's import that to
// a png.
let imgNoAa = null;
let groundTruth = null;
let groundTruthImage = null;

imgNoAa = PNG.sync.read(fs.readFileSync(options.noAaPath));

// Create a boolean array of the results of whether each pixel is antialiased (ground truth).
groundTruth = new Uint8Array(width * height);

groundTruthImage = new PNG({ width, height });

const output = new PNG({ width, height });
// Set to all white for output image
output.data.fill(255);

const overlay = new PNG({ width, height });
const differentialImage = new PNG({ width, height });

// Make sure directories exist
mkdirpSync(options.outputDirectory);

// Loop through all pixels and determine if they are anti-aliased
let results = {
  aaPixels: 0,
  expectedAaPixels: 0,
  falseNegatives: 0,
  falsePositives: 0,
  truePositives: 0
};

console.time('detected aa pixels in');
for (let y = 0; y < img.height; y++) {
  for (let x = 0; x < img.width; x++) {
    const pixelIdx = (img.width * y + x) << 2;

    // Determine if we have a direct difference between the image and
    // it's corresponding version without AA. If there is, then this should
    // be registered as an antialiased pixel in the "ground truth".
    let noAaPixelIdx = null;
    noAaPixelIdx = (imgNoAa.width * y + x);
    const isSame = doesPixelRGBDirectlyMatch(img, imgNoAa, x, y);
    groundTruth[noAaPixelIdx] = isSame ? 0 : 1;
    results.expectedAaPixels += isSame ? 0 : 1;

    groundTruthImage.data[pixelIdx] = isSame ? 255 : AA_GROUND_TRUTH_RED;
    groundTruthImage.data[pixelIdx + 1] = isSame ? 255 : AA_GROUND_TRUTH_GREEN;
    groundTruthImage.data[pixelIdx + 2] = isSame ? 255 : AA_GROUND_TRUTH_BLUE;
    groundTruthImage.data[pixelIdx + 3] = isSame ? 0 : AA_GROUND_TRUTH_ALPHA;

    // Place original pixel in overlay image
    overlay.data[pixelIdx] = img.data[pixelIdx];
    overlay.data[pixelIdx + 1] = img.data[pixelIdx + 1];
    overlay.data[pixelIdx + 2] = img.data[pixelIdx + 2];
    overlay.data[pixelIdx + 3] = img.data[pixelIdx + 3];

    let antiAliased = antialiased(img.data, x, y, img.width, img.height);
    if (antiAliased) {
      results.aaPixels++;
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

      // If the ground truth says we should not be anti-aliased
      if (groundTruth[noAaPixelIdx] == 0) {
        results.falsePositives++;
        // A false positive was encountered
        differentialImage.data[pixelIdx] = AA_FALSE_POSITIVE_RED;
        differentialImage.data[pixelIdx + 1] = AA_FALSE_POSITIVE_GREEN;
        differentialImage.data[pixelIdx + 2] = AA_FALSE_POSITIVE_BLUE;
        differentialImage.data[pixelIdx + 3] = AA_FALSE_POSITIVE_ALPHA;
      } else {
        results.truePositives++;
      }
    } else {
      // If we are not antialiased and the ground truth says we should be
      if (groundTruth[noAaPixelIdx] == 1) {
        // A false negative was encountered
        results.falseNegatives++;
        differentialImage.data[pixelIdx] = AA_FALSE_NEGATIVE_RED;
        differentialImage.data[pixelIdx + 1] = AA_FALSE_NEGATIVE_GREEN;
        differentialImage.data[pixelIdx + 2] = AA_FALSE_NEGATIVE_BLUE;
        differentialImage.data[pixelIdx + 3] = AA_FALSE_NEGATIVE_ALPHA;
      }
    }
  }
}

console.timeEnd('detected aa pixels in');
console.log(`Detected ${results.aaPixels} anti-aliased pixels.`);
console.log(`Expected ${results.expectedAaPixels} anti-aliased pixels.`);
console.log(`True positives: ${results.truePositives}`);
console.log(`False positives: ${results.falsePositives}`);
console.log(`False negatives: ${results.falseNegatives}`);
console.log(`=========================`);
console.log(chalk.bold(`Precision: ${results.truePositives / (results.truePositives + results.falsePositives)}`));
console.log(chalk.bold(`Recall: ${results.truePositives / (results.truePositives + results.falseNegatives)}`));
console.log(chalk.bold(`F1 Score: ${2 * (results.truePositives / (results.truePositives + results.falsePositives)) * (results.truePositives / (results.truePositives + results.falseNegatives)) / ((results.truePositives / (results.truePositives + results.falsePositives)) + (results.truePositives / (results.truePositives + results.falseNegatives)))}`));

if (output) {
  fs.writeFileSync(options.resultPath, PNG.sync.write(output));
  fs.writeFileSync(options.overlayPath, PNG.sync.write(overlay));
  fs.writeFileSync(options.differentialPath, PNG.sync.write(differentialImage));
  fs.writeFileSync(options.groundTruthPath, PNG.sync.write(groundTruthImage));
}
