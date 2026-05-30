import type { DistanceUnit, HeightUnit, TimeFormat } from '../engine/types';
import { persisted } from './persisted';

export interface Settings {
  heightUnit: HeightUnit;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  /** Chart datum key, or null to use each station's own chart_datum. */
  datum: string | null;
  theme: 'dark' | 'light' | 'auto';
}

export const defaultSettings: Settings = {
  heightUnit: 'm',
  distanceUnit: 'km',
  timeFormat: '24h',
  datum: null,
  theme: 'dark',
};

export const settings = persisted<Settings>('lunitidal:settings', defaultSettings);
