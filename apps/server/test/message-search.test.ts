import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

test("message search filters accessible messages and opens older results", async () => {
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "starbyte-search-")), "db.sqlite");
  process.env.JWT_SECRET = "test-secret-that-is-long-enough";
  const app = await buildApp();
  try {
    async function register(username: string) {
      const response = await app.inject({ method: "POST", url: "/api/auth/register", payload: {
        username, displayName: username, password: "password123", confirmPassword: "password123"
      }});
      assert.equal(response.statusCode, 200, response.body);
      return response.json() as { token: string; user: { id: string } };
    }
    const alice = await register("alice");
    const bob = await register("bobby");
    const room = app.db.createRoom({ name: "Open", hostUserId: alice.user.id });
    app.db.addMemberToRoom(room.id, bob.user.id, "member");
    const privateRoom = app.db.createRoom({ name: "Hidden", hostUserId: bob.user.id });
    const thread = app.db.createThread({ title: "Chat", creatorId: alice.user.id, roomId: room.id });
    const hidden = app.db.createThread({ title: "Secret", creatorId: bob.user.id, roomId: privateRoom.id });
    const whisper = app.db.createWhisper({ creatorId: alice.user.id, targetUserId: bob.user.id });
    const first = app.db.createMessage({ threadId: thread.id, userId: alice.user.id,
      body: "#launch see https://example.com @bobby /api/uploads/images/123e4567-e89b-12d3-a456-426614174000.png" });
    app.db.createMessage({ threadId: hidden.id, userId: bob.user.id, body: "secret launch" });
    const dm = app.db.createMessage({ threadId: whisper.id, userId: bob.user.id, body: "private launch" });
    for (let i = 0; i < 55; i++) app.db.createMessage({ threadId: thread.id, userId: bob.user.id, body: `later ${i}` });
    const headers = { authorization: `Bearer ${alice.token}` };
    const roomSearch = `/api/messages/search?roomId=${room.id}`;
    const search = await app.inject({ method: "GET", headers,
      url: `${roomSearch}&q=launch&userId=${alice.user.id}&hasLink=true&hasAttachment=true&mentions=bobby` });
    assert.equal(search.statusCode, 200, search.body);
    assert.deepEqual(search.json().messages.map((message: { id: string }) => message.id), [first.id]);
    const all = await app.inject({ method: "GET", headers, url: roomSearch });
    assert.equal(all.statusCode, 200, all.body);
    assert.equal(all.json().messages.length, 50);
    assert.equal(all.json().hasMore, true);
    assert.equal(all.json().messages.some((message: { threadId: string }) => message.threadId === hidden.id), false);
    const secondPage = await app.inject({ method: "GET", headers, url: `${roomSearch}&offset=50` });
    assert.equal(secondPage.statusCode, 200, secondPage.body);
    assert.equal(secondPage.json().messages.some((message: { id: string }) => message.id === first.id), true);
    const day = first.createdAt.slice(0, 10);
    const dated = await app.inject({ method: "GET", headers, url: `${roomSearch}&q=launch&after=${day}&before=${day}` });
    assert.deepEqual(dated.json().messages.map((message: { id: string }) => message.id), [first.id]);
    const dmSearch = await app.inject({ method: "GET", headers, url: `/api/messages/search?threadId=${whisper.id}&q=launch` });
    assert.deepEqual(dmSearch.json().messages.map((message: { id: string }) => message.id), [dm.id]);
    const unscoped = await app.inject({ method: "GET", headers, url: "/api/messages/search?q=launch" });
    assert.equal(unscoped.statusCode, 400);
    const filteredThread = await app.inject({ method: "GET", headers, url: `${roomSearch}&threadId=${thread.id}&q=launch` });
    assert.deepEqual(filteredThread.json().messages.map((message: { id: string }) => message.id), [first.id]);
    const otherThread = await app.inject({ method: "GET", headers, url: `${roomSearch}&threadId=${whisper.id}` });
    assert.deepEqual(otherThread.json().messages, []);
    const privateSearch = await app.inject({ method: "GET", headers, url: `/api/messages/search?roomId=${privateRoom.id}` });
    assert.equal(privateSearch.statusCode, 403);
    const older = await app.inject({ method: "GET", headers, url: `/api/threads/${thread.id}/messages?through=${first.id}` });
    assert.equal(older.statusCode, 200, older.body);
    assert.equal(older.json().messages.at(-1).id, first.id);
    const denied = await app.inject({ method: "GET", headers, url: `/api/threads/${hidden.id}/messages?through=${first.id}` });
    assert.equal(denied.statusCode, 403);
    const invalid = await app.inject({ method: "GET", headers, url: `${roomSearch}&after=2026-02-30` });
    assert.equal(invalid.statusCode, 400);
    const removedTag = await app.inject({ method: "GET", headers, url: `${roomSearch}&tag=launch` });
    assert.equal(removedTag.statusCode, 400);
    const wrongMention = await app.inject({ method: "GET", headers, url: `${roomSearch}&mentions=bobb` });
    assert.deepEqual(wrongMention.json().messages, []);
    app.db.deleteMessage(first.id);
    const deleted = await app.inject({ method: "GET", headers, url: `${roomSearch}&q=launch` });
    assert.deepEqual(deleted.json().messages, []);
    const unauthorized = await app.inject({ method: "GET", url: roomSearch });
    assert.equal(unauthorized.statusCode, 401);
  } finally {
    await app.close();
  }
});
