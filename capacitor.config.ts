import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Expenses',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
    }
  }
};

export default config;
