// frontend/src/hooks/useChatSocket.js

import { useEffect, useRef, useState } from "react";

export function useChatSocket(url) {
  const socketRef = useRef(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 5;
  const reconnectDelay = 2000;

  const connect = () => {
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onclose = () => {
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(c => c + 1);
          connect();
        }, reconnectDelay);
      }
    };
  };

  useEffect(() => {
    connect();
    return () => socketRef.current?.close();
  }, [url]);
}