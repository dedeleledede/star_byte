import Database from "better-sqlite3";
import {mkdirSync} from "node:fs";
import {dirname} from "node:path";
import {randomUUID} from "node:crypto";

export interface SafeUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  statusText: string | null;
  createdAt: string;
}

interface UserRecord extends SafeUser {
  passwordHash: string;
}

export interface ThreadRecord {
  id: string;
  kind: "text" | "whisper";
  title: string;
  slug: string | null;
  createdBy: string | null;
  isPrivate: number;
  roomId: string | null;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  threadId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  body: string;
  replyToMessageId: string | null;
  editedAt: string | null;
  createdAt: string;
}

export interface ThreadMemberRecord {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface MentionNotificationRecord {
  id: string;
  threadId: string;
  messageId: string;
  mentionedByUserId: string;
  mentionedByUsername: string;
  mentionedByDisplayName: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export interface RoomRecord {
  id: string;
  name: string;
  slug: string | null;
  description: string;
  hostUserId: string;
  roomPass: string | null;
  iconUrl: string | null;
  createdAt: string;
}

export class DatabaseService {
  private readonly db: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT NOT NULL DEFAULT '',
        status_text TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS threads(
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('text', 'whisper')),
        title TEXT NOT NULL,
        slug TEXT UNIQUE,
        created_by TEXT,
        is_private INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS thread_members (
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        PRIMARY KEY (thread_id, user_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        body TEXT NOT NULL,
        reply_to_message_id TEXT,
        created_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to_message_id) REFERENCES messages(id)
      );

