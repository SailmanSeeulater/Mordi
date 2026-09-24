import client from '../api/client';

/**
 * Shared goals, from the browser's side. The invite code rides after a # in
 * the link: the fragment never leaves the browser, so the code stays out of
 * server logs and Referer headers. It is sent to the API in a request body.
 */

export const MAX_MESSAGE = 500;

export function inviteUrl(code, origin = window.location.origin) {
  return `${origin}/join#${code}`;
}

/** The code from a /join#code link, or '' when there is none. */
export function readInviteCode(hash) {
  const code = (hash ?? '').replace(/^#/, '').trim();
  return /^[A-Za-z0-9_-]{20,64}$/.test(code) ? code : '';
}

export function initials(name) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Goals with anyone else in them. */
export function sharedGoals(goals) {
  return goals.filter((g) => g.role === 'member' || (g.memberCount ?? 1) > 1);
}

/** "You and 2 others", "Sam's goal · 3 people". */
export function togetherLabel(goal) {
  const others = Math.max(0, (goal.memberCount ?? 1) - 1);
  if (goal.role === 'member') {
    const owner = (goal.ownerName ?? '').trim().split(/\s+/)[0] || 'Someone';
    return `${owner}’s goal · ${goal.memberCount} people`;
  }
  return others === 0 ? 'Just you' : `You and ${others} ${others === 1 ? 'other' : 'others'}`;
}

/** "Just now", "5m", "3h", or the date. For a message's timestamp. */
export function sinceLabel(iso, now = new Date()) {
  const at = new Date(iso);
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400 && at.getDate() === now.getDate()) return `${Math.floor(seconds / 3600)}h`;
  return at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const togetherApi = {
  week: (goalId, weekIso) => client.get(`/api/goals/${goalId}/together`, { params: { week: weekIso } }),
  messages: (goalId, before) =>
    client.get(`/api/goals/${goalId}/messages`, { params: before ? { before } : {} }),
  post: (goalId, body) => client.post(`/api/goals/${goalId}/messages`, { body }),
  deleteMessage: (goalId, id) => client.delete(`/api/goals/${goalId}/messages/${id}`),
  createInvite: (goalId) => client.post(`/api/goals/${goalId}/invites`),
  revokeInvites: (goalId) => client.delete(`/api/goals/${goalId}/invites`),
  removeMember: (goalId, userId) => client.delete(`/api/goals/${goalId}/members/${userId}`),
  leave: (goalId) => client.delete(`/api/goals/${goalId}/membership`),
  preview: (code) => client.post('/api/invites/preview', { code }),
  accept: (code) => client.post('/api/invites/accept', { code }),
};
