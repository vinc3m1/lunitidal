import type { DistanceUnit, HeightUnit, TimeFormat } from '../engine/types';
import { persisted } from './persisted';

export interface Settings {
  heightUnit: HeightUnit;
  distanceUnit: DistanceUnit;
  timeFormat: TimeFormat;
  theme: 'dark' | 'light' | 'auto';
  showMarine: boolean;
}

export const defaultSettings: Settings = {
  heightUnit: 'm',
  distanceUnit: 'km',
  timeFormat: '24h',
  theme: 'dark',
  showMarine: true,
};

export const settings = persisted<Settings>('lunitidal:settings', defaultSettings);
