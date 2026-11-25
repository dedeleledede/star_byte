import { useEffect, useId, useRef, useState } from "react";
import type { User } from "../api";

export function SearchUserPicker({ label, users, value, valueKey, onChange }: {
    label: string;
    users: Array<Pick<User, "id" | "username" | "displayName">>;
    value?: string;
    valueKey: "id" | "username";
    onChange: (value?: string) => void;
}) {
    const inputId = useId();
    const listId = `${inputId}-options`;
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const selected = users.find((user) => user[valueKey] === value);
    const term = query.trim().replace(/^@/, "").toLowerCase();
    const matches = users.filter((user) =>
        user.username.toLowerCase().includes(term) || user.displayName.toLowerCase().includes(term)
    ).sort((left, right) => {
        const rank = (user: typeof left) => !term || user.username.toLowerCase().startsWith(term) ? 0
            : user.displayName.toLowerCase().startsWith(term) ? 1
                : user.username.toLowerCase().includes(term) ? 2 : 3;
        return rank(left) - rank(right) || left.username.localeCompare(right.username);
    });

    useEffect(() => {
        if (!open) return;
        function closeOutside(event: MouseEvent) {
            if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", closeOutside);
        return () => document.removeEventListener("mousedown", closeOutside);
    }, [open]);

    function choose(user: (typeof users)[number]) {
        onChange(user[valueKey]);
        setQuery("");
        setOpen(false);
    }

    return (
        <div className="stack search-user-picker" ref={pickerRef}>
            <label htmlFor={inputId}>{label}</label>
            <input
                id={inputId}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={open}
                aria-controls={listId}
                aria-activedescendant={open && matches.length ? `${listId}-${selectedIndex}` : undefined}
                placeholder={label === "Mentions" ? "Anyone" : "Any user"}
                value={open ? query : selected ? `@${selected.username}` : ""}
                onFocus={() => { setQuery(""); setSelectedIndex(0); setOpen(true); }}
                onClick={() => { if (!open) { setQuery(""); setSelectedIndex(0); setOpen(true); } }}
                onChange={(event) => { setQuery(event.target.value); setSelectedIndex(0); onChange(undefined); setOpen(true); }}
                onBlur={(event) => { if (!pickerRef.current?.contains(event.relatedTarget as Node)) setOpen(false); }}
                onKeyDown={(event) => {
                    if (!open) return;
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        setSelectedIndex((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
                    } else if (event.key === "Enter") {
                        event.preventDefault();
                        if (matches.length) choose(matches[selectedIndex] ?? matches[0]);
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        setOpen(false);
                    }
                }}
            />
            {open && (
                <div className="search-user-options" id={listId} role="listbox" aria-label={label}>
                    {matches.length ? matches.map((user, index) => (
                        <button
                            key={user.id}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === selectedIndex}
                            className={index === selectedIndex ? "search-user-option search-user-option-active" : "search-user-option"}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => choose(user)}
                        >
                            <strong>@{user.username}</strong><span className="muted">{user.displayName}</span>
                        </button>
                    )) : <div className="muted search-user-empty">No users found.</div>}
                    {selected && <button className="search-user-option" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(undefined); setOpen(false); }}>Clear selection</button>}
                </div>
            )}
        </div>
    );
}

export function SearchDatePicker({ label, value, onChange }: {
    label: string;
    value?: string;
    onChange: (value?: string) => void;
}) {
    const pickerRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const [viewMonth, setViewMonth] = useState(() => {
        const date = value ? new Date(`${value}T12:00:00`) : new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1);
    });
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const thisYear = new Date().getFullYear();
    const firstYear = Math.min(thisYear - 100, year);
    const lastYear = Math.max(thisYear + 10, year);
    const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
    const months = Array.from({ length: 12 }, (_, index) => new Date(2020, index, 1).toLocaleString(undefined, { month: "long" }));

    useEffect(() => {
        if (!open) return;
        function closeOutside(event: MouseEvent) {
            if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
        }
        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", closeOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("mousedown", closeOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    function choose(day: number) {
        onChange(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        setOpen(false);
        triggerRef.current?.focus();
    }

    return (
        <div className="stack search-date-picker" ref={pickerRef}>
            <span>{label}</span>
            <div className="search-date-field">
                <button ref={triggerRef} className="button search-date-trigger" type="button" aria-expanded={open} aria-label={`${label}: ${value ?? "any date"}`} onClick={() => setOpen((current) => !current)}>
                    {value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "Any date"}
                </button>
                {value && <button className="button" type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { onChange(undefined); setOpen(false); }}>Clear</button>}
            </div>
            {open && (
                <div className="search-calendar" aria-label={`${label} calendar`}>
                    <div className="search-calendar-heading">
                        <button className="button" type="button" aria-label="Previous month" onClick={() => setViewMonth(new Date(year, month - 1, 1))}>‹</button>
                        <select aria-label="Month" value={month} onChange={(event) => setViewMonth(new Date(year, Number(event.target.value), 1))}>
                            {months.map((name, index) => <option key={name} value={index}>{name}</option>)}
                        </select>
                        <select aria-label="Year" value={year} onChange={(event) => setViewMonth(new Date(Number(event.target.value), month, 1))}>
                            {years.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <button className="button" type="button" aria-label="Next month" onClick={() => setViewMonth(new Date(year, month + 1, 1))}>›</button>
                    </div>
                    <div className="search-calendar-days">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span className="muted" key={day}>{day}</span>)}
                        {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
                        {Array.from({ length: daysInMonth }, (_, index) => {
                            const day = index + 1;
                            const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            return <button className={date === value ? "search-calendar-day search-calendar-day-selected" : "search-calendar-day"} key={day} type="button" aria-label={date} aria-pressed={date === value} onClick={() => choose(day)}>{day}</button>;
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

