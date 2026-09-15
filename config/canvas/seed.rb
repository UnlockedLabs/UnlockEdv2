# carddev81 canvas lms seed data (created only for local development / testing only).
PASSWORD = "password123".freeze
DAY      = 24 * 60 * 60
account  = Account.default
now      = Time.now.utc

def step(label)
  yield
rescue => e
  puts "  !! skipped #{label}: #{e.class}: #{e.message}"
end

def find_or_create_user(name, email, account, password)
  existing = Pseudonym.active.by_unique_id(email).first
  if existing
    puts "  user exists: #{email}"
    return existing.user
  end

  user = User.create!(name: name)
  user.pseudonyms.create!(
    unique_id:             email,
    password:              password,
    password_confirmation: password,
    account:               account
  )
  cc = user.communication_channels.create!(path: email, path_type: "email")
  cc.confirm!
  user.register!
  puts "  created user: #{name} <#{email}>"
  user
end

def find_or_create_course(account, name, code)
  course = account.all_courses.where(course_code: code).first
  if course
    puts "  course exists: #{code}"
    return course
  end
  course = account.courses.create!(name: name, course_code: code)
  course.offer!
  puts "  created course: #{name} (#{code})"
  course
end

def find_or_create_section(course, name)
  course.course_sections.where(name: name).first ||
    course.course_sections.create!(name: name)
end

def enroll(course, user, type, section = nil, state = "active")
  return if course.enrollments.where(user_id: user.id, type: type).exists?

  opts = { enrollment_state: state }
  opts[:section] = section if section
  case type
  when "TeacherEnrollment" then course.enroll_teacher(user, opts)
  when "StudentEnrollment" then course.enroll_student(user, opts)
  when "TaEnrollment"      then course.enroll_ta(user, opts)
  end
  puts "    enrolled: #{user.name} as #{type}"
end

def assignment_group(course, name, weight)
  course.assignment_groups.where(name: name).first ||
    course.assignment_groups.create!(name: name, group_weight: weight)
end

def find_or_create_assignment(course, title, points, group: nil, due_at: nil, grading_type: "points")
  a = course.assignments.where(title: title).first
  return a if a
  course.assignments.create!(
    title:            title,
    points_possible:  points,
    submission_types: "online_text_entry",
    workflow_state:   "published",
    grading_type:     grading_type,
    assignment_group: group,
    due_at:           due_at
  )
end

# Submit + grade most students. Leaves the LAST student with no submission
# (=> "missing" if the assignment is past due) and the SECOND-TO-LAST student
# submitted-but-ungraded (=> "needs grading"). Past-due submissions show as late.
def submit_and_grade(assignment, students, teacher)
  students.each_with_index do |student, i|
    next if i == students.length - 1 # no submission
    assignment.submit_homework(student, submission_type: "online_text_entry",
                                        body: "Submission from #{student.name}")
    next if i == students.length - 2 # submitted, leave ungraded
    score = (assignment.points_possible * (0.7 + 0.05 * i)).round
    score = assignment.points_possible if score > assignment.points_possible
    assignment.grade_student(student, grade: score.to_s, grader: teacher)
  end
end

def mc_question(name, text, correct, others)
  answers = [{ text: correct, weight: 100 }]
  others.each { |o| answers << { text: o, weight: 0 } }
  { question_name: name, question_type: "multiple_choice_question",
    question_text: text, points_possible: 1, answers: answers }
end

def find_or_create_quiz(course, title, questions, due_at: nil)
  quiz = course.quizzes.where(title: title).first
  return quiz if quiz

  quiz = course.quizzes.create!(title: title, quiz_type: "assignment",
                                description: "#{title} - auto-seeded", due_at: due_at)
  questions.each { |qd| quiz.quiz_questions.create!(question_data: qd) }
  quiz.generate_quiz_data
  quiz.publish!
  quiz
end

# Record a graded quiz attempt for a student. correct: true => picks the
# 100%-weight answer for every question; false => picks a 0%-weight answer.
def take_quiz(quiz, student, correct:)
  return if quiz.quiz_submissions.where(user_id: student.id).exists?

  sub = quiz.generate_submission(student)
  answers = {}
  quiz.quiz_data.each do |q|
    opts   = q["answers"]
    chosen = correct ? opts.find { |a| a["weight"].to_i == 100 }
                     : opts.find { |a| a["weight"].to_i == 0 }
    chosen ||= opts.first
    answers["question_#{q['id']}"] = chosen["id"].to_s
  end
  sub.submission_data = answers
  Quizzes::SubmissionGrader.new(sub).grade_submission
end

def find_or_create_discussion(course, title, message, author)
  course.discussion_topics.where(title: title).first ||
    course.discussion_topics.create!(title: title, message: message,
                                     user: author, workflow_state: "active")
end

def find_or_create_module(course, name, position)
  course.context_modules.where(name: name).first ||
    course.context_modules.create!(name: name, position: position,
                                   workflow_state: "active")
end

def calendar_event(course, title, start_at, duration = 3600)
  return if course.calendar_events.where(title: title).exists?
  course.calendar_events.create!(title: title, start_at: start_at,
                                 end_at: start_at + duration)
end

def announcement(course, title, message, author)
  return if course.announcements.where(title: title).exists?
  course.announcements.create!(title: title, message: message, user: author)
end

def wiki_page(course, title, body)
  return if course.wiki_pages.where(title: title).exists?
  course.wiki_pages.create!(title: title, body: body)
end

# ---------------------------------------------------------------------------

puts "Seeding Canvas data into account: #{account.name}"

