import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ricehub.app",
  appName: "RiceHub",
  webDir: "dist",

  server: {
    // Native app Android HTTPS scheme configuration
    androidScheme: "https",
    // Allow mixed content for local testing fallback (False in Production)
    cleartext: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },

  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;