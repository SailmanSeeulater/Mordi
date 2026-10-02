import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ResetPassword from "../pages/ResetPassword";
import client from "../api/client";
import { useAuth } from "../context/useAuth";

vi.mock("../api/client", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("../context/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// 32 random bytes, base64url: what the server puts after the #.
const TOKEN = "Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6";

function renderAt(hash) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/reset-password", hash }]}>
      <ResetPassword />
    </MemoryRouter>
  );
}

function fillAndSubmit({ password = "newpassword1", confirm = password } = {}) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: /change password/i }));
}

describe("ResetPassword", () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: null, logout: mockLogout });
  });

  it("without a token says the link has expired and offers a new one", () => {
    renderAt("");
    expect(screen.getByRole("heading", { name: /expired/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });

  it("treats a malformed fragment the same as none", () => {
    renderAt("#not a token");
    expect(screen.getByRole("heading", { name: /expired/i })).toBeInTheDocument();
  });

  it("with a token asks for the new password twice", () => {
    renderAt("#" + TOKEN);
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("refuses mismatched passwords before asking the server", () => {
    renderAt("#" + TOKEN);
    fillAndSubmit({ password: "newpassword1", confirm: "newpassword2" });

    expect(screen.getByRole("alert")).toHaveTextContent(/match/i);
    expect(client.post).not.toHaveBeenCalled();
  });

  it("sends the token with the password, then goes to sign-in with a notice", async () => {
    client.post.mockResolvedValueOnce({ status: 204 });

    renderAt("#" + TOKEN);
    fillAndSubmit();

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith("/api/auth/reset", { token: TOKEN, password: "newpassword1" });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      replace: true,
      state: { notice: expect.stringMatching(/changed/i) },
    });
    // Nobody was signed in here, so there was nothing to sign out.
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("signs this browser out first if it was signed in, since every session just ended", async () => {
    useAuth.mockReturnValue({ user: { email: "me@mordi.com" }, logout: mockLogout });
    client.post.mockResolvedValueOnce({ status: 204 });

    renderAt("#" + TOKEN);
    fillAndSubmit();

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
    expect(mockLogout).toHaveBeenCalled();
  });

  it("a used or expired link switches to the expired view", async () => {
    client.post.mockRejectedValueOnce({ response: { status: 410, data: { error: "gone" } } });

    renderAt("#" + TOKEN);
    fillAndSubmit();

    expect(await screen.findByRole("heading", { name: /expired/i })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows the server's own words when the password itself is refused", async () => {
    client.post.mockRejectedValueOnce({
      response: { status: 400, data: { fieldErrors: { password: "Password must be between 8 and 72 characters" } } },
    });

    renderAt("#" + TOKEN);
    fillAndSubmit({ password: "short" });

    expect(await screen.findByRole("alert")).toHaveTextContent(/between 8 and 72/i);
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
  });
});
