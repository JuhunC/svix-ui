// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { listOptionsFromRequest, listQueryFromRequest } from "@/lib/api/admin";

/** Build a NextRequest carrying only a query string (path is irrelevant). */
function req(query: string) {
  return new NextRequest(`http://localhost/api/admin/x${query}`);
}

describe("listOptionsFromRequest", () => {
  it("returns all-undefined for an empty query string", () => {
    expect(listOptionsFromRequest(req(""))).toEqual({
      limit: undefined,
      iterator: undefined,
      order: undefined,
    });
  });

  it("parses a numeric limit", () => {
    expect(listOptionsFromRequest(req("?limit=25")).limit).toBe(25);
  });

  it("parses limit=0 (truthy string, coerced to 0)", () => {
    expect(listOptionsFromRequest(req("?limit=0")).limit).toBe(0);
  });

  it("treats a blank limit as undefined", () => {
    expect(listOptionsFromRequest(req("?limit=")).limit).toBeUndefined();
  });

  it("treats a missing limit as undefined", () => {
    expect(listOptionsFromRequest(req("?order=ascending")).limit).toBeUndefined();
  });

  it("coerces a non-numeric limit to NaN (present but unparseable)", () => {
    // `limit ? Number(limit)` — a non-empty non-numeric string is truthy, so Number() → NaN.
    expect(listOptionsFromRequest(req("?limit=abc")).limit).toBeNaN();
  });

  it("passes the iterator token through verbatim", () => {
    expect(listOptionsFromRequest(req("?iterator=cursor_abc")).iterator).toBe("cursor_abc");
  });

  it("returns undefined iterator when absent", () => {
    expect(listOptionsFromRequest(req("")).iterator).toBeUndefined();
  });

  it("accepts order=ascending", () => {
    expect(listOptionsFromRequest(req("?order=ascending")).order).toBe("ascending");
  });

  it("accepts order=descending", () => {
    expect(listOptionsFromRequest(req("?order=descending")).order).toBe("descending");
  });

  it("rejects an unknown order value as undefined", () => {
    expect(listOptionsFromRequest(req("?order=asc")).order).toBeUndefined();
  });

  it("rejects a blank order as undefined", () => {
    expect(listOptionsFromRequest(req("?order=")).order).toBeUndefined();
  });

  it("parses limit, iterator, and order together", () => {
    expect(listOptionsFromRequest(req("?limit=10&iterator=c1&order=descending"))).toEqual({
      limit: 10,
      iterator: "c1",
      order: "descending",
    });
  });
});

describe("listQueryFromRequest", () => {
  it("returns the base ListOptions fields plus empty filters for a blank query", () => {
    expect(listQueryFromRequest(req(""))).toEqual({
      limit: undefined,
      iterator: undefined,
      order: undefined,
      eventTypes: undefined,
      channel: undefined,
      before: undefined,
      after: undefined,
      status: undefined,
      statusCodeClass: undefined,
      tag: undefined,
      withContent: false,
    });
  });

  it("inherits the ListOptions parsing (limit/iterator/order)", () => {
    const q = listQueryFromRequest(req("?limit=5&iterator=cur&order=ascending"));
    expect(q.limit).toBe(5);
    expect(q.iterator).toBe("cur");
    expect(q.order).toBe("ascending");
  });

  describe("event_types", () => {
    it("splits a comma-separated list", () => {
      expect(listQueryFromRequest(req("?event_types=a,b,c")).eventTypes).toEqual(["a", "b", "c"]);
    });

    it("drops empty segments from the split (filter Boolean)", () => {
      expect(listQueryFromRequest(req("?event_types=a,,b,")).eventTypes).toEqual(["a", "b"]);
    });

    it("wraps a single value in an array", () => {
      expect(listQueryFromRequest(req("?event_types=user.created")).eventTypes).toEqual([
        "user.created",
      ]);
    });

    it("is undefined when absent", () => {
      expect(listQueryFromRequest(req("")).eventTypes).toBeUndefined();
    });

    it("is undefined when blank", () => {
      expect(listQueryFromRequest(req("?event_types=")).eventTypes).toBeUndefined();
    });
  });

  describe("string filters (channel / before / after / tag)", () => {
    it("passes present values through", () => {
      const q = listQueryFromRequest(
        req("?channel=ch1&before=2024-01-01T00:00:00Z&after=2023-01-01T00:00:00Z&tag=vip"),
      );
      expect(q.channel).toBe("ch1");
      expect(q.before).toBe("2024-01-01T00:00:00Z");
      expect(q.after).toBe("2023-01-01T00:00:00Z");
      expect(q.tag).toBe("vip");
    });

    it("maps blank string filters to undefined", () => {
      const q = listQueryFromRequest(req("?channel=&before=&after=&tag="));
      expect(q.channel).toBeUndefined();
      expect(q.before).toBeUndefined();
      expect(q.after).toBeUndefined();
      expect(q.tag).toBeUndefined();
    });
  });

  describe("numeric filters (status / status_code_class)", () => {
    it("coerces numeric strings to numbers", () => {
      const q = listQueryFromRequest(req("?status=2&status_code_class=400"));
      expect(q.status).toBe(2);
      expect(q.statusCodeClass).toBe(400);
    });

    it("coerces status=0 to the number 0", () => {
      expect(listQueryFromRequest(req("?status=0")).status).toBe(0);
    });

    it("maps a non-numeric status to undefined", () => {
      expect(listQueryFromRequest(req("?status=abc")).status).toBeUndefined();
    });

    it("maps a blank numeric filter to undefined", () => {
      const q = listQueryFromRequest(req("?status=&status_code_class="));
      expect(q.status).toBeUndefined();
      expect(q.statusCodeClass).toBeUndefined();
    });

    it("maps a missing numeric filter to undefined", () => {
      expect(listQueryFromRequest(req("")).statusCodeClass).toBeUndefined();
    });
  });

  describe("with_content boolean", () => {
    it("is true only for the literal string 'true'", () => {
      expect(listQueryFromRequest(req("?with_content=true")).withContent).toBe(true);
    });

    it("is false for 'false'", () => {
      expect(listQueryFromRequest(req("?with_content=false")).withContent).toBe(false);
    });

    it("is false for any other truthy-looking value", () => {
      expect(listQueryFromRequest(req("?with_content=1")).withContent).toBe(false);
      expect(listQueryFromRequest(req("?with_content=TRUE")).withContent).toBe(false);
    });

    it("defaults to false when absent", () => {
      expect(listQueryFromRequest(req("")).withContent).toBe(false);
    });
  });

  it("parses a fully populated filter query", () => {
    const q = listQueryFromRequest(
      req(
        "?limit=50&iterator=cur&order=descending&event_types=a,b&channel=ch&before=2024&after=2023&status=1&status_code_class=500&tag=t&with_content=true",
      ),
    );
    expect(q).toEqual({
      limit: 50,
      iterator: "cur",
      order: "descending",
      eventTypes: ["a", "b"],
      channel: "ch",
      before: "2024",
      after: "2023",
      status: 1,
      statusCodeClass: 500,
      tag: "t",
      withContent: true,
    });
  });
});
