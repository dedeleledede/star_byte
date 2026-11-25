import type { ReactNode } from "react";

function DesktopTitlebar() {
    async function withWindow(action: (window: import("@tauri-apps/api/window").Window) => Promise<unknown>) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await action(getCurrentWindow());
    }

    return (
        <header
            className="desktop-titlebar"
            data-tauri-drag-region
        >
            <strong className="desktop-titlebar-brand" data-tauri-drag-region>
                <img src="/sb_logo.svg" alt="" />
                <span>star_byte</span>
            </strong>
            <div className="desktop-window-controls" onDoubleClick={(event) => event.stopPropagation()}>
                <button
                    type="button"
                    aria-label="Minimize"
                    title="Minimize"
                    onClick={() => void withWindow((window) => window.minimize())}
                >
                    -
                </button>
                <button
                    type="button"
                    aria-label="Maximize"
                    title="Maximize"
                    onClick={() => void withWindow((window) => window.toggleMaximize())}
                >
                    []
                </button>
                <button
                    type="button"
                    className="desktop-window-close"
                    aria-label="Close"
                    title="Close"
                    onClick={() => void withWindow((window) => window.close())}
                >
                    x
                </button>
            </div>
        </header>
    );
}

function DesktopResizeHandles() {
    const directions = [
        "North",
        "NorthEast",
        "East",
        "SouthEast",
        "South",
        "SouthWest",
        "West",
        "NorthWest"
    ] as const;

    async function startResize(direction: typeof directions[number]) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        await getCurrentWindow().startResizeDragging(direction);
    }

    return (
        <>
            {directions.map((direction) => (
                <div
                    key={direction}
                    className={`window-resize-handle window-resize-${direction.toLowerCase()}`}
                    onMouseDown={(event) => {
                        if (event.button === 0) void startResize(direction);
                    }}
                    aria-hidden="true"
                />
            ))}
        </>
    );
}

export function DesktopFrame({ children }: { children: ReactNode }) {
    return (
        <div className="tauri-frame">
            <DesktopResizeHandles />
            <DesktopTitlebar />
            <div className="tauri-content">{children}</div>
        </div>
    );
}
