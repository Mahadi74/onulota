/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    // ── Typography scale ────────────────────────────────────────────────────
    fontSize: {
      xs:   ['0.75rem',  { lineHeight: '1rem' }],
      sm:   ['0.875rem', { lineHeight: '1.25rem' }],
      base: ['1rem',     { lineHeight: '1.5rem' }],
      lg:   ['1.125rem', { lineHeight: '1.75rem' }],
      xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
      '2xl':['1.5rem',   { lineHeight: '2rem' }],
      '3xl':['1.875rem', { lineHeight: '2.25rem' }],
      '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
      '5xl':['3rem',     { lineHeight: '1.1' }],
    },
    // ── Container ───────────────────────────────────────────────────────────
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      // ── Brand color palette ─────────────────────────────────────────────
      colors: {
        // Semantic tokens (CSS-var driven, works with dark mode)
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT:    'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          50:  'hsl(var(--primary-50))',
          100: 'hsl(var(--primary-100))',
          600: 'hsl(var(--primary-600))',
          700: 'hsl(var(--primary-700))',
        },
        secondary: {
          DEFAULT:    'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT:    'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT:    'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT:    'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT:    'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Brand direct palette (onulota brand)
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        surface: {
          DEFAULT: '#ffffff',
          50:      '#f8fafc',
          100:     '#f1f5f9',
          200:     '#e2e8f0',
        },
        ink: {
          DEFAULT: '#0f172a',
          secondary: '#475569',
          tertiary:  '#94a3b8',
          disabled:  '#cbd5e1',
        },
        success:  { DEFAULT: '#16a34a', light: '#dcfce7' },
        warning:  { DEFAULT: '#d97706', light: '#fef3c7' },
        danger:   { DEFAULT: '#dc2626', light: '#fee2e2' },
      },

      // ── Font families ───────────────────────────────────────────────────
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      // ── Font weights ────────────────────────────────────────────────────
      fontWeight: {
        normal:    '400',
        medium:    '500',
        semibold:  '600',
        bold:      '700',
        extrabold: '800',
      },

      // ── Spacing extras ──────────────────────────────────────────────────
      spacing: {
        '4.5': '1.125rem',
        '13':  '3.25rem',
        '15':  '3.75rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
      },

      // ── Border radius ───────────────────────────────────────────────────
      borderRadius: {
        none: '0',
        sm:   '0.25rem',
        DEFAULT:'0.375rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '1rem',
        '2xl':'1.25rem',
        '3xl':'1.5rem',
        full: '9999px',
      },

      // ── Shadows / Elevation ─────────────────────────────────────────────
      boxShadow: {
        xs:  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        sm:  '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md:  '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg:  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl:  '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl':'0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner:'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
        none: 'none',
      },

      // ── Transitions ─────────────────────────────────────────────────────
      transitionDuration: {
        fast:   '100ms',
        DEFAULT:'150ms',
        slow:   '300ms',
        slower: '500ms',
      },

      // ── Keyframes & Animations ──────────────────────────────────────────
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'fade-in':        'fade-in 0.2s ease-out',
        'slide-up':       'slide-up 0.25s ease-out',
        'scale-in':       'scale-in 0.15s ease-out',
      },
    },
  },
  plugins: [],
}
