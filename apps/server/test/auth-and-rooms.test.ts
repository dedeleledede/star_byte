import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

async function buildTestApp() {
  const dataDir = mkdtempSync(join(tmpdir(), "starbyte-test-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = join(dataDir, "starbyte.db");
  process.env.CLIENT_ORIGIN = "https://starbyte.test";
  process.env.JWT_SECRET = "test-secret-that-is-long-enough";
  process.env.TRUST_PROXY = "false";

  return buildApp();
}

async function register(app: Awaited<ReturnType<typeof buildApp>>, username: string) {
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
    user: {
      id: string;
      username: string;
      displayName: string;
    };
  };
}

test("PATCH /api/auth/me updates the authenticated profile and returns a safe user", async () => {
  const app = await buildTestApp();
  try {
    const { token } = await register(app, "alice");

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        displayName: "Alice Updated",
        avatarUrl: "/api/uploads/images/avatar.png",
        bio: "hello",
        statusText: "online"
      }
    });

    assert.equal(response.statusCode, 200, response.body);
    const body = response.json();
    assert.equal(body.user.displayName, "Alice Updated");
    assert.equal(body.user.avatarUrl, "/api/uploads/images/avatar.png");
    assert.equal(body.user.bio, "hello");
    assert.equal(body.user.statusText, "online");
    assert.equal(body.user.passwordHash, undefined);

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    assert.equal(me.statusCode, 200, me.body);
    assert.equal(me.json().user.displayName, "Alice Updated");
  } finally {
    await app.close();
  }
});

test("PATCH /api/auth/me rejects invalid payload", async () => {
  const app = await buildTestApp();
  try {
    const { token } = await register(app, "bob");

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        displayName: "B",
        avatarUrl: "",
        bio: "",
        statusText: ""
      }
    });

    assert.equal(response.statusCode, 400, response.body);
    assert.equal(response.json().error, "invalid payload");
  } finally {
    await app.close();
  }
});

test("PATCH /api/auth/me rejects missing authentication", async () => {
  const app = await buildTestApp();
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      payload: {
        displayName: "No Auth",
        avatarUrl: "",
        bio: "",
        statusText: ""
      }
    });

    assert.equal(response.statusCode, 401, response.body);
  } finally {
    await app.close();
  }
});

test("PATCH /api/auth/me rejects a token for a user that no longer exists", async () => {
  const app = await buildTestApp();
  try {
    const token = app.jwt.sign({
      sub: "00000000-0000-4000-8000-000000000000",
      username: "missing"
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/auth/me",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {
        displayName: "Missing User",
        avatarUrl: "",
        bio: "",
        statusText: ""
      }
    });

    assert.equal(response.statusCode, 401, response.body);
    assert.equal(response.json().error, "invalid session");
  } finally {
    await app.close();
  }
});

test("PATCH /api/auth/me allows Tauri preflight origins", async () => {
  const app = await buildTestApp();
  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/auth/me",
      headers: {
        origin: "http://tauri.localhost",
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "authorization,content-type"
      }
    });

    assert.equal(response.statusCode, 204, response.body);
    assert.equal(response.headers["access-control-allow-origin"], "http://tauri.localhost");
  } finally {
    await app.close();
  }
});

test("joining a room emits room.members.changed and members include host and joiner", async () => {
  const app = await buildTestApp();
  try {
    const host = await register(app, "hostuser");
    const joiner = await register(app, "joiner");

    const createRoom = await app.inject({
      method: "POST",
      url: "/api/rooms",
      headers: {
        authorization: `Bearer ${host.token}`
      },
      payload: {
        name: "Launch Room"
      }
    });

    assert.equal(createRoom.statusCode, 200, createRoom.body);
    const room = createRoom.json().room as { id: string };

    const passResponse = await app.inject({
      method: "POST",
      url: `/api/rooms/${room.id}/pass`,
      headers: {
        authorization: `Bearer ${host.token}`
      }
    });

    assert.equal(passResponse.statusCode, 200, passResponse.body);

    const sent: string[] = [];
    app.wsClients.set(host.user.id, new Set([
      {
        readyState: 1,
        send: (payload: string) => sent.push(payload)
      } as never
    ]));

    const joinResponse = await app.inject({
      method: "POST",
      url: "/api/rooms/join",
      headers: {
        authorization: `Bearer ${joiner.token}`
      },
      payload: {
        roomPass: passResponse.json().roomPass
      }
    });

    assert.equal(joinResponse.statusCode, 200, joinResponse.body);

    const event = sent.map((item) => JSON.parse(item)).find((item) => item.type === "room.members.changed");
    assert.equal(event?.data.roomId, room.id);
    assert.equal(event?.data.userId, joiner.user.id);

    const membersResponse = await app.inject({
      method: "GET",
      url: `/api/rooms/${room.id}/users`,
      headers: {
        authorization: `Bearer ${host.token}`
      }
    });

    assert.equal(membersResponse.statusCode, 200, membersResponse.body);
    const usernames = membersResponse.json().users.map((user: { username: string }) => user.username);
    assert.deepEqual(usernames.sort(), ["hostuser", "joiner"]);
  } finally {
    await app.close();
  }
});
