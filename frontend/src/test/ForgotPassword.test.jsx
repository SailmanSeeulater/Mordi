import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ForgotPassword from "../pages/ForgotPassword";
import client from "../api/client";

vi.mock("../api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>
  );
}

function submit(email = "ana@example.com") {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /email me a link/i }));
}

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks for an address and links back to sign-in", () => {
    renderPage();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email me a link/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("sends the address and shows the same confirmation whatever the server knows", async () => {
    client.post.mockResolvedValueOnce({ data: { message: "ok" } });

    renderPage();
    submit("ana@example.com");

    const done = await screen.findByRole("status");
    expect(done).toHaveTextContent(/on its way/i);
    expect(done).toHaveTextContent("ana@example.com");
    expect(client.post).toHaveBeenCalledWith("/api/auth/forgot", { email: "ana@example.com" });
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("lets the person go back and try another address", async () => {
    client.post.mockResolvedValueOnce({ data: {} });

    renderPage();
    submit();
    await screen.findByRole("status");

    fireEvent.click(screen.getByRole("button", { name: /try another address/i }));

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("asks to wait after too many tries", async () => {
    client.post.mockRejectedValueOnce({ response: { status: 429 } });

    renderPage();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/wait a minute/i);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("explains when the server could not be reached", async () => {
    client.post.mockRejectedValueOnce(new Error("Network Error"));

    renderPage();
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(/send the link/i);
  });

  it("disables the button while the request is in flight", async () => {
    let resolveRequest;
    client.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderPage();
    submit();

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    resolveRequest({ data: {} });
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
  });
});
