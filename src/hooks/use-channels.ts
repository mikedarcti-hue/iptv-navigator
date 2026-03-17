import { useState, useEffect, useCallback } from "react";
import type { Channel } from "@/lib/mock-data";
import { getStoredChannels, setStoredChannels } from "@/lib/channel-store";

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>(() => getStoredChannels());
  const [loading, setLoading] = useState(false);

  // Sync from localStorage on mount and storage events
  useEffect(() => {
    const handler = () => setChannels(getStoredChannels());
    window.addEventListener("storage", handler);
    window.addEventListener("channels-updated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("channels-updated", handler);
    };
  }, []);

  const refreshChannels = useCallback(() => {
    setChannels(getStoredChannels());
  }, []);

  const updateChannels = useCallback((newChannels: Channel[]) => {
    setStoredChannels(newChannels);
    setChannels(newChannels);
    window.dispatchEvent(new Event("channels-updated"));
  }, []);

  return { channels, loading, refreshChannels, updateChannels };
}
