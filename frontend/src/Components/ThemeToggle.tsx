import { useContext } from 'react';
import { ThemeContext } from '@/Context/ThemeContext';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useContext(ThemeContext);

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
