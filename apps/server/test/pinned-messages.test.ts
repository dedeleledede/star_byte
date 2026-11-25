import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

async function buildTestApp() {
  const dataDir = mkdtempSync(join(tmpdir(), "starbyte-pins-test-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = join(dataDir, "starbyte.db");
  process.env.CLIENT_ORIGIN = "https://starbyte.test";
  process.env.JWT_SECRET = "test-secret-that-is-long-enough";
  process.env.TRUST_PROXY = "false";

  return buildApp();
}

async function registerUser(app: Awaited<ReturnType<typeof buildApp>>, username: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      username,
      displayName: username.toUpperCase(),
      password: "password123"
    }
  });

  assert.equal(response.statusCode, 200, response.body);
  return response.json() as {
    token: string;
    user: { id: string; username: string; displayName: string };
  };
}

async function setupRoomAndThread(app: Awaited<ReturnType<typeof buildApp>>) {
  const host = await registerUser(app, "pinhost");
  const member = await registerUser(app, "pinmember");
  const outsider = await registerUser(app, "pinoutsider");

  const roomRes = await app.inject({
    method: "POST",
    url: "/api/rooms",
    headers: { authorization: `Bearer ${host.token}` },
    payload: { name: "Pin Room" }
  });
  assert.equal(roomRes.statusCode, 200, roomRes.body);
  const room = roomRes.json().room as { id: string };

  const passRes = await app.inject({
    method: "POST",
    url: `/api/rooms/${room.id}/pass`,
    headers: { authorization: `Bearer ${host.token}` }
  });
  assert.equal(passRes.statusCode, 200, passRes.body);

  const joinRes = await app.inject({
    method: "POST",
    url: "/api/rooms/join",
    headers: { authorization: `Bearer ${member.token}` },
    payload: { roomPass: passRes.json().roomPass }
  });
  assert.equal(joinRes.statusCode, 200, joinRes.body);

  const threadRes = await app.inject({
    method: "POST",
    url: "/api/threads",
    headers: { authorization: `Bearer ${host.token}` },
    payload: { title: "Announcements", roomId: room.id }
  });
  assert.equal(threadRes.statusCode, 200, threadRes.body);
  const thread = threadRes.json().thread as { id: string };

  return { host, member, outsider, room, thread };
}

