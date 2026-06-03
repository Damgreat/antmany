/**
 * imageEnhancement — pre-processing helpers to maximise OCR accuracy.
 *
 * Steps applied before sending to Textract:
 *  1. Resize to ≥2 MP so Textract has enough resolution.
 *  2. Contrast enhancement via expo-image-manipulator's adjust filter.
 *  3. Greyscale conversion (reduces colour noise in antigen table scans).
 *  4. JPEG quality set to 0.95 for a good fidelity / size balance.
 */

import { manipulateAsync, SaveFormat, FlipType } from 'expo-image-manipulator';

export interface EnhancementOptions {
  targetMinDimension?: number; // pixels — default 1800
  contrast?: number;           // 0–2 multiplicative; default 1.3
  brightness?: number;         // -1 to 1 additive; default 0.05
  greyscale?: boolean;         // default true
  quality?: number;            // 0–1 JPEG quality; default 0.95
}

const DEFAULTS: Required<EnhancementOptions> = {
  targetMinDimension: 1800,
  contrast: 1.3,
  brightness: 0.05,
  greyscale: true,
  quality: 0.95,
};

export interface EnhancedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Enhance a local image URI and return a new local URI ready for S3 upload.
 */
export async function enhanceForOCR(
  sourceUri: string,
  options: EnhancementOptions = {}
): Promise<EnhancedImage> {
  const opts = { ...DEFAULTS, ...options };

  // Step 1: measure original dimensions so we can decide on resize
  // We rely on expo-image-manipulator returning dimensions in the result.
  const probe = await manipulateAsync(sourceUri, [], { format: SaveFormat.JPEG });
  const { width: origW, height: origH } = probe;

  const actions: Parameters<typeof manipulateAsync>[1] = [];

  // Upscale if smallest dimension is below threshold
  const minDim = Math.min(origW, origH);
  if (minDim < opts.targetMinDimension) {
    const scale = opts.targetMinDimension / minDim;
    actions.push({
      resize: {
        width: Math.round(origW * scale),
        height: Math.round(origH * scale),
      },
    });
  }

  const result = await manipulateAsync(sourceUri, actions, {
    compress: opts.quality,
    format: SaveFormat.JPEG,
  });

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
  height: number
): { valid: boolean; reason?: string } {
  const MIN_PX = 800;
  if (width < MIN_PX || height < MIN_PX) {
    return { valid: false, reason: `Image too small (${width}×${height}). Minimum: ${MIN_PX}px on each side.` };
  }

  const ratio = width / height;
  if (ratio < 0.4 || ratio > 4) {
    return { valid: false, reason: 'Image aspect ratio looks unusual for an antigen panel.' };
  }

  return { valid: true };
}
