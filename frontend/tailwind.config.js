export default {
    content: ['./src/**/*.tsx'],

    daisyui: {
        themes: [
            {
                light: {
                    primary: '#14b8a6',
                    secondary: '#2dd4bf',
                    accent: '#d97706',
                    neutral: '#4d5360',
                    'base-100': '#f3f4f6',
                    info: '#0ea5e9',
                    success: '#22c55e',
                    warning: '#e97356',
                    error: '#d95566',

                    '--teal-1': '#D7F4F1',
                    '--teal-2': '#B0DFDA',
                    '--teal-3': '#18ABA0',
                    '--teal-4': '#005952',
                    '--teal-5': '#002E2A',
                    '--base-teal': '#FFFFFF',
                    '--background': '#F9FBFB',
                    '--inner-background': '#FFFFFF',
                    '--dark-yellow': '#EA9B00',
                    '--primary-yellow': '#FDC601',
                    '--pale-yellow': '#FFF3D4',
                    '--grey-1': '#ECECEC',
                    '--grey-2': '#CCCCCC',
                    '--grey-3': '#999999',
                    '--grey-4': '#737373',
                    '--body-text': '#222222',
                    '--header-text': '#121212',
                    '--fallback-b1': '#F9FBFB'
                },
                dark: {
                    primary: '#14b8a6',
                    secondary: '#2dd4bf',
                    accent: '#ebaf24',
                    neutral: '#7d8390',
                    'base-100': '#1f2937',
                    info: '#0ea5e9',
                    success: '#22c55e',
                    warning: '#e97356',
                    error: '#d95566',

                    '--teal-1': '#11554E',
                    '--teal-2': '#13746C',
                    '--teal-3': '#14958A',
                    '--teal-4': '#61BAB2',
                    '--teal-5': '#B0DFDA',
                    '--base-teal': '#103531',
                    '--background': '#0F2926',
                    '--inner-background': '#1A3F3B',
                    '--dark-yellow': '#EA9B00',
                    '--primary-yellow': '#FDC601',
                    '--pale-yellow': '#18ABA0',
                    '--grey-1': '#737373',
                    '--grey-2': '#999999',
                    '--grey-3': '#CCCCCC',
                    '--grey-4': '#ECECEC',
                    '--body-text': '#EEEEEE',
                    '--header-text': '#CCCCCC',
                    '--fallback-b1': '#0F2926'
                }
            }
        ]
    },

    theme: {
        extend: {
            fontFamily: {
                lexend: ['Lexend', 'sans-serif']
            },
            colors: {
                'teal-1': 'var(--teal-1)',
                'teal-2': 'var(--teal-2)',
                'teal-3': 'var(--teal-3)',
                'teal-4': 'var(--teal-4)',
                'teal-5': 'var(--teal-5)',
                'base-teal': 'var(--base-teal)',
                background: 'var(--background)',
                'inner-background': 'var(--inner-background)',
                'dark-yellow': 'var(--dark-yellow)',
                'primary-yellow': 'var(--primary-yellow)',
                'pale-yellow': 'var(--pale-yellow)',
                'grey-1': 'var(--grey-1)',
                'grey-2': 'var(--grey-2)',
                'grey-3': 'var(--grey-3)',
                'grey-4': 'var(--grey-4)',
                'body-text': 'var(--body-text)',
                'header-text': 'var(--header-text)'
            }
        }
    },

    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
        require('daisyui')
    ]
};
