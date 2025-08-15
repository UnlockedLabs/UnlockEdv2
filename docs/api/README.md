# API Reference Documentation

This document provides comprehensive documentation for the UnlockEdv2 REST API. All endpoints require authentication unless otherwise noted.

## 📋 Table of Contents
- [Authentication](#authentication)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Pagination](#pagination)
- [Endpoints](#endpoints)
  - [Authentication & Users](#authentication--users)
  - [Facilities](#facilities)
  - [Programs & Classes](#programs--classes)
  - [Courses & LMS](#courses--lms)
  - [Content Management](#content-management)
  - [Analytics & Reports](#analytics--reports)
  - [System Administration](#system-administration)

## 🔐 Authentication

### Headers Required
```http
Cookie: ory_kratos_session=<session-token>
```

### Role-Based Access
```typescript
type UserRole = 'system_admin' | 'department_admin' | 'facility_admin' | 'student'

// Permission hierarchy (highest to lowest)
system_admin > department_admin > facility_admin > student
```

### Multi-tenancy
- All data is scoped to the user's facility
- `system_admin` and `department_admin` can access multiple facilities
- Facility context can be switched via session traits

## 📄 Response Formats

### Success Response
```json
{
  "data": { /* response data */ },
  "message": "Success",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": ["Field 'email' is required"]
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### HTTP Status Codes
- `200` - Success with data
- `201` - Resource created successfully
- `204` - Success with no content
- `400` - Bad request / validation error
- `401` - Unauthorized / authentication required
- `403` - Forbidden / insufficient permissions
- `404` - Resource not found
- `409` - Conflict / resource already exists
- `500` - Internal server error

## 📊 Pagination

### Request Parameters
```http
GET /api/users?page=1&per_page=20&search=john
```

### Response Format
```json
{
  "data": [/* array of resources */],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total_pages": 5,
    "total_count": 97,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## 🚪 Authentication & Users

### Authentication Check
```http
GET /api/auth
Authorization: Required
```
**Description**: Validate current session and return user claims
**Returns**: User session information with permissions

**Response**:
```json
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com",
  "role": "facility_admin",
  "facility_id": 1,
  "facility_name": "Central Facility",
  "feature_access": ["open_content", "program_management"],
  "session_id": "session-uuid",
  "kratos_id": "kratos-uuid",
  "timezone": "America/New_York"
}
```

### Password Reset
```http
POST /api/reset-password
Content-Type: application/json
```
**Body**:
```json
{
  "password": "newPassword123",
  "confirm": "newPassword123",
  "facility_name": "Central Facility",
  "timezone": "America/New_York"
}
```

### User Management

#### List Users
```http
GET /api/users?page=1&per_page=20&search=john&role=student&facility_id=1
Authorization: Admin required
```
**Query Parameters**:
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 20, max: 100)
- `search` - Search by name, username, or email
- `role` - Filter by user role
- `facility_id` - Filter by facility (system/dept admins only)

#### Get User Details
```http
GET /api/users/{id}
Authorization: Admin or self
```

#### Create User
```http
POST /api/users
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "username": "new_user",
  "name_first": "John",
  "name_last": "Doe", 
  "email": "john.doe@example.com",
  "role": "student",
  "facility_id": 1,
  "doc_id": "DOC123456",
  "password": "tempPassword123"
}
```

#### Update User
```http
PUT /api/users/{id}
Authorization: Admin required
Content-Type: application/json
```
**Body**: Same as create user (partial updates allowed)

#### Deactivate User
```http
POST /api/users/{id}/deactivate
Authorization: Admin required
```

#### User Account History
```http
GET /api/users/{id}/history?page=1&per_page=20
Authorization: Admin or self
```

#### Transfer User Between Facilities
```http
POST /api/users/transfer/{id}
Authorization: Department Admin or System Admin
Content-Type: application/json
```
**Body**:
```json
{
  "target_facility_id": 2,
  "reason": "Transfer due to program completion"
}
```

#### Bulk User Upload
```http
POST /api/users/upload
Authorization: Admin required  
Content-Type: multipart/form-data
```
**Form Data**: CSV file with user data

---

## 🏢 Facilities

#### List Facilities
```http
GET /api/facilities?page=1&per_page=20
Authorization: System Admin
```

#### Get Facility Details
```http
GET /api/facilities/{id}
Authorization: System Admin or facility access
```

#### Create Facility
```http
POST /api/facilities
Authorization: System Admin
Content-Type: application/json
```
**Body**:
```json
{
  "name": "New Correctional Facility",
  "timezone": "America/Chicago"
}
```

#### Update Facility
```http
PUT /api/facilities/{id}
Authorization: System Admin
Content-Type: application/json
```

#### Delete Facility
```http
DELETE /api/facilities/{id}
Authorization: System Admin
```

---

## 📚 Programs & Classes

### Program Management

#### List Programs
```http
GET /api/programs?page=1&per_page=20&search=ged&type=Educational&is_active=true
Authorization: Admin required
```
**Query Parameters**:
- `search` - Search by program name or description
- `type` - Filter by program type
- `is_active` - Filter by active status
- `facility_id` - Filter by facility (admins only)

#### Get Program Details
```http
GET /api/programs/{id}
Authorization: Admin or enrolled student
```

#### Create Program
```http
POST /api/programs
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "name": "Adult Basic Education",
  "description": "Basic literacy and numeracy program",
  "funding_type": "Federal_Grants",
  "program_types": ["Educational"],
  "credit_types": ["Completion", "Participation"],
  "is_active": true
}
```

#### Update Program
```http
PUT /api/programs/{id}
Authorization: Admin required
Content-Type: application/json
```

#### Archive Program
```http
DELETE /api/programs/{id}
Authorization: Admin required
```

#### Toggle Program Status
```http
POST /api/programs/{id}/toggle
Authorization: Admin required
```

### Program Classes

#### List Program Classes
```http
GET /api/programs/{program_id}/classes?page=1&status=Active
Authorization: Admin required
```

#### Get Class Details
```http
GET /api/classes/{id}
Authorization: Admin or enrolled student
```

#### Create Class
```http
POST /api/classes
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "program_id": 1,
  "facility_id": 1,
  "name": "ABE Level 1 - Morning",
  "instructor_name": "Jane Smith",
  "description": "Basic education for beginners",
  "capacity": 15,
  "start_dt": "2024-01-15T09:00:00Z",
  "end_dt": "2024-06-15T11:00:00Z",
  "credit_hours": 120
}
```

#### Update Class
```http
PUT /api/classes/{id}
Authorization: Admin required
Content-Type: application/json
```

#### Archive Class
```http
DELETE /api/classes/{id}
Authorization: Admin required
```

### Class Enrollments

#### List Class Enrollments
```http
GET /api/classes/{id}/enrollments?page=1&status=Enrolled
Authorization: Admin required
```

#### Enroll Students in Class
```http
POST /api/classes/{id}/enroll
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "user_ids": [1, 2, 3],
  "enrollment_date": "2024-01-15T00:00:00Z"
}
```

#### Update Enrollment Status
```http
PUT /api/enrollments/{id}
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "status": "Completed",
  "change_reason": "Successfully completed program requirements",
  "end_date": "2024-06-15T00:00:00Z"
}
```

#### Remove Enrollment
```http
DELETE /api/enrollments/{id}
Authorization: Admin required
```

### Class Events & Attendance

#### List Class Events
```http
GET /api/classes/{id}/events?start_date=2024-01-01&end_date=2024-01-31
Authorization: Admin or enrolled student
```

#### Create Class Event
```http
POST /api/events
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "class_id": 1,
  "duration": "2h",
  "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO,WE,FR",
  "room": "Education Room A"
}
```

#### Get Event Attendance
```http
GET /api/events/{id}/attendance?date=2024-01-15
Authorization: Admin required
```

#### Record Attendance
```http
POST /api/events/{id}/attendance
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "attendance_records": [
    {
      "user_id": 1,
      "date": "2024-01-15",
      "status": "present",
      "note": ""
    },
    {
      "user_id": 2, 
      "date": "2024-01-15",
      "status": "absent_excused",
      "note": "Medical appointment"
    }
  ]
}
```

#### Update Attendance Status
```http
PUT /api/attendance/{id}
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "status": "present",
  "note": "Arrived late but attended full session"
}
```

---

## 🎓 Courses & LMS

### Course Catalog

#### List Courses
```http
GET /api/courses?page=1&per_page=20&search=math&provider_id=1&type=open_enrollment
Authorization: Required
```
**Query Parameters**:
- `search` - Search by course name or description
- `provider_id` - Filter by LMS provider
- `type` - Course type filter
- `outcome_types` - Filter by available outcomes

#### Get Course Details
```http
GET /api/courses/{id}
Authorization: Required
```

#### User's Enrolled Courses
```http
GET /api/my-courses?page=1&status=active
Authorization: Student or Admin
```

#### User's Learning Progress
```http
GET /api/my-progress?course_id=1&include_activities=true
Authorization: Student or Admin
```

#### Enroll in Course
```http
POST /api/courses/{id}/enroll
Authorization: Student or Admin
Content-Type: application/json
```
**Body**:
```json
{
  "user_id": 1  // Optional: admins can enroll others
}
```

### Provider Platform Management

#### List LMS Platforms
```http
GET /api/provider-platforms?page=1&state=enabled
Authorization: Admin required
```

#### Get Platform Details
```http
GET /api/provider-platforms/{id}
Authorization: Admin required
```

#### Add LMS Platform
```http
POST /api/provider-platforms
Authorization: System Admin
Content-Type: application/json
```
**Body**:
```json
{
  "type": "canvas_cloud",
  "name": "Canvas Production",
  "account_id": "123456",
  "base_url": "https://institution.instructure.com",
  "access_key": "encrypted_api_key"
}
```

#### Update Platform
```http
PUT /api/provider-platforms/{id}
Authorization: System Admin
Content-Type: application/json
```

#### Remove Platform
```http
DELETE /api/provider-platforms/{id}
Authorization: System Admin
```

#### Sync Platform Data
```http
POST /api/provider-platforms/sync
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "platform_ids": [1, 2],
  "sync_types": ["users", "courses", "enrollments", "activities"]
}
```

---

## 📖 Content Management

### Open Content

#### List Open Content
```http
GET /api/open-content?page=1&provider=youtube&search=programming&category=technology
Authorization: Required
```

#### Search Content
```http
GET /api/open-content/search?q=mathematics&provider=kiwix&limit=10
Authorization: Required
```

#### Add to Favorites
```http
POST /api/open-content/favorite
Authorization: Required
Content-Type: application/json
```
**Body**:
```json
{
  "content_id": 123,
  "provider_id": 1,
  "url_id": 456
}
```

#### Remove from Favorites
```http
DELETE /api/open-content/favorite/{id}
Authorization: Required
```

### Libraries

#### List Libraries
```http
GET /api/libraries?page=1&provider_id=1&visible_only=true
Authorization: Required
```

#### Library Content Proxy
```http
GET /api/libraries/{id}/proxy/*path
Authorization: Required
```
**Description**: Proxy requests to library content with access control

#### Toggle Library Visibility
```http
POST /api/libraries/{id}/visibility
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "facility_id": 1,
  "visible": true
}
```

### Video Management

#### List Videos
```http
GET /api/videos?page=1&availability=available&channel=educational
Authorization: Required
```

#### Get Video Details
```http
GET /api/videos/{id}
Authorization: Required
```

#### Add Video
```http
POST /api/videos
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "url": "https://youtube.com/watch?v=abc123",
  "title": "Mathematics Basics",
  "description": "Introduction to basic mathematics",
  "visibility_status": true
}
```

#### Update Video
```http
PUT /api/videos/{id}
Authorization: Admin required
Content-Type: application/json
```

#### Delete Video
```http
DELETE /api/videos/{id}
Authorization: Admin required
```

#### Video Content Proxy
```http
GET /api/videos/{id}/proxy
Authorization: Required
```
**Description**: Stream video content with access control

### Helpful Links

#### List Helpful Links
```http
GET /api/helpful-links?page=1&facility_id=1&visible_only=true
Authorization: Required
```

#### Create Link
```http
POST /api/helpful-links
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "title": "Khan Academy Mathematics",
  "description": "Free online mathematics courses",
  "url": "https://khanacademy.org/math",
  "visibility_status": true,
  "facility_id": 1,
  "thumbnail_url": "https://example.com/thumb.jpg"
}
```

#### Update Link
```http
PUT /api/helpful-links/{id}
Authorization: Admin required
Content-Type: application/json
```

#### Delete Link
```http
DELETE /api/helpful-links/{id}
Authorization: Admin required
```

---

## 📈 Analytics & Reports

### Dashboard Data

#### Dashboard Statistics
```http
GET /api/dashboard?facility_id=1&date_range=30d
Authorization: Required
```
**Response**:
```json
{
  "total_users": 150,
  "active_programs": 12,
  "enrollment_rate": 78.5,
  "completion_rate": 65.2,
  "recent_activities": [/* recent activity data */],
  "engagement_metrics": {/* engagement data */}
}
```

#### Operational Insights
```http
GET /api/operational-insights?facility_id=1&start_date=2024-01-01&end_date=2024-01-31
Authorization: Admin required
```

### Activity & Progress

#### User Activity Data
```http
GET /api/activity/{user_id}?course_id=1&start_date=2024-01-01&include_sessions=true
Authorization: Admin or self
```

#### Learning Outcomes
```http
GET /api/outcomes?user_id=1&program_id=1&outcome_type=completion
Authorization: Admin or self
```

### Reports

#### Engagement Analytics
```http
GET /api/metrics/engagement?facility_id=1&period=monthly&breakdown=program
Authorization: Admin required
```

#### Completion Reports
```http
GET /api/reports/completions?facility_id=1&program_type=Educational&format=json
Authorization: Admin required
```
**Query Parameters**:
- `format` - Response format: `json`, `csv`, `pdf`
- `program_type` - Filter by program type
- `date_range` - Time period for report

---

## ⚙️ System Administration

### Feature Flags

#### List Feature Flags
```http
GET /api/feature-flags
Authorization: Admin required
```

#### Toggle Feature Flag
```http
PUT /api/feature-flags/{id}
Authorization: System Admin
Content-Type: application/json
```
**Body**:
```json
{
  "enabled": true
}
```

### Job Management

#### List Scheduled Jobs
```http
GET /api/jobs?category=provider_platform&status=running
Authorization: Admin required
```

#### Execute Job Manually
```http
POST /api/jobs/run
Authorization: Admin required
Content-Type: application/json
```
**Body**:
```json
{
  "job_type": "sync_users",
  "provider_platform_id": 1
}
```

### Health & Monitoring

#### System Health Check
```http
GET /api/health
Authorization: Not required
```
**Response**:
```json
{
  "status": "healthy",
  "services": {
    "database": "up",
    "nats": "up",
    "kratos": "up",
    "hydra": "up"
  },
  "version": "2.0.0",
  "uptime": "72h15m30s"
}
```

#### Prometheus Metrics
```http
GET /api/prometheus/metrics
Authorization: Admin required
```
**Description**: Prometheus-compatible metrics endpoint

### OIDC Client Management

#### List OIDC Clients
```http
GET /api/oidc/clients
Authorization: Admin required with ProviderAccess
```

#### Register OIDC Client
```http
POST /api/oidc/clients
Authorization: Admin required with ProviderAccess
Content-Type: application/json
```
**Body**:
```json
{
  "redirect_uri": "https://lms.example.com/auth/callback",
  "provider_platform_id": 1,
  "auto_register": true
}
```

#### Get OIDC Client
```http
GET /api/oidc/clients/{id}
Authorization: Admin required with ProviderAccess
```

### Identity Management

#### Sync Kratos Identities
```http
DELETE /api/identities/sync
Authorization: System Admin
```
**Description**: Synchronize or clean up Kratos identity store

---

## 🔧 Rate Limiting & Usage

### Rate Limits
- **API Calls**: 1000 requests per hour per user
- **File Uploads**: 10 files per minute
- **Bulk Operations**: 5 concurrent operations per user

### Bulk Operations
- **User Upload**: Maximum 1000 users per CSV
- **Enrollment**: Maximum 100 students per class enrollment
- **Attendance**: Maximum 500 attendance records per submission

### File Uploads
- **Maximum Size**: 10MB per file
- **Allowed Types**: CSV, JSON, PDF, images
- **Video Processing**: Asynchronous with webhook notifications

---

## 📚 Additional Resources

- [Authentication Documentation](../authentication/README.md)
- [Database Schema](../database/README.md)
- [Integration Guide](../integration/README.md)
- [Troubleshooting](../troubleshooting/README.md)

## 🐛 Error Codes Reference

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service unavailable |