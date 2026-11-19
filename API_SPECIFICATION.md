# API Specification & Frontend Integration Guide

> **System**: Student Academic Performance & Dropout Early Warning System (*Hệ thống Cảnh báo Rủi ro ĐACN*)
> **API Version**: `0.1.0`
> **Base URL**: `http://localhost:8000/api/v1`
> **Swagger UI (Interactive Docs)**: [http://localhost:8000/docs](http://localhost:8000/docs)
> **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Table of Contents

1. [General Conventions &amp; Guidelines](#1-general-conventions--guidelines)
2. [Authentication &amp; Authorization](#2-authentication--authorization)
3. [Error Handling &amp; Status Codes](#3-error-handling--status-codes)
4. [Endpoint Reference by Module](#4-endpoint-reference-by-module)
   - [Authentication](#authentication)
   - [Users](#users)
   - [Students](#students)
   - [Lecturers](#lecturers)
   - [Courses &amp; Prerequisites](#courses--prerequisites)
   - [Curriculums &amp; Program Structures](#curriculums--program-structures)
   - [Semesters](#semesters)
   - [Academic Classes](#academic-classes)
   - [Enrollments &amp; Grades](#enrollments--grades)
   - [Predictions &amp; Explainable AI (XAI)](#predictions--explainable-ai-xai)
   - [Academic Advising &amp; Two-Way Messaging](#academic-advising--two-way-messaging)
   - [System Health](#system-health)
5. [TypeScript Interfaces &amp; DTOs](#5-typescript-interfaces--dtos)
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

| Token Type              | Lifespan             | Recommended Storage                     | Purpose                                                  |
| ----------------------- | -------------------- | --------------------------------------- | -------------------------------------------------------- |
| **Access Token**  | Short-lived (60 min) | Memory / State / Cookie                 | Sent in `Authorization` header for protected endpoints |
| **Refresh Token** | Long-lived (7 days)  | `localStorage` or `HttpOnly Cookie` | Used to obtain a fresh access token without re-login     |

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

| Status                                  | Meaning           | Scenario                                                        |
| --------------------------------------- | ----------------- | --------------------------------------------------------------- |
| **`200 OK`**                    | Success           | Request succeeded and returned data                             |
| **`201 Created`**               | Created           | Resource successfully created (POST)                            |
| **`204 No Content`**            | Deleted           | Resource successfully deleted (DELETE)                          |
| **`400 Bad Request`**           | Client Error      | Malformed business logic or invalid request data                |
| **`401 Unauthorized`**          | Auth Error        | Missing token, invalid token, or expired credentials            |
| **`403 Forbidden`**             | Permission Denied | Authenticated user lacks the required role                      |
| **`404 Not Found`**             | Resource Missing  | Entity with requested ID does not exist                         |
| **`409 Conflict`**              | Duplicate Key     | Email, user code, or unique identifier already exists           |
| **`422 Unprocessable Content`** | Validation Error  | Pydantic schema validation failed (wrong types, missing fields) |

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
  >
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
  - `major` (*string*, optional): e.g. `Khoa hoc May tinh`
  - `search` (*string*, optional): Search keyword
- **Response (`200 OK`)**: Array of `StudentResponse`:
  ```json
  [
    {
      "student_id": "2617037",
      "cohort": "K26",
      "major": "Khoa hoc May tinh",
      "program": "Dai tra",
      "specialization": "Cong nghe phan mem",
      "english_pass": true,
      "ctxh_days": 15,
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
    "major": "Khoa hoc May tinh",
    "program": "Dai tra",
    "specialization": "Cong nghe phan mem",
    "english_pass": true,
    "ctxh_days": 15,
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
    "major": "Khoa hoc May tinh",
    "program": "Dai tra",
    "specialization": "Cong nghe phan mem",
    "english_pass": true,
    "ctxh_days": 15,
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
- **Description**: Returns the student's overall Cumulative GPA (weighted average of passed courses with numeric grades), total degree credits accumulated (including exempted courses such as `LA1003`..`LA1009` with `final_score = 12.0`), total attempted credits, and chronological term GPA breakdown for each semester studied.

> [!NOTE]
> **Exempted Courses (`final_score = 12.0`)**: In university business rules, English exemption courses grant full academic credits towards graduation (`total_passed_credits`), but are excluded from the denominator in GPA weighted calculations to preserve numeric scale integrity.

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
- **Request Body** (all fields optional):
  ```json
  {
    "cohort": "K26",
    "major": "Khoa hoc May tinh",
    "program": "Dai tra",
    "specialization": "He thong thong tin",
    "english_pass": true,
    "ctxh_days": 18,
    "user_id": "123e4567-e89b-12d3-a456-426614174000"
  }
  ```
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

#### 4. Get Classes Taught by Lecturer in Current Active Semester

- **Endpoint**: `GET /api/v1/lecturers/{lecturer_id}/current` (Alias: `GET /api/v1/lecturers/{lecturer_id}/classes/current`)
- **Auth Required**: No
- **Path Parameters**: `lecturer_id` (*string*)
- **Description**: Returns all academic classes assigned to this lecturer for the currently active semester (dynamically resolved from `semesters.is_active = true`, e.g. `HK261`), including course details and enrolled student count.
- **Response (`200 OK`)**:
  ```json
  [
    {
      "class_id": "HK261_CO1005_L01",
      "class_group": "L01",
      "course_code": "CO1005",
      "course_name": "Nhập môn Điện toán",
      "credits": 3,
      "semester_code": "HK261",
      "academic_year": "2026-2027",
      "term": 1,
      "total_students": 116
    },
    {
      "class_id": "HK261_CO3139_L01",
      "class_group": "L01",
      "course_code": "CO3139",
      "course_name": "Chuyển đổi số",
      "credits": 3,
      "semester_code": "HK261",
      "academic_year": "2026-2027",
      "term": 1,
      "total_students": 70
    }
  ]
  ```
- **Error Codes**:
  - `404 Not Found`: Lecturer with ID does not exist (`{"detail": "Lecturer 'GV9999' not found"}`).

---

#### 5. Update Lecturer

- **Endpoint**: `PUT /api/v1/lecturers/{lecturer_id}`
- **Request Body**: `departments`, `user_id`
- **Response (`200 OK`)**: `LecturerResponse`

---

#### 6. Delete Lecturer

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

#### 3. Get Course with Prerequisites & Assessment Weights

- **Endpoint**: `GET /api/v1/courses/{course_code}`
- **Response (`200 OK`)**:
  ```json
  {
    "course_code": "CO2003",
    "course_name": "Cấu trúc dữ liệu và Giải thuật",
    "credits": 4,
    "prerequisites": [
      {
        "course_prerequisite_id": 1,
        "course_code": "CO2003",
        "related_course_code": "CO1005",
        "relation_type": "PREREQ"
      }
    ],
    "assessment": {
      "course_code": "CO2003",
      "course_category": "Core",
      "quiz": 0,
      "lab": 20,
      "btl": 30,
      "giua_ky": 0,
      "cuoi_ky": 50
    }
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

#### 8. Get Course Assessment Weights

- **Endpoint**: `GET /api/v1/courses/{course_code}/assessment`
- **Path Parameters**: `course_code` (*string*, e.g. `CO2003`)
- **Description**: Returns the percentage breakdown of assessment components (quiz, lab, btl, giua_ky, cuoi_ky) and the course category.
- **Response (`200 OK`)**:
  ```json
  {
    "course_code": "CO2003",
    "course_category": "Core",
    "quiz": 0,
    "lab": 20,
    "btl": 30,
    "giua_ky": 0,
    "cuoi_ky": 50
  }
  ```
- **Error Codes**: `404 Not Found` (if no assessment scheme is registered for this course).

---

### Curriculums & Program Structures

#### 1. List Curriculums

- **Endpoint**: `GET /api/v1/curriculums/`
- **Query Parameters**:
  - `cohort` (*string*, optional): Filter by cohort (e.g. `K20`, `K21`)
  - `major_code` (*string*, optional): Filter by major code (e.g. `7480201`)
  - `skip` (*integer*, optional, default: `0`)
  - `limit` (*integer*, optional, default: `100`)
- **Response (`200 OK`)**: Array of `CurriculumResponse`:
  ```json
  [
    {
      "curriculum_id": "KHMT_K20",
      "curriculum_name": "Chương trình Đào tạo Cử nhân Khoa học Máy tính K20",
      "major_code": "7480201",
      "major_name": "Khoa học Máy tính",
      "cohort": "K20",
      "academic_year_start": 2020,
      "total_credits": 128.0,
      "base_curriculum_id": null,
      "faculty": "Khoa Khoa học và Kỹ thuật Máy tính"
    }
  ]
  ```

---

#### 2. Get Curriculum Details & Knowledge Blocks

- **Endpoint**: `GET /api/v1/curriculums/{curriculum_id}`
- **Path Parameters**: `curriculum_id` (*string*, e.g. `KHMT_K20`)
- **Description**: Returns curriculum master data along with the grouped knowledge blocks and mapped course structures.
- **Response (`200 OK`)**:
  ```json
  {
    "curriculum_id": "KHMT_K20",
    "curriculum_name": "Chương trình Đào tạo Cử nhân Khoa học Máy tính K20",
    "major_code": "7480201",
    "major_name": "Khoa học Máy tính",
    "cohort": "K20",
    "academic_year_start": 2020,
    "total_credits": 128.0,
    "base_curriculum_id": null,
    "faculty": "Khoa Khoa học và Kỹ thuật Máy tính",
    "structures": [
      {
        "structure_id": 1,
        "curriculum_id": "KHMT_K20",
        "course_code": "CO2003",
        "block_id": "KB_CS_CORE",
        "course_type": "BB",
        "elective_group": null,
        "specialization": null,
        "credits": 4,
        "recommended_semester": "HK3",
        "prerequisites": "CO1005",
        "knowledge_block": {
          "block_id": "KB_CS_CORE",
          "block_code": "CS_CORE",
          "block_name_vi": "Khối kiến thức Cơ sở nhóm ngành",
          "block_name_en": "Computer Science Core",
          "category": "Core",
          "required_credits": 32.0,
          "description": "Bắt buộc đối với toàn ngành KHMT"
        }
      }
    ]
  }
  ```
- **Error Codes**: `404 Not Found` (curriculum does not exist).

---

#### 3. Get Curriculum Course Structures

- **Endpoint**: `GET /api/v1/curriculums/{curriculum_id}/structures`
- **Path Parameters**: `curriculum_id` (*string*)
- **Description**: Returns all mapped course allocations in the curriculum, including recommended semester, compulsory/elective designation (`BB`/`TC`), credits, and knowledge block metadata.
- **Response (`200 OK`)**: Array of `ProgramStructureDetailResponse`.

---

#### 4. List Knowledge Blocks

- **Endpoint**: `GET /api/v1/curriculums/knowledge-blocks`
- **Query Parameters**:
  - `category` (*string*, optional): Filter by category (e.g. `General`, `Core`, `Specialized`)
  - `skip` (*integer*, optional, default: `0`)
  - `limit` (*integer*, optional, default: `100`)
- **Response (`200 OK`)**: Array of `KnowledgeBlockResponse`:
  ```json
  [
    {
      "block_id": "KB_GENERAL",
      "block_code": "GENERAL",
      "block_name_vi": "Khối kiến thức Giáo dục đại cương",
      "block_name_en": "General Education",
      "category": "General",
      "required_credits": 28.0,
      "description": "Các môn lý luận chính trị, toán, khoa học tự nhiên"
    },
    {
      "block_id": "KB_CS_CORE",
      "block_code": "CS_CORE",
      "block_name_vi": "Khối kiến thức Cơ sở nhóm ngành",
      "block_name_en": "Computer Science Core",
      "category": "Core",
      "required_credits": 32.0,
      "description": "Bắt buộc đối với toàn ngành KHMT"
    }
  ]
  ```

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

### Predictions & Explainable AI (XAI)

#### 1. Check AI Model Service Health

- **Endpoint**: `GET /api/v1/predictions/health`
- **Auth Required**: No
- **Response (`200 OK`)**:
  ```json
  {
    "status": "ok",
    "service": "dacn-model-service",
    "model_status": "loaded",
    "fail_threshold": 0.9309,
    "total_records_cached": 424158,
    "metrics": {
      "threshold": 0.93092,
      "roc_auc": 0.9494,
      "average_precision": 0.4321,
      "accuracy": 0.9762,
      "f1": 0.4464
    }
  }
  ```

---

#### 2. Predict All Enrolled Courses for a Student (Term Dashboard)

- **Endpoint**: `GET /api/v1/predictions/students/{student_id}`
- **Alternative POST**: `POST /api/v1/predictions/student` with body `{"student_id": "2100512", "semester_code": "HK261"}`
- **Auth Required**: Yes (`student` can only access own MSSV; `lecturer` / `admin` can access any student)
- **Query Parameters**:
  - `semester_code` (*string*, optional): Defaults to currently active semester (e.g. `HK261`)
- **Response (`200 OK`)**: `StudentPredictionResponse`
  ```json
  {
    "student_id": "2100512",
    "semester_code": "HK261",
    "total_courses": 2,
    "at_risk_count": 0,
    "predicted_semester_gpa4": 2.5,
    "courses": [
      {
        "course_code": "CO2017",
        "course_name": "Hệ điều hành",
        "credits": 3,
        "class_id": "HK261_CO2017_L01",
        "class_group": "L01",
        "lecturer_name": "Nguyễn Văn B",
        "semester_code": "HK261",
        "record_status": null,
        "fail_probability": 0.0207,
        "predicted_course_fail": 0,
        "is_at_risk": false,
        "risk_level": "LOW",
        "predicted_score10": 6.15,
        "predicted_gpa4": 2.0,
        "current_marks": {
          "quiz": null,
          "lab": null,
          "btl": null,
          "giua_ky": 5.5
        },
        "top_shap_factors": [
          {
            "feature": "giua_ky",
            "shap_value": -1.7865,
            "impact": "DECREASE_RISK",
            "description": "Điểm giữa kỳ (5.5) góp phần giảm nguy cơ rớt môn"
          },
          {
            "feature": "prior_failed_course_count",
            "shap_value": 1.3372,
            "impact": "INCREASE_RISK",
            "description": "Số môn đã từng rớt trong quá khứ (10 môn) làm tăng nguy cơ rớt môn"
          }
        ]
      }
    ]
  }
  ```

---

#### 3. Predict Single Course Outcome

- **Endpoint**: `POST /api/v1/predictions/course`
- **Auth Required**: Yes (`student` own ID or `lecturer` / `admin`)
- **Request Body**:
  ```json
  {
    "student_id": "2100512",
    "course_code": "CO2017",
    "semester_code": "HK261"
  }
  ```
- **Response (`200 OK`)**: `CoursePredictionResponse`
  ```json
  {
    "course_code": "CO2017",
    "course_name": "Hệ điều hành",
    "credits": 3,
    "class_id": "HK261_CO2017_L01",
    "class_group": "L01",
    "lecturer_name": "Nguyễn Văn B",
    "semester_code": "HK261",
    "record_status": null,
    "fail_probability": 0.0207,
    "predicted_course_fail": 0,
    "is_at_risk": false,
    "risk_level": "LOW",
    "predicted_score10": 6.15,
    "predicted_gpa4": 2.0,
    "current_marks": {
      "quiz": null,
      "lab": null,
      "btl": null,
      "giua_ky": 5.5
    },
    "top_shap_factors": [
      {
        "feature": "giua_ky",
        "shap_value": -1.7865,
        "impact": "DECREASE_RISK",
        "description": "Điểm giữa kỳ (5.5) góp phần giảm nguy cơ rớt môn"
      }
    ]
  }
  ```

---

#### 4. Predict Risk & Batch Analytics for an Entire Class (Lecturer / Admin)

- **Endpoint**: `GET /api/v1/predictions/classes/{class_id}`
- **Alternative POST**: `POST /api/v1/predictions/class` with body `{"class_id": "HK261_CO1023_L02", "include_shap": true}`
- **Auth Required**: Yes (`ROLE_LECTURER` who teaches the class, or `ROLE_ADMIN`. `ROLE_STUDENT` receives `403 Forbidden`)
- **Query Parameters**:
  - `include_shap` (*boolean*, optional, default: `true`): Whether to include top SHAP explanatory risk factors per student
- **Description**: Vectorized high-speed batch prediction for an entire class (40–120 students in ~0.08s). Returns aggregated class risk analytics, predicted grade distribution, common class-level risk drivers, and student rankings sorted descending by `fail_probability` (highest risk first), enriched with course metadata, section, lecturer name, and student names from the database.
- **Response (`200 OK`)**: `ClassPredictionResponse`
  ```json
  {
    "class_id": "HK261_CO1023_L02",
    "course_code": "CO1023",
    "course_name": "Hệ thống số",
    "credits": 3,
    "class_group": "L02",
    "lecturer_name": "Đặng Anh Phúc",
    "semester_code": "HK261",
    "inference_time_ms": 78.78,
    "analytics": {
      "total_students": 40,
      "high_risk_count": 2,
      "medium_risk_count": 5,
      "low_risk_count": 33,
      "high_risk_rate": 0.05,
      "average_predicted_score10": 7.82,
      "average_predicted_gpa4": 3.21,
      "grade_distribution": {
        "A": 11,
        "B+": 6,
        "B": 15,
        "C+": 6,
        "C": 2,
        "D+": 0,
        "D": 0,
        "F": 0
      },
      "top_class_risk_factors": [
        {
          "feature": "lab",
          "mean_shap": 0.1716,
          "impact": "INCREASE_RISK",
          "description": "Điểm bài tập thực hành/thí nghiệm (lab) dưới mức trung bình là yếu tố rủi ro cao nhất đối với sinh viên lớp này."
        }
      ]
    },
    "students": [
      {
        "student_id": "2642009",
        "student_name": "Nguyễn Văn C",
        "fail_probability": 0.952,
        "predicted_course_fail": 1,
        "is_at_risk": true,
        "risk_level": "HIGH",
        "predicted_score10": 3.5,
        "predicted_gpa4": 1.0,
        "predicted_letter_grade": "D",
        "current_marks": {
          "quiz": 3.0,
          "lab": 2.5,
          "btl": null,
          "giua_ky": 4.0,
          "cuoi_ky": null
        },
        "top_shap_factors": [
          {
            "feature": "lab",
            "value": 2.5,
            "shap_value": 0.42,
            "impact": "INCREASE_RISK",
            "description": "Điểm lab (2.5) thấp làm tăng nguy cơ rớt môn."
          }
        ]
      }
    ]
  }
  ```
- **Error Codes**:
  - `401 Unauthorized`: Token invalid or expired.
  - `403 Forbidden`: Authenticated user is a student, or a lecturer attempting to view a class they do not teach (`{"detail": "Access forbidden: lecturers can only access predictions for classes they teach"}`).
  - `404 Not Found`: Class ID not found in database or model cache (`{"detail": "Class 'HK261_CO1023_L99' not found in database"}`).
  - `503 Service Unavailable`: AI Model Service is unreachable or timed out.

---

### Academic Advising & Two-Way Messaging

#### 1. Get Unread Notification Count
- **Endpoint**: `GET /api/v1/advising/unread-count`
- **Auth Required**: Yes (Student or Lecturer)
- **Response (`200 OK`)**:
  ```json
  {
    "unread_count": 2
  }
  ```

---

#### 2. List Advising Sessions
- **Endpoint**: `GET /api/v1/advising/sessions`
- **Auth Required**: Yes (Returns sessions involving the authenticated user)
- **Response (`200 OK`)**: Array of `AdvisingSessionResponse`
  ```json
  [
    {
      "id": "3a9cbc45-0811-4655-9486-0873774e3a7b",
      "student_id": "2028899",
      "student_name": "Trần Quang Hiếu",
      "lecturer_id": "GV00001",
      "lecturer_name": "Ngô Quốc An",
      "course_code": "CO1005",
      "course_name": "Nhập môn Điện toán",
      "semester_code": "HK261",
      "topic": "Cố vấn can thiệp rủi ro giữa kỳ",
      "risk_level": "CRITICAL",
      "status": "ACTIVE",
      "unread_count": 1,
      "last_message": {
        "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "session_id": "3a9cbc45-0811-4655-9486-0873774e3a7b",
        "sender_id": "GV00001",
        "sender_role": "lecturer",
        "sender_name": "Ngô Quốc An",
        "message_type": "NOTICE",
        "content": "Em cần chú ý ôn tập kỹ phần bài tập lớn và lý thuyết giữa kỳ nhé.",
        "attachments": null,
        "is_read": false,
        "read_at": null,
        "created_at": "2026-11-19T14:30:00Z"
      },
      "last_message_at": "2026-11-19T14:30:00Z",
      "created_at": "2026-11-19T14:00:00Z",
      "updated_at": "2026-11-19T14:30:00Z"
    }
  ]
  ```

---

#### 3. Create or Retrieve Advising Session (get_or_create)
- **Endpoint**: `POST /api/v1/advising/sessions`
- **Auth Required**: Yes (Student or Lecturer)
- **Request Body**:
  ```json
  {
    "student_id": "2028899",
    "course_code": "CO1005",
    "semester_code": "HK261",
    "topic": "Cố vấn can thiệp rủi ro giữa kỳ",
    "risk_level": "CRITICAL",
    "lecturer_id": "GV00001"
  }
  ```
- **Response (`201 Created` or `200 OK`)**: `AdvisingSessionResponse`

---

#### 4. List Messages in Session (Auto-Marks Unread as Read)
- **Endpoint**: `GET /api/v1/advising/sessions/{session_id}/messages`
- **Auth Required**: Yes (Session owner only)
- **Query Parameters**:
  - `limit` (*integer*, optional, default: 50, max: 100)
  - `offset` (*integer*, optional, default: 0)
- **Response (`200 OK`)**: Array of `AdvisingMessageResponse`

---

#### 5. Send Message / Notice inside Session
- **Endpoint**: `POST /api/v1/advising/sessions/{session_id}/messages`
- **Auth Required**: Yes (Session owner only)
- **Request Body**:
  ```json
  {
    "content": "Dạ Thầy cho em xin tài liệu tham khảo thêm với ạ!",
    "message_type": "REPLY",
    "attachments": null
  }
  ```
- **Response (`201 Created`)**: `AdvisingMessageResponse`

---

#### 6. List Appointments in Session
- **Endpoint**: `GET /api/v1/advising/sessions/{session_id}/appointments`
- **Auth Required**: Yes (Session owner only)
- **Response (`200 OK`)**: Array of `AdvisingAppointmentResponse`

---

#### 7. Create Appointment
- **Endpoint**: `POST /api/v1/advising/sessions/{session_id}/appointments`
- **Auth Required**: Yes (Session owner only)
- **Request Body**:
  ```json
  {
    "subject": "Gặp trực tiếp tư vấn phương án ôn thi",
    "time_slot": "Thứ Năm: 14:00 - 15:00",
    "meeting_type": "OFFICE",
    "location": "P.503 Nhà H6",
    "notes": "Mang theo đề cương chi tiết"
  }
  ```
- **Response (`201 Created`)**: `AdvisingAppointmentResponse`

---

#### 8. Update Appointment Status
- **Endpoint**: `PATCH /api/v1/advising/appointments/{appointment_id}/status`
- **Auth Required**: Yes (Session owner only)
- **Request Body**:
  ```json
  {
    "status": "CONFIRMED"
  }
  ```
- **Response (`200 OK`)**: `AdvisingAppointmentResponse`

---

#### 9. List Action Tasks in Session
- **Endpoint**: `GET /api/v1/advising/sessions/{session_id}/tasks`
- **Auth Required**: Yes (Session owner only)
- **Response (`200 OK`)**: Array of `AdvisingActionTaskResponse`

---

#### 10. Assign Action Task
- **Endpoint**: `POST /api/v1/advising/sessions/{session_id}/tasks`
- **Auth Required**: Yes (Session owner only)
- **Request Body**:
  ```json
  {
    "title": "Hoàn thành bài tập tuần 10",
    "description": "Nộp bài lên hệ thống BKeL",
    "deadline": "30/11/2026",
    "priority": "HIGH"
  }
  ```
- **Response (`201 Created`)**: `AdvisingActionTaskResponse`

---

#### 11. Toggle Action Task Completion
- **Endpoint**: `PATCH /api/v1/advising/tasks/{task_id}/toggle`
- **Auth Required**: Yes (Session owner only)
- **Request Body**:
  ```json
  {
    "completed": true
  }
  ```
- **Response (`200 OK`)**: `AdvisingActionTaskResponse`

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
// Admin Types
// ==========================================
export interface Admin {
  admin_id: string;
  department: string;
  user_id: string | null;
}

export interface AdminDetail extends Admin {
  user: User | null;
}

export interface AdminCreatePayload {
  admin_id: string;
  department?: string;
  user_id?: string | null;
}

export interface AdminUpdatePayload {
  department?: string;
  user_id?: string | null;
}

// ==========================================
// Student Types
// ==========================================
export interface Student {
  student_id: string;
  cohort: string;
  major: string;
  program: string | null;
  specialization: string | null;
  english_pass: boolean | null;
  ctxh_days: number | null;
  user_id: string | null;
}

export interface StudentDetail extends Student {
  user: User | null;
}

export interface StudentCreatePayload {
  student_id: string;
  cohort: string;
  major: string;
  program?: string | null;
  specialization?: string | null;
  english_pass?: boolean | null;
  ctxh_days?: number | null;
  user_id?: string | null;
}

export interface StudentUpdatePayload {
  cohort?: string;
  major?: string;
  program?: string | null;
  specialization?: string | null;
  english_pass?: boolean | null;
  ctxh_days?: number | null;
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

export interface LecturerCurrentClassItem {
  class_id: string;
  class_group: string;
  course_code: string;
  course_name: string;
  credits: number;
  semester_code: string;
  academic_year: string | null;
  term: number | null;
  total_students: number;
}

// ==========================================
// Course, Assessment & Prerequisite Types
// ==========================================
export interface CourseAssessment {
  course_code: string;
  course_category: string | null;
  quiz: number;
  lab: number;
  btl: number;
  giua_ky: number;
  cuoi_ky: number;
}

export interface CourseAssessmentPayload {
  course_code: string;
  course_category?: string | null;
  quiz?: number;
  lab?: number;
  btl?: number;
  giua_ky?: number;
  cuoi_ky?: number;
}

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
  assessment: CourseAssessment | null;
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
// Curriculum & Knowledge Block Types
// ==========================================
export interface Curriculum {
  curriculum_id: string;
  curriculum_name: string;
  major_code: string;
  major_name: string;
  cohort: string;
  academic_year_start: number | null;
  total_credits: number | null;
  base_curriculum_id: string | null;
  faculty: string | null;
}

export interface KnowledgeBlock {
  block_id: string;
  block_code: string | null;
  block_name_vi: string;
  block_name_en: string | null;
  category: string | null;
  required_credits: number | null;
  description: string | null;
}

export interface ProgramStructure {
  structure_id: number;
  curriculum_id: string | null;
  course_code: string | null;
  block_id: string | null;
  course_type: string | null; // 'BB', 'TC'
  elective_group: string | null;
  specialization: string | null;
  credits: number | null;
  recommended_semester: string | null;
  prerequisites: string | null;
}

export interface ProgramStructureDetail extends ProgramStructure {
  curriculum?: Curriculum | null;
  knowledge_block?: KnowledgeBlock | null;
}

export interface CurriculumDetail extends Curriculum {
  structures: ProgramStructureDetail[];
}

export interface CurriculumCreatePayload {
  curriculum_id: string;
  curriculum_name: string;
  major_code: string;
  major_name: string;
  cohort: string;
  academic_year_start?: number | null;
  total_credits?: number | null;
  base_curriculum_id?: string | null;
  faculty?: string | null;
}

export interface KnowledgeBlockCreatePayload {
  block_id: string;
  block_code?: string | null;
  block_name_vi: string;
  block_name_en?: string | null;
  category?: string | null;
  required_credits?: number | null;
  description?: string | null;
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
  final_score: number | null; // Standard 0.0-10.0, or 12.0 for English exemption (Exempted)
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

// ==========================================
// Prediction & Explainable AI (XAI) Types
// ==========================================
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type FeatureImpact = 'INCREASE_RISK' | 'DECREASE_RISK';

export interface ShapFactor {
  feature: string;
  shap_value: number;
  impact: FeatureImpact;
  description: string;
}

export interface CoursePrediction {
  course_code: string;
  course_name: string | null;
  credits: number | null;
  class_id: string | null;
  class_group: string | null;
  lecturer_name: string | null;
  semester_code: string;
  record_status: string | null;
  fail_probability: number;
  predicted_course_fail: number; // 0 (Pass) or 1 (Fail)
  is_at_risk: boolean;
  risk_level: RiskLevel;
  predicted_score10: number;
  predicted_gpa4: number;
  current_marks: {
    quiz: number | null;
    lab: number | null;
    btl: number | null;
    giua_ky: number | null;
  };
  top_shap_factors: ShapFactor[];
}

export interface StudentPrediction {
  student_id: string;
  semester_code: string;
  total_courses: number;
  at_risk_count: number;
  predicted_semester_gpa4: number;
  courses: CoursePrediction[];
}

export interface PredictCoursePayload {
  student_id: string;
  course_code: string;
  semester_code?: string | null;
}

export interface PredictStudentPayload {
  student_id: string;
  semester_code?: string | null;
}

export interface ModelHealth {
  status: string;
  service: string;
  model_status: 'loaded' | 'not_loaded';
  fail_threshold: number;
  total_records_cached: number;
  metrics: Record<string, any>;
}

export interface ClassRiskFactor {
  feature: string;
  mean_shap: number;
  impact: FeatureImpact;
  description: string;
}

export interface ClassRiskAnalytics {
  total_students: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  high_risk_rate: number;
  average_predicted_score10: number;
  average_predicted_gpa4: number;
  grade_distribution: Record<string, number>;
  top_class_risk_factors: ClassRiskFactor[];
}

export interface ClassStudentPrediction {
  student_id: string;
  student_name: string | null;
  fail_probability: number;
  predicted_course_fail: number;
  is_at_risk: boolean;
  risk_level: RiskLevel;
  predicted_score10: number;
  predicted_gpa4: number;
  predicted_letter_grade: string;
  current_marks: Record<string, number | null>;
  top_shap_factors: ShapFactor[];
}

export interface ClassPrediction {
  class_id: string;
  course_code: string;
  course_name: string | null;
  credits: number | null;
  class_group: string | null;
  lecturer_name: string | null;
  semester_code: string;
  inference_time_ms: number;
  analytics: ClassRiskAnalytics;
  students: ClassStudentPrediction[];
}

export interface PredictClassPayload {
  class_id: string;
  include_shap?: boolean;
}

// ==========================================
// Academic Advising & Messaging Types
// ==========================================
export type AdvisingRiskLevel = 'CRITICAL' | 'WARNING' | 'SAFE';
export type AdvisingSessionStatus = 'ACTIVE' | 'RESOLVED' | 'CLOSED';
export type AdvisingMessageType = 'NOTICE' | 'REPLY' | 'TASK_NOTICE' | 'APPOINTMENT_NOTICE';
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'NORMAL';

export interface AdvisingMessage {
  id: string; // UUID
  session_id: string; // UUID
  sender_id: string;
  sender_role: 'student' | 'lecturer' | 'admin' | string;
  sender_name: string;
  message_type: AdvisingMessageType;
  content: string;
  attachments?: any | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface AdvisingSession {
  id: string; // UUID
  student_id: string;
  student_name?: string | null;
  lecturer_id: string;
  lecturer_name?: string | null;
  course_code: string;
  course_name?: string | null;
  semester_code: string;
  topic: string;
  risk_level: AdvisingRiskLevel;
  status: AdvisingSessionStatus;
  unread_count: number;
  last_message?: AdvisingMessage | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdvisingSessionCreatePayload {
  student_id: string;
  course_code: string;
  semester_code?: string;
  topic: string;
  risk_level?: AdvisingRiskLevel;
  lecturer_id?: string;
}

export interface AdvisingMessageCreatePayload {
  content: string;
  message_type?: AdvisingMessageType;
  attachments?: any | null;
}

export interface AdvisingAppointment {
  id: string; // UUID
  session_id: string; // UUID
  student_id: string;
  lecturer_id: string;
  course_code: string;
  subject: string;
  time_slot: string;
  meeting_type: 'OFFICE' | 'ONLINE';
  location: string;
  notes?: string | null;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export interface AdvisingAppointmentCreatePayload {
  subject: string;
  time_slot: string;
  meeting_type?: 'OFFICE' | 'ONLINE';
  location: string;
  notes?: string | null;
}

export interface AdvisingActionTask {
  id: string; // UUID
  session_id: string; // UUID
  student_id: string;
  lecturer_id: string;
  course_code: string;
  title: string;
  description?: string | null;
  deadline: string;
  priority: TaskPriority;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
}

export interface AdvisingActionTaskCreatePayload {
  title: string;
  description?: string | null;
  deadline: string;
  priority?: TaskPriority;
}

export interface UnreadCountResponse {
  unread_count: number;
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
