export function resolveDeviceName(userAgent?: string, deviceNameHint?: string): string {
  const hint = deviceNameHint?.trim();
  if (hint) {
    return hint.slice(0, 80);
  }

  const ua = (userAgent ?? "").trim();
  if (!ua) {
    return "Unknown device";
  }

  let client = "";
  if (/StarByte|Tauri/i.test(ua)) {
    client = "StarByte Desktop";
  } else if (/Edg\//i.test(ua)) {
    client = "Edge";
  } else if (/OPR\/|Opera/i.test(ua)) {
    client = "Opera";
  } else if (/Firefox\//i.test(ua)) {
    client = "Firefox";
  } else if (/CriOS\/|Chrome\//i.test(ua)) {
    client = "Chrome";
  } else if (/Safari\//i.test(ua)) {
    client = "Safari";
  } else if (/curl\//i.test(ua)) {
    client = "curl";
  } else if (/node|undici/i.test(ua)) {
    client = "Node.js";
  }

  let os = "";
  if (/Windows/i.test(ua)) {
    os = "Windows";
  } else if (/Android/i.test(ua)) {
    os = "Android";
  } else if (/iPhone/i.test(ua)) {
    os = "iPhone";
  } else if (/iPad/i.test(ua)) {
    os = "iPad";
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = "macOS";
  } else if (/Linux/i.test(ua)) {
    os = "Linux";
  }

  if (client && os) {
    return `${client} on ${os}`;
  }
  if (client) {
    return client;
  }
  if (os) {
    return `Web on ${os}`;
  }

  return "Unknown device";
}
