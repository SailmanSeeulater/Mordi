import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Privacy from '../pages/Privacy';
import Terms from '../pages/Terms';
import TermsConsent from '../components/TermsConsent';
import { GOOGLE_MAPS_TERMS, GOOGLE_PRIVACY, LEGAL } from '../lib/legal';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('the legal facts', () => {
  it('name a real operator, not the placeholder', () => {
    expect(LEGAL.operator).not.toMatch(/\[|\]|your full name/i);
    expect(LEGAL.operator.trim().length).toBeGreaterThan(1);
  });

  it('carry the same version the backend records at sign-up', () => {
    // vitest runs from frontend/, so the backend is one level up.
    const java = readFileSync(
      resolve(process.cwd(), '../backend/src/main/java/com/mordi/backend/service/AuthService.java'),
      'utf8',
    );
    const backend = java.match(/TERMS_VERSION\s*=\s*"([^"]+)"/)?.[1];
    expect(backend).toBe(LEGAL.version);
  });
});

describe('Privacy', () => {
  it('names the contact address, the operator and the services that see data', () => {
    inRouter(<Privacy />);
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: LEGAL.contact })[0]).toHaveAttribute('href', `mailto:${LEGAL.contact}`);
    for (const service of ['Oracle Cloud', 'Resend', 'Google Maps Platform', 'Google Fonts', 'Open-Meteo']) {
      expect(screen.getByText(service)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Google Privacy Policy' })).toHaveAttribute('href', GOOGLE_PRIVACY);
  });

  it('says how deletion and backups work and covers California and children', () => {
    inRouter(<Privacy />);
    expect(screen.getByText(/overwritten, so it is gone from those within a week/i)).toBeInTheDocument();
    expect(screen.getByText(/California residents/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Children' })).toBeInTheDocument();
    expect(screen.getByText(/Do Not Track/)).toBeInTheDocument();
  });
});

describe('Terms', () => {
  it('sets the age, the governing law and the Google Maps terms', () => {
    inRouter(<Terms />);
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`at least ${LEGAL.minimumAge} years old`))).toBeInTheDocument();
    expect(screen.getByText(/governed by the laws of the State of California/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Google Maps\/Google Earth Additional Terms/ })).toHaveAttribute(
      'href',
      GOOGLE_MAPS_TERMS,
    );
    expect(screen.getAllByRole('link', { name: 'Privacy Policy' })[0]).toHaveAttribute('href', '/privacy');
  });
});

describe('TermsConsent', () => {
  it('links both pages, opening in a new tab so the form is kept', () => {
    inRouter(<TermsConsent />);
    const terms = screen.getByRole('link', { name: 'Terms of Service' });
    const privacy = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(terms).toHaveAttribute('href', '/terms');
    expect(privacy).toHaveAttribute('href', '/privacy');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(privacy).toHaveAttribute('target', '_blank');
  });
});
