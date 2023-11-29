New Repository Workflow

We are transitioning to a forking workflow, wherein each team member will fork the main repository to their personal account. This approach offers several advantages,Each developer can test their changes using the CI with their personal fork, minimizing the time/$ we spend on github actions as an organization, as well as avoiding creating unnecessary noise in the CI pipeline.


### Here are the basic steps to follow:

a. Fork the Repository: Start by forking the main repository to your GitHub account.

b. Clone Your Fork: Clone your forked repository to your local machine.
 
c. Push Changes: Once your changes are ready, push them to your fork and th

d. Pull Request: Submit a pull request from your branch in the fork to the main repository.

e. Code Review and Merge: After code review, your changes will be merged into the main repository.

This approach ensures a clean and organized development process while maintaining the integrity of the main repository.

### Conventional Commits: Guidelines and Importance

We are also introducing the use of Conventional Commits for our commit messages. Conventional Commits follow a standardized format that provides several benefits:

    Semantic Versioning: Conventional Commits help automate versioning by providing clear, structured commit messages that convey the nature of changes.

    Release Notes Automation: With Conventional Commits, generating release notes becomes automated, simplifying the process of communicating changes to stakeholders.

    Clarity and Consistency: By adhering to a specific commit message format, our commit history becomes more readable, consistent, and easier to understand.

Here's a quick guide to Conventional Commits:

    Format: Each commit message should have a structured format: <type>(<scope>): <description>

    Types: Examples of types include feat for new features, fix for bug fixes, chore for routine tasks, etc.

    Scope: The scope indicates the module, component, or area affected by the change.

    Description: A concise and clear description of the changes made.

Conventional commit messages must be in the following format:

## type(optional_scope): verb + phrase describing the change 

(verb must start with verb in present tense, like change, add, correct, filter, etc)


### Types are: `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`, `ci`, `build`

Examples:

          `feat: add password reset functionality`

          `fix: correct typo in login screen`

          `chore: upgrade dependency version`

          `refactor: remove unused variables`

          `docs: update README.md`


The spec can be found here: https://www.conventionalcommits.org/en/v1.0.0/
