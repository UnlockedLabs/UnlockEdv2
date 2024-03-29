# Contributing to UnlockEdv2

Thank you for considering contributing to UnlockEd v2! We appreciate your interest in joining our community and helping us to improve this project. Please take a moment to review the following guidelines before getting started.

## Ways to Contribute

There are many ways you can contribute to UnlockEdv2:

-   **Reporting Bugs**: If you encounter a bug, please open an issue on GitHub and provide as much detail as possible, including steps to reproduce.
-   **Feature Requests**: If you have an idea for a new feature or improvement, feel free to open an issue to discuss it.
-   **Code Contributions**: We welcome pull requests for bug fixes, new features, and improvements. Before submitting a pull request, please make sure to review the contribution guidelines outlined below.
-   **Documentation**: If you notice any errors or have suggestions for improving the project documentation, please open an issue or submit a pull request.
-   **Testing**: Help us beta-test the project by reporting bugs, verifying fixes, and testing new features.

## Code of Conduct

We hope that all contributors introduce themselves in the [Discussions](https://github.com/UnlockedLabs/UnlockEdv2/discussions) section, as we would love to know who is interested in joining our community.We also ask that all community members and contributors keep an open mind and respect the input, perspectives and contributions of others in the community. We are dedicated to providing a welcoming and inclusive environment for all, and we ask that you do the same. Please have a look at our mission statement on our [Website](https://www.unlockedlabs.org/mission).

## How to Contribute

To contribute to UnlockEdv2, follow these steps:

1. Fork the repository and clone it locally.
2. Create a new branch for your contribution: `git checkout -b feature-name`.
3. Follow the build instructions in the [README](./README.md) to set up and run the project locally.
4. Make your changes and test them thoroughly locally before submitting a pull request. If they are back-end changes, please include tests for your changes. (`php artisan make:test TestName`)
5. Commit your changes. Please make sure your commit message follows conventional commit guidelines: ie. `git commit -m 'feat: decription of feature added'`.
6. Push to your fork: `git push origin feature-name`.
7. Submit a pull request to the `main` branch of the original repository with an explanation of the change(s) you have made. Please include screenshots where you see fit.

## Contribution Guidelines

When submitting a pull request, please ensure the following:

-   Your code follows the [project's coding style and conventions](#project-coding-style-and-conventions).
-   You have written tests for your changes (if applicable) and ensured that all tests pass.
-   Your commit messages are structured according to the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) guidelines.
-   If your pull request addresses an open issue, reference the issue number in the pull request description.

## Project Coding Style and Conventions

> **Note**: On commit, the project will run `prettier` and `pint` to format your code, so things like indentation and line breaks will be taken care of for you automatically.

### Frontend

=====================

We use the following libraries to help keep our frontend consistent:

-   Framework: [React](https://react.dev/blog/2023/03/16/introducing-react-dev)
-   Styling: [tailwindCSS](https://tailwindcss.com/)
-   Components/Theming: [daisyUI](https://daisyui.com/)
-   Forms: [react-hook-forms](https://react-hook-form.com/)
-   Icons: [heroicons](https://heroicons.com/)

Please follow these guidelines when making changes to the frontend:

-   Use the pre-made generic components provided in the `components` directory where possible.
-   Use functional components and hooks where possible.
-   Use `react-hook-forms` for form validation.
-   Use `heroicons` for icons.
-   Use `tailwindCSS` for general styling.
-   Use `daisyUI` styled-components where possible. We follow a theme that is defined in the `tailwind.config.js` file.

```json
    daisyui: {
        themes: [
            {
                light: {
                    primary: "#14b8a6",  // <button className="btn btn-primary">
                    secondary: "#2dd4bf",
                    accent: "#d97706",
                    neutral: "#4d5360",
                    "base-100": "#f3f4f6",
                    info: "#0ea5e9",   //<label className="label label-info">
                    success: "#22c55e",
                    warning: "#e97356", // <div className="text-warning text-lg">
                    error: "#d95566",
                },
```

These colors are used throughout the project, so please try to use them where possible.
Checkout the [daisyUI documentation](https://daisyui.com/docs) for more information.

### Backend

==============

#### Style and Naming-Conventions:

Currently (3/2024) we are working to enforce a consistent style and naming convention for the back-end code.

Variables are to be lower-snake case, functions are to be camelCase, and classes are to be UpperCamelCase.
We also are ultimately going to be enforcing `declare(strict_types=1);` at the top of each PHP file.

```php
<?php
declare(strict_types=1);

class ExampleClass
{
public string $example_property;

private function exampleFunction(array $example_array): int
{
    $example_var = $example_array['foo'];
    return $example_var + 42;
```

The back-end is built with the Laravel framework. Please follow these guidelines when making changes to the back-end:

-   Use Laravel's built-in validation and request classes. If your request doesn't require form validation, you can use either the `AdminRequest` or `UserAuthRequest`
    or basic `Request` class to determine the authorization depending on the resource the handler provides.

-   New handlers must always return a class that inherits from `Resource`. These can be generated with `php artisan make:resource ResourceName`

-   Use Laravel's built-in Eloquent ORM wherever possible for database interactions.

-   We use `Pest` testing framework, built on top of `php-unit` for running tests. However they can still be generated with `php artisan make:test TestName`.

-   Each API endpoint should have a corresponding test in the `tests/Feature` directory. You may use `php artisan app:make-controller-test ControllerName` to generate
    a template test class for the controller.

-   Each Model needs to have a properly defined Factory and Seeder class. You can generate these with `php artisan make:factory FactoryName` and `php artisan make:seeder SeederName`.
    Should there be any foreign key constraints, instead of instantiating new models to fulfill them, please instead use random numbers, and provide methods to insert the necessary
    FK's upon instantiation of the Factory. This means you must use `MyModel::factory()->forOtherModel($constraint->id)->makeOne()` instead of `MyModel::factory()->createOne()` when
    populating test data. Examples of this can be found in the `database/factories/EnrollmentFactory.php` file.

## Code Review Process

All pull requests will be reviewed by one or more project maintainers. Feedback may be provided, and changes may be requested before your contribution is accepted. We appreciate your patience and collaboration during this process.

Because we are a company focused on meeting the needs of incarcerated students, there are larger design goals that we must adhere to. We will do our best to communicate these goals to you, and work with you to ensure your contribution is accepted, however we ask that before you make changes that affect the overall functionality and design of the project, you open an issue to discuss your proposed changes.
This is made much more simple if you focus on issues marked `good first issue` or `contributions welcome`. We will do our best to provide feedback and guidance on these issues, while still trying to provide opportunities for larger feature contributions.

## License

`UnlockEdv2` is open-sourced software and by contributing to `UnlockEdv2`, you agree that your contributions will be licensed under the `Apache License, Version 2.0`. For more information, see the [LICENSE](./LICENSE) file.

## Contact

If you have any questions or need further assistance, please feel free to contact the project maintainers by opening a [Discussion](https://github.com/UnlockedLabs/UnlockEdv2/discussions). Or by visiting our [Website](https://www.unlockedlabs.org/contact).
