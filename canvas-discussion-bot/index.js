const axios = require('axios');
const dotenv = require('dotenv');
const { faker } = require('@faker-js/faker');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function retrieveCourses(apiToken, canvasURL) {
  try {
    const endPoint = "/api/v1/accounts/self/courses";
    const url = canvasURL + endPoint;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    });
    
    return response.data;
  } catch (error) {
    throw new Error(`Error retrieving courses: ${error.message}`);
  }
}

// Specify the path to the .env file for the local directory
const envFilePath = path.resolve(__dirname, '.env');

// Load the .env file
const result = dotenv.config({ path: envFilePath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Successfully loaded .env file');
}

async function postDiscussion(username, password, courseId, index) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  console.log('postDiscussion Course Id:', courseId); 
  try {
    // Navigate to the Canvas login page
    await page.goto(process.env.CANVAS_URL);

    // Perform login
    // Wait for the first textbox to become visible and type username
    await page.waitForSelector('#pseudonym_session_unique_id_forgot');
    await page.type('#pseudonym_session_unique_id_forgot', username);

    // Wait for the second textbox to become visible and type password
    await page.waitForSelector('#pseudonym_session_password');
    await page.type('#pseudonym_session_password', password);

    // Wait for the first button to become visible and click
    await page.waitForSelector('.Button');
    await page.click('.Button');
    console.log('Hit the button')
    // Wait for navigation to complete
    await page.waitForNavigation();


    // Navigate to course and post discussion
    const courseURL = `${process.env.CANVAS_URL}/courses/${courseId}/discussion_topics`;
    await page.goto(courseURL);
    await page.waitForSelector('#add_discussion');
    await page.click('#add_discussion'); 

    await page.waitForSelector('#discussion-title');
    await page.type('#discussion-title', faker.lorem.sentence());

    await page.waitForSelector('#discussion-topic-message2_ifr');
    const iframeElement = await page.$('#discussion-topic-message2_ifr');
    const iframe = await iframeElement.contentFrame();
    await iframe.waitForSelector('body');
    await iframe.type('body', faker.lorem.sentences(8));

    // Click the "Save" button
    await page.waitForSelector('button.btn.btn-primary.submit_button');
    await page.click('button.btn.btn-primary.submit_button');

    // Add a 5-second delay
    await new Promise(resolve => setTimeout(resolve, 5000));

  } catch (error) {
    console.error(`Failed to post discussion for user ${username}:`, error);
  } finally {
    // Close the browser
    await browser.close();
  }
}

function randomChoice(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

let randomCourseId;
let courseIds = [];

retrieveCourses(process.env.API_TOKEN, process.env.CANVAS_URL)
  .then(courses => {
    for (let i = 0; i < courses.length; i++) {
      const courseId = courses[i].id;
      courseIds.push(courseId);
    }
    randomCourseId = randomChoice(courseIds);
    console.log('Random Course Id:', randomCourseId);    
    // Read and parse the tab-delimited credentials file
    tab_file = path.join(__dirname, process.env.TAB_FILE_PATH)
    console.log(`Reading the file: ${tab_file}`);
    fs.readFile(tab_file, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the file:', err);
        return;
      }

      // Split the file content by lines
      const lines = data.trim().split('\n');

      // Process each line (skipping blank lines and comment lines)
      lines.forEach((line, index) => {
        line = line.trim();
        if (line === '' || line.startsWith('#')) {
          return;
        }

        // Split each line by tab to get username and password
        const [username, password] = line.split('\t');
        postDiscussion(username, password, randomCourseId, index + 1);
      });

      console.log('Tab-delimited text file successfully processed');
    });
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
