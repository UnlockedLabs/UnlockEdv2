#!/usr/bin/env python

import subprocess


def print_red(text):
    return f"\033[91m{text}\033[0m"


def print_green(text):
    # ANSI escape code for green text
    return f"\033[92m{text}\033[0m"


def check_unstaged_files():
    try:
        status_output = subprocess.check_output(["git", "diff"]).decode("utf-8").strip()
        if status_output:
            print(print_red("*** Alert ***"))
            print(
                print_green(
                    "There are unstaged changes in the working directory, the formatter was run on your last commit and may have changed some files. Please re stage those files and"
                )
            )
            print(print_red("git commit --amend"))
    except subprocess.CalledProcessError as e:
        print(f"Error: Unable to execute 'git hook'. {e}")


if __name__ == "__main__":
    check_unstaged_files()
