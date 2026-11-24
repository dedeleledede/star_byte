import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

async function buildTestApp() {
  const dataDir = mkdtempSync(join(tmpdir(), "starbyte-sessions-test-"));
  process.env.NODE_ENV = "test";
  process.env.DB_PATH = join(dataDir, "starbyte.db");
  process.env.CLIENT_ORIGIN = "https://starbyte.test";
  process.env.JWT_SECRET = "test-secret-that-is-long-enough";
  process.env.TRUST_PROXY = "false";

  return buildApp();
}

async function registerUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  username: string,
  userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    headers: {
      "user-agent": userAgent
    },
    payload: {
      username,
      displayName: username.toUpperCase(),
      password: "password123"
    }
  });

  assert.equal(response.statusCode, 200, response.body);
  return response.json() as {
    token: string;
    user: { id: string; username: string };
    session: { id: string; deviceName: string; current: boolean };
  };
}

async function loginUser(
  app: Awaited<ReturnType<typeof buildApp>>,
  username: string,
  options?: { userAgent?: string; deviceName?: string }
) {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: options?.userAgent ? { "user-agent": options.userAgent } : undefined,
    payload: {
      username,
      password: "password123",
      ...(options?.deviceName ? { deviceName: options.deviceName } : {})
    }
  });

  assert.equal(response.statusCode, 200, response.body);
  return response.json() as {
    token: string;
    user: { id: string; username: string };
    session: { id: string; deviceName: string; current: boolean };
  };
}

test("GET /api/auth/sessions lists active sessions and marks the current session", async () => {
  const app = await buildTestApp();
  try {
    const first = await registerUser(
      app,
      "sessionuser",
      "Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0.0.0 Safari/537.36"
    );
    const second = await loginUser(app, "sessionuser", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0"
    });
    const third = await loginUser(app, "sessionuser", {
      deviceName: "StarByte Desktop on macOS"
    });

    const listRes = await app.inject({
      method: "GET",
      url: "/api/auth/sessions",
      headers: {
        authorization: `Bearer ${second.token}`
      }
    });

    assert.equal(listRes.statusCode, 200, listRes.body);
    const { sessions } = listRes.json() as {
      sessions: Array<{ id: string; deviceName: string; current: boolean }>;
    };

    assert.equal(sessions.length, 3);

    const byId = new Map(sessions.map((s) => [s.id, s]));
    assert.equal(byId.get(first.session.id)?.deviceName, "Chrome on Linux");
    assert.equal(byId.get(first.session.id)?.current, false);
    assert.equal(byId.get(second.session.id)?.deviceName, "Firefox on Windows");
    assert.equal(byId.get(second.session.id)?.current, true);
    assert.equal(byId.get(third.session.id)?.deviceName, "StarByte Desktop on macOS");
    assert.equal(byId.get(third.session.id)?.current, false);
  } finally {
    await app.close();
  }
});

test("DELETE /api/auth/sessions/:sessionId revokes only the target session and closes its WebSockets", async () => {
  const app = await buildTestApp();
  try {
    const first = await registerUser(app, "revokeuser");
    const second = await loginUser(app, "revokeuser", { deviceName: "Phone" });

    const sent: string[] = [];
    let closedCode: number | undefined;
    app.wsSessionClients.set(
      second.session.id,
      new Set([
        {
          readyState: 1,
          send: (payload: string) => sent.push(payload),
          close: (code?: number) => {
            closedCode = code;
          }
        } as never
      ])
    );

    const revokeRes = await app.inject({
      method: "DELETE",
      url: `/api/auth/sessions/${second.session.id}`,
      headers: {
        authorization: `Bearer ${first.token}`
      }
    });

    assert.equal(revokeRes.statusCode, 200, revokeRes.body);
    assert.deepEqual(revokeRes.json(), { ok: true, revokedCurrent: false });

    assert.equal(closedCode, 4001);
    assert.ok(sent.some((msg) => JSON.parse(msg).type === "session.revoked"));

    // Revoked token is rejected
    const revokedMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${second.token}` }
    });
    assert.equal(revokedMe.statusCode, 401);
    assert.equal(revokedMe.json().error, "invalid session");

    // First session still works
    const activeMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${first.token}` }
    });
    assert.equal(activeMe.statusCode, 200);

    // Revoking again returns 404
    const repeatRevoke = await app.inject({
      method: "DELETE",
      url: `/api/auth/sessions/${second.session.id}`,
      headers: { authorization: `Bearer ${first.token}` }
    });
    assert.equal(repeatRevoke.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("DELETE /api/auth/sessions/:sessionId cannot revoke another user's session", async () => {
  const app = await buildTestApp();
  try {
    const alice = await registerUser(app, "alice_sess");
    const bob = await registerUser(app, "bob_sess");

    const response = await app.inject({
      method: "DELETE",
      url: `/api/auth/sessions/${alice.session.id}`,
      headers: {
        authorization: `Bearer ${bob.token}`
      }
    });

    assert.equal(response.statusCode, 404);

    const aliceMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${alice.token}` }
    });
    assert.equal(aliceMe.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("POST /api/auth/logout revokes only the current session", async () => {
  const app = await buildTestApp();
  try {
    const first = await registerUser(app, "logoutuser");
    const second = await loginUser(app, "logoutuser", { deviceName: "Second Device" });

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${first.token}` }
    });
    assert.equal(logoutRes.statusCode, 200);
    assert.deepEqual(logoutRes.json(), { ok: true });

    const firstMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${first.token}` }
    });
    assert.equal(firstMe.statusCode, 401);

    const secondMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${second.token}` }
    });
    assert.equal(secondMe.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("POST /api/auth/logout-all supports revoking other sessions and logging out everywhere", async () => {
  const app = await buildTestApp();
  try {
    const s1 = await registerUser(app, "everywhere");
    const s2 = await loginUser(app, "everywhere", { deviceName: "Device 2" });
    const s3 = await loginUser(app, "everywhere", { deviceName: "Device 3" });

    // First test includeCurrent: false (revoke other devices only)
    const othersRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout-all",
      headers: { authorization: `Bearer ${s1.token}` },
      payload: { includeCurrent: false }
    });
    assert.equal(othersRes.statusCode, 200, othersRes.body);
    assert.deepEqual(othersRes.json(), {
      ok: true,
      revokedCount: 2,
      loggedOutCurrent: false
    });

    assert.equal(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${s2.token}` } })).statusCode,
      401
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${s3.token}` } })).statusCode,
      401
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${s1.token}` } })).statusCode,
      200
    );

    // Log in another session, then log out everywhere (default includeCurrent: true)
    const s4 = await loginUser(app, "everywhere", { deviceName: "Device 4" });
    const allRes = await app.inject({
      method: "POST",
      url: "/api/auth/logout-all",
      headers: { authorization: `Bearer ${s1.token}` }
    });
    assert.equal(allRes.statusCode, 200, allRes.body);
    assert.deepEqual(allRes.json(), {
      ok: true,
      revokedCount: 2,
      loggedOutCurrent: true
    });

    assert.equal(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${s1.token}` } })).statusCode,
      401
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/auth/me", headers: { authorization: `Bearer ${s4.token}` } })).statusCode,
      401
    );
  } finally {
    await app.close();
  }
});
