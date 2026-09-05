'use client'

/**
 * Face Recognition Utility
 * Uses @vladmandic/face-api with browser WebGL backend.
 * Models are hosted at /models (copied from package weights).
 *
 * NOTE: face-api is loaded dynamically inside functions to avoid
 * server-side evaluation (the lib uses browser-only TextEncoder
 * which breaks Next.js SSR).
 *
 * Flow:
 *  - loadModels()      → load TinyFaceDetector + FaceLandmark68 + FaceRecognition
 *  - detectFace(video) → returns Float32Array descriptor (128-d) or null
 *  - compareDescriptors(a, b) → Euclidean distance (lower = more similar)
 *  - isMatch(a, b, threshold=0.55) → boolean
 */

import type * as FaceApi from '@vladmandic/face-api'

let modelsLoaded = false
let modelsLoading: Promise<void> | null = null
let faceapiLib: typeof FaceApi | null = null

const MODEL_URL = '/models'

// Threshold for face match. Default 0.5 (stricter) for attendance security.
// @vladmandic/face-api uses 0.5 as default; we use 0.55 to allow some lighting variation.
export const FACE_MATCH_THRESHOLD = 0.55

/**
 * Dynamically load the face-api library (browser-only).
 * Avoids SSR issues with TextEncoder.
 */
async function getFaceApi(): Promise<typeof FaceApi> {
  if (faceapiLib) return faceapiLib
  const mod = await import('@vladmandic/face-api')
  faceapiLib = mod
  return mod
}

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return
  if (modelsLoading) return modelsLoading

  modelsLoading = (async () => {
    const faceapi = await getFaceApi()
    // Use TinyFaceDetector for speed (190KB) — accurate enough for attendance
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
    modelsLoaded = true
  })()

  return modelsLoading
}

/**
 * Detect a single face from a video/image element and return its 128-d descriptor.
 * Returns null if no face is detected.
 */
export async function detectFace(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<{ descriptor: Float32Array; score: number; box: { x: number; y: number; width: number; height: number } } | null> {
  const faceapi = await getFaceApi()
  await loadModels()

  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.5,
  })

  const result = await faceapi
    .detectSingleFace(input, options)
    .withFaceLandmarks()
    .withFaceDescriptor()

  if (!result) return null

  return {
    descriptor: result.descriptor,
    score: result.detection.score,
    box: {
      x: result.detection.box.x,
      y: result.detection.box.y,
      width: result.detection.box.width,
      height: result.detection.box.height,
    },
  }
}

/**
 * Euclidean distance between two face descriptors.
 * Lower distance = more similar faces.
 */
export function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
  const arrA = a instanceof Float32Array ? a : new Float32Array(a)
  const arrB = b instanceof Float32Array ? b : new Float32Array(b)
  if (arrA.length !== arrB.length) return Infinity
  let sum = 0
  for (let i = 0; i < arrA.length; i++) {
    const diff = arrA[i] - arrB[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/**
 * Check if two descriptors match (i.e., same person).
 */
export function isMatch(
  a: Float32Array | number[],
  b: Float32Array | number[],
  threshold: number = FACE_MATCH_THRESHOLD
): boolean {
  return euclideanDistance(a, b) < threshold
}

/**
 * Convert Float32Array descriptor to JSON-serializable number[] for storage.
 */
export function descriptorToArray(d: Float32Array): number[] {
  return Array.from(d)
}

/**
 * Convert stored number[] back to Float32Array for comparison.
 */
export function arrayToDescriptor(arr: number[]): Float32Array {
  return new Float32Array(arr)
}

/**
 * Helper: start a webcam stream and return the MediaStream.
 * Throws if camera is not available or permission denied.
 */
export async function startCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Browser tidak mendukung akses kamera')
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
    },
    audio: false,
  })
}

/**
 * Helper: stop all tracks of a MediaStream.
 */
export function stopCamera(stream: MediaStream | null) {
  if (!stream) return
  stream.getTracks().forEach((track) => track.stop())
}

/**
 * Helper: capture a frame from video element to a canvas (for preview/save).
 */
export function captureFrame(
  video: HTMLVideoElement,
  maxWidth: number = 480
): { dataUrl: string; canvas: HTMLCanvasElement } | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const ratio = video.videoHeight / video.videoWidth
  const w = Math.min(maxWidth, video.videoWidth)
  const h = Math.round(w * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // Mirror horizontally to match the mirrored video preview
  ctx.translate(w, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, 0, 0, w, h)
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), canvas }
}
