import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/test/test-utils";
import type { AppNotification } from "@/hooks/useNotifications";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const authState = { role: "sales_rep" as string | null };
vi.mock("@/lib/auth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/useNotificationRealtime", () => ({
  useNotificationRealtime: () => undefined,
}));

const markAsRead = vi.fn();
const markAllAsRead = vi.fn();
const notificationsState = {
  notifications: [] as AppNotification[],
  unreadCount: 0,
  isLoading: false,
};
vi.mock("@/hooks/useNotifications", () => ({
  useNotifications: () => ({ ...notificationsState, markAsRead, markAllAsRead }),
}));

import { NotificationBell } from "../NotificationBell";

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n1",
    user_id: "user-1",
    quote_id: "q1",
    type: "quote_approved",
    title: "Quote approved",
    body: "Nevada eligibility refresh",
    read_at: null,
    created_at: new Date().toISOString(),
    quote: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.role = "sales_rep";
  notificationsState.notifications = [];
  notificationsState.unreadCount = 0;
  notificationsState.isLoading = false;
});

async function openBell() {
  const user = userEvent.setup();
  render(<NotificationBell />);
  await user.click(screen.getByRole("button", { name: /notifications/i }));
  return user;
}

describe("badge", () => {
  it("hides the badge when there is nothing unread", () => {
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("9+")).not.toBeInTheDocument();
  });

  it("shows the unread count", () => {
    notificationsState.unreadCount = 4;
    render(<NotificationBell />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("caps the badge at 9+", () => {
    notificationsState.unreadCount = 23;
    render(<NotificationBell />);
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("announces the unread count to screen readers", () => {
    notificationsState.unreadCount = 2;
    render(<NotificationBell />);
    expect(
      screen.getByRole("button", { name: "Notifications (2 unread)" }),
    ).toBeInTheDocument();
  });
});

describe("dropdown contents", () => {
  it("renders the empty state", async () => {
    await openBell();
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });

  it("renders a loading state", async () => {
    notificationsState.isLoading = true;
    await openBell();
    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("renders notification titles and bodies", async () => {
    notificationsState.notifications = [makeNotification()];
    notificationsState.unreadCount = 1;
    await openBell();
    expect(await screen.findByText("Quote approved")).toBeInTheDocument();
    expect(screen.getByText("Nevada eligibility refresh")).toBeInTheDocument();
  });

  it("caps the dropdown at 20 rows", async () => {
    notificationsState.notifications = Array.from({ length: 30 }, (_, i) =>
      makeNotification({ id: `n${i}`, title: `Notification ${i}` }),
    );
    notificationsState.unreadCount = 30;
    await openBell();
    const list = await screen.findByText("Notification 0");
    const container = list.closest("div")!.parentElement!.parentElement!;
    expect(within(container).getAllByRole("button").length).toBeLessThanOrEqual(20);
    expect(screen.queryByText("Notification 25")).not.toBeInTheDocument();
  });

  it("hides Mark all read when nothing is unread", async () => {
    notificationsState.notifications = [
      makeNotification({ read_at: new Date().toISOString() }),
    ];
    await openBell();
    await screen.findByText("Quote approved");
    expect(screen.queryByText("Mark all read")).not.toBeInTheDocument();
  });

  it("marks everything read from the header action", async () => {
    notificationsState.notifications = [makeNotification()];
    notificationsState.unreadCount = 1;
    const user = await openBell();
    await user.click(await screen.findByText("Mark all read"));
    expect(markAllAsRead).toHaveBeenCalledTimes(1);
  });
});

describe("selecting a notification", () => {
  it("marks an unread notification read", async () => {
    notificationsState.notifications = [makeNotification()];
    notificationsState.unreadCount = 1;
    const user = await openBell();
    await user.click(await screen.findByText("Quote approved"));
    expect(markAsRead).toHaveBeenCalledWith("n1");
  });

  it("does not re-mark an already read notification", async () => {
    notificationsState.notifications = [
      makeNotification({ read_at: new Date().toISOString() }),
    ];
    const user = await openBell();
    await user.click(await screen.findByText("Quote approved"));
    expect(markAsRead).not.toHaveBeenCalled();
  });

  it("routes a sales rep to the rep quote page", async () => {
    notificationsState.notifications = [makeNotification()];
    const user = await openBell();
    await user.click(await screen.findByText("Quote approved"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/quotes/$id",
      params: { id: "q1" },
    });
  });

  it("routes an estimator to the review page", async () => {
    authState.role = "estimator";
    notificationsState.notifications = [makeNotification()];
    const user = await openBell();
    await user.click(await screen.findByText("Quote approved"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/review/$id",
      params: { id: "q1" },
    });
  });

  it("routes an external user to the request page", async () => {
    authState.role = "external";
    notificationsState.notifications = [makeNotification()];
    const user = await openBell();
    await user.click(await screen.findByText("Quote approved"));
    expect(navigate).toHaveBeenCalledWith({
      to: "/request-quote/$id",
      params: { id: "q1" },
    });
  });

  it("does not navigate for a notification without a quote", async () => {
    notificationsState.notifications = [makeNotification({ quote_id: null })];
    const user = await openBell();
    await user.click(await screen.findByText("Quote approved"));
    expect(navigate).not.toHaveBeenCalled();
  });
});
