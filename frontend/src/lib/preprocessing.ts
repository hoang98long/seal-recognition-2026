import type { Parameters } from '../types';

export const defaultParameters: Parameters = {
  rotation: 0,
  brightness: 0,
  contrast: 1,
  gamma: 1,
  saturation: 1,
  sharpen: 0,
  denoise: 0,
  grayscale: false,
  threshold_mode: 'off',
  threshold_value: 127,
  red_mask: false,
  hue_width: 15,
  saturation_min: 60,
  value_min: 40,
  morphology: 'none',
  kernel_size: 3,
  invert: false,
  background: 'none',
  apply_mask: true,
};

export function preprocessingPreset(name: string): Parameters {
  const presets: Record<string, Partial<Parameters>> = {
    original: {},
    red: { red_mask: true, background: 'white' },
    bw: { grayscale: true, threshold_mode: 'otsu' },
    gentle: { contrast: 1.1, sharpen: 0.3 },
  };
  return { ...defaultParameters, ...presets[name] };
}
