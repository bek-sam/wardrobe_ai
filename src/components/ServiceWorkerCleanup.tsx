"use client";

import { useEffect } from "react";

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      Promise.all(
        registrations.map(async (registration) => {
          await registration.update().catch(() => undefined);
          return registration.unregister();
        }),
      ),
    );
    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("open-wardrobe") || key.startsWith("wardrobe-"))
              .map((key) => caches.delete(key)),
          ),
        );
    }
  }, []);
  return null;
}
