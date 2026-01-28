#!/usr/bin/env node
/**
 * Convert Playwright video recordings (webm) to GIFs
 *
 * Requires ffmpeg to be installed on the system.
 * On macOS: brew install ffmpeg
 * On Ubuntu: sudo apt install ffmpeg
 *
 * Usage: npm run gifs
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VIDEO_DIR = path.join(__dirname, 'test-results')
const OUTPUT_DIR = path.join(__dirname, 'output')

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

// Check if ffmpeg is installed
try {
  execSync('ffmpeg -version', { stdio: 'ignore' })
} catch {
  console.error('Error: ffmpeg is not installed.')
  console.error('Install it with:')
  console.error('  macOS: brew install ffmpeg')
  console.error('  Ubuntu: sudo apt install ffmpeg')
  process.exit(1)
}

// Find all video files
function findVideos(dir) {
  const videos = []
  if (!fs.existsSync(dir)) {
    console.log(`No video directory found at ${dir}`)
    console.log('Run "npm run screenshots:video" first to generate videos.')
    return videos
  }

  const items = fs.readdirSync(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    if (item.isDirectory()) {
      videos.push(...findVideos(fullPath))
    } else if (item.name.endsWith('.webm')) {
      videos.push(fullPath)
    }
  }
  return videos
}

// Convert a video to GIF
function convertToGif(videoPath, outputName) {
  const outputPath = path.join(OUTPUT_DIR, `${outputName}.gif`)

  console.log(`Converting: ${path.basename(videoPath)} -> ${outputName}.gif`)

  // Two-pass conversion for better quality
  // First pass: generate palette
  const paletteCmd = `ffmpeg -y -i "${videoPath}" -vf "fps=10,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff" -t 15 /tmp/palette.png`

  // Second pass: use palette to create GIF
  const gifCmd = `ffmpeg -y -i "${videoPath}" -i /tmp/palette.png -lavfi "fps=10,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -t 15 "${outputPath}"`

  try {
    execSync(paletteCmd, { stdio: 'ignore' })
    execSync(gifCmd, { stdio: 'ignore' })
    console.log(`  Created: ${outputPath}`)
    return outputPath
  } catch (error) {
    console.error(`  Error converting ${videoPath}:`, error.message)
    return null
  }
}

// Main
console.log('Converting Playwright videos to GIFs...')
console.log(`Looking for videos in: ${VIDEO_DIR}`)

const videos = findVideos(VIDEO_DIR)

if (videos.length === 0) {
  console.log('No video files found.')
  process.exit(0)
}

console.log(`Found ${videos.length} video(s)`)

const results = []
for (const video of videos) {
  // Extract test name from path
  const relativePath = path.relative(VIDEO_DIR, video)
  const testName = relativePath
    .replace(/[\\/]/g, '-')
    .replace('.webm', '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const result = convertToGif(video, testName)
  if (result) results.push(result)
}

console.log('')
console.log(`Conversion complete! ${results.length} GIF(s) created in ${OUTPUT_DIR}`)
