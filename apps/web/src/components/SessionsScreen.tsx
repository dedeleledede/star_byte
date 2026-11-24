import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSessions,
  logoutEverywhere,
  revokeSession,
  type Session
} from "../api";

function formatRelativeTime(iso: string) {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return "Active now";
  if (diffSeconds < 3600) {
    const mins = Math.floor(diffSeconds / 60);
    return `${mins}m ago`;
  }
  if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffSeconds / 86400);
  return `${days}d ago`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

export function SessionsScreen({
  onBack,
  onForceLogout
}: {
  onBack: () => void;
  onForceLogout: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: () => fetchSessions().then((data) => data.sessions),
    refetchOnMount: "always",
    refetchInterval: 15000
  });

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      setRevokingSessionId(sessionId);
      return revokeSession(sessionId);
    },
    onSuccess: async (data, sessionId) => {
      if (data.revokedCurrent) {
        onForceLogout();
        return;
      }

      queryClient.setQueryData<Session[]>(["sessions"], (current = []) =>
        current.filter((item) => item.id !== sessionId)
      );
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onSettled: () => {
      setRevokingSessionId(null);
    }
  });

  const logoutOthersMutation = useMutation({
    mutationFn: () => logoutEverywhere(false),
    onSuccess: async () => {
      queryClient.setQueryData<Session[]>(["sessions"], (current = []) =>
        current.filter((item) => item.current)
      );
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  });

  const logoutEverywhereMutation = useMutation({
    mutationFn: () => logoutEverywhere(true),
    onSuccess: () => {
      onForceLogout();
    }
  });

  const sessions = [...(sessionsQuery.data ?? [])].sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt);
  });

  const otherSessionsCount = sessions.filter((s) => !s.current).length;
  const mutationError =
    revokeMutation.error ??
    logoutOthersMutation.error ??
    logoutEverywhereMutation.error;

  return (
    <main className="thread-panel">
      <header className="thread-header">
        <h2>Sessions &amp; Devices</h2>
        <p className="muted">manage active logins and revoke access</p>
      </header>

      <section className="profile-screen">
        <div className="sessions-toolbar">
          <div className="sessions-summary">
            <strong>
              {sessions.length} active {sessions.length === 1 ? "session" : "sessions"}
            </strong>
            <span className="muted">
              Revoking a session immediately signs out that device.
            </span>
          </div>

          <div className="sessions-toolbar-actions">
            <button
              type="button"
              className="button"
              onClick={() => void sessionsQuery.refetch()}
              disabled={sessionsQuery.isFetching}
            >
              {sessionsQuery.isFetching ? "Refreshing..." : "Refresh"}
            </button>

            {otherSessionsCount > 0 && (
              <button
                type="button"
                className="button"
                onClick={() => logoutOthersMutation.mutate()}
                disabled={logoutOthersMutation.isPending || logoutEverywhereMutation.isPending}
              >
                {logoutOthersMutation.isPending ? "Revoking..." : "Log out other devices"}
              </button>
            )}

            <button
              type="button"
              className="button button-danger"
              onClick={() => setConfirmLogoutAll(true)}
              disabled={sessions.length === 0 || logoutEverywhereMutation.isPending}
            >
              Log out everywhere
            </button>
          </div>
        </div>

        {confirmLogoutAll && (
          <div className="sessions-confirm-banner">
            <div>
              <strong>Log out everywhere?</strong>
              <p className="muted">
                This will revoke all {sessions.length} active{" "}
                {sessions.length === 1 ? "session" : "sessions"}, including this device.
              </p>
            </div>
            <div className="profile-actions">
              <button
                type="button"
                className="button"
                onClick={() => setConfirmLogoutAll(false)}
                disabled={logoutEverywhereMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={() => logoutEverywhereMutation.mutate()}
                disabled={logoutEverywhereMutation.isPending}
              >
                {logoutEverywhereMutation.isPending ? "Signing out..." : "Confirm log out everywhere"}
              </button>
            </div>
          </div>
        )}

        {(sessionsQuery.error || mutationError) && (
          <p className="error">
            {((sessionsQuery.error ?? mutationError) as Error).message}
          </p>
        )}

        {sessionsQuery.isLoading ? (
          <div className="muted">Loading active sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="muted">No active sessions found.</div>
        ) : (
          <div className="sessions-list">
            {sessions.map((session) => {
              const isRevokingThis =
                revokeMutation.isPending && revokingSessionId === session.id;

              return (
                <article
                  key={session.id}
                  className={`session-card ${session.current ? "session-card-current" : ""}`}
                >
                  <div className="session-card-main">
                    <div className="session-card-title">
                      <strong>{session.deviceName}</strong>
                      {session.current && (
                        <span className="session-badge">Current device</span>
                      )}
                    </div>

                    <div className="session-meta">
                      <span title={formatDateTime(session.lastActiveAt)}>
                        Last active: {formatRelativeTime(session.lastActiveAt)} ({formatDateTime(session.lastActiveAt)})
                      </span>
                      <span>Signed in: {formatDateTime(session.createdAt)}</span>
                      {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                    </div>

                    {session.userAgent && (
                      <div className="session-ua muted" title={session.userAgent}>
                        {session.userAgent}
                      </div>
                    )}
                  </div>

                  <div className="session-card-actions">
                    <button
                      type="button"
                      className={`button ${session.current ? "button-danger" : ""}`}
                      onClick={() => revokeMutation.mutate(session.id)}
                      disabled={isRevokingThis || logoutEverywhereMutation.isPending}
                    >
                      {isRevokingThis
                        ? "Revoking..."
                        : session.current
                          ? "Sign out"
                          : "Revoke"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="profile-actions">
          <button type="button" className="button" onClick={onBack}>
            Back
          </button>
        </div>
      </section>
    </main>
  );
}
