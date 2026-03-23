import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.darkiptv',
  appName: 'DARK IPTV',
  webDir: 'dist',
  server: {
    url: 'https://9e96ea94-5d8f-4083-9ab9-edf40595d719.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
