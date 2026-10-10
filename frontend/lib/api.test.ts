import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, beacon, errorMessage } from "./api";

function mockFetch(status: number, body: string) {
  const fn = vi.fn(async () => new Response(status === 204 ? null : body, { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

describe("api", () => {
  it("GETs from the BFF and parses JSON", async () => {
    const fetch = mockFetch(200, '{"a":1}');
    await expect(api("/texts")).resolves.toEqual({ a: 1 });
    expect(fetch).toHaveBeenCalledWith("/api/texts", expect.objectContaining({ method: "GET", body: undefined }));
  });

  it("POSTs JSON bodies with a content type", async () => {
    const fetch = mockFetch(201, "{}");
    await api("vocabulary", { body: { term: "x" } });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"term":"x"}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("sends FormData untouched so the browser sets the multipart boundary", async () => {
    const fetch = mockFetch(200, "{}");
    const form = new FormData();
    await api("upload", { body: form });
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe(form);
    expect(init.headers).toEqual({});
  });

  it("honours an explicit method", async () => {
    const fetch = mockFetch(204, "");
    await expect(api("texts/1", { method: "DELETE" })).resolves.toBeNull();
    expect(fetch.mock.calls[0]).toEqual(["/api/texts/1", expect.objectContaining({ method: "DELETE" })]);
  });

  it("returns non-JSON text as-is", async () => {
    mockFetch(200, "plain");
    await expect(api("x")).resolves.toBe("plain");
  });

  it("turns error responses into ApiError with the server's code and message", async () => {
    mockFetch(402, '{"code":"upgrade_required","message":"Upgrade"}');
    const err = await failure(api("x"));
    expect(err.status).toBe(402);
    expect(err.code).toBe("upgrade_required");
    expect(err.message).toBe("Upgrade");
    expect(err.upgradeRequired).toBe(true);
  });

  it("falls back to a generic error when the body has no details", async () => {
    mockFetch(500, "");
    const err = await failure(api("x"));
    expect(err.code).toBe("error");
    expect(err.message).toBe("Request failed (500)");
    expect(err.upgradeRequired).toBe(false);
  });

  it("does not redirect auth calls on 401 (no window in tests either way)", async () => {
    mockFetch(401, '{"code":"invalid_credentials","message":"Incorrect"}');
    await expect(api("auth/login", { body: {} })).rejects.toMatchObject({ status: 401, message: "Incorrect" });
  });
});

describe("errorMessage", () => {
  it("uses Error messages and a fallback for anything else", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("nope")).toBe("Something went wrong");
  });
});

describe("api request details", () => {
  it("sends no content type without a body", async () => {
    const fetch = mockFetch(200, "{}");
    await api("texts");
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toEqual({});
  });

  it("strips any number of leading slashes", async () => {
    const fetch = mockFetch(200, "{}");
    await api("//texts/1");
    expect((fetch.mock.calls[0] as unknown as [string])[0]).toBe("/api/texts/1");
  });
});

describe("expired sessions", () => {
  function stubWindow() {
    const win = { location: { pathname: "/vocabulary", href: "" } };
    vi.stubGlobal("window", win);
    return win;
  }

  it("send the browser to log in and come back afterwards", async () => {
    const win = stubWindow();
    mockFetch(401, "");
    const err = await failure(api("texts"));
    expect(win.location.href).toBe("/login?next=%2Fvocabulary");
    expect(err.code).toBe("unauthorized");
    expect(err.message).toBe("Please sign in again");
  });

  it("but auth calls and other errors don't redirect", async () => {
    const win = stubWindow();
    mockFetch(401, '{"code":"invalid_credentials","message":"Incorrect"}');
    await failure(api("auth/login", { body: {} }));
    mockFetch(403, '{"code":"forbidden","message":"No"}');
    await failure(api("texts/1"));
    expect(win.location.href).toBe("");
  });

  it("are not detected on the server, where there is no window", async () => {
    mockFetch(401, '{"code":"unauthorized","message":"Not signed in"}');
    expect((await failure(api("texts"))).message).toBe("Not signed in");
  });
});

describe("beacon", () => {
  it("uses sendBeacon with a JSON blob when available", async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon });
    const fetch = mockFetch(200, "");
    beacon("sessions/1/heartbeat", { seconds: 5 });
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe("/api/sessions/1/heartbeat");
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe('{"seconds":5}');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to a keepalive fetch when sendBeacon is refused or missing", async () => {
    vi.stubGlobal("navigator", { sendBeacon: () => false });
    let fetch = mockFetch(200, "");
    beacon("sessions/1/heartbeat", { seconds: 5 });
    expect(fetch).toHaveBeenCalledWith("/api/sessions/1/heartbeat", expect.objectContaining({ method: "POST", keepalive: true }));
    const init = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(await (init.body as Blob).text()).toBe('{"seconds":5}');

    vi.stubGlobal("navigator", {});
    fetch = mockFetch(200, "");
    beacon("x", {});
    expect(fetch).toHaveBeenCalledOnce();
  });
});
