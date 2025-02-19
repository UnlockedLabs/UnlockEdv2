from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import re
import os
from dotenv import load_dotenv

load_dotenv()


"""
YOUTUBE SIGNIN
aria-label="Sign in"
Youtube Sign in button with the aria-label sign in has an href that redirects to accounts.google.com
"""

EMAIL = os.environ.get("EMAIL")
PASSWORD = os.environ.get("PASSWORD")


def generate_netscape_cookies(cookies):
    content = ""
    for cookie in cookies:
        domain = cookie["domain"].lstrip(".")
        domain_flag = "TRUE" if cookie["domain"].startswith(".") else "FALSE"
        path = cookie["path"]
        secure = "TRUE" if cookie["secure"] else "FALSE"
        expiry = str(int(cookie.get("expiry", 0)))
        name = cookie["name"]
        value = cookie["value"]
        content += (
            f"{domain}\t{domain_flag}\t{path}\t{secure}\t{expiry}\t{name}\t{value}\n"
        )
    return content


def update_configmap(cookie_content):
    config_path = "templates/ytdlp-cookies-config.yaml"

    if not os.path.exists(config_path):
        raise FileNotFoundError(f"ConfigMap template not found at {config_path}")

    indented_content = "\n".join(
        [f"     {line}" if line.strip() else "" for line in cookie_content.split("\n")]
    )

    with open(config_path, "r+") as f:
        content = f.read()

        updated = re.sub(
            r"(  cookies\.txt: \|)(\n(?:     .*?\n)*)?",
            f"\\1\n{indented_content.rstrip()}\n",
            content,
            flags=re.MULTILINE,
        )
        f.seek(0)
        f.write(updated)
        f.truncate()


def main():
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    driver = webdriver.Chrome(options=options)

    try:
        driver.get("https://www.youtube.com")

        sign_in_button = WebDriverWait(driver, 15).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, 'a[aria-label*="Sign in"]'))
        )
        sign_in_button.click()

        WebDriverWait(driver, 15).until(EC.url_contains("accounts.google.com"))

        email_field = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.ID, "identifierId"))
        )
        email_field.send_keys(EMAIL)

        driver.find_element(By.ID, "identifierNext").click()

        password_field = WebDriverWait(driver, 15).until(
            EC.visibility_of_element_located((By.NAME, "Passwd"))
        )
        password_field.send_keys(PASSWORD)

        driver.find_element(By.ID, "passwordNext").click()

        WebDriverWait(driver, 30).until(EC.url_contains("youtube.com"))

        cookies = driver.get_cookies()

        content = generate_netscape_cookies(cookies)
        try:
            update_configmap(content)
            print("Successfully updated ConfigMap")
        except Exception as e:
            print(f"ConfigMap update failed: {str(e)}")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()
