/**
 * VideoMuteContext - Global mute state for video playback
 *
 * Tracks whether the user has unmuted videos. When a user taps to unmute
 * a video in the feed, the unmuted state persists as they navigate to
 * PhotoDetail, stories, and back to the feed. Resets to muted on app
 * background or when the user explicitly mutes.
 *
 * Usage:
 * - Wrap app root with <VideoMuteProvider>
 * - Components call useVideoMute() to get { isMuted, toggleMute, setMuted }
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const VideoMuteContext = createContext({
  isMuted: true,
  toggleMute: () => {},
  setMuted: () => {},
});

export const useVideoMute = () => useContext(VideoMuteContext);

export const VideoMuteProvider = ({ children }) => {
  const [isMuted, setIsMuted] = useState(true); // Start muted (feed autoplay muted)

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const setMuted = useCallback(value => {
    setIsMuted(value);
  }, []);

  return (
    <VideoMuteContext.Provider value={{ isMuted, toggleMute, setMuted }}>
      {children}
    </VideoMuteContext.Provider>
  );
};

export default VideoMuteContext;
