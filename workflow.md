# New Repository Workflow

==========================

We are transitioning to a forking workflow, wherein each team member will fork the main repository to their personal account. This approach offers several advantages,Each developer can test their changes using the CI with their personal fork, minimizing the time/$ we spend on github actions as an organization, as well as avoiding creating unnecessary noise in the CI pipeline.

### Here are the basic steps to follow:

---

1. Fork the Repository: Start by forking the main repository to your GitHub account.

2. Clone Your Fork: Clone your forked repository to your local machine.

3. Push Changes: Once your changes are ready, stage and commit them, ensuring that your commit messages follow the Conventional Commits guidelines. Then push your changes to your forked repository. Be aware that the git hooks will format any unformatted code and you may need to re-stage and `git commit --amend` any changes it makes.

4. Pull Request: Submit a pull request from your branch in the fork to the main repository.

5. Code Review: At least one other team member will review your code and provide feedback. If you see any open Pull Requests on the repository, please take time to add your review to those as well. Review with kind but thorough, constructive feedback but if you find something you don't understand or a possible mistake, it might be more kind to message the coworker on Slack instead.

This approach ensures a clean and organized development process while maintaining the integrity of the main repository.

### Conventional Commits: Guidelines and Importance

---

Conventional Commits follow a standardized format that provides several benefits:

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

          `feat(UN-123): add password reset functionality`

          `fix: correct typo in login screen`

          `chore: upgrade tailwind dependency version`

          `refactor: remove unused imports in resources`

          `docs: update README.md`

# Please reference the `Jira` ticket in any commit that uses feat: example:

```
feat(UN-212): implement crud operations for enrollments
```

### NOTE: You do not have to do this for any other type of commit, (docs, fix, test, etc)

# For commits that require you to describe or explain your changes in the PR (usually the comment block you would fill), please add these to your git commit after a newline, and it will automatically be added to the PR.

**EXAMPLE:**

```
feat(UN-231): implement crud operations for enrollments

enrollments controller added at `api/v1/users/{id}/enrollments`, with proper
migrations, Model, Requests and Resource. added related foreign keys, and
tests.
```

NOTE: If you break up those things described in the extra paragraph into individual commits themselves, and just include them all in the PR you submit, then you can skip the paragraph.

The spec can be found here: https://www.conventionalcommits.org/en/v1.0.0/