test("room host can pin and unpin messages, emitting realtime events and updating message queries", async () => {
  const app = await buildTestApp();
  try {
    const { host, member, thread } = await setupRoomAndThread(app);

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/threads/${thread.id}/messages`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { body: "Important release checklist" }
    });
    assert.equal(msgRes.statusCode, 200, msgRes.body);
    const message = msgRes.json().message as { id: string };

    const memberEvents: string[] = [];
    app.wsClients.set(
      member.user.id,
      new Set([
        {
          readyState: 1,
          send: (payload: string) => memberEvents.push(payload)
        } as never
      ])
    );

    const pinRes = await app.inject({
      method: "POST",
      url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(pinRes.statusCode, 200, pinRes.body);
    const { pin } = pinRes.json();
    assert.equal(pin.messageId, message.id);
    assert.equal(pin.threadId, thread.id);
    assert.equal(pin.body, "Important release checklist");
    assert.equal(pin.pinnedByUserId, host.user.id);
    assert.equal(pin.pinnedByUsername, "pinhost");

    const pinnedEvent = memberEvents.map((e) => JSON.parse(e)).find((e) => e.type === "message.pinned");
    assert.equal(pinnedEvent?.data.messageId, message.id);
    assert.equal(pinnedEvent?.data.threadId, thread.id);

    // Idempotent re-pin should succeed without duplicating
    const repeatPinRes = await app.inject({
      method: "POST",
      url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(repeatPinRes.statusCode, 200, repeatPinRes.body);

    // Member can view pinned messages
    const listPinsRes = await app.inject({
      method: "GET",
      url: `/api/threads/${thread.id}/pins`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(listPinsRes.statusCode, 200, listPinsRes.body);
    assert.equal(listPinsRes.json().pins.length, 1);
    assert.equal(listPinsRes.json().pins[0].messageId, message.id);

    // Messages list includes pinnedAt and pinnedByUserId
    const listMessagesRes = await app.inject({
      method: "GET",
      url: `/api/threads/${thread.id}/messages`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(listMessagesRes.statusCode, 200, listMessagesRes.body);
    assert.ok(listMessagesRes.json().messages[0].pinnedAt);
    assert.equal(listMessagesRes.json().messages[0].pinnedByUserId, host.user.id);

    // Unpin message
    const unpinRes = await app.inject({
      method: "DELETE",
      url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(unpinRes.statusCode, 200, unpinRes.body);
    assert.deepEqual(unpinRes.json(), { ok: true });

    const unpinnedEvent = memberEvents.map((e) => JSON.parse(e)).find((e) => e.type === "message.unpinned");
    assert.equal(unpinnedEvent?.data.messageId, message.id);

    const afterUnpinPins = await app.inject({
      method: "GET",
      url: `/api/threads/${thread.id}/pins`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(afterUnpinPins.statusCode, 200);
    assert.equal(afterUnpinPins.json().pins.length, 0);
  } finally {
    await app.close();
  }
});

test("unauthorized room members and outsiders cannot pin or unpin messages", async () => {
  const app = await buildTestApp();
  try {
    const { host, member, outsider, thread } = await setupRoomAndThread(app);

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/threads/${thread.id}/messages`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { body: "Member message" }
    });
    const message = msgRes.json().message as { id: string };

    // Regular member cannot pin even their own message
    const memberPinRes = await app.inject({
      method: "POST",
      url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(memberPinRes.statusCode, 403);
    assert.equal(memberPinRes.json().error, "forbidden");

    // Host pins it
    const hostPinRes = await app.inject({
      method: "POST",
      url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(hostPinRes.statusCode, 200);

    // Regular member cannot unpin it
    const memberUnpinRes = await app.inject({
      method: "DELETE",
      url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(memberUnpinRes.statusCode, 403);

    // Outsider cannot view, pin, or unpin
    assert.equal(
      (await app.inject({
        method: "GET",
        url: `/api/threads/${thread.id}/pins`,
        headers: { authorization: `Bearer ${outsider.token}` }
      })).statusCode,
      403
    );
    assert.equal(
      (await app.inject({
        method: "POST",
        url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
        headers: { authorization: `Bearer ${outsider.token}` }
      })).statusCode,
      403
    );
    assert.equal(
      (await app.inject({
        method: "DELETE",
        url: `/api/threads/${thread.id}/messages/${message.id}/pin`,
        headers: { authorization: `Bearer ${outsider.token}` }
      })).statusCode,
      403
    );

    // Unauthenticated rejected
    assert.equal(
      (await app.inject({
        method: "GET",
        url: `/api/threads/${thread.id}/pins`
      })).statusCode,
      401
    );
  } finally {
    await app.close();
  }
});

test("thread creator can pin in their own thread, and editing/deleting updates pinned messages", async () => {
  const app = await buildTestApp();
  try {
    const { host, member, room } = await setupRoomAndThread(app);

    // Member creates a thread
    const memberThreadRes = await app.inject({
      method: "POST",
      url: "/api/threads",
      headers: { authorization: `Bearer ${member.token}` },
      payload: { title: "Member Topic", roomId: room.id }
    });
    assert.equal(memberThreadRes.statusCode, 200, memberThreadRes.body);
    const memberThread = memberThreadRes.json().thread as { id: string };

    const msgRes = await app.inject({
      method: "POST",
      url: `/api/threads/${memberThread.id}/messages`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { body: "Initial notes" }
    });
    const message = msgRes.json().message as { id: string };

    // Thread creator can pin
    const creatorPinRes = await app.inject({
      method: "POST",
      url: `/api/threads/${memberThread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(creatorPinRes.statusCode, 200, creatorPinRes.body);

    // Editing updates the pinned body
    const editRes = await app.inject({
      method: "PATCH",
      url: `/api/threads/${memberThread.id}/messages/${message.id}`,
      headers: { authorization: `Bearer ${member.token}` },
      payload: { body: "Updated important notes" }
    });
    assert.equal(editRes.statusCode, 200, editRes.body);

    const pinsAfterEdit = await app.inject({
      method: "GET",
      url: `/api/threads/${memberThread.id}/pins`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(pinsAfterEdit.statusCode, 200);
    assert.equal(pinsAfterEdit.json().pins[0].body, "Updated important notes");

    // Host can unpin and re-pin in member's thread
    assert.equal(
      (await app.inject({
        method: "DELETE",
        url: `/api/threads/${memberThread.id}/messages/${message.id}/pin`,
        headers: { authorization: `Bearer ${host.token}` }
      })).statusCode,
      200
    );
    assert.equal(
      (await app.inject({
        method: "POST",
        url: `/api/threads/${memberThread.id}/messages/${message.id}/pin`,
        headers: { authorization: `Bearer ${host.token}` }
      })).statusCode,
      200
    );

    // Deleting the message clears its pin and prevents re-pinning
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/threads/${memberThread.id}/messages/${message.id}`,
      headers: { authorization: `Bearer ${member.token}` }
    });
    assert.equal(delRes.statusCode, 200);

    const pinsAfterDelete = await app.inject({
      method: "GET",
      url: `/api/threads/${memberThread.id}/pins`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(pinsAfterDelete.statusCode, 200);
    assert.equal(pinsAfterDelete.json().pins.length, 0);

    const repinDeleted = await app.inject({
      method: "POST",
      url: `/api/threads/${memberThread.id}/messages/${message.id}/pin`,
      headers: { authorization: `Bearer ${host.token}` }
    });
    assert.equal(repinDeleted.statusCode, 404);
  } finally {
    await app.close();
  }
});
