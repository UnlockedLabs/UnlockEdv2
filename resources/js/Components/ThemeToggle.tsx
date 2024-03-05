import { useEffect } from "react";

export default function ThemeToggle() {
    useEffect(() => {
        /* Sets the data-theme attribute on html tag */
        document.documentElement.setAttribute(
            "data-theme",
            localStorage.getItem("theme") === "dark" ? "dark" : "light",
        );
    }, []);

    return (
        /* Component provided by daisyUI - https://daisyui.com/components/toggle/ */
        <input
            type="checkbox"
            className="toggle"
            defaultChecked={
                typeof window !== "undefined" &&
                localStorage.getItem("theme") === "dark"
            }
            onClick={(e: any) => {
                let newTheme = e.target.checked ? "dark" : "light";
                localStorage.setItem("theme", newTheme);
                document.documentElement.setAttribute("data-theme", newTheme);
            }}
        />
    );
}
