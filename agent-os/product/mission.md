# Product Mission

## Pitch

UnlockEdv2 is an open-source educational platform that helps incarcerated individuals build knowledge and skills for successful reentry by providing respectful, modern access to educational content, vocational programs, and progress tracking in correctional facilities where internet access is limited or restricted.

TODO: Add more context to why this important for administrators and educators.

## Users

### Primary Customers

- **Correctional Facilities**: Prisons and jails seeking to provide educational opportunities and track rehabilitative progress
- **Departments of Correction**: State and county agencies managing multiple facilities and measuring recidivism reduction outcomes
- **Educational Service Providers**: Organizations delivering educational programs within correctional settings

TODO: Residents should also be treated as customers, if not the PRIMARY customer.

### User Personas

TODO: Should there be different resident segments based on comfort with tech, education level, etc?
TODO: What Pain points and goals are we missing?
TODO: Are these the correct non-resident personas?

**Incarcerated Resident** (18-65 years)

- **Role:** Primary learner and content consumer
- **Context:** Limited or no internet access, restricted technology environment, seeking education and skills to prepare for release
- **Pain Points:** Poor quality software typically available in prisons, difficulty accessing educational resources, lack of visibility into their own progress and achievements, systems that focus on infractions rather than accomplishments
- **Goals:** Earn credits toward sentence reduction, gain knowledge and skills for post-release employment, track personal progress and achievements, access engaging educational content

**Facility Administrator** (30-55 years)

- **Role:** Program coordinator, enrollment manager, attendance tracker
- **Context:** Managing educational programs across multiple classrooms and instructors, reporting to facility leadership and state agencies
- **Pain Points:** Time-consuming manual tracking, difficulty generating reports for stakeholders, inability to compare program effectiveness, lack of actionable data on student outcomes
- **Goals:** Efficiently manage enrollments and attendance, demonstrate program impact through data, identify at-risk students early, streamline reporting workflows

**Educational Coordinator** (25-50 years)

- **Role:** Instructor or program lead delivering educational content
- **Context:** Teaching in a restrictive environment with limited technology, managing diverse student skill levels
- **Pain Points:** Tracking individual student progress manually, limited insight into student engagement with materials, difficulty adapting programs based on outcomes
- **Goals:** Monitor student engagement and progress, provide meaningful feedback, understand which content resonates with learners

**Department Administrator** (35-60 years)

- **Role:** Oversight across multiple facilities within a corrections department
- **Context:** Responsible for system-wide educational outcomes and recidivism reduction metrics
- **Pain Points:** No standardized way to compare facilities, inability to identify best practices, difficulty demonstrating ROI of educational programs to legislators and taxpayers
- **Goals:** Benchmark facility performance, identify successful programs for replication, prove recidivism reduction through data, allocate resources effectively

## The Problem

### Educational Access in Correctional Settings Is Broken

Despite evidence that education reduces recidivism by up to 43%, incarcerated individuals face enormous barriers to accessing quality educational programs. Facilities rely on outdated, punitive-focused software that tracks infractions but ignores achievements. Manual tracking makes it nearly impossible to prove program effectiveness or optimize outcomes. This results in missed opportunities for rehabilitation, higher recidivism rates, and wasted taxpayer dollars on re-incarceration.

**Our Solution:** A resident-first platform that treats education as a fundamental right, makes progress tracking automatic, and provides the data needed to prove that rehabilitation works.

### Technology in Prisons Disrespects Users

Existing correctional software is often poorly designed, difficult to use, and feels punitive rather than supportive. This sends a message to residents that they don't deserve quality tools, undermining the rehabilitative mission.

**Our Solution:** Modern, clean, visually appealing interface that signals respect for users and makes core tasks easily accessible. We apply the same UX standards used in consumer software to create an uplifting experience.

### Earned Credit Systems Lack Flexibility

Current systems for tracking sentence reduction credits are rigid, only accounting for structured classroom time. This excludes valuable activities like vocational projects, self-paced learning, and skill-building work.

**Our Solution:** Flexible credit tracking that handles both time-based and activity-based credits (e.g., "1 knitted hat = 3 hours"), ensuring all rehabilitative activities count toward early release.

### Offline Content Access Is Limited

Correctional facilities cannot provide direct internet access, but current solutions for offline educational content are limited, outdated, or difficult to manage.

**Our Solution:** Seamless offline-first architecture with local or S3-based content delivery, integrated Wikipedia access via Kiwix, and support for leading educational platforms (Canvas, Brightspace, Kolibri).

## Differentiators

### Open Source and Community-Driven

Unlike proprietary correctional software vendors, we provide a fully open-source platform. This results in transparency, community contributions, no vendor lock-in, and lower costs for cash-strapped correctional systems.

### Resident-First Philosophy

Unlike traditional prison software that focuses on control and punishment tracking, we prioritize the resident's educational journey and achievements. This results in higher engagement, better outcomes, and a culture shift toward rehabilitation.

### Comprehensive Feature Set for All Stakeholders

Unlike single-purpose tools, we serve residents, facility admins, coordinators, and department leadership in one integrated platform. This results in better data flow, reduced duplicate entry, and system-wide insights.

### Modern, Respectful User Experience

Unlike the dated, difficult interfaces common in correctional technology, we deliver a clean, modern UI/UX that respects users' intelligence and time. This results in faster adoption, reduced training time, and a more dignified user experience.

### Offline-First Architecture

Unlike web-based platforms that require internet connectivity, we're built from the ground up for restricted environments. This results in reliable access to educational content regardless of connectivity constraints.

### Focus on Measurable Outcomes

Unlike systems that simply track compliance, we capture rich data on program effectiveness, completion rates, and recidivism reduction. This results in evidence-based program improvements and the ability to secure continued funding.

## Key Features

### Core Features

- **Multi-Tenant Facility Management:** Each facility maintains isolated data with role-based access controls, ensuring security while enabling department-level oversight and benchmarking
- **Offline Content Delivery:** Reliable access to courses, videos, libraries, and Wikipedia content served locally or from S3, with seamless integration of Canvas, Brightspace, Kolibri, and Kiwix platforms
- **Program Structure & Enrollment:** Organize learning into Programs → Classes → Events with streamlined enrollment management and automated scheduling
- **Progress & Milestone Tracking:** Monitor student advancement through programs, track achievements, and celebrate accomplishments rather than just infractions

### Reporting & Analytics Features

- **Attendance Tracking:** Daily, weekly, and monthly attendance with precise seat time measurement to prove participation and calculate earned credits
- **Earned Credit Management:** Track both time-based and activity-based credits toward sentence reduction, helping residents visualize their path to early release
- **Program Outcomes Dashboard:** View completion rates, student progress, and program effectiveness metrics across quarterly and annual timeframes
- **Facility Comparison Reports:** Enable department administrators to benchmark performance, identify best practices, and allocate resources based on data

### Content & Integration Features

- **Multiple Content Types:** Curate courses, open educational resources, facility programs, and helpful links all in one accessible interface
- **Activity Tracking:** Automatically log all content interactions to understand engagement patterns and provide personalized recommendations
- **External Platform Integration:** Connect seamlessly with leading educational platforms while maintaining a unified user experience

### User Experience Features

- **Modern, Dignified Interface:** Clean, visually appealing design using TailwindCSS and DaisyUI that respects users and makes information easily discoverable
- **Streamlined Information Architecture:** Present complex data in digestible, actionable formats so users can find what they need quickly
- **Role-Optimized Dashboards:** Surface the most relevant information for each user type, from residents tracking their progress to admins managing programs
