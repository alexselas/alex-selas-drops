import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from '../types';

export function useAudioPlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const watermarkRef = useRef<HTMLAudioElement | null>(null);
  const watermarkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize audio elements
  useEffect(() => {
    audioRef.current = new Audio();
    watermarkRef.current = new Audio('/watermark.mp3');
    watermarkRef.current.volume = 0.4;

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      if (watermarkIntervalRef.current) {
        clearInterval(watermarkIntervalRef.current);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      if (watermarkIntervalRef.current) {
        clearInterval(watermarkIntervalRef.current);
      }
    };
  }, []);

  const startWatermarkLoop = useCallback(() => {
    if (watermarkIntervalRef.current) {
      clearInterval(watermarkIntervalRef.current);
    }
    // Play watermark every ~15 seconds
    watermarkIntervalRef.current = setInterval(() => {
      if (watermarkRef.current && isPlaying) {
        watermarkRef.current.currentTime = 0;
        watermarkRef.current.play().catch(() => {});
      }
    }, 15000);
  }, [isPlaying]);

  const play = useCallback((track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentTrack?.id === track.id) {
      // Toggle play/pause on same track
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
        if (watermarkIntervalRef.current) {
          clearInterval(watermarkIntervalRef.current);
        }
      } else {
        audio.play().catch(() => {});
        setIsPlaying(true);
        startWatermarkLoop();
      }
    } else {
      // New track
      audio.src = track.previewUrl;
      audio.load();
      audio.play().catch(() => {});
      setCurrentTrack(track);
      setIsPlaying(true);
      setProgress(0);
      setCurrentTime(0);

      // Play watermark immediately on new track
      if (watermarkRef.current) {
        watermarkRef.current.currentTime = 0;
        watermarkRef.current.play().catch(() => {});
      }
      startWatermarkLoop();
    }
  }, [currentTrack, isPlaying, startWatermarkLoop]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    if (watermarkIntervalRef.current) {
      clearInterval(watermarkIntervalRef.current);
    }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setCurrentTrack(null);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    if (watermarkIntervalRef.current) {
      clearInterval(watermarkIntervalRef.current);
    }
  }, []);

  const seek = useCallback((percent: number) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (percent / 100) * audio.duration;
    setProgress(percent);
  }, []);

  return {
    currentTrack,
    isPlaying,
    progress,
    duration,
    currentTime,
    play,
    pause,
    stop,
    seek,
  };
}
