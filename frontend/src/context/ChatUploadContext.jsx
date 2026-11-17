import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import messageService from "../services/messageService";
import useAuth from "../hooks/useAuth";
import {
  getChatUploads,
  removeChatUpload,
  saveChatUpload,
} from "../services/chatUploadStore";

const ChatUploadContext = createContext(null);

function isRetryableUploadError(error) {
  const status = error.response?.status;
  return !status || status === 429 || status >= 500;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function withoutPreviewUrl(upload) {
  const { previewUrl: _previewUrl, ...storedUpload } = upload;
  return storedUpload;
}

export function ChatUploadProvider({ children }) {
  const { user } = useAuth();
  const [uploads, setUploads] = useState([]);
  const uploadsRef = useRef([]);
  const previewUrlsRef = useRef(new Map());
  const processingRef = useRef(new Set());
  const mountedRef = useRef(true);

  const publishUploads = useCallback((nextUploads) => {
    uploadsRef.current = nextUploads;
    if (mountedRef.current) setUploads(nextUploads);
  }, []);

  const updateUpload = useCallback((uploadId, update) => {
    publishUploads(uploadsRef.current.map((upload) => (
      upload.id === uploadId ? { ...upload, ...update } : upload
    )));
  }, [publishUploads]);

  const processUpload = useCallback(async (upload) => {
    if (processingRef.current.has(upload.id)) return;
    processingRef.current.add(upload.id);

    let attempt = 0;
    try {
      updateUpload(upload.id, { status: "uploading", error: "" });
      await saveChatUpload(withoutPreviewUrl({ ...upload, status: "uploading" }));

      while (true) {
        try {
          const message = await messageService.sendAttachment(
            upload.conversationId,
            upload.file,
            upload.replyToId,
            "video"
          );
          window.dispatchEvent(new CustomEvent("ricehub:chat-video-uploaded", {
            detail: {
              conversationId: upload.conversationId,
              message,
            },
          }));
          await removeChatUpload(upload.id);
          const previewUrl = previewUrlsRef.current.get(upload.id);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          previewUrlsRef.current.delete(upload.id);
          publishUploads(uploadsRef.current.filter((item) => item.id !== upload.id));
          break;
        } catch (uploadError) {
          if (!isRetryableUploadError(uploadError)) {
            const failedUpload = {
              ...upload,
              status: "failed",
              retryable: false,
              error: uploadError.response?.data?.detail
                || uploadError.message
                || "Video upload failed.",
            };
            updateUpload(upload.id, failedUpload);
            await saveChatUpload(withoutPreviewUrl(failedUpload));
            break;
          }

          const retryableUpload = {
            ...upload,
            status: "uploading",
            retryable: true,
          };
          updateUpload(upload.id, retryableUpload);
          await saveChatUpload(withoutPreviewUrl(retryableUpload));
          await wait(Math.min(1000 * (2 ** attempt), 30_000));
          attempt += 1;
        }
      }
    } catch (queueError) {
      console.error("Chat video upload queue could not be updated:", queueError);
      updateUpload(upload.id, {
        status: "failed",
        retryable: false,
        error: queueError.message || "Video upload failed.",
      });
    } finally {
      processingRef.current.delete(upload.id);
    }
  }, [publishUploads, updateUpload]);

  useEffect(() => {
    mountedRef.current = true;
    if (!user?.id) {
      publishUploads([]);
      return () => {
        mountedRef.current = false;
      };
    }

    let active = true;
    getChatUploads(user.id).then((storedUploads) => {
      const restoredUploads = storedUploads.map((upload) => {
        const previewUrl = URL.createObjectURL(upload.file);
        previewUrlsRef.current.set(upload.id, previewUrl);
        return {
          ...upload,
          status: upload.retryable === false ? "failed" : "uploading",
          previewUrl,
        };
      });
      if (!active) {
        restoredUploads.forEach((upload) => {
          URL.revokeObjectURL(upload.previewUrl);
          previewUrlsRef.current.delete(upload.id);
        });
        return;
      }
      const restoredIds = new Set(restoredUploads.map((upload) => upload.id));
      publishUploads([
        ...restoredUploads,
        ...uploadsRef.current.filter((upload) => !restoredIds.has(upload.id)),
      ]);
      restoredUploads
        .filter((upload) => upload.retryable !== false)
        .forEach((upload) => void processUpload(upload));
    }).catch((storageError) => {
      console.error("Pending chat video uploads could not be restored:", storageError);
    });

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [processUpload, publishUploads, user?.id]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  const queueVideoUpload = useCallback(async ({
    conversationId,
    file,
    replyToId,
    attachmentType,
  }) => {
    if (!user?.id) throw new Error("Sign in to send chat videos.");

    const id = `local-video-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUrl = URL.createObjectURL(file);
    const upload = {
      id,
      conversationId,
      userId: user.id,
      file,
      fileName: file.name,
      fileType: file.type,
      replyToId,
      attachmentType,
      createdAt: new Date().toISOString(),
      status: "uploading",
      retryable: true,
      previewUrl,
    };

    previewUrlsRef.current.set(id, previewUrl);
    publishUploads([...uploadsRef.current, upload]);
    try {
      await saveChatUpload(withoutPreviewUrl(upload));
    } catch (storageError) {
      URL.revokeObjectURL(previewUrl);
      previewUrlsRef.current.delete(id);
      publishUploads(uploadsRef.current.filter((item) => item.id !== id));
      throw new Error("Video could not be queued for background upload.", {
        cause: storageError,
      });
    }

    void processUpload(upload);
    return id;
  }, [processUpload, publishUploads, user?.id]);

  return (
    <ChatUploadContext.Provider value={{ uploads, queueVideoUpload }}>
      {children}
    </ChatUploadContext.Provider>
  );
}

export function useChatUploads() {
  const context = useContext(ChatUploadContext);
  if (!context) {
    throw new Error("useChatUploads must be used within ChatUploadProvider.");
  }
  return context;
}
