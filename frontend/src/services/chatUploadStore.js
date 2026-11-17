const DATABASE_NAME = "ricehub-chat-uploads";
const STORE_NAME = "uploads";
const DATABASE_VERSION = 1;

let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("Chat upload storage is unavailable in this browser."));
        return;
      }
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(
        new Error("Chat upload storage is blocked by another tab.")
      );
    });
  }
  return databasePromise;
}

async function runTransaction(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;

    try {
      result = operation(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(
      transaction.error || new Error("Chat upload storage transaction was aborted.")
    );
  });
}

export async function getChatUploads(userId) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      resolve(request.result.filter(
        (upload) => String(upload.userId) === String(userId)
      ));
    };
    request.onerror = () => reject(request.error);
  });
}

export function saveChatUpload(upload) {
  return runTransaction("readwrite", (store) => store.put(upload));
}

export function removeChatUpload(uploadId) {
  return runTransaction("readwrite", (store) => store.delete(uploadId));
}
