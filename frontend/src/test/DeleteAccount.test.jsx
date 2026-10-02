import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DeleteAccount from '../components/DeleteAccount';
import client from '../api/client';
import { useAuth } from '../context/useAuth';

vi.mock('../api/client', () => ({
  default: {
    delete: vi.fn(),
  },
}));

vi.mock('../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <DeleteAccount />
    </MemoryRouter>,
  );
}

function openAndSubmit(password = 'my-password') {
  fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
  fireEvent.change(screen.getByLabelText('Your password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: /delete permanently/i }));
}

describe('DeleteAccount', () => {
  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ logout: mockLogout });
  });

  it('says what goes before asking for anything', () => {
    renderPanel();
    expect(screen.getByText(/can’t be undone/)).toBeInTheDocument();
    expect(screen.getByText(/pass to whoever joined them first/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your password')).not.toBeInTheDocument();
  });

  it('cancelling closes the form and sends nothing', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /delete my account/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByLabelText('Your password')).not.toBeInTheDocument();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('sends the password, signs out, and goes to sign-in with a notice', async () => {
    client.delete.mockResolvedValueOnce({ status: 204 });

    renderPanel();
    openAndSubmit('my-password');

    await waitFor(() => {
      expect(client.delete).toHaveBeenCalledWith('/api/account', { data: { password: 'my-password' } });
    });
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login', {
      replace: true,
      state: { notice: expect.stringMatching(/deleted/i) },
    });
  });

  it('a wrong password keeps the account and says so', async () => {
    client.delete.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Password is incorrect' } } });

    renderPanel();
    openAndSubmit('wrong');

    expect(await screen.findByRole('alert')).toHaveTextContent(/password isn’t right/i);
    expect(mockLogout).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /delete permanently/i })).not.toBeDisabled();
  });

  it('asks to wait after too many tries', async () => {
    client.delete.mockRejectedValueOnce({ response: { status: 429 } });

    renderPanel();
    openAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a minute/i);
  });
});
