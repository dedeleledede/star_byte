# Starbyte Backlog

This backlog records planned product, platform, community, security, accessibility, self-hosting, and infrastructure work for Starbyte.

Starbyte is a private chatting network for friends inside a closed community. The main hosted Starbyte instance is intended to remain invite-only, while self-hosting should be clear and practical for independent communities.

## Product principles

- Keep the main Starbyte instance private and invitation-based.
- Do not require a desktop client update for backend-only fixes.
- Preserve a lightweight path for low-resource devices and IRC-oriented users.
- Keep self-hosting understandable and maintainable.
- Prefer transparent limits, storage accounting, and funding information.
- Keep licensing and attribution requirements clear for bundled emoji, icon, and media assets.
- Avoid unnecessary complexity such as federation until the single-instance model is mature.

## High priority

### Internationalization and language switching

- [ ] Add a proper localization/i18n system.
- [ ] Remove the current Portuguese/English mixture from hardcoded UI strings.
- [ ] Allow users to change application language from settings.
- [ ] Persist the selected language per user or client.
- [ ] Provide at least English and Brazilian Portuguese translations initially.
- [ ] Make date, time, number, and file-size formatting locale-aware.
- [ ] Make validation errors, server errors, notifications, updater UI, onboarding, and accessibility labels translatable.
- [ ] Establish a translation key naming convention and contributor workflow for future languages.

### Permissions and moderation

- [ ] Define Room roles and permissions, including Host, Moderator, Member, and optional Read-only roles.
- [ ] Add permission controls for creating Threads and Sections, managing Room Passes, inviting Users, pinning content, and moderation actions.
- [ ] Add kick, ban, timeout, mute, and slow mode.
- [ ] Add delete-message-with-reason moderation flows.
- [ ] Add an audit log for meaningful administrative and moderation actions.
- [ ] Make moderation actions safe for the existing production database and use incremental schema changes only.

### Search and message state

- [ ] Add full message search.
- [ ] Add filters for User, date, Room, Thread, tag, attachment type, mentions, and links.
- [ ] Add jump-to-message behavior for search results.
- [ ] Add unread message tracking.
- [ ] Track last-read position per Thread.
- [ ] Add mark Thread as read and mark Room as read.
- [ ] Add a separate mentions/replies inbox.
- [ ] Add saved or bookmarked messages.
- [ ] Add pinned messages.
- [ ] Preserve drafts per Thread.
- [ ] Consider optional message edit history.

### Account security

- [ ] Require password confirmation during registration.
- [ ] Add password reset requests.
- [ ] Add 2FA.
- [ ] Add recovery codes for 2FA.
- [ ] Add session management with device/session listing and individual revocation.
- [ ] Add login alerts for new devices or suspicious activity.
- [ ] Record invitation lineage for administrative abuse control.
- [ ] Add revocable, expiring, and single-use invitation options.
- [ ] Support invite quotas or role-based invite permissions if needed.

### Main-instance registration policy

- [ ] Make the main Starbyte server invitation-only for account creation.
- [ ] Ensure public self-hosted instances can choose their own registration policy.
- [ ] Support registration modes such as closed, invite-only, approval-required, and open.
- [ ] Keep registration policy instance-configurable rather than hardcoded into the client.

## Messaging, expression, and content

### Symbols

- [ ] Add support for Symbols as a first-class expression system.
- [ ] Define where Symbols can be used: messages, profiles, statuses, tags, Room identity, and other appropriate UI surfaces.
- [ ] Define storage and rendering rules that remain compatible with plain-text and IRC-oriented access where possible.

### Emoji

- [ ] Add built-in emoji support.
- [ ] Support multiple properly licensed or open-source emoji sets where practical.
- [ ] Track attribution and license obligations for every bundled set.
- [ ] Add emoji picker and keyboard search.
- [ ] Support emoji use in messages, reactions, profiles, statuses, Room descriptions, and other appropriate places.
- [ ] Consider Room-specific or instance-specific custom emoji packs later.

