# API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
Most endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### Health Check
**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "service": "backend-auth",
  "timestamp": "2025-10-10T03:09:31.039Z"
}
```

---

### Register User
**POST** `/auth/register`

Create a new user account with initial computer setup.

**Request Body:**
```json
{
  "username": "hacker123",
  "email": "hacker@example.com",
  "password": "securepass123"
}
```

**Validation:**
- `username`: Required, unique
- `email`: Required, unique, valid email format
- `password`: Required, minimum 6 characters

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGci...",
  "user": {
    "id": 1,
    "username": "hacker123",
    "email": "hacker@example.com"
  },
  "computer": {
    "ip": "45.126.219.165",
    "name": "Desktop PC",
    "credentials": {
      "username": "user",
      "password": "Ek3HE9AMEd"
    }
  }
}
```

**Error Responses:**
- `400`: Missing required fields or password too short
- `409`: User already exists

---

### Login
**POST** `/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "hacker@example.com",
  "password": "securepass123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGci...",
  "user": {
    "id": 1,
    "username": "hacker123",
    "email": "hacker@example.com"
  },
  "computer": {
    "ip": "45.126.219.165",
    "name": "Desktop PC"
  }
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials

---

### Get Current User
**GET** `/auth/me`

Get authenticated user information and associated computers.

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "user": {
    "id": 1,
    "username": "hacker123",
    "email": "hacker@example.com",
    "createdAt": "2025-10-09T09:51:58.297Z",
    "lastLogin": "2025-10-10T03:10:13.260Z"
  },
  "computers": [
    {
      "ip": "45.126.219.165",
      "name": "Desktop PC",
      "username": "user",
      "hasRootAccess": true
    }
  ]
}
```

**Error Responses:**
- `401`: No token provided or invalid token
- `404`: User not found

---

## Error Handling

All error responses follow this format:

```json
{
  "error": "Error message here"
}
```

### Common Error Codes
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `500` - Internal Server Error

---

## JWT Token

**Format:**
```
Authorization: Bearer <token>
```

**Expiration:** 7 days

**Payload:**
```json
{
  "userId": 1,
  "username": "hacker123",
  "email": "hacker@example.com",
  "iat": 1760065812,
  "exp": 1760670612
}
```

---

## Database Models

### User (SQL Server)
- `id` - Integer, Primary Key
- `username` - String, Unique
- `email` - String, Unique
- `password_hash` - String
- `created_at` - DateTime
- `last_login` - DateTime
- `is_active` - Boolean

### Computer (MongoDB)
- `type` - String (player_pc, npc_server, router, bank_server)
- `name` - String
- `ip` - String, Unique
- `hardware` - Object (cpu, ram, disk, gpu, network)
- `accounts` - Array (username, passwordHash, permissions)
- `security` - Object (firewall, encryption, ports)

### Filesystem (MongoDB)
- `computerId` - ObjectId (ref: Computer)
- `path` - String
- `type` - String (directory)
- `owner` - String
- `permissions` - String
- `children` - Object (files and subdirectories)

### PlayerAccess (MongoDB)
- `userId` - Integer (SQL Server user ID)
- `computerId` - ObjectId (ref: Computer)
- `username` - String
- `password` - String (plain text - known by player)
- `hasRootAccess` - Boolean
