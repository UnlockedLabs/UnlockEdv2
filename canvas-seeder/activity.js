const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = process.env.CANVAS_BASE_URL || 'https://staging.canvas.unlockedlabs.xyz';
const COURSES_API_URL = `${BASE_URL}/api/v1/courses`;
const LOGIN_URL = `${BASE_URL}/login/canvas`;
const LOGOUT_URL = `${BASE_URL}/logout`;
const USER_FILE = './users.txt';
const MAX_MINUTES = parseInt(process.env.MAX_MINUTES || '5');

function readUsers() {
	return fs.readFileSync(USER_FILE, 'utf-8')
		.split('\n')
		.filter(Boolean)
		.map(line => {
			const [username, password] = line.split(';');
			return { username, password };
		});
}

function getRandomWaitTime(maxMinutes) {
	const minMilliseconds = 1 * 60 * 1000;
	const maxMilliseconds = maxMinutes * 60 * 1000;
	return Math.floor(Math.random() * (maxMilliseconds - minMilliseconds + 1)) + minMilliseconds;
}

async function waitForTimeout(page, timeout) {
	await page.evaluate((timeout) => {
		return new Promise(resolve => setTimeout(resolve, timeout));
	}, timeout);
}

async function fetchEnrolledCourses(page) {
	try {
		const courses = await page.evaluate(async (apiUrl) => {
			const response = await fetch(apiUrl, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json'
				},
				credentials: 'same-origin'
			});
			if (!response.ok) throw new Error('Failed to fetch courses');
			return await response.json();
		}, COURSES_API_URL);
		console.log(courses);
		return courses.map(course => course.id);
	} catch (error) {
		console.error('Error fetching courses:', error);
		return [];
	}
}

async function visitCourses(page, courseIds) {
	for (const courseId of courseIds) {
		const courseUrl = `${BASE_URL}/courses/${courseId}`;
		console.log(`Visiting course: ${courseUrl}`);
		await page.goto(courseUrl);
		const waitTime = getRandomWaitTime(MAX_MINUTES);
		console.log(`Waiting for ${waitTime / 1000 / 60} minutes on course ${courseId}`);
		await waitForTimeout(page, waitTime);
	}
}

async function loginAndFetchCourses(page, username, password) {
	try {
		await page.goto(LOGIN_URL);
		await page.type('#pseudonym_session_unique_id', username);
		await page.type('#pseudonym_session_password', password);

		await page.click('input[name="commit"]'),
			await page.waitForNavigation()

		console.log(`Logged in as ${username}`);
		const courseIds = await fetchEnrolledCourses(page);

		await visitCourses(page, courseIds).then(() => {
			console.log(`Visited courses for ${username}`);
		}).catch((error) => {
			console.error(`Error visiting courses for ${username}:`, error);
		});

		await page.goto(LOGOUT_URL);
		console.log(`Logged out ${username}`);
	} catch (error) {
		console.error(`Error with user ${username}:`, error);
	}
}

(async () => {
	const browser = await puppeteer.launch({ headless: false });
	const users = readUsers();

	for (const { username, password } of users) {
		const page = await browser.newPage();
		await loginAndFetchCourses(page, username, password);
		await page.close();
	}
	await browser.close();
})();
