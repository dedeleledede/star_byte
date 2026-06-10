import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export function DesktopUpdater() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [message, setMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    void getVersion().then(setCurrentVersion);
  }, []);

  async function checkForUpdates() {
    setIsChecking(true);
    setMessage("");

    try {
      const update = await check();
      setAvailableUpdate(update);
      setMessage(update ? "" : "star_byte is up to date.");
    } catch {
      setMessage("Could not check for updates. Try again later.");
    } finally {
      setIsChecking(false);
    }
  }

  async function installUpdate() {
    if (!availableUpdate) return;

    setIsInstalling(true);
    setMessage("Installing update...");

    try {
      await availableUpdate.downloadAndInstall();
      await relaunch();
    } catch {
      setMessage("Could not install the update. Try again later.");
      setIsInstalling(false);
    }
  }

  return (
    <section className="desktop-updater">
      <div className="muted">star_byte {currentVersion || "..."}</div>

      <button className="button" type="button" onClick={() => void checkForUpdates()} disabled={isChecking || isInstalling}>
        {isChecking ? "Checking..." : "Check for updates"}
      </button>

      {availableUpdate && (
        <div className="desktop-update-available stack">
          <strong>Update available: {availableUpdate.version}</strong>
          {availableUpdate.body && (
            <div>
              <div className="muted">Release notes</div>
              <p className="muted">{availableUpdate.body}</p>
            </div>
          )}
          <div className="profile-actions">
            <button className="button button-primary" type="button" onClick={() => void installUpdate()} disabled={isInstalling}>
              {isInstalling ? "Installing..." : "Install update"}
            </button>
            <button className="button" type="button" onClick={() => setAvailableUpdate(null)} disabled={isInstalling}>
              Later
            </button>
          </div>
        </div>
      )}

      {message && <p className="muted">{message}</p>}
    </section>
  );
}