### Reactions

- [ ] Add message reactions.
- [ ] Integrate reactions with built-in emoji and future custom emoji packs.
- [ ] Keep reaction state efficient for realtime updates.

### Embeds

- [ ] Improve generic link embeds.
- [ ] Improve YouTube/video embed handling.
- [ ] Improve image/file preview behavior.
- [ ] Add safer fallback behavior for failed or malformed embeds.
- [ ] Add user settings to disable or simplify embeds.
- [ ] Audit embed privacy and remote-fetch behavior.

### Attachments and files

- [ ] Add a Room or Thread attachment browser.
- [ ] Provide views for images, files, links, and embeds.
- [ ] Add upload progress indicators.
- [ ] Add clear upload failure and retry states.
- [ ] Add storage cleanup tooling for orphaned uploads without deleting referenced content.
- [ ] Add retention policies for files and messages where appropriate.

### Message interaction

- [ ] Make clicking a reply jump to the original message.
- [ ] Add message permalinks.
- [ ] Add collapsible handling for large pasted text.
- [ ] Improve code block and plaintext paste handling.
- [ ] Add optional per-Thread composer history or draft recovery.

## Navigation and accessibility

### Keyboard navigation

- [ ] Add keyboard navigation across Rooms, Sections, Threads, Whispers, message lists, profile panels, overlays, and dialogs.
- [ ] Define customizable keyboard shortcuts.
- [ ] Ensure no critical action is mouse-only.
- [ ] Add visible focus states.
- [ ] Add focus restoration after dialogs and overlays close.

### Accessibility

- [ ] Add complete screen-reader labels.
- [ ] Support text scaling.
- [ ] Add reduced-motion settings.
- [ ] Add high-contrast themes.
- [ ] Audit color contrast.
- [ ] Ensure keyboard-only operation.
- [ ] Audit focus traps and modal navigation.

### Known UI bug

- [ ] Fix the bug where clicking a Thread while editing a profile does not leave the profile screen and switch to the selected Thread.

## Tags and organization

- [ ] Build a better tag system.
- [ ] Define whether tags are global, instance-level, Room-level, or Thread-level.
- [ ] Support tag filtering and search.
- [ ] Support tag-based organization without replacing Sections.
- [ ] Add clear permissions for creating, renaming, and deleting shared tags.
- [ ] Consider tag colors/icons while keeping accessibility and localization in mind.

## Rooms and community structure

### Room onboarding

- [ ] Add Room welcome messages.
- [ ] Add Room rules.
- [ ] Improve Room descriptions.
- [ ] Allow default Threads and Sections for new members.
- [ ] Consider an optional onboarding checklist.

### Sections

- [ ] Add collapsing and expanding Sections.
- [ ] Add Section reordering.
- [ ] Add permission controls where useful.
- [ ] Add Section-specific notification settings where useful.

### Room visibility and joining

- [ ] Support hidden Rooms.
- [ ] Support listed Rooms within an instance.
- [ ] Support invite-only Rooms.
- [ ] Consider request-to-join Rooms.

### Room-specific identity

- [ ] Consider Room-specific nicknames or display labels.
- [ ] Consider Room-specific role labels.
- [ ] Keep the global account identity clear and authoritative.

## Notifications

- [ ] Add notification levels per Room and Thread: all messages, mentions only, muted.
- [ ] Add quiet hours.
- [ ] Add optional notification digests.
- [ ] Add dedicated mention and reply notifications.
- [ ] Add mark-as-read controls from notifications.
- [ ] Make notification settings sync appropriately without forcing unnecessary server load.

## Profiles and identity

### HTML-customizable profiles

- [ ] Add HTML-customizable profiles.
- [ ] Define a safe sanitization policy.
- [ ] Block scripts and unsafe active content.
- [ ] Define whether custom CSS is allowed and how it is sandboxed.
- [ ] Provide a safe preview before saving.
- [ ] Ensure profile customization degrades gracefully in low-resource and IRC-oriented clients.
- [ ] Keep profile rendering accessible.

