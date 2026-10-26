import {
    useState,
    useEffect,
    useRef,
    useMemo,
    type KeyboardEvent as ReactKeyboardEvent,
    type MouseEvent as ReactMouseEvent
} from "react";

import { emojiCategories, allEmojis, type EmojiCategory } from "../data/emojis";

interface EmojiPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onEmojiSelect: (emoji: string) => void;
    anchorElement: HTMLElement | null;
}

export function EmojiPicker({ isOpen, onClose, onEmojiSelect, anchorElement }: EmojiPickerProps) {
    const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [showSearchResults, setShowSearchResults] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const categoriesRef = useRef<HTMLDivElement>(null);

    // Filter emojis based on search query
    const filteredEmojis = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return allEmojis.filter(emoji => {
            // Simple search - we can match by common names or just return all for now
            return true;
        }).slice(0, 50);
    }, [searchQuery]);

    const activeCategory = emojiCategories[activeCategoryIndex];

    // Handle click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                onClose();
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            // Focus search input when opened
            requestAnimationFrame(() => searchInputRef.current?.focus());
        }

        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    // Handle keyboard navigation
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (!isOpen) return;

            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key === "Tab") {
                event.preventDefault();
                // Cycle through categories
                setActiveCategoryIndex((prev) => (prev + 1) % emojiCategories.length);
                return;
            }

            if (event.key === "ArrowRight" && !showSearchResults) {
                event.preventDefault();
                setActiveCategoryIndex((prev) => (prev + 1) % emojiCategories.length);
                return;
            }

            if (event.key === "ArrowLeft" && !showSearchResults) {
                event.preventDefault();
                setActiveCategoryIndex((prev) => (prev - 1 + emojiCategories.length) % emojiCategories.length);
                return;
            }
        }

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, showSearchResults]);

    // Position the picker
    useEffect(() => {
        if (!isOpen || !anchorElement || !pickerRef.current) return;

        const rect = anchorElement.getBoundingClientRect();
        const pickerRect = pickerRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Position above the anchor (composer)
        let top = rect.top - pickerRect.height - 8;
        let left = rect.left;

        // Adjust if would go off top of screen
        if (top < 8) {
            top = rect.bottom + 8;
        }

        // Adjust if would go off right of screen
        if (left + pickerRect.width > viewportWidth - 8) {
            left = viewportWidth - pickerRect.width - 8;
        }

        // Adjust if would go off left of screen
        if (left < 8) {
            left = 8;
        }

        pickerRef.current.style.top = `${top}px`;
        pickerRef.current.style.left = `${left}px`;
    }, [isOpen, anchorElement]);

    if (!isOpen) return null;

    function handleEmojiClick(emoji: string) {
        onEmojiSelect(emoji);
        // Keep picker open for multiple selection
        requestAnimationFrame(() => searchInputRef.current?.focus());
    }

    function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>) {
        const value = event.target.value;
        setSearchQuery(value);
        setShowSearchResults(value.length > 0);
        setActiveCategoryIndex(0); // Reset to first category when searching
    }

    function handleSearchFocus() {
        setShowSearchResults(searchQuery.length > 0);
    }

    function handleSearchBlur() {
        // Delay to allow click on emoji
        setTimeout(() => setShowSearchResults(false), 200);
    }

    function handleCategoryClick(index: number) {
        setActiveCategoryIndex(index);
        setShowSearchResults(false);
        searchInputRef.current?.blur();
    }

    return (
        <div
            ref={pickerRef}
            className="emoji-picker"
            role="dialog"
            aria-label="Emoji picker"
        >
            <div className="emoji-picker-header">
                <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search emojis..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    className="emoji-search-input"
                    aria-label="Search emojis"
                />
                <div className="emoji-categories" ref={categoriesRef} role="tablist">
                    {emojiCategories.map((category, index) => (
                        <button
                            key={category.name}
                            type="button"
                            role="tab"
                            aria-selected={activeCategoryIndex === index}
                            className={`emoji-category-tab ${activeCategoryIndex === index ? "active" : ""}`}
                            onClick={() => handleCategoryClick(index)}
                            onMouseDown={(e) => e.preventDefault()} // Prevent blur on search input
                        >
                            {category.emojis[0]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="emoji-picker-body">
                {showSearchResults && searchQuery.trim() ? (
                    <div className="emoji-grid" role="tabpanel">
                        {filteredEmojis.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                className="emoji-button"
                                onClick={() => handleEmojiClick(emoji)}
                                onMouseDown={(e) => e.preventDefault()}
                                aria-label={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                        {filteredEmojis.length === 0 && (
                            <div className="emoji-empty">No emojis found</div>
                        )}
                    </div>
                ) : (
                    <div className="emoji-grid" role="tabpanel">
                        {activeCategory.emojis.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                className="emoji-button"
                                onClick={() => handleEmojiClick(emoji)}
                                onMouseDown={(e) => e.preventDefault()}
                                aria-label={emoji}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="emoji-picker-footer">
                <span className="emoji-category-name">{activeCategory.name}</span>
                <button
                    type="button"
                    className="emoji-close-button"
                    onClick={onClose}
                    aria-label="Close emoji picker"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}