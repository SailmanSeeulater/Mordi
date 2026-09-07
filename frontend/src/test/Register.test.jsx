import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Register from "../pages/Register";
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

function renderRegister() {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>
  );
}

function fillAndSubmit({
  name = "Test User",
  email = "user@example.com",
  password = "correcthorse",
} = {}) {
  fireEvent.change(screen.getByPlaceholderText("Full Name"), {
    target: { value: name },
  });
  fireEvent.change(screen.getByPlaceholderText("Email"), {
    target: { value: email },
  });
  fireEvent.change(screen.getByPlaceholderText("Password"), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

// --- Tests ---------------------------------------------------------------

describe("Register", () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ login: mockLogin });
  });

  it("renders name, email, password fields, and submit button", () => {
    renderRegister();
    expect(screen.getByPlaceholderText("Full Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i })
    ).toBeInTheDocument();
  });

  it("renders a link to the login page", () => {
    renderRegister();
    const link = screen.getByRole("link", { name: /login/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("updates input values as the user types", () => {
    renderRegister();
    const nameInput = screen.getByPlaceholderText("Full Name");
    const emailInput = screen.getByPlaceholderText("Email");
    const passwordInput = screen.getByPlaceholderText("Password");

    fireEvent.change(nameInput, { target: { value: "Jane Doe" } });
    fireEvent.change(emailInput, { target: { value: "jane@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "hunter2" } });

    expect(nameInput).toHaveValue("Jane Doe");
    expect(emailInput).toHaveValue("jane@example.com");
    expect(passwordInput).toHaveValue("hunter2");
  });

  it("submits registration data, calls login(), and navigates to /dashboard on success", async () => {
    client.post.mockResolvedValueOnce({
      data: { email: "user@example.com", name: "Test User", token: "fake-jwt" },
    });

    renderRegister();
    fillAndSubmit();

    await waitFor(() => {
      expect(client.post).toHaveBeenCalledWith("/api/auth/register", {
        name: "Test User",
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

  it("shows a generic error message on failed registration, without leaking backend detail", async () => {
    client.post.mockRejectedValueOnce({
      response: { status: 409, data: { message: "Email already registered to user 4821" } },
    });

    renderRegister();
    fillAndSubmit({ email: "taken@example.com" });

    const errorMsg = await screen.findByText(
      "Registration failed. Email may already be in use."
    );
    expect(errorMsg).toBeInTheDocument();

    // Ensure backend-provided detail (e.g. internal user IDs) never reaches the DOM.
    expect(screen.queryByText(/4821/)).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("clears a previous error on a new submit attempt", async () => {
    client.post.mockRejectedValueOnce({ response: { status: 409 } });

    renderRegister();
    fillAndSubmit({ email: "taken@example.com" });
    await screen.findByText("Registration failed. Email may already be in use.");

    client.post.mockResolvedValueOnce({
      data: { email: "new@example.com", name: "Test User", token: "fake-jwt" },
    });
    fillAndSubmit({ email: "new@example.com" });

    await waitFor(() => {
      expect(
        screen.queryByText("Registration failed. Email may already be in use.")
      ).not.toBeInTheDocument();
    });
  });

  // KNOWN GAP: Register.jsx has no loading/disabled state during submit.
  // Same issue as Login.jsx — see the matching skipped test there.
  // Left in (skipped) as a marker for when the double-submit guard lands.
  it.skip("disables the submit button while the request is in flight", async () => {
    let resolveRequest;
    client.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    renderRegister();
    fireEvent.change(screen.getByPlaceholderText("Full Name"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "correcthorse" },
    });

    const button = screen.getByRole("button", { name: /create account/i });
    fireEvent.click(button);

    // Expected once a loading guard exists:
    expect(button).toBeDisabled();

    resolveRequest({
      data: { email: "user@example.com", name: "Test User", token: "fake-jwt" },
    });
    await waitFor(() => expect(button).not.toBeDisabled());
  });
});