### Profile system improvements

- [ ] Improve profile editing flow and navigation.
- [ ] Make profile changes propagate reliably in realtime.
- [ ] Consider profile visibility controls.
- [ ] Consider optional pronouns, links, and structured profile fields without forcing them.

## IRC and low-resource access

### IRC access layer

- [ ] Ensure Starbyte can be accessed through IRC where practical.
- [ ] Define the mapping between Starbyte and IRC concepts.
- [ ] Map Text Threads to channels where appropriate.
- [ ] Map Whispers to private messages/queries.
- [ ] Map User identity to account/nick behavior carefully.
- [ ] Define how Host and moderation authority map to IRC operator-style permissions where appropriate.
- [ ] Treat Sections as Starbyte client organization rather than forcing an unnatural IRC protocol mapping.
- [ ] Keep Room Pass behavior understandable from IRC-compatible access paths.

### Low-resource mode

- [ ] Add a lowest-resource interface mode inspired by IRC clients.
- [ ] Allow disabling embeds.
- [ ] Allow disabling animated emoji.
- [ ] Allow disabling avatars.
- [ ] Allow disabling image previews.
- [ ] Allow disabling typing indicators.
- [ ] Allow reducing presence updates.
- [ ] Add plain-text message rendering.
- [ ] Reduce animations.
- [ ] Add compact layout.
- [ ] Reduce background polling where realtime events already exist.
- [ ] Measure memory and CPU use on Windows and Linux using the full process tree.

## Usage, limits, and funding transparency

- [ ] Add a dashboard or meter for uploads and storage use.
- [ ] Show message-related limits where applicable.
- [ ] Show upload limits and quota state.
- [ ] Show instance resource usage at an appropriate level.
- [ ] Show where community funds are going.
- [ ] Distinguish infrastructure costs, storage, domains, backups, and other operating expenses.
- [ ] Avoid exposing private operational or security-sensitive details.
- [ ] Consider historical monthly cost and usage views.
- [ ] Add clear warnings before users hit relevant quotas.

## Instance notices and community bulletin

- [ ] Add instance-level notices.
- [ ] Add Room-level notices.
- [ ] Support maintenance notices, release notes, rule changes, funding updates, storage warnings, and community events.
- [ ] Keep notices separate from normal chat Threads so critical information remains discoverable.
- [ ] Add permissions and expiration dates for notices.

## Self-hosting

### Documentation and deployment

- [ ] Make it obvious how to host an independent Starbyte instance.
- [ ] Document required ports, domain configuration, HTTPS, WebSocket routing, persistent paths, environment variables, and service management.
- [ ] Provide Docker Compose where it genuinely simplifies deployment.
- [ ] Provide `.env.example` without secrets.
- [ ] Add configuration validation.
- [ ] Document upgrade procedure.
- [ ] Document backup procedure.
- [ ] Document restore procedure.
- [ ] Add tested health-check instructions.
- [ ] Document release and update channels.

### Instance identity and policy

- [ ] Add instance name.
- [ ] Add instance logo.
- [ ] Add instance description.
- [ ] Add administrator contact information.
- [ ] Add registration mode configuration.
- [ ] Add invite policy configuration.
- [ ] Add upload and storage limits.
- [ ] Add message limits only if operationally necessary.
- [ ] Add feature flags for optional capabilities.
- [ ] Add a public or semi-public status page.

### Backup and recovery

- [ ] Add a tested backup command.
- [ ] Add a tested restore command.
- [ ] Document SQLite consistency requirements.
- [ ] Never erase the current production database during upgrades.
- [ ] Keep schema changes incremental and backward-conscious.
- [ ] Add backup verification.
- [ ] Add restore drills for maintainers.

## Data ownership and retention

### User export

