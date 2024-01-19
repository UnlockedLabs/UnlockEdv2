#!/usr/bin/env python

import subprocess


def print_red(text):
    return "\033[91m{}\033[0m".format(text)


def print_green(text):
    # ANSI escape code for green text
    return "\033[92m{}\033[0m".format(text)


def check_unstaged_files():
    try:
        status_output = subprocess.check_output(["git", "diff"]).decode("utf-8").strip()
        if status_output:
            print(print_red("*** Alert ***"))
            print(
                print_green(
                    "There are unstaged changes in the working directory, the formatter was run on your last commit and may have changed some files."
                )
            )
            print(
                print_green(
                    "Please re stage: ( "
                    + print_red("git add .")
                    + print_green(
                        " ) whatever files were changed and then you can amend your last commit with:"
                    )
                )
            )
            print(print_red("git commit --amend"))
    except subprocess.CalledProcessError as e:
        print("Error: Unable to execute 'git hook'. {}".format(e))


if __name__ == "__main__":
    check_unstaged_files()
