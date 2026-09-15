import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/Login";
import client from "../api/client";
import { useAuth } from "../context/useAuth";

// --- Mocks ---------------------------------------------------------------

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

// --- Helpers ---------------------------------------------------------------

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  );
}

function fillAndSubmit({ email = "user@example.com", password = "correcthorse" } = {}) {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

// --- Tests ---------------------------------------------------------------

describe("Login", () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ login: mockLogin });
  });

  it("renders email, password fields, and submit button", () => {
    renderLogin();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a link to the register page", () => {
    renderLogin();
    const link = screen.getByRole("link", { name: /create an account/i });
    expect(link).toHaveAttribute("href", "/register");
  });

  it("updates input values as the user types", () => {
    renderLogin();
    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "hunter2" } });

    expect(emailInput).toHaveValue("test@example.com");
    expect(passwordInput).toHaveValue("hunter2");
  });

  it("submits credentials, calls login(), and navigates to /dashboard on success", async () => {
    client.post.mockResolvedValueOnce({
      data: { email: "user@example.com", name: "Test User", token: "fake-jwt" },
    });

    renderLogin();
    fillAndSubmit();

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith("/api/auth/login", {
        email: "user@example.com",
        password: "correcthorse",
      });
    });

    expect(mockLogin).toHaveBeenCalledWith(
      { email: "user@example.com", name: "Test User" },
      "fake-jwt"
    );
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("shows a generic error message on failed login, without leaking backend detail", async () => {
    client.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: "User not found" } },
    });

    renderLogin();
    fillAndSubmit({ email: "nouser@example.com", password: "wrongpass" });

    const errorMsg = await screen.findByText("Invalid email or password");
    expect(errorMsg).toBeInTheDocument();

    // Ensure backend-provided detail never reaches the DOM.
    expect(screen.queryByText(/user not found/i)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("shows the same generic error for wrong password as for nonexistent user (anti-enumeration)", async () => {
    client.post.mockRejectedValueOnce({
      response: { status: 401, data: { message: "Invalid credentials" } },
    });

    renderLogin();
    fillAndSubmit({ email: "realuser@example.com", password: "wrongpass" });

    const errorMsg = await screen.findByText("Invalid email or password");
    expect(errorMsg).toBeInTheDocument();
  });

  it("clears a previous error on a new submit attempt", async () => {
    client.post.mockRejectedValueOnce({ response: { status: 401 } });

    renderLogin();
    fillAndSubmit({ password: "wrong" });
    await screen.findByText("Invalid email or password");

    client.post.mockResolvedValueOnce({
      data: { email: "user@example.com", name: "Test User", token: "fake-jwt" },
    });
    fillAndSubmit({ password: "correcthorse" });

    await waitFor(() => {
      expect(screen.queryByText("Invalid email or password")).not.toBeInTheDocument();
    });
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveRequest;
    client.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderLogin();
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correcthorse" },
    });

    const button = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();

    resolveRequest({
      data: { email: "user@example.com", name: "Test User", token: "fake-jwt" },
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});