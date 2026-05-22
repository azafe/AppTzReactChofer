import { useState, useEffect } from "react";
import { apiPost, apiDelete } from "../lib/http";

const STORAGE_KEY = "tz-push-subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export function usePushNotifications() {
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  const [isSubscribed, setIsSubscribed] = useState(
    () => isSupported && localStorage.getItem(STORAGE_KEY) === "1"
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        const active = sub !== null;
        setIsSubscribed(active);
        if (active) {
          localStorage.setItem(STORAGE_KEY, "1");
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      });
    });
  }, [isSupported]);

  async function subscribe() {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!isSupported || !vapidKey) return;
    setIsLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await apiPost("/push/subscribe", sub.toJSON());
      localStorage.setItem(STORAGE_KEY, "1");
      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscribe failed:", err);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  async function unsubscribe() {
    if (!isSupported) return;
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiDelete(
          `/push/unsubscribe?endpoint=${encodeURIComponent(sub.endpoint)}`
        );
        await sub.unsubscribe();
      }
      localStorage.removeItem(STORAGE_KEY);
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe };
}
