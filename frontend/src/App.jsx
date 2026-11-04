import React, { useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";

import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { NotificationProvider } from "./context/NotificationContext";
import { LanguageProvider } from "./context/LanguageContext";
import AppRoutes from "./routes/AppRoutes";

// Android Physical Back Button Handler Component
function AndroidBackHandler() {
  useEffect(() => {
    let listenerHandler = null;

    const setupBackListener = async () => {
      listenerHandler = await CapacitorApp.addListener(
        "backButton",
        ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapacitorApp.exitApp();
          }
        }
      );
    };

    setupBackListener();

    return () => {
      if (listenerHandler) {
        listenerHandler.remove();
      }
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <LanguageProvider>
            <AndroidBackHandler />
            <AppRoutes />
          </LanguageProvider>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}