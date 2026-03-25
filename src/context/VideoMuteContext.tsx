import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface VideoMuteContextValue {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (value: boolean) => void;
}

const VideoMuteContext = createContext<VideoMuteContextValue>({
  isMuted: true,
  toggleMute: () => {},
  setMuted: () => {},
});

export const useVideoMute = (): VideoMuteContextValue => useContext(VideoMuteContext);

interface VideoMuteProviderProps {
  children: ReactNode;
}

export const VideoMuteProvider = ({ children }: VideoMuteProviderProps): React.JSX.Element => {
  const [isMuted, setIsMuted] = useState(true);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const setMuted = useCallback((value: boolean) => {
    setIsMuted(value);
  }, []);

  return (
    <VideoMuteContext.Provider value={{ isMuted, toggleMute, setMuted }}>
      {children}
    </VideoMuteContext.Provider>
  );
};

export default VideoMuteContext;
