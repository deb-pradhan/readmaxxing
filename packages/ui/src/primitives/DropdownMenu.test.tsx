/**
 * DropdownMenu primitive tests — roving tabindex + arrow keys + Escape.
 *
 * Per UI-UX-AUDIT accessibility finding:
 * - Only one item is tabIndex=0 at a time.
 * - Arrow Down moves focus to the next enabled item.
 * - Escape closes the menu.
 * - Disabled items are skipped.
 */

import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { Button } from "./Button";
import { DropdownMenu } from "./DropdownMenu";

const items = [
  { label: "Open", onSelect: () => undefined },
  { label: "Rename", onSelect: () => undefined, disabled: true },
  { label: "Delete", onSelect: () => undefined, danger: true },
];

describe("DropdownMenu", () => {
  it("renders with role='menu' and aria-orientation='vertical' when open", () => {
    render(
      <DropdownMenu
        trigger={<Button>Actions</Button>}
        items={items}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    expect(menu).toHaveAttribute("aria-orientation", "vertical");
    expect(menu.querySelectorAll('[role="menuitem"]').length).toBe(3);
  });

  it("only one item has tabIndex=0 at a time (roving tabindex)", () => {
    render(
      <DropdownMenu trigger={<Button>Actions</Button>} items={items} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menuItems = screen.getAllByRole("menuitem");
    const zeroCount = menuItems.filter((it) => it.tabIndex === 0).length;
    expect(zeroCount).toBe(1);
  });

  it("Arrow Down moves focus to the next enabled item", () => {
    render(
      <DropdownMenu trigger={<Button>Actions</Button>} items={items} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    // Wait one tick for the focus effect (useEffect + microtask).
    // jsdom schedules setTimeout/microtask; the synchronous test continues.
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    // The keyboard handler moves focus to the next enabled item, skipping
    // the disabled "Rename" — landing on "Delete".
    expect(screen.getByText("Delete").closest("button")).toHaveFocus();
  });

  it("Arrow Up wraps to the previous enabled item", () => {
    render(
      <DropdownMenu trigger={<Button>Actions</Button>} items={items} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    // Wrap from "Open" (index 0) → previous enabled → "Delete" (index 2).
    expect(screen.getByText("Delete").closest("button")).toHaveFocus();
  });

  it("Escape closes the menu", () => {
    render(
      <DropdownMenu trigger={<Button>Actions</Button>} items={items} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Home and End jump to first/last enabled item", () => {
    render(
      <DropdownMenu trigger={<Button>Actions</Button>} items={items} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "End" });
    expect(screen.getByText("Delete").closest("button")).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Home" });
    expect(screen.getByText("Open").closest("button")).toHaveFocus();
  });

  it("clicking a menu item fires onSelect and closes the menu", () => {
    let selected: string | null = null;
    const localItems = [
      { label: "Open", onSelect: () => (selected = "Open") },
      { label: "Delete", onSelect: () => (selected = "Delete") },
    ];
    render(
      <DropdownMenu trigger={<Button>Actions</Button>} items={localItems} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByText("Delete").closest("button")!);
    expect(selected).toBe("Delete");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});