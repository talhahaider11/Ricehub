import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ricehub.app",
  appName: "RiceHub",
  webDir: "dist",

  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      showSpinner: false,
    },
  },

  android: {
    allowMixedContent: false,
  },
};

export default config;