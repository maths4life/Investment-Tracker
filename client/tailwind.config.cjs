module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FAFAFA',
        surface: '#FFFFFF',
        text: '#1F2328',
        muted: '#6B7280',
        divider: '#E8E8E8',
        fill: '#F3F4F6',
        positive: '#4E8F6B',
        negative: '#C8665B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '13': '13px',
      },
      borderRadius: {
        DEFAULT: '4px',
        md: '6px',
      },
      maxWidth: {
        content: '1120px',
      },
    },
  },
  plugins: [],
};