puts "Users:"
teachers = [
  find_or_create_user("Terry Teacher",  "teacher@example.com",  account, PASSWORD),
  find_or_create_user("Tom Teacher",    "teacher2@example.com", account, PASSWORD),
]
ta = find_or_create_user("Tina TA", "ta@example.com", account, PASSWORD)
students = [
  ["Sam Student",    "student1@example.com"],
  ["Sara Student",   "student2@example.com"],
  ["Steve Student",  "student3@example.com"],
  ["Selena Student", "student4@example.com"],
  ["Sidney Student", "student5@example.com"],
  ["Simon Student",  "student6@example.com"],
].map { |name, email| find_or_create_user(name, email, account, PASSWORD) }

# course_code => [name, primary teacher index]
COURSES = [
  ["TEST101", "Intro to Testing",       0],
  ["DBG201",  "Advanced Debugging",     0],
  ["ALGO301", "Algorithms",             1],
  ["WEB150",  "Web Development Basics", 1],
].freeze

puts "Courses:"
courses = COURSES.map { |code, name, _t| find_or_create_course(account, name, code) }

COURSES.each_with_index do |(code, _name, t_idx), idx|
  course  = courses[idx]
  teacher = teachers[t_idx]
  puts "== #{code} =="

  section_a = section_b = nil
  step("sections") do
    section_a = find_or_create_section(course, "Section A")
    section_b = find_or_create_section(course, "Section B")
  end

  step("enrollments") do
    enroll(course, teacher, "TeacherEnrollment")
    enroll(course, ta,      "TaEnrollment")
    students.each_with_index do |s, i|
      enroll(course, s, "StudentEnrollment", i.even? ? section_a : section_b)
    end
  end

  # Weighted grading groups (Homework 40 / Exams 40 / Attendance 20)
  hw_group = exam_group = att_group = nil
  step("grading groups") do
    course.update!(group_weighting_scheme: "percent")
    hw_group   = assignment_group(course, "Homework",   40)
    exam_group = assignment_group(course, "Exams",      40)
    att_group  = assignment_group(course, "Attendance", 20)
  end

  # Assignments with due dates (past => late/missing, future => upcoming)
  step("assignments/grades") do
    a1 = find_or_create_assignment(course, "Welcome Assignment", 100, group: hw_group,   due_at: now - 14 * DAY)
    a2 = find_or_create_assignment(course, "Midterm Project",    250, group: exam_group, due_at: now - 3 * DAY)
    a3 = find_or_create_assignment(course, "Final Project",      300, group: exam_group, due_at: now + 14 * DAY)
    [a1, a2, a3].each { |a| submit_and_grade(a, students, teacher) }
    puts "    assignments + grades applied (some late/missing/ungraded)"
  end

  # Attendance modeled as pass/fail assignments
  step("attendance") do
    [["Attendance: Week 1", now - 14 * DAY], ["Attendance: Week 2", now - 7 * DAY]].each do |title, due|
      att = find_or_create_assignment(course, title, 0, group: att_group,
                                      grading_type: "pass_fail", due_at: due)
      students.each_with_index do |s, i|
        att.grade_student(s, grade: (i % 4 == 0 ? "incomplete" : "complete"), grader: teacher)
      end
    end
    puts "    attendance (pass/fail) recorded"
  end

  # Quiz + graded attempts
  step("quiz") do
    quiz = find_or_create_quiz(course, "Knowledge Check 1", [
      mc_question("Q1", "What does a unit test verify?",
                  "A single unit of behavior", ["The whole system", "The database", "The UI"]),
      mc_question("Q2", "Which is a good test practice?",
                  "Tests are independent", ["Tests share state", "Tests need manual steps", "Tests hit production"]),
      mc_question("Q3", "What is a regression?",
                  "A previously working feature breaks", ["A new feature", "A faster test", "A code comment"]),
    ], due_at: now - 5 * DAY)
    puts "    quiz created + published"

    step("quiz attempts") do
      students.each_with_index do |s, i|
        next if i >= 4 # first 4 students take it; last 2 leave it untaken
        take_quiz(quiz, s, correct: i < 3) # first 3 ace it, 4th misses them
      end
      puts "    quiz attempts graded"
    end
  end

  step("discussion") do
    find_or_create_discussion(course, "Course Introductions",
                              "Welcome to #{code}! Introduce yourself here.", teacher)
    puts "    discussion topic created"
  end

  step("announcements") do
    announcement(course, "Welcome to #{code}",
                 "Class is now open. Please review the syllabus and Week 1 module.", teacher)
    announcement(course, "Midterm reminder",
                 "The midterm project is due soon — check the calendar.", teacher)
    puts "    announcements posted"
  end

  step("pages") do
    wiki_page(course, "Syllabus Overview",
              "<h2>#{code} Syllabus</h2><p>Grading: Homework 40%, Exams 40%, Attendance 20%.</p>")
    wiki_page(course, "Course Resources",
              "<p>Reading list, office hours, and helpful links.</p>")
    puts "    wiki pages created"
  end

  step("modules") do
    find_or_create_module(course, "Week 1: Getting Started", 1)
    find_or_create_module(course, "Week 2: Core Concepts",   2)
    find_or_create_module(course, "Week 3: Project Work",    3)
    puts "    modules created"
  end

  # Scheduled class sessions / events on the course calendar
  step("calendar/events") do
    calendar_event(course, "Lecture: Introduction",      now - 14 * DAY)
    calendar_event(course, "Lecture: Core Topics",       now - 7 * DAY)
    calendar_event(course, "Lecture: Deep Dive",         now + 1 * DAY)
    calendar_event(course, "Office Hours",               now + 2 * DAY, 1800)
    calendar_event(course, "Midterm Exam (in class)",    now + 7 * DAY, 5400)
    calendar_event(course, "Guest Speaker",              now + 10 * DAY)
    puts "    calendar events scheduled"
  end
end

puts "Done. All seeded users have password: #{PASSWORD}"
