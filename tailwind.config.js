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
                    "--quartile-0": "#e2e8f0",
                    "--quartile-1": "#99f6e4",
                    "--quartile-2": "#2dd4bf",
                    "--quartile-3": "#0d9488",
                    "--quartile-4": "#115e59",
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
                    "--quartile-0": "#334155",
                    "--quartile-1": "#0f766e",
                    "--quartile-2": "#0d9488",
                    "--quartile-3": "#14b8a6",
                    "--quartile-4": "#2dd4bf",
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

    theme: {
        extend: {
            fontFamily: {
                lato: ["Lato", "sans-serif"],
            },
            colors: {
                "quartile-0": "var(--quartile-0)",
                "quartile-1": "var(--quartile-1)",
                "quartile-2": "var(--quartile-2)",
                "quartile-3": "var(--quartile-3)",
                "quartile-4": "var(--quartile-4)",
              },
        },
    },

    plugins: [
        require("@tailwindcss/forms"),
        require("@tailwindcss/typography"),
        require("daisyui"),
    ],
};
