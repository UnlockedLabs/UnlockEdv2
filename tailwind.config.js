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
                unlocked: {
                    primary: "#99f6e4",
                    secondary: "#14b8a6",
                    accent: "#fbbf24",
                    neutral: "#9ca3af",
                    "base-100": "#1f2937",
                    info: "#0ea5e9",
                    success: "#22c55e",
                    warning: "#f97316",
                    error: "#ef4444",
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
