# API Specification & Frontend Integration Guide

> **System**: Student Academic Performance & Dropout Early Warning System (*Hệ thống Cảnh báo Rủi ro ĐACN*)  
> **API Version**: `0.1.0`  
> **Base URL**: `http://localhost:8000/api/v1`  
> **Swagger UI (Interactive Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)  
> **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Table of Contents
1. [General Conventions & Guidelines](#1-general-conventions--guidelines)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Error Handling & Status Codes](#3-error-handling--status-codes)
4. [Endpoint Reference by Module](#4-endpoint-reference-by-module)
   - [Authentication](#authentication)
   - [Users](#users)
   - [Students](#students)
   - [Lecturers](#lecturers)
   - [Courses & Prerequisites](#courses--prerequisites)
   - [Semesters](#semesters)
   - [Academic Classes](#academic-classes)
   - [Enrollments & Grades](#enrollments--grades)
   - [System Health](#system-health)
5. [TypeScript Interfaces & DTOs](#5-typescript-interfaces--dtos)
6. [Axios API Client Example with Token Refresh](#6-axios-api-client-example-with-token-refresh)

---

## 1. General Conventions & Guidelines

- **Base Path**: All domain routes are prefixed with `/api/v1`.
- **Content-Type**: Requests with a JSON body must include header `'Content-Type': 'application/json'`.
- **Response Format**: All API responses return standard JSON objects or arrays.
- **Pagination Standard**:
  All listing endpoints support uniform pagination query parameters:
  - `skip` (*integer*, optional, default: `0`, minimum: `0`): Number of records to skip.
  - `limit` (*integer*, optional, default: `100`, range: `1` to `500`): Maximum number of records to return.

---

## 2. Authentication & Authorization

The system utilizes **JWT (JSON Web Token)** authentication with token separation (Access Token & Refresh Token).

### Token Types & Storage
| Token Type | Lifespan | Recommended Storage | Purpose |
|---|---|---|---|
| **Access Token** | Short-lived (60 min) | Memory / State / Cookie | Sent in `Authorization` header for protected endpoints |
| **Refresh Token** | Long-lived (7 days) | `localStorage` or `HttpOnly Cookie` | Used to obtain a fresh access token without re-login |

### Authorization Header
For endpoints requiring authentication, send the access token in the HTTP header:
```http
Authorization: Bearer <access_token>
```

### Roles (`role`)
- `admin`: Full administrative access.
- `lecturer`: Academic staff / instructor.
- `student`: Enrolled student.

---

## 3. Error Handling & Status Codes

### Standard HTTP Status Codes
| Status | Meaning | Scenario |
|---|---|---|
| **`200 OK`** | Success | Request succeeded and returned data |
| **`201 Created`** | Created | Resource successfully created (POST) |
| **`204 No Content`** | Deleted | Resource successfully deleted (DELETE) |
| **`400 Bad Request`** | Client Error | Malformed business logic or invalid request data |
| **`401 Unauthorized`** | Auth Error | Missing token, invalid token, or expired credentials |
| **`403 Forbidden`** | Permission Denied | Authenticated user lacks the required role |
| **`404 Not Found`** | Resource Missing | Entity with requested ID does not exist |
| **`409 Conflict`** | Duplicate Key | Email, user code, or unique identifier already exists |
| **`422 Unprocessable Content`** | Validation Error | Pydantic schema validation failed (wrong types, missing fields) |

### Error Response Schemas

#### Standard Business Error (`400`, `401`, `403`, `404`, `409`)
```json
{
  "detail": "Incorrect email or password"
}
```

#### Validation Error (`422 Unprocessable Content`)
Returned when payload fails validation (e.g. invalid email format, missing required body field):
```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "email"],
      "msg": "Field required",
      "input": {}
    }
  ]
}
```

---

## 4. Endpoint Reference by Module

---

### Authentication

#### 1. User Login
- **Endpoint**: `POST /api/v1/auth/login`
- **Auth Required**: No
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "user@university.edu.vn",
    "password": "mySecurePassword123"
  }
  ```
  > [!WARNING]
  > Must be sent as JSON body with `email` (not `username`) and `password`. Do not send as `application/x-www-form-urlencoded`.

- **Response (`200 OK`)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer"
  }
  ```
- **Error Codes**: `401 Unauthorized` (incorrect credentials), `422 Unprocessable Content` (invalid email/missing body).

---

#### 2. Rotate Refresh Token
- **Endpoint**: `POST /api/v1/auth/refresh`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "refresh_token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsIn...",
    "token_type": "bearer"
  }
  ```
- **Error Codes**: `401 Unauthorized` (expired or invalid refresh token).

---

### Users

#### 1. Get Current User Profile
- **Endpoint**: `GET /api/v1/users/me`
- **Auth Required**: Yes (`Bearer <access_token>`)
- **Response (`200 OK`)**:
  ```json
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_code": "2617037",
    "name": "Nguyen Van A",
    "email": "vana@university.edu.vn",
    "role": "student",
    "title": null
  }
  ```

---

#### 2. List Users
- **Endpoint**: `GET /api/v1/users/`
- **Auth Required**: No
- **Query Parameters**:
  - `skip` (*integer*, default: `0`): Offset.
  - `limit` (*integer*, default: `100`): Maximum count.
  - `role` (*string*, optional): Filter by role (`admin`, `lecturer`, `student`).
  - `search` (*string*, optional): Keyword search across name, user_code, or email.
- **Response (`200 OK`)**: Array of `UserResponse`.

---

#### 3. Create User Account
- **Endpoint**: `POST /api/v1/users/`
- **Auth Required**: No
- **Request Body**:
  ```json
  {
    "user_code": "2617037",
    "name": "Nguyen Van A",
    "email": "vana@university.edu.vn",
    "role": "student",
    "title": null,
    "password": "Password123!"
  }
  ```
- **Response (`201 Created`)**: `UserResponse`
- **Error Codes**: `409 Conflict` (user_code or email already exists).

---

#### 4. Get User by ID
- **Endpoint**: `GET /api/v1/users/{user_id}`
- **Path Parameters**: `user_id` (*UUID string*)
- **Response (`200 OK`)**: `UserResponse`
- **Error Codes**: `404 Not Found`

---

#### 5. Update User Profile
- **Endpoint**: `PUT /api/v1/users/{user_id}`
- **Path Parameters**: `user_id` (*UUID string*)
- **Request Body** (all fields optional):
  ```json
  {
    "name": "Nguyen Van B",
    "email": "vanb@university.edu.vn",
    "role": "lecturer",
    "title": "ThS",
    "password": "NewPassword456"
  }
  ```
- **Response (`200 OK`)**: Updated `UserResponse`

---

#### 6. Delete User Account
- **Endpoint**: `DELETE /api/v1/users/{user_id}`
- **Path Parameters**: `user_id` (*UUID string*)
- **Response (`204 No Content`)**: Empty response body

---

### Students

#### 1. List Students
- **Endpoint**: `GET /api/v1/students/`
- **Query Parameters**:
  - `skip`, `limit`
  - `cohort` (*string*, optional): e.g. `K26`, `2022`
  - `major` (*string*, optional): e.g. `computer science`
  - `search` (*string*, optional): Search keyword
- **Response (`200 OK`)**: Array of `StudentResponse`:
  ```json
  [
    {
      "student_id": "2617037",
      "cohort": "K26",
      "major": "computer science",
      "user_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  ]
  ```

---

#### 2. Create Student Record
- **Endpoint**: `POST /api/v1/students/`
- **Request Body**:
  ```json
  {
    "student_id": "2617037",
    "cohort": "K26",
    "major": "computer science",
    "user_id": "123e4567-e89b-12d3-a456-426614174000"
  }
  ```
- **Response (`201 Created`)**: `StudentResponse`

---

#### 3. Get Student Details (with Linked User Profile)
- **Endpoint**: `GET /api/v1/students/{student_id}`
- **Path Parameters**: `student_id` (*string*)
- **Response (`200 OK`)**:
  ```json
  {
    "student_id": "2617037",
    "cohort": "K26",
    "major": "computer science",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "user_code": "2617037",
      "name": "Nguyen Van A",
      "email": "vana@university.edu.vn",
      "role": "student",
      "title": null
    }
  }
  ```

---

#### 4. Get Student Academic Summary & Semester GPA History
- **Endpoint**: `GET /api/v1/students/{student_id}/summary`
- **Auth Required**: No
- **Path Parameters**: `student_id` (*string*)
- **Description**: Returns the student's overall Cumulative GPA (weighted average of passed courses), total degree credits accumulated, total attempted credits, and chronological term GPA breakdown for each semester studied.
- **Response (`200 OK`)**:
  ```json
  {
    "student_id": "1316593",
    "cumulative_gpa": 2.38,
    "total_passed_credits": 127,
    "total_attempted_credits": 127,
    "passed_courses_count": 44,
    "failed_courses_count": 0,
    "is_graduated": true,
    "semester_gpas": [
      {
        "semester_code": "HK131",
        "gpa": 2.09,
        "semester_gpa": 2.09,
        "attempted_credits": 16,
        "passed_credits": 16,
        "courses_count": 6
      },
      {
        "semester_code": "HK132",
        "gpa": 2.38,
        "semester_gpa": 2.38,
        "attempted_credits": 17,
        "passed_credits": 17,
        "courses_count": 8
      }
    ]
  }
  ```
- **Error Codes**: `404 Not Found` (student with ID does not exist).

---

#### 5. Get Enrolled Courses in Current Active Semester
- **Endpoint**: `GET /api/v1/students/{student_id}/current`
- **Auth Required**: No
- **Path Parameters**: `student_id` (*string*)
- **Description**: Returns all courses registered by the student in the current active academic term (dynamically resolved from active semester, currently `HK261`), including class code, section group, credit weight, and lecturer details.
- **Response (`200 OK`)**:
  ```json
  [
    {
      "course_code": "CO4029",
      "course_name": "Đồ án Chuyên ngành",
      "credits": 2,
      "class_id": "HK261_CO4029_L01",
      "class_group": "L01",
      "lecturer_id": "1300746",
      "lecturer_name": "Ngô Quốc An",
      "retaken": false,
      "status": null
    },
    {
      "course_code": "SP1037",
      "course_name": "Tư tưởng Hồ Chí Minh",
      "credits": 2,
      "class_id": "HK261_SP1037_L03",
      "class_group": "L03",
      "lecturer_id": "1387855",
      "lecturer_name": "Huỳnh Ngọc Khôi",
      "retaken": false,
      "status": null
    }
  ]
  ```
- **Error Codes**:
  - `404 Not Found`:
    - Student does not exist: `{"detail": "Student '2617037' not found"}`
    - Student already graduated: `{"detail": "Student '1316593' has already graduated and has no registered classes in semester HK261"}`
    - Student not registered in current semester: `{"detail": "Student '1664698' has not registered for any classes in semester HK261"}`

---

#### 6. Update Student Record
- **Endpoint**: `PUT /api/v1/students/{student_id}`
- **Request Body** (optional fields): `cohort`, `major`, `user_id`
- **Response (`200 OK`)**: `StudentResponse`

---

#### 7. Delete Student Record
- **Endpoint**: `DELETE /api/v1/students/{student_id}`
- **Response (`204 No Content`)**

---

### Lecturers

#### 1. List Lecturers
- **Endpoint**: `GET /api/v1/lecturers/`
- **Query Parameters**:
  - `skip`, `limit`
  - `department` (*string*, optional): Filter by department name
  - `search` (*string*, optional): Search keyword
- **Response (`200 OK`)**: Array of `LecturerResponse`.

---

#### 2. Create Lecturer Record
- **Endpoint**: `POST /api/v1/lecturers/`
- **Request Body**:
  ```json
  {
    "lecturer_id": "GV1001",
    "departments": "Khoa Khoa học & Kỹ thuật Máy tính",
    "user_id": "123e4567-e89b-12d3-a456-426614174000"
  }
  ```
- **Response (`201 Created`)**: `LecturerResponse`

---

#### 3. Get Lecturer Details (with Linked User Profile)
- **Endpoint**: `GET /api/v1/lecturers/{lecturer_id}`
- **Response (`200 OK`)**: `LecturerDetailResponse` (includes nested `user` object).

---

#### 4. Update Lecturer
- **Endpoint**: `PUT /api/v1/lecturers/{lecturer_id}`
- **Request Body**: `departments`, `user_id`
- **Response (`200 OK`)**: `LecturerResponse`

---

#### 5. Delete Lecturer
- **Endpoint**: `DELETE /api/v1/lecturers/{lecturer_id}`
- **Response (`204 No Content`)**

---

### Courses & Prerequisites

#### 1. List Courses
- **Endpoint**: `GET /api/v1/courses/`
- **Query Parameters**: `skip`, `limit`, `search`
- **Response (`200 OK`)**:
  ```json
  [
    {
      "course_code": "CS101",
      "course_name": "Nhập môn Lập trình",
      "credits": 4
    }
  ]
  ```

---

#### 2. Create Course
- **Endpoint**: `POST /api/v1/courses/`
- **Request Body**:
  ```json
  {
    "course_code": "CS102",
    "course_name": "Cấu trúc dữ liệu & Giải thuật",
    "credits": 4
  }
  ```
- **Response (`201 Created`)**: `CourseResponse`

---

#### 3. Get Course with Prerequisites
- **Endpoint**: `GET /api/v1/courses/{course_code}`
- **Response (`200 OK`)**:
  ```json
  {
    "course_code": "CS102",
    "course_name": "Cấu trúc dữ liệu & Giải thuật",
    "credits": 4,
    "prerequisites": [
      {
        "course_prerequisite_id": 1,
        "course_code": "CS102",
        "related_course_code": "CS101",
        "relation_type": "PREREQ"
      }
    ]
  }
  ```

---

#### 4. Update Course
- **Endpoint**: `PUT /api/v1/courses/{course_code}`
- **Request Body**: `course_name`, `credits`
- **Response (`200 OK`)**: `CourseResponse`

---

#### 5. Delete Course
- **Endpoint**: `DELETE /api/v1/courses/{course_code}`
- **Response (`204 No Content`)**

---

#### 6. Add Prerequisite Relation
- **Endpoint**: `POST /api/v1/courses/{course_code}/prerequisites`
- **Request Body**:
  ```json
  {
    "course_code": "CS102",
    "related_course_code": "CS101",
    "relation_type": "PREREQ"
  }
  ```
- **Response (`201 Created`)**: `CoursePrerequisiteResponse`

---

#### 7. Delete Prerequisite Relation
- **Endpoint**: `DELETE /api/v1/courses/prerequisites/{prerequisite_id}`
- **Path Parameters**: `prerequisite_id` (*integer*)
- **Response (`204 No Content`)**

---

### Semesters

#### 1. List Semesters
- **Endpoint**: `GET /api/v1/semesters/`
- **Query Parameters**:
  - `skip`, `limit`
  - `academic_year` (*string*, optional): e.g. `2023-2024`
  - `is_active` (*boolean*, optional): Filter by active status (`true` / `false`)
- **Response (`200 OK`)**:
  ```json
  [
    {
      "semester_code": "HK261",
      "academic_year": "2026-2027",
      "term": 1,
      "is_active": true
    },
    {
      "semester_code": "HK253",
      "academic_year": "2025-2026",
      "term": 3,
      "is_active": false
    }
  ]
  ```

---

#### 2. Get Current Active Semester
- **Endpoint**: `GET /api/v1/semesters/active`
- **Auth Required**: No
- **Response (`200 OK`)**:
  ```json
  {
    "semester_code": "HK261",
    "academic_year": "2026-2027",
    "term": 1,
    "is_active": true
  }
  ```
- **Error Codes**: `404 Not Found` (when no active semester is configured).

---

#### 3. Create Semester
- **Endpoint**: `POST /api/v1/semesters/`
- **Request Body**:
  ```json
  {
    "semester_code": "HK231",
    "academic_year": "2023-2024",
    "term": 1
  }
  ```
- **Response (`201 Created`)**: `SemesterResponse`

---

#### 4. Get Semester by Code
- **Endpoint**: `GET /api/v1/semesters/{semester_code}`
- **Response (`200 OK`)**: `SemesterResponse`

---

#### 5. Update Semester
- **Endpoint**: `PUT /api/v1/semesters/{semester_code}`
- **Request Body** (optional fields): `academic_year`, `term`, `is_active`
- **Response (`200 OK`)**: `SemesterResponse`

---

#### 6. Delete Semester
- **Endpoint**: `DELETE /api/v1/semesters/{semester_code}`
- **Response (`204 No Content`)**

---

### Academic Classes

#### 1. List Classes
- **Endpoint**: `GET /api/v1/classes/`
- **Query Parameters**:
  - `skip`, `limit`
  - `course_code` (*string*, optional)
  - `semester_code` (*string*, optional)
  - `lecturer_id` (*string*, optional)
  - `search` (*string*, optional)
- **Response (`200 OK`)**: Array of `AcademicClassResponse`.

---

#### 2. Create Class
- **Endpoint**: `POST /api/v1/classes/`
- **Request Body**:
  ```json
  {
    "class_id": "HK231_CS101_L01",
    "class_group": "L01",
    "course_code": "CS101",
    "semester_code": "HK231",
    "lecturer_id": "GV1001"
  }
  ```
- **Response (`201 Created`)**: `AcademicClassResponse`

---

#### 3. Get Class Details (with Course, Semester, & Lecturer)
- **Endpoint**: `GET /api/v1/classes/{class_id}`
- **Response (`200 OK`)**:
  ```json
  {
    "class_id": "HK231_CS101_L01",
    "class_group": "L01",
    "course_code": "CS101",
    "semester_code": "HK231",
    "lecturer_id": "GV1001",
    "course": {
      "course_code": "CS101",
      "course_name": "Nhập môn Lập trình",
      "credits": 4
    },
    "semester": {
      "semester_code": "HK231",
      "academic_year": "2023-2024",
      "term": 1
    },
    "lecturer": {
      "lecturer_id": "GV1001",
      "departments": "Khoa Khoa học & Kỹ thuật Máy tính",
      "user_id": "123e4567-e89b-12d3-a456-426614174000"
    }
  }
  ```

---

#### 4. Update Class
- **Endpoint**: `PUT /api/v1/classes/{class_id}`
- **Request Body**: `class_group`, `course_code`, `semester_code`, `lecturer_id`
- **Response (`200 OK`)**: `AcademicClassResponse`

---

#### 5. Delete Class
- **Endpoint**: `DELETE /api/v1/classes/{class_id}`
- **Response (`204 No Content`)**

---

### Enrollments & Grades

#### 1. List Enrollments
- **Endpoint**: `GET /api/v1/enrollments/`
- **Query Parameters**:
  - `skip`, `limit`
  - `student_id` (*string*, optional)
  - `class_id` (*string*, optional)
  - `course_code` (*string*, optional)
  - `semester_code` (*string*, optional)
  - `status` (*string*, optional): e.g. `enrolled`, `completed`, `dropped`
- **Response (`200 OK`)**: Array of `EnrollmentResponse`.

---

#### 2. Register Student into Class
- **Endpoint**: `POST /api/v1/enrollments/`
- **Request Body**:
  ```json
  {
    "student_id": "2617037",
    "class_id": "HK231_CS101_L01",
    "course_code": "CS101",
    "semester_code": "HK231",
    "retaken": false,
    "status": "enrolled"
  }
  ```
- **Response (`201 Created`)**: `EnrollmentResponse`

---

#### 3. Get Student Transcript / Enrollments
- **Endpoint**: `GET /api/v1/enrollments/students/{student_id}`
- **Query Parameters**: `semester_code` (optional), `skip`, `limit`
- **Response (`200 OK`)**: Array of all enrollment & grade records for this student.

---

#### 4. Get Class Grade Roster
- **Endpoint**: `GET /api/v1/enrollments/classes/{class_id}`
- **Query Parameters**: `skip`, `limit`
- **Response (`200 OK`)**: Array of all student grade entries in this class.

---

#### 5. Update Grades and Status
- **Endpoint**: `PUT /api/v1/enrollments/{enrollment_id}`
- **Path Parameters**: `enrollment_id` (*UUID string*)
- **Request Body** (all fields optional):
  ```json
  {
    "quiz": 8.5,
    "lab": 9.0,
    "btl": 8.0,
    "giua_ky": 7.5,
    "cuoi_ky": 8.5,
    "final_score": 8.3,
    "letter_grade": "B+",
    "gpa_4": 3.5,
    "passed": true,
    "semester_gpa_4": 3.42,
    "final_gpa_4": 3.38,
    "status": "completed"
  }
  ```
- **Response (`200 OK`)**: `EnrollmentResponse`

---

#### 6. Delete Enrollment Record
- **Endpoint**: `DELETE /api/v1/enrollments/{enrollment_id}`
- **Response (`204 No Content`)**

---

### System Health

#### Health Check
- **Endpoint**: `GET /health`
- **Auth Required**: No
- **Response (`200 OK`)**:
  ```json
  {
    "status": "ok"
  }
  ```

---

## 5. TypeScript Interfaces & DTOs

Save the following definitions into `src/types/api.ts` in your frontend project:

```typescript
// ==========================================
// Authentication Types
// ==========================================
export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RefreshTokenPayload {
  refresh_token: string;
}

// ==========================================
// User Types
// ==========================================
export type UserRole = 'admin' | 'lecturer' | 'student';

export interface User {
  id: string; // UUID
  user_code: string;
  name: string;
  email: string;
  role: UserRole;
  title: string | null;
}

export interface UserCreatePayload {
  user_code: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string | null;
  password: string;
}

export interface UserUpdatePayload {
  name?: string;
  email?: string;
  role?: UserRole;
  title?: string | null;
  password?: string;
}

// ==========================================
// Student Types
// ==========================================
export interface Student {
  student_id: string;
  cohort: string;
  major: string;
  user_id: string | null;
}

export interface StudentDetail extends Student {
  user: User | null;
}

export interface StudentCreatePayload {
  student_id: string;
  cohort: string;
  major: string;
  user_id?: string | null;
}

export interface SemesterGpaItem {
  semester_code: string;
  gpa: number;
  semester_gpa: number;
  attempted_credits: number;
  passed_credits: number;
  courses_count: number;
}

export interface StudentAcademicSummary {
  student_id: string;
  cumulative_gpa: number;
  total_passed_credits: number;
  total_attempted_credits: number;
  passed_courses_count: number;
  failed_courses_count: number;
  is_graduated: boolean;
  semester_gpas: SemesterGpaItem[];
}

export interface StudentCurrentCourseItem {
  course_code: string;
  course_name: string;
  credits: number;
  class_id: string | null;
  class_group: string | null;
  lecturer_id: string | null;
  lecturer_name: string | null;
  retaken: boolean;
  status: string | null;
}

// ==========================================
// Lecturer Types
// ==========================================
export interface Lecturer {
  lecturer_id: string;
  departments: string;
  user_id: string | null;
}

export interface LecturerDetail extends Lecturer {
  user: User | null;
}

export interface LecturerCreatePayload {
  lecturer_id: string;
  departments: string;
  user_id?: string | null;
}

// ==========================================
// Course & Prerequisite Types
// ==========================================
export interface Course {
  course_code: string;
  course_name: string;
  credits: number;
}

export interface CoursePrerequisite {
  course_prerequisite_id: number;
  course_code: string;
  related_course_code: string;
  relation_type: string; // 'PREREQ', 'COREQ'
}

export interface CourseDetail extends Course {
  prerequisites: CoursePrerequisite[];
}

export interface CourseCreatePayload {
  course_code: string;
  course_name: string;
  credits: number;
}

export interface CoursePrerequisiteCreatePayload {
  course_code: string;
  related_course_code: string;
  relation_type: string;
}

// ==========================================
// Semester Types
// ==========================================
export interface Semester {
  semester_code: string;
  academic_year: string;
  term: number;
  is_active: boolean;
}

export interface SemesterCreatePayload {
  semester_code: string;
  academic_year: string;
  term: number;
  is_active?: boolean;
}

export interface SemesterUpdatePayload {
  academic_year?: string;
  term?: number;
  is_active?: boolean;
}

// ==========================================
// Academic Class Types
// ==========================================
export interface AcademicClass {
  class_id: string;
  class_group: string;
  course_code: string | null;
  semester_code: string | null;
  lecturer_id: string | null;
}

export interface AcademicClassDetail extends AcademicClass {
  course: Course | null;
  semester: Semester | null;
  lecturer: Lecturer | null;
}

export interface AcademicClassCreatePayload {
  class_id: string;
  class_group: string;
  course_code?: string | null;
  semester_code?: string | null;
  lecturer_id?: string | null;
}

// ==========================================
// Enrollment & Grade Types
// ==========================================
export interface Enrollment {
  id: string; // UUID
  student_id: string;
  class_id: string;
  course_code: string;
  semester_code: string;
  retaken: boolean;
  quiz: number | null;
  lab: number | null;
  btl: number | null;
  giua_ky: number | null;
  cuoi_ky: number | null;
  final_score: number | null;
  letter_grade: string | null;
  gpa_4: number | null;
  passed: boolean | null;
  semester_gpa_4: number | null;
  final_gpa_4: number | null;
  status: string | null;
}

export interface EnrollmentCreatePayload {
  student_id: string;
  class_id: string;
  course_code: string;
  semester_code: string;
  retaken?: boolean;
  status?: string | null;
}

export interface EnrollmentUpdatePayload {
  retaken?: boolean;
  quiz?: number | null;
  lab?: number | null;
  btl?: number | null;
  giua_ky?: number | null;
  cuoi_ky?: number | null;
  final_score?: number | null;
  letter_grade?: string | null;
  gpa_4?: number | null;
  passed?: boolean | null;
  semester_gpa_4?: number | null;
  final_gpa_4?: number | null;
  status?: string | null;
}
```

---

## 6. Axios API Client Example with Token Refresh

Here is a drop-in Axios setup with interceptors that automatically attach the bearer token and rotate expired tokens:

```typescript
// src/services/apiClient.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenResponse } from '../types/api';

const BASE_URL = 'http://localhost:8000/api/v1';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 & Auto-Refresh Token
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Avoid infinite loop on auth endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<TokenResponse>(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);

        apiClient.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        }

        processQueue(null, data.access_token);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

