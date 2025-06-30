# User Management API

A simple RESTful API for managing users with CRUD operations, built with Node.js and Express.js.

## Features

- Create, Read, Update, and Delete users
- Input validation for all fields
- Proper HTTP status codes and error handling
- In-memory data storage (resets on server restart)
- CORS enabled

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

### Create User(s)

#### Create a Single User
- **URL**: `POST /api/users`
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "age": 25
  }
  ```
- **Success Response**: 201 Created
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "age": 25
  }
  ```

#### Create Multiple Users (Bulk)
- **URL**: `POST /api/users`
- **Request Body**:
  ```json
  [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "age": 25
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "age": 30
    }
  ]
  ```
- **Success Response (All users created)**: 201 Created
  ```json
  {
    "message": "All users created successfully",
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "email": "john@example.com",
        "age": 25
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "age": 30
      }
    ]
  }
  ```
- **Partial Success Response**: 207 Multi-Status
  ```json
  {
    "message": "Some users were not created",
    "created": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "John Doe",
        "email": "john@example.com",
        "age": 25
      }
    ],
    "errors": [
      {
        "index": 1,
        "error": "Email already exists"
      }
    ]
  }
  ```

### Get All Users
- **URL**: `GET /api/users`
- **Success Response**: 200 OK
  ```json
  [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "age": 25
    }
  ]
  ```

### Get a Single User
- **URL**: `GET /api/users/:id`
- **Success Response**: 200 OK
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "john@example.com",
    "age": 25
  }
  ```
- **Error Response**: 404 Not Found
  ```json
  {
    "error": "User not found"
  }
  ```

### Update a User
- **URL**: `PUT /api/users/:id`
- **Request Body**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "age": 26
  }
  ```
- **Success Response**: 200 OK
  ```json
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "age": 26
  }
  ```

### Delete a User
- **URL**: `DELETE /api/users/:id`
- **Success Response**: 204 No Content
- **Error Response**: 404 Not Found
  ```json
  {
    "error": "User not found"
  }
  ```

## Error Handling

- **400 Bad Request**: Invalid input data or malformed request
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Unexpected server error

## Validation Rules

- **Name**: Required, at least 1 character
- **Email**: Must be a valid email format
- **Age**: Must be a number between 1 and 120
