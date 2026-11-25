import type { SyntheticEvent } from "react";
import { AvatarSquare } from "./Avatars";

export function ProfileScreen({   user, displayName, setDisplayName,
                           avatarUrl, setAvatarUrl,
                           bio, setBio, statusText, setStatusText,
                           onAvatarUpload, isUploadingAvatar,
                           onBack, onSave, isSaving, error, uploadError
                       }: {
    user: {
        username: string;
        displayName: string;
        avatarUrl?: string | null;
        bio?: string | null;
        statusText?: string | null;
    };
    displayName: string;
    setDisplayName: (value: string) => void;
    avatarUrl: string;
    setAvatarUrl: (value: string) => void;
    bio: string;
    setBio: (value: string) => void;
    statusText: string;
    setStatusText: (value: string) => void;
    onAvatarUpload: (file: File) => void;
    isUploadingAvatar: boolean;
    onBack: () => void;
    onSave: (event: SyntheticEvent) => void;
    isSaving: boolean;
    error?: string;
    uploadError?: string;
}) {
    return (
        <main className="thread-panel">
            <header className="thread-header">
                <h2>Profile</h2>
                <p className="muted">account settings</p>
            </header>

            <section className="profile-screen">
                <div className="profile-screen-top">
                    <AvatarSquare
                        displayName={displayName || user.displayName}
                        avatarUrl={avatarUrl || user.avatarUrl}
                        size="lg"
                    />

                    <div className="profile-screen-copy">
                        <strong>{user.username}</strong>
                        <div className="muted">@{user.username}</div>
                    </div>
                </div>

                <form className="profile-form" onSubmit={onSave}>
                    <label className="stack">
                        <span>Display name</span>
                        <input
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                        />
                    </label>

                    <label className="stack">
                        <span>Avatar URL</span>
                        <input
                            value={avatarUrl}
                            onChange={(event) => setAvatarUrl(event.target.value)}
                        />
                    </label>

                    <label className="button upload-button">
                        {isUploadingAvatar ? "Uploading image..." : "Upload profile image"}
                        <input
                            className="file-input"
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            disabled={isUploadingAvatar}
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onAvatarUpload(file);
                                event.target.value = "";
                            }}
                        />
                    </label>

                    <label className="stack">
                        <span>Status</span>
                        <input
                            value={statusText}
                            onChange={(event) => setStatusText(event.target.value)}
                        />
                    </label>

                    <label className="stack">
                        <span>Bio</span>
                        <textarea
                            value={bio}
                            onChange={(event) => setBio(event.target.value)}
                            rows={6}
                        />
                    </label>

                    {(error || uploadError) && <p className="error">{error ?? uploadError}</p>}

                    <div className="profile-actions">
                        <button type="button" className="button" onClick={onBack}>
                            Back
                        </button>
                        <button className="button button-primary" disabled={isSaving}>
                            {isSaving ? "Saving..." : "Save profile"}
                        </button>
                    </div>
                </form>
            </section>
        </main>
    );
}

