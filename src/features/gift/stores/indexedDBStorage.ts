export const GIFT_STORAGE_NAME = "intents_sdk.gift_maker_gifts"
const GIFT_STORE_NAME = "gifts"

export const indexedDBStorage = {
  dbName: GIFT_STORAGE_NAME,
  storeName: GIFT_STORE_NAME,

  openDB: () => {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(indexedDBStorage.dbName, 1)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(indexedDBStorage.storeName)) {
          db.createObjectStore(indexedDBStorage.storeName)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  },

  getItem: async (name: string) => {
    const db = await indexedDBStorage.openDB()
    return new Promise<string | null>((resolve, reject) => {
      const transaction = db.transaction(indexedDBStorage.storeName, "readonly")
      const store = transaction.objectStore(indexedDBStorage.storeName)
      const request = store.get(name)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  setItem: async (name: string, value: string) => {
    const db = await indexedDBStorage.openDB()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        indexedDBStorage.storeName,
        "readwrite"
      )
      const store = transaction.objectStore(indexedDBStorage.storeName)
      const request = store.put(value, name)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  removeItem: async (name: string) => {
    const db = await indexedDBStorage.openDB()
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(
        indexedDBStorage.storeName,
        "readwrite"
      )
      const store = transaction.objectStore(indexedDBStorage.storeName)
      const request = store.delete(name)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },
}
