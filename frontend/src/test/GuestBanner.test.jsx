import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GuestBanner from '../components/GuestBanner';
import client from '../api/client';
import { useAuth } from '../context/useAuth';
import { askToSave } from '../lib/guest';

vi.mock('../api/client', () => ({
  default: { post: vi.fn() },
  SAVE_ACCOUNT: 'mordi:save-account',
}));

vi.mock('../context/useAuth', () => ({
  useAuth: vi.fn(),
}));

const GUEST = { email: 'guest-1@guest.invalid', name: 'Guest', guestUntil: '2026-11-26T22:30:00' };

function renderBanner() {
  return render(
    <MemoryRouter>
      <GuestBanner />
    </MemoryRouter>,
  );
}

describe('GuestBanner', () => {
  const login = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows nothing for a saved account', () => {
    useAuth.mockReturnValue({ user: { email: 'a@b.c', name: 'A', guestUntil: null }, login });
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('says when the demo goes', () => {
    useAuth.mockReturnValue({ user: GUEST, login });
    renderBanner();
    expect(screen.getByText(/deleted on/)).toHaveTextContent('November 26');
  });

  it('opens the save dialog when the app asks, with the reason', () => {
    useAuth.mockReturnValue({ user: GUEST, login });
    renderBanner();
    act(() => askToSave('Sharing a goal needs a saved account.'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Sharing a goal needs a saved account.');
  });

  it('saves the account and keeps the session going as the real one', async () => {
    useAuth.mockReturnValue({ user: GUEST, login });
    client.post.mockResolvedValue({ data: { token: 'new', email: 'ana@example.com', name: 'Ana', guestUntil: null } });
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Save my account' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-good-password' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save my account' }).at(-1));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({ email: 'ana@example.com', name: 'Ana', guestUntil: null }, 'new'),
    );
    expect(client.post).toHaveBeenCalledWith('/api/account/claim', {
      name: 'Ana',
      email: 'ana@example.com',
      password: 'a-good-password',
    });
    expect(await screen.findByText(/This is your account now/)).toBeInTheDocument();
  });

  it('says so when the address already has an account', async () => {
    useAuth.mockReturnValue({ user: GUEST, login });
    client.post.mockRejectedValue({ response: { status: 409 } });
    renderBanner();

    fireEvent.click(screen.getByRole('button', { name: 'Save my account' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taken@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-good-password' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save my account' }).at(-1));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already an account/);
    expect(login).not.toHaveBeenCalled();
  });
});
