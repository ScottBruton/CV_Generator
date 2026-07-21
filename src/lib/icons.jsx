import { cloneElement } from 'react';
import { assetUrl } from './content.js';

const ASSET_ICONS = {
  multi: 'assets/icons/multi.svg'
};

const ICONS = {
  location: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 11h8M8 8h5" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 4h4l1 5-3 2c1 3 3 5 6 6l2-3 5 1v4c0 1-1 2-2 2C10 21 3 14 3 5c0-1 1-2 2-2z" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 18l4-6 4 3 4-8 4 5" />
      <path d="M4 18h16" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 19c0-3 3-5 6-5s6 2 6 5" />
      <path d="M14 14c2 0 4 1.5 4 4" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  ),
  growth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-10" />
      <path d="M14 5h7v7" />
    </svg>
  ),
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  hexShape: (
    <svg viewBox="0 0 56 64" aria-hidden="true">
      <polygon points="28,2 52,14 52,50 28,62 4,50 4,14" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  photo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="11" r="3" />
      <path d="M8 17c1.5-2 2.5-3 4-3s2.5 1 4 3" />
    </svg>
  )
};

function AssetIcon({ src, className }) {
  return (
    <span
      className={className ? `${className} icon-asset` : 'icon-asset'}
      aria-hidden="true"
      style={{
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center'
      }}
    />
  );
}

export function Icon({ name, className }) {
  const assetPath = ASSET_ICONS[name];
  if (assetPath) {
    return <AssetIcon src={assetUrl(assetPath)} className={className} />;
  }

  const icon = ICONS[name];
  if (!icon) return null;
  return cloneElement(icon, {
    className: className || undefined,
    'aria-hidden': true
  });
}

export default ICONS;
