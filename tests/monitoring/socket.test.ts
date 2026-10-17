import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({
  bytes: 12,
  status: 200,
  hang: false,
  options: null as RequestOptions | null,
}));
vi.mock("node:https", () => ({
  request: (
    _url: URL,
    options: RequestOptions,
    receive: (res: IncomingMessage) => void,
  ) => {
    state.options = options;
    const req = Object.assign(new EventEmitter(), {
      destroyed: false,
      end() {
        if (state.hang) return;
        const res = Object.assign(new EventEmitter(), {
          statusCode: state.status,
        });
        receive(res as IncomingMessage);
        res.emit("data", Buffer.alloc(state.bytes));
        res.emit("end");
        req.emit("close");
        return req;
      },
      destroy(error: Error) {
        req.destroyed = true;
        req.emit("error", error);
        req.emit("close");
        return req;
      },
    });
    return req as unknown as ClientRequest;
  },
}));
import { httpsWire, resolveTarget } from "@/features/monitoring/safe-http";
beforeEach(() => {
  state.bytes = 12;
  state.status = 200;
  state.hang = false;
  state.options = null;
});
afterEach(() => vi.useRealTimers());
const config = {
  url: new URL("https://example.com/health"),
  address: "93.184.216.34",
  family: 4,
  timeoutMs: 10000,
  maxBytes: 65536,
};
it("pins the checked address with TLS hostname verification and no pooled connection", async () => {
  expect(await httpsWire(config)).toEqual({ statusCode: 200 });
  expect(state.options).toMatchObject({
    agent: false,
    family: 4,
    autoSelectFamily: false,
    rejectUnauthorized: true,
    servername: "example.com",
    maxHeaderSize: 8192,
  });
  let ip = "";
  let family = 0;
  const lookup = state.options!.lookup as (
    host: string,
    options: object,
    cb: (error: Error | null, address: string, family: number) => void,
  ) => void;
  lookup("example.com", {}, (_error, address, f) => {
    ip = address;
    family = f;
  });
  expect(ip).toBe(config.address);
  expect(family).toBe(4);
});
it("aborts a probe exceeding the response-byte cap", async () => {
  state.bytes = 65537;
  await expect(httpsWire(config)).rejects.toThrow("response_limit");
});
it("aborts a hanging socket within the total request timeout", async () => {
  vi.useFakeTimers();
  state.hang = true;
  const promise = httpsWire(config);
  const assertion = expect(promise).rejects.toThrow("probe_timeout");
  await vi.advanceTimersByTimeAsync(10000);
  await assertion;
});
it("bounds DNS resolution time before any socket is opened", async () => {
  vi.useFakeTimers();
  const promise = resolveTarget(
    new URL("https://example.com"),
    () => new Promise(() => {}),
  );
  const assertion = expect(promise).rejects.toThrow("probe_timeout");
  await vi.advanceTimersByTimeAsync(2000);
  await assertion;
});
