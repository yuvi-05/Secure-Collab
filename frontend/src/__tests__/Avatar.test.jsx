import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import Avatar from '../components/common/Avatar';

describe('Avatar Component', () => {
  it('renders user initials when no image source is provided', () => {
    const { container } = render(<Avatar name="Alice Vance" isOnline={true} />);
    expect(container.textContent).toBe('AV');
  });

  it('renders online presence indicator badge', () => {
    const { container } = render(<Avatar name="Bob Builder" isOnline={true} />);
    const indicator = container.querySelector('.bg-emerald-400');
    expect(indicator).not.toBeNull();
  });
});
