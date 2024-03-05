export default {
    content: [
        "./vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php",
        "./storage/framework/views/*.php",
        "./resources/views/**/*.blade.php",
        "./resources/js/**/*.tsx",
    ],

    daisyui: {
        themes: [
            {
                light: {
                    primary: "#14b8a6",
                    secondary: "#2dd4bf",
                    accent: "#d97706",
                    neutral: "#4d5360",
                    "base-100": "#f3f4f6",
                    info: "#0ea5e9",
                    success: "#22c55e",
                    warning: "#e97356",
                    error: "#d95566",
                },
                dark: {
                    primary: "#14b8a6",
                    secondary: "#2dd4bf",
                    accent: "#ebaf24",
                    neutral: "#7d8390",
                    "base-100": "#1f2937",
                    info: "#0ea5e9",
                    success: "#22c55e",
                    warning: "#e97356",
                    error: "#d95566",
                },
            },
        ],
    },

    plugins: [
        require("@tailwindcss/forms"),
        require("@tailwindcss/typography"),
        require("daisyui"),
    ],
};
