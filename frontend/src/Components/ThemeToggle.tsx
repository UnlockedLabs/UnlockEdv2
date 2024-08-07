import { useEffect, useContext } from 'react';
import { ThemeContext } from './ThemeContext';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useContext(ThemeContext);

    useEffect(() => {
        /* Sets the data-theme attribute on html tag */
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        /* Component provided by daisyUI - https://daisyui.com/components/toggle/ */
        <input
            type="checkbox"
            className="toggle"
            checked={theme === 'dark'}
            onChange={(e) => {
                toggleTheme();
                e.target.blur();
            }}
        />
    );
}
