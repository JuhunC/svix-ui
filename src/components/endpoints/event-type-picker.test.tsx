import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventTypePicker } from "./event-type-picker";
import { apiGet } from "@/lib/api/fetcher";
import type { EventType, ListResponse } from "@/lib/svix/types";

vi.mock("@/lib/api/fetcher", () => ({ apiGet: vi.fn() }));

const mockedApiGet = vi.mocked(apiGet);

function eventType(name: string): EventType {
  return {
    name,
    description: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

/** Active catalog: only b.evt and c.evt survive — a.evt is an archived orphan. */
function catalogResponse(): ListResponse<EventType> {
  return {
    data: [eventType("b.evt"), eventType("c.evt")],
    iterator: null,
    done: true,
  };
}

beforeEach(() => {
  mockedApiGet.mockReset();
  mockedApiGet.mockResolvedValue(catalogResponse());
});

describe("EventTypePicker", () => {
  it("renders active catalog checkboxes and quarantines archived orphans", async () => {
    const onChange = vi.fn();
    const onCatalogLoaded = vi.fn();

    render(
      <EventTypePicker
        catalogPath="/api/admin/event-types"
        value={["a.evt", "b.evt", "c.evt"]}
        onChange={onChange}
        onCatalogLoaded={onCatalogLoaded}
      />,
    );

    // Active event types become checkboxes once the catalog resolves.
    const bBox = await screen.findByRole("checkbox", { name: "b.evt" });
    const cBox = screen.getByRole("checkbox", { name: "c.evt" });
    expect(bBox).toBeChecked();
    expect(cBox).toBeChecked();

    // The archived selection is not a checkbox — it lives in "Unavailable".
    expect(
      screen.queryByRole("checkbox", { name: "a.evt" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Archived or removed/i)).toBeInTheDocument();

    const orphan = screen.getByText("a.evt");
    expect(orphan).toHaveClass("line-through");
    expect(screen.getByText("archived")).toBeInTheDocument();

    // Parent is handed only the active names so it can drop the orphan on save.
    expect(onCatalogLoaded).toHaveBeenCalledWith(["b.evt", "c.evt"]);
  });

  it("calls onChange when a checkbox is toggled", async () => {
    const onChange = vi.fn();

    render(
      <EventTypePicker
        catalogPath="/api/admin/event-types"
        value={["a.evt", "b.evt", "c.evt"]}
        onChange={onChange}
        onCatalogLoaded={vi.fn()}
      />,
    );

    const cBox = await screen.findByRole("checkbox", { name: "c.evt" });
    fireEvent.click(cBox);

    // Unchecking c.evt drops it from the explicit subset (orphan stays).
    expect(onChange).toHaveBeenCalledWith(["a.evt", "b.evt"]);
  });

  it("selects the 'All event types' radio and hides the list when value is null", async () => {
    const onCatalogLoaded = vi.fn();

    render(
      <EventTypePicker
        catalogPath="/api/admin/event-types"
        value={null}
        onChange={vi.fn()}
        onCatalogLoaded={onCatalogLoaded}
      />,
    );

    // Wait for the async catalog load to settle so state updates are flushed.
    await waitFor(() => expect(onCatalogLoaded).toHaveBeenCalled());

    const allRadio = screen.getByRole("radio", { name: "All event types" });
    const subsetRadio = screen.getByRole("radio", {
      name: "Only selected event types",
    });
    expect(allRadio).toBeChecked();
    expect(subsetRadio).not.toBeChecked();

    // The catalog list (and its checkboxes) is hidden in "all" mode.
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
