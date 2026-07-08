import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) {
    return null;
  }

  return (
    <div className="pwa-toast">
      <div className="pwa-toast-copy">
        <img src="/sb_logo.svg" alt="" className="pwa-toast-logo" />
        <div>
          {needRefresh ? "An update is ready over Wi-Fi or web reconnect." : "App is ready for offline use."}
        </div>
      </div>

      <div className="pwa-actions">
        {needRefresh && (
          <button
            className="button button-primary"
            onClick={() => updateServiceWorker(true)}
          >
            Reload
          </button>
        )}

        <button
          className="button"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
