export default {
    content: [
        "./vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php",
        "./storage/framework/views/*.php",
        "./resources/views/**/*.blade.php",
        "./resources/js/**/*.tsx",
    ],

    darkMode: "class",

    daisyui: {
        themes: [
            {
                unlocked: {
                    primary: "#14b8a6",
                    secondary: "#99f6e4",
                    accent: "#fbbf24",
                    neutral: "#9ca3af",
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
