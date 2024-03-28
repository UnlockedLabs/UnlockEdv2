#!/usr/bin/env python

import subprocess


def print_red(text):
    return "\033[91m{}\033[0m".format(text)


def print_blue(text):
    return "\033[94m{}\033[0m".format(text)


def print_green(text):
    return "\033[92m{}\033[0m".format(text)


def check_unstaged_files():
    try:
        status_output = subprocess.check_output(["git", "diff"]).decode("utf-8").strip()
        if status_output:
            print(print_red("*** Alert ***"))
            print(
                print_blue(
                    "There are unstaged changes in the working directory, the formatter was run on your last commit and may have changed some files."
                )
            )
            print(
                print_blue(
                    "Please re stage: ( "
                    + print_red("git add .")
                    + print_blue(
                        " ) whatever files were changed and then you can amend your last commit with:"
                    )
                )
            )
            print(print_red("git commit --amend"))
            print(print_green("To avoid this message in the future, you can run: "))
            print(print_blue("frontend: npx prettier -w resources/"))
            print(print_green("or"))
            print(print_blue("backend: ./vendor/bin/pint"))
            print(print_red("before committing your changes."))
    except subprocess.CalledProcessError as e:
        print("Error: Unable to execute 'git hook'. {}".format(e))


if __name__ == "__main__":
    check_unstaged_files()
