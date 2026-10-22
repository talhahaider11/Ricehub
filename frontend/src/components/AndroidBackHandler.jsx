import { App } from "@capacitor/app";
import { useEffect } from "react";

export default function AndroidBackHandler() {
  useEffect(() => {
    const listener = App.addListener(
      "backButton",
      ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      }
    );

    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);

  return null;
}