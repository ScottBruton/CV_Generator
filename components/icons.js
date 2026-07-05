/**
 * Outline SVG icons used across CV components.
 * Each method returns an HTML string for inline SVG.
 */
const icons = {
  location: `<svg class="contact__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/>
    <circle cx="12" cy="10" r="2.5"/>
  </svg>`,

  linkedin: `<svg class="contact__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <path d="M8 11h8M8 8h5"/>
  </svg>`,

  email: `<svg class="contact__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <path d="M3 7l9 6 9-6"/>
  </svg>`,

  phone: `<svg class="contact__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M6 4h4l1 5-3 2c1 3 3 5 6 6l2-3 5 1v4c0 1-1 2-2 2C10 21 3 14 3 5c0-1 1-2 2-2z"/>
  </svg>`,

  trend: `<svg class="stat-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M4 18l4-6 4 3 4-8 4 5"/>
    <path d="M4 18h16"/>
  </svg>`,

  target: `<svg class="stat-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="5"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
  </svg>`,

  people: `<svg class="stat-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="9" cy="8" r="3"/>
    <circle cx="16" cy="9" r="2.5"/>
    <path d="M3 19c0-3 3-5 6-5s6 2 6 5"/>
    <path d="M14 14c2 0 4 1.5 4 4"/>
  </svg>`,

  gear: `<svg class="pillar__hex-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>
  </svg>`,

  shield: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z"/>
  </svg>`,

  check: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`,

  plus: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M4 12h16M12 4v16"/>
    <circle cx="12" cy="12" r="9"/>
  </svg>`,

  list: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M4 6h16M4 12h10M4 18h14"/>
  </svg>`,

  growth: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M3 17l6-6 4 4 8-10"/>
    <path d="M14 5h7v7"/>
  </svg>`,

  lock: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <rect x="3" y="8" width="18" height="12" rx="1"/>
    <path d="M7 8V6a5 5 0 0 1 10 0v2"/>
  </svg>`,

  clock: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 7v5l3 3"/>
  </svg>`,

  sun: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4"/>
  </svg>`,

  team: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`,

  book: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5V4.5A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>`,

  award: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M12 2a4 4 0 0 1 4 4c0 2-1 3-2 4l-2 2-2-2c-1-1-2-2-2-4a4 4 0 0 1 4-4z"/>
    <path d="M8 14l-2 6 6-2 6 2-2-6"/>
  </svg>`,

  globe: `<svg class="pillar__item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>
  </svg>`,

  hexShape: `<svg class="pillar__hex-shape" viewBox="0 0 56 64" aria-hidden="true">
    <polygon points="28,2 52,14 52,50 28,62 4,50 4,14" fill="none" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,

  referencesUser: `<svg class="references__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"/>
  </svg>`,

  photo: `<svg class="photo-placeholder__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <circle cx="12" cy="11" r="3"/>
    <path d="M8 17c1.5-2 2.5-3 4-3s2.5 1 4 3"/>
  </svg>`
};

module.exports = icons;
