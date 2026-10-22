import { useEffect } from "react";
import { App } from "@capacitor/app";

export function useAndroidBackButton() {
  useEffect(() => {
    let listener;

    App.addListener(
      "backButton",
      ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      }
    ).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove();
    };
  }, []);
  
}