      CREATE TABLE IF NOT EXISTS mention_notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        thread_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        mentioned_by_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        read_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (thread_id) REFERENCES threads(id),
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (mentioned_by_user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS rooms (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       slug TEXT UNIQUE,
       description TEXT NOT NULL DEFAULT '',
       host_user_id TEXT NOT NULL,
       room_pass_hash TEXT NOT NULL,
       created_at TEXT NOT NULL,
       FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // ensures
    const ensureUserProfileColumns = () => {
      const columns = this.db
          .prepare("PRAGMA table_info(users)")
          .all() as Array<{ name: string }>;

      const names = new Set(columns.map((column) => column.name));

      if (!names.has("avatar_url")) {
        this.db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
      }

      if (!names.has("bio")) {
        this.db.exec("ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''");
      }

      if (!names.has("status_text")) {
        this.db.exec("ALTER TABLE users ADD COLUMN status_text TEXT NOT NULL DEFAULT ''");
      }
    };

    const ensureThreadRoomColumns = () => {
      const columns = this.db
          .prepare("PRAGMA table_info(threads)")
          .all() as Array<{ name: string }>;

      const names = new Set(columns.map((column) => column.name));

      if (!names.has("room_id")) {
        this.db.exec("ALTER TABLE threads ADD COLUMN room_id TEXT");
      }

      if (!names.has("section_id")) {
        this.db.exec("ALTER TABLE threads ADD COLUMN section_id TEXT");
      }
    };

    const ensureRoomColumns = () => {
      const columns = this.db.prepare("PRAGMA table_info(rooms)").all() as Array<{ name: string }>;
      const names = new Set(columns.map((column) => column.name));

      if (!names.has("room_pass")) {
        this.db.exec("ALTER TABLE rooms ADD COLUMN room_pass TEXT");
      }

      if (!names.has("icon_url")) {
        this.db.exec("ALTER TABLE rooms ADD COLUMN icon_url TEXT");
      }

      this.db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_room_pass
    ON rooms(room_pass)
    WHERE room_pass IS NOT NULL
  `);
    };

    const ensureMessageColumns = () => {
      const columns = this.db
          .prepare("PRAGMA table_info(messages)")
          .all() as Array<{ name: string }>;

      const names = new Set(columns.map((column) => column.name));

      if (!names.has("edited_at")) {
        this.db.exec("ALTER TABLE messages ADD COLUMN edited_at TEXT");
      }
    };

    ensureRoomColumns();
    ensureUserProfileColumns();
    ensureThreadRoomColumns();
    ensureMessageColumns();

    const existingGeneral = this.db.prepare(
      `SELECT id FROM threads WHERE slug = ?`
    ).get("general") as { id: string } | undefined;

    if (!existingGeneral) {
      this.db.prepare(`
        INSERT INTO threads (id, kind, title, slug, created_by, is_private, created_at)
        VALUES (?, 'text', 'General', 'general', NULL, 0, ?)
      `).run("general", new Date().toISOString());
    }
  }

  close() {
    this.db.close();
  }

  createUser(input: { username: string; displayName: string; passwordHash: string }) {
    const user: UserRecord = {
      id: randomUUID(),
      username: input.username,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      avatarUrl: null,
      bio: "",
      statusText: "",
      createdAt: new Date().toISOString()
    };

    this.db.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, avatar_url, bio, status_text, created_at)
      VALUES (@id, @username, @displayName, @passwordHash, @avatarUrl, @bio, @statusText, @createdAt)
    `).run(user);

    this.addMemberToThread("general", user.id, "member");

    return this.toSafeUser(user);
  }

  findUserByUsername(username: string) {
    return this.db.prepare(`
      SELECT
        id,
        username,
        display_name as displayName,
        password_hash as passwordHash,
        avatar_url as avatarUrl,
        bio,
        status_text as statusText,
        created_at as createdAt
      FROM users
      WHERE username = ?
    `).get(username) as UserRecord | undefined;
  }

  findUserById(userId: string) {
    return this.db.prepare(`
      SELECT
        id,
        username,
        display_name as displayName,
        password_hash as passwordHash,
        avatar_url as avatarUrl,
        bio,
        status_text as statusText,
        created_at as createdAt
      FROM users
      WHERE id = ?
    `).get(userId) as UserRecord | undefined;
  }

  getRoomById(roomId: string) {
    return this.db.prepare(`
      SELECT
        id,
        name,
        slug,
        description,
        host_user_id as hostUserId,
        room_pass as roomPass,
        icon_url as iconUrl,
        created_at as createdAt
      FROM rooms
      WHERE id = ?
    `).get(roomId) as RoomRecord | undefined;
  }

  findRoomByRoomPass(roomPass: string) {
    return this.db.prepare(`
    SELECT
      id,
      name,
      slug,
      description,
      host_user_id as hostUserId,
      room_pass as roomPass,
      icon_url as iconUrl,
      created_at as createdAt
    FROM rooms
    WHERE room_pass = ?
  `).get(roomPass) as RoomRecord | undefined;
  }

  setRoomPass(roomId: string, roomPass: string | null) {
    this.db.prepare(`
    UPDATE rooms
    SET room_pass = ?
    WHERE id = ?
  `).run(roomPass, roomId);
  }

  setRoomIcon(roomId: string, iconUrl: string | null) {
    this.db.prepare(`
    UPDATE rooms
    SET icon_url = ?
    WHERE id = ?
  `).run(iconUrl, roomId);
  }

  deleteRoom(roomId: string) {
    this.db.prepare(`DELETE FROM rooms WHERE id = ?`).run(roomId);
  }

  listThreadsForRoom(userId: string, roomId: string) {
    return this.db.prepare(`
      SELECT
        t.id,
        t.kind,
        t.title,
        t.slug,
        t.created_by as createdBy,
        t.is_private as isPrivate,
        t.room_id as roomId,
        t.created_at as createdAt
      FROM threads t
      INNER JOIN room_members rm ON rm.room_id = t.room_id
      WHERE rm.user_id = ? AND t.room_id = ? AND t.kind = 'text'
      ORDER BY t.title COLLATE NOCASE ASC
    `).all(userId, roomId) as ThreadRecord[];
  }

  createThread(input: { title: string; creatorId: string; roomId: string; memberIds?: string[] }) {
    const thread: ThreadRecord = {
      id: randomUUID(),
      kind: "text",
      title: input.title,
      slug: null,
      createdBy: input.creatorId,
      isPrivate: 0,
      roomId: input.roomId,
      createdAt: new Date().toISOString()
    };

    this.db.prepare(`
      INSERT INTO threads (id, kind, title, slug, created_by, is_private, room_id, created_at)
      VALUES (@id, @kind, @title, @slug, @createdBy, @isPrivate, @roomId, @createdAt)
    `).run(thread);

    return thread;
  }

  addMemberToThread(threadId: string, userId: string, role: string) {
    this.db.prepare(`
      INSERT OR IGNORE INTO thread_members (thread_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(threadId, userId, role);
  }

  deleteThread(threadId: string) {
    this.db.prepare(`DELETE FROM threads WHERE id = ?`).run(threadId);
  }

  isMember(threadId: string, userId: string) {
    const row = this.db.prepare(`
      SELECT 1
      FROM thread_members
      WHERE thread_id = ? AND user_id = ?
    `).get(threadId, userId);

    return Boolean(row);
  }

  canAccessThread(threadId: string, userId: string) {
    const thread = this.getThreadById(threadId);
    if (!thread) return false;

    if (thread.kind === "text" && thread.roomId) {
      return this.isRoomMember(thread.roomId, userId);
    }

    return this.isMember(threadId, userId);
  }

  listMembersForThread(threadId: string) {
    const thread = this.getThreadById(threadId);
    if (!thread) return [];

    if (thread.kind === "text" && thread.roomId) {
      return this.db.prepare(`
      SELECT
        u.id,
        u.username,
        u.display_name as displayName,
        u.avatar_url as avatarUrl
      FROM room_members rm
      INNER JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
      ORDER BY u.username COLLATE NOCASE ASC
    `).all(thread.roomId) as ThreadMemberRecord[];
    }

    return this.db.prepare(`
      SELECT
        u.id,
        u.username,
        u.display_name as displayName,
        u.avatar_url as avatarUrl
      FROM thread_members tm
      INNER JOIN users u ON u.id = tm.user_id
      WHERE tm.thread_id = ?
      ORDER BY u.username COLLATE NOCASE ASC
    `).all(threadId) as ThreadMemberRecord[];
  }

  createMentionNotifications(input: {
    threadId: string;
    messageId: string;
    mentionedByUserId: string;
    mentionedUserIds: string[];
  }) {
    const insert = this.db.prepare(`
      INSERT INTO mention_notifications (
        id,
        user_id,
        thread_id,
        message_id,
        mentioned_by_user_id,
        created_at,
        read_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL)
    `);

    const now = new Date().toISOString();

    const transaction = this.db.transaction((userIds: string[]) => {
      for (const userId of userIds) {
        insert.run(
            randomUUID(),
            userId,
            input.threadId,
            input.messageId,
            input.mentionedByUserId,
            now
        );
      }
    });

    transaction(input.mentionedUserIds);
  }

  listMentionNotificationsForUser(userId: string) {
    return this.db.prepare(`
      SELECT
        mn.id,
        mn.thread_id as threadId,
        mn.message_id as messageId,
        mn.mentioned_by_user_id as mentionedByUserId,
        u.username as mentionedByUsername,
        u.display_name as mentionedByDisplayName,
        m.body,
        mn.created_at as createdAt,
        mn.read_at as readAt
      FROM mention_notifications mn
      INNER JOIN messages m ON m.id = mn.message_id
      INNER JOIN users u ON u.id = mn.mentioned_by_user_id
      WHERE mn.user_id = ?
      ORDER BY mn.created_at DESC
      LIMIT 50
    `).all(userId) as MentionNotificationRecord[];
  }

  markMentionNotificationsRead(input: { userId: string; threadId: string }) {
    this.db.prepare(`
      UPDATE mention_notifications
      SET read_at = ?
      WHERE user_id = ? AND thread_id = ? AND read_at IS NULL
    `).run(
        new Date().toISOString(),
        input.userId,
        input.threadId
    );
  }

  createMessage(input: { threadId: string; userId: string; body: string; replyToMessageId?: string | null }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO messages (id, thread_id, user_id, body, reply_to_message_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, input.threadId, input.userId, input.body, input.replyToMessageId ?? null, createdAt);

    return this.getMessageById(id)!;
  }

  getMessageById(messageId: string) {
    return this.db.prepare(`
      SELECT
        m.id,
        m.thread_id as threadId,
        m.user_id as userId,
        u.username,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        m.body,
        m.reply_to_message_id as replyToMessageId,
        m.created_at as createdAt
      FROM messages m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.id = ? AND m.deleted_at IS NULL
    `).get(messageId) as MessageRecord | undefined;
  }

  listMessages(threadId: string, limit = 50) {
    return this.db.prepare(`
      SELECT
        m.id,
        m.thread_id as threadId,
        m.user_id as userId,
        u.username,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        m.body,
        m.reply_to_message_id as replyToMessageId,
        m.created_at as createdAt
      FROM messages m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.thread_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT ?
    `).all(threadId, limit) as MessageRecord[];
  }

  listUsers() {
    return this.db.prepare(`
      SELECT
        id,
        username,
        display_name as displayName,
        avatar_url as avatarUrl,
        bio,
        status_text as statusText,
        created_at as createdAt
      FROM users
      ORDER BY username ASC
    `).all() as SafeUser[];
  }

  createRoom(input: {
    name: string;
    slug?: string | null;
    description?: string;
    hostUserId: string;
  }) {
    const room: RoomRecord & { roomPassHash: string } = {
      id: randomUUID(),
      name: input.name,
      slug: input.slug ?? null,
      description: input.description ?? "",
      hostUserId: input.hostUserId,
      roomPass: null,
      iconUrl: null,
      roomPassHash: "",
      createdAt: new Date().toISOString()
    };

    this.db.prepare(`
      INSERT INTO rooms (id, name, slug, description, host_user_id, room_pass_hash, room_pass, icon_url, created_at)
      VALUES (@id, @name, @slug, @description, @hostUserId, @roomPassHash, @roomPass, @iconUrl, @createdAt)
    `).run(room);

    this.addMemberToRoom(room.id, room.hostUserId, "host");

    return {
      id: room.id,
      name: room.name,
      slug: room.slug,
      description: room.description,
      hostUserId: room.hostUserId,
      roomPass: room.roomPass,
      iconUrl: room.iconUrl,
      createdAt: room.createdAt
    } satisfies RoomRecord;
  }

  addMemberToRoom(roomId: string, userId: string, role: string) {
    this.db.prepare(`
      INSERT OR IGNORE INTO room_members (room_id, user_id, role)
      VALUES (?, ?, ?)
    `).run(roomId, userId, role);
  }

  isRoomMember(roomId: string, userId: string) {
    const row = this.db.prepare(`
      SELECT 1
      FROM room_members
      WHERE room_id = ? AND user_id = ?
    `).get(roomId, userId);

    return Boolean(row);
  }

  listRoomsForUser(userId: string) {
    return this.db.prepare(`
      SELECT
        r.id,
        r.name,
        r.slug,
        r.description,
        r.host_user_id as hostUserId,
        r.room_pass as roomPass,
        r.icon_url as iconUrl,
        r.created_at as createdAt
      FROM rooms r
             INNER JOIN room_members rm ON rm.room_id = r.id
      WHERE rm.user_id = ?
      ORDER BY r.name COLLATE NOCASE ASC
    `).all(userId) as RoomRecord[];
  }

  listUsersForRoom(roomId: string) {
    return this.db.prepare(`
      SELECT
        u.id,
        u.username,
        u.display_name as displayName,
        u.avatar_url as avatarUrl,
        u.bio,
        u.status_text as statusText,
        u.created_at as createdAt
      FROM room_members rm
      INNER JOIN users u ON u.id = rm.user_id
      WHERE rm.room_id = ?
      ORDER BY u.username COLLATE NOCASE ASC
    `).all(roomId) as SafeUser[];
  }

  getThreadById(threadId: string) {
    return this.db.prepare(`
    SELECT
      id,
      kind,
      title,
      slug,
      created_by as createdBy,
      is_private as isPrivate,
      room_id as roomId,
      created_at as createdAt
    FROM threads
    WHERE id = ?
  `).get(threadId) as ThreadRecord | undefined;
  }

  updateUserProfile(input: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string;
    statusText: string;
  }) {
    this.db.prepare(`
    UPDATE users
    SET display_name = ?,
        avatar_url = ?,
        bio = ?,
        status_text = ?
    WHERE id = ?
  `).run(
        input.displayName,
        input.avatarUrl,
        input.bio,
        input.statusText,
        input.userId
    );

    return this.findUserById(input.userId);
  }

  listWhispersForUser(userId: string) {
    return this.db.prepare(`
    SELECT
      t.id,
      t.kind,
      COALESCE(other_user.display_name, other_user.username) as title,
      t.slug,
      t.created_by as createdBy,
      t.is_private as isPrivate,
      t.room_id as roomId,
      t.created_at as createdAt
    FROM threads t
    INNER JOIN thread_members self_member
      ON self_member.thread_id = t.id AND self_member.user_id = ?
    INNER JOIN thread_members other_member
      ON other_member.thread_id = t.id AND other_member.user_id <> ?
    INNER JOIN users other_user
      ON other_user.id = other_member.user_id
    WHERE t.kind = 'whisper'
    ORDER BY t.created_at DESC
  `).all(userId, userId) as ThreadRecord[];
  }

  findWhisperBetweenUsers(userAId: string, userBId: string) {
    return this.db.prepare(`
    SELECT
      t.id,
      t.kind,
      t.title,
      t.slug,
      t.created_by as createdBy,
      t.is_private as isPrivate,
      t.room_id as roomId,
      t.created_at as createdAt
    FROM threads t
    INNER JOIN thread_members a
      ON a.thread_id = t.id AND a.user_id = ?
    INNER JOIN thread_members b
      ON b.thread_id = t.id AND b.user_id = ?
    WHERE t.kind = 'whisper'
    LIMIT 1
  `).get(userAId, userBId) as ThreadRecord | undefined;
  }

  createWhisper(input: { creatorId: string; targetUserId: string }) {
    const target = this.findUserById(input.targetUserId);
    const thread: ThreadRecord = {
      id: randomUUID(),
      kind: "whisper",
      title: target?.displayName ?? target?.username ?? "Whisper",
      slug: null,
      createdBy: input.creatorId,
      isPrivate: 1,
      roomId: null,
      createdAt: new Date().toISOString()
    };

    this.db.prepare(`
    INSERT INTO threads (id, kind, title, slug, created_by, is_private, room_id, created_at)
    VALUES (@id, @kind, @title, @slug, @createdBy, @isPrivate, @roomId, @createdAt)
  `).run(thread);

    this.addMemberToThread(thread.id, input.creatorId, "member");
    this.addMemberToThread(thread.id, input.targetUserId, "member");

    return thread;
  }

  private toSafeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      statusText: user.statusText,
      createdAt: user.createdAt
    };
  }
}
