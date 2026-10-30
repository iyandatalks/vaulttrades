"use client";

import { useEffect, useState } from "react";

function decodeKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

export default function AnalyzerPushSettings() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Checking this browser…");
  const [deviceCount, setDeviceCount] = useState(0);

  async function refresh() {
    const response = await fetch("/api/admin/analyzer-push/subscription", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load registered devices.");
    const data = await response.json();
    setDeviceCount((data.subscriptions || []).filter((item: any) => item.enabled).length);
  }

  useEffect(() => {
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    if (available) setPermission(Notification.permission);
    refresh().catch(() => setMessage("Sign in with the administrator account to manage push alerts."));
  }, []);

  async function enable() {
    setBusy(true); setMessage("");
    try {
      if (!supported) throw new Error("This browser does not support Web Push.");
      const keyResponse = await fetch("/api/admin/analyzer-push/public-key", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("Push keys are not configured on the server yet.");
      const { publicKey } = await keyResponse.json();
      const registration = await navigator.serviceWorker.register("/vaulttrades-admin-push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") throw new Error("Notification permission was not granted in Chrome.");
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(publicKey) });
      const saved = await fetch("/api/admin/analyzer-push/subscription", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!saved.ok) throw new Error("The device subscription could not be saved.");
      await refresh();
      setMessage("This device is connected. Send a test notification to confirm delivery.");
    } catch (error: any) { setMessage(error?.message || "Could not enable push notifications."); }
    finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/analyzer-push/test", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error === "NO_ACTIVE_DEVICE" ? "Connect this device first." : data.error || "Test notification failed.");
      setMessage("Test push sent. Check your Android notification shade.");
    } catch (error: any) { setMessage(error?.message || "Test notification failed."); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/vaulttrades-admin-push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/admin/analyzer-push/subscription", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      await refresh();
      setMessage("This device has been disconnected.");
    } catch { setMessage("Could not disconnect this device."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-amber-400/25 bg-[#171717] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold">Android Chrome device</h2><p className="mt-1 text-sm text-white/55">{deviceCount} active device subscription(s)</p></div>
      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{permission === "granted" ? "Permission granted" : `Permission: ${permission}`}</span>
    </div>
    <p className="mt-4 text-sm text-white/65">{supported ? "Web Push is supported in this browser." : "Web Push is not supported in this browser."}</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <button disabled={busy || !supported} onClick={enable} className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Please wait…" : "Enable this device"}</button>
      <button disabled={busy || deviceCount === 0} onClick={test} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Send test notification</button>
      <button disabled={busy || deviceCount === 0} onClick={disconnect} className="rounded-xl border border-red-400/30 px-4 py-2.5 text-sm text-red-200 disabled:opacity-50">Disconnect device</button>
    </div>
    {message && <p role="status" className="mt-4 text-sm text-amber-200">{message}</p>}
  </section>;
}
