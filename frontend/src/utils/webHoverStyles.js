import { Platform } from 'react-native';

const STYLE_TAG_ID = 'sd-grid-card-hover-styles';

/**
 * Injects a small stylesheet (once) with real CSS :hover rules for the
 * Myntra-style product/deal grid cards. React Native's Touchable components
 * don't reliably forward onMouseEnter/onMouseLeave to the underlying DOM
 * node, so we use genuine CSS hover instead of JS state for web.
 */
export function ensureGridCardHoverStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById(STYLE_TAG_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = `
    .sd-grid-card {
      transition: box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease;
      cursor: pointer;
    }
    .sd-grid-card:hover {
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
      transform: translateY(-4px);
      border-color: #e5e5e5;
    }
    .sd-grid-image {
      transition: transform 250ms ease;
    }
    .sd-grid-card:hover .sd-grid-image {
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);
}
