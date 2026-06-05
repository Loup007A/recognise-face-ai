#!/usr/bin/env node
/**
 * download-models.js
 * Downloads face-api.js model weights into frontend/public/models/
 * Run: node download-models.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'frontend', 'public', 'models');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

const FILES = [
  // TinyFaceDetector
  'tiny_face_detector_model-shard1',
  'tiny_face_detector_model-weights_manifest.json',
  // FaceLandmark68Net
  'face_landmark_68_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  // FaceRecognitionNet
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_recognition_model-weights_manifest.json',
  // FaceExpressionNet
  'face_expression_recognition_model-shard1',
  'face_expression_recognition_model-weights_manifest.json',
];

function download(filename) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}/${filename}`;
    const dest = path.join(MODELS_DIR, filename);

    if (fs.existsSync(dest)) {
      console.log(`  ✓ Already exists: ${filename}`);
      return resolve();
    }

    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${res.statusCode} for ${filename}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`  ↓ Downloaded: ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
    console.log(`Created directory: ${MODELS_DIR}`);
  }

  console.log(`\nDownloading face-api.js models to ${MODELS_DIR}...\n`);

  for (const file of FILES) {
    try {
      await download(file);
    } catch (err) {
      console.error(`  ✗ Failed: ${file} — ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n✅ All models downloaded successfully!\n');
}

main();
