/**
 * imageEnhancement — pre-processing helpers to maximise OCR accuracy.
 *
 * Uses react-native-image-resizer (already linked in this app) instead of
 * expo-image-manipulator, which can crash release builds without Expo modules.
 */

import ImageResizer from 'react-native-image-resizer';

export interface EnhancementOptions {
  targetMinDimension?: number;
  quality?: number;
}

const DEFAULTS: Required<EnhancementOptions> = {
  targetMinDimension: 1800,
  quality: 0.95,
};

export interface EnhancedImage {
  uri: string;
  width: number;
  height: number;
}

function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Enhance a local image URI and return a new local URI ready for S3 upload.
 */
export async function enhanceForOCR(
  sourceUri: string,
  options: EnhancementOptions = {},
): Promise<EnhancedImage> {
  const opts = {...DEFAULTS, ...options};
  const maxSide = Math.max(opts.targetMinDimension * 2, 2400);

  const result = await ImageResizer.createResizedImage(
    toFileUri(sourceUri),
    maxSide,
    maxSide,
    'JPEG',
    Math.round(opts.quality * 100),
    0,
    undefined,
    false,
  );

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Quick check: returns true if the image is likely a valid antigen panel scan
 * (landscape or near-square, minimum resolution).
 */
export function validateImageDimensions(
  width: number,
  height: number,
): {valid: boolean; reason?: string} {
  const MIN_PX = 800;
  if (width < MIN_PX || height < MIN_PX) {
    return {
      valid: false,
      reason: `Image too small (${width}×${height}). Minimum: ${MIN_PX}px on each side.`,
    };
  }

  const ratio = width / height;
  if (ratio < 0.4 || ratio > 4) {
    return {valid: false, reason: 'Image aspect ratio looks unusual for an antigen panel.'};
  }

  return {valid: true};
}