- [ ] Add user data export.
- [ ] Include profile data, messages, uploads, memberships, and account metadata as appropriate.
- [ ] Define privacy boundaries for data involving other users.

### Room export

- [ ] Add Host-controlled Room export.
- [ ] Export Room structure, Sections, Threads, and permitted content.
- [ ] Respect privacy constraints for Whispers and unrelated private content.

### Retention

- [ ] Add configurable retention policies.
- [ ] Support indefinite retention.
- [ ] Consider delete-after-N-days policies.
- [ ] Consider retaining messages while expiring large files.
- [ ] Make destructive retention actions explicit and auditable.

## Release and distribution

- [ ] Keep normal pushes separate from client releases.
- [ ] Keep backend deploys separate from client releases.
- [ ] Only allow desktop auto-update after an explicitly published release or client hotfix with a new version.
- [ ] Keep GitHub Release creation separate from promotion to `latest.json`.
- [ ] Add deliberate promotion from GitHub Release to constellation.
- [ ] Keep publication atomic so `latest.json` never points to missing artifacts.
- [ ] Add Windows portable builds.
- [ ] Keep installed Windows updater flow separate from portable update behavior.
- [ ] Keep Arch native package support.
- [ ] Keep Debian package support.
- [ ] Treat AppImage as experimental until WebKitGTK/EGL compatibility is reliable.
- [ ] Add version synchronization and version consistency checks.
- [ ] Add release dry-run and status commands.
- [ ] Add safe server deploy tooling with backup, tests, build, restart, and health check.

## Platform and performance

- [ ] Continue investigating Linux WebKitGTK EGL/AppImage crashes.
- [ ] Compare AppImage memory use against native Arch package memory use.
- [ ] Measure full Windows WebView2 process tree, not only the main executable.
- [ ] Measure full Linux WebKitWebProcess and NetworkProcess tree.
- [ ] Remove unnecessary desktop PWA/service-worker overhead if it exists.
- [ ] Keep PWA prompts hidden inside Tauri.
- [ ] Add performance budgets for idle CPU, RAM, startup time, and reconnect behavior.

## Later / deliberate deferrals

- [ ] Reconsider federation only after the single-instance identity, moderation, permissions, storage, and abuse models are mature.
- [ ] Reconsider end-to-end encryption only after a clear threat model and compatibility plan for desktop, web, IRC access, backups, search, moderation, and multi-device sessions exists.
- [ ] Reconsider advanced cross-instance discovery only after self-hosting and instance administration are stable.

## Suggested implementation order

### Phase 1 — core usability and safety

- [ ] Internationalization and language switching.
- [ ] Fix profile-to-Thread navigation bug.
- [ ] Unread message system and last-read position.
- [ ] Keyboard navigation and accessibility baseline.
- [ ] Search.
- [ ] Password confirmation, reset requests, 2FA, recovery codes, and session management.
- [ ] Room roles, permissions, and moderation basics.
- [ ] Invite-only registration controls for the main instance.

### Phase 2 — expression and community quality

- [ ] Symbols.
- [ ] Built-in emoji sets.
- [ ] Reactions.
- [ ] Better embeds.
- [ ] Better tags.
- [ ] Attachment browser.
- [ ] Notification settings.
- [ ] Room onboarding and Sections improvements.
- [ ] Community bulletin/notices.

### Phase 3 — transparency, low-resource access, and self-hosting

- [ ] Usage/limits/funding dashboard.
- [ ] IRC access layer.
- [ ] Low-resource mode.
- [ ] HTML-customizable profiles with strict sanitization.
- [ ] Instance identity and policy configuration.
- [ ] Complete self-hosting guide.
- [ ] Tested backup and restore tooling.
- [ ] User and Room exports.

### Phase 4 — advanced platform work

- [ ] Retention policies.
- [ ] Advanced moderation and audit tooling.
- [ ] Performance budgets and deeper Linux packaging improvements.
- [ ] Revisit federation and other cross-instance features only after earlier phases are mature.
