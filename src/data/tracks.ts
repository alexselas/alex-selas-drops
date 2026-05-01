import type { Track } from '../types';

// Demo tracks are only used as fallback if the API returns nothing.
// In production, tracks come from Redis via /api/tracks.
export const demoTracks: Track[] = [];
