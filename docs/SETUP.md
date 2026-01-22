# Setup & Installation Guide

## Prerequisites

### Required Software
- **Node.js** 20+ ([Download](https://nodejs.org))
- **SQL Server Express** ([Download](https://www.microsoft.com/en-us/sql-server/sql-server-downloads))
- **MongoDB** ([Download](https://www.mongodb.com/try/download/community))

### Recommended Tools
- **SQL Server Management Studio (SSMS)** - For database management
- **MongoDB Compass** - For MongoDB GUI
- **Git** - For version control

---

## Database Setup

### 1. SQL Server Configuration

**Port:** `2433`
**User:** `sa`
**Password:** `Cloverfield161185!`

1. Start SQL Server on port 2433
2. Run the initialization script:

```bash
cd backend-auth
sqlcmd -S 127.0.0.1,2433 -U sa -P "Cloverfield161185!" -i scripts/init-database.sql
```

This creates:
- Database: `hackergame_auth`
- Tables: `Users`, `Sessions`

### 2. MongoDB Configuration

**Port:** `2434`
**User:** `admin`
**Password:** `cloverfield161185`
**Database:** `hackergame_world`

MongoDB collections are created automatically:
- `computers`
- `filesystems`
- `playeraccesses`

---

## Backend Setup

### 1. Install Dependencies

```bash
cd backend-auth
npm install
```

### 2. Environment Configuration

The `.env` file is already configured:

```env
PORT=3000
NODE_ENV=development

# SQL Server
SQL_HOST=127.0.0.1
SQL_PORT=2433
SQL_USER=sa
SQL_PASSWORD=Cloverfield161185!
SQL_DATABASE=hackergame_auth

# MongoDB
MONGODB_URI=mongodb://admin:cloverfield161185@127.0.0.1:2434/hackergame_world?authSource=admin

# JWT
JWT_SECRET=hackergame_super_secret_key_change_in_production_2024
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 3. Start Backend Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

Server will run on: `http://localhost:3000`

### 4. Verify Backend

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","service":"backend-auth","timestamp":"..."}
```

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend-game
npm install
```

### 2. Environment Configuration

The `.env` file is already configured:

```env
VITE_API_URL=http://localhost:3000
```

### 3. Start Frontend

```bash
npm run dev
```

Frontend will run on: `http://localhost:5173`

---

## Testing the Setup

### 1. Register a New User

**Via Frontend:**
1. Open `http://localhost:5173`
2. Click "Register"
3. Fill in username, email, password
4. Submit

**Via API (curl):**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "hacker1",
    "email": "hacker1@test.com",
    "password": "securepass123"
  }'
```

### 2. Login

**Via Frontend:**
1. Go to login page
2. Enter email and password
3. You'll be redirected to dashboard

**Via API (curl):**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hacker1@test.com",
    "password": "securepass123"
  }'
```

### 3. Access Dashboard

After login, you should see:
- Your user information
- Your computer details (IP, credentials)
- Terminal placeholder

---

## Troubleshooting

### SQL Server Connection Failed

**Error:** `Failed to connect to 127.0.0.1:2433`

**Solutions:**
1. Verify SQL Server is running
2. Check port 2433 is correct
3. Verify firewall allows connection
4. Test with: `sqlcmd -S 127.0.0.1,2433 -U sa -P "Cloverfield161185!"`

### MongoDB Connection Failed

**Error:** `MongoDB connection failed`

**Solutions:**
1. Verify MongoDB is running on port 2434
2. Check credentials are correct
3. Verify `admin` user exists with password
4. Test with: `mongosh mongodb://admin:cloverfield161185@127.0.0.1:2434`

### CORS Errors

**Error:** `Access to XMLHttpRequest has been blocked by CORS policy`

**Solutions:**
1. Verify backend CORS_ORIGIN matches frontend URL
2. Check frontend is running on `http://localhost:5173`
3. Restart both servers after config changes

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Solutions:**
1. Kill existing process on port
   - Backend: `npx kill-port 3000`
   - Frontend: `npx kill-port 5173`
2. Change port in .env files

---

## Project Structure

```
hackgame/
├── backend-auth/           # Backend API
│   ├── src/
│   │   ├── config/        # Database connections
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth middleware
│   │   ├── models/        # MongoDB schemas
│   │   ├── routes/        # API routes
│   │   └── server.js      # Entry point
│   ├── scripts/           # DB initialization
│   ├── .env               # Environment variables
│   └── package.json
│
├── frontend-game/         # Frontend React app
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── contexts/      # Auth context
│   │   ├── pages/         # Login, Register, Dashboard
│   │   ├── services/      # API client
│   │   └── App.tsx        # Main app
│   ├── .env               # Frontend config
│   └── package.json
│
├── docs/                  # Documentation
│   ├── API.md            # API documentation
│   └── SETUP.md          # This file
│
└── README.md             # Project index
```

---

## Next Steps

After successful setup, you can:

1. **Explore the Dashboard** - View your user and computer info
2. **Check Database** - See created users in SQL Server and computers in MongoDB
3. **Read API Docs** - See [API.md](./API.md) for all endpoints
4. **Continue Development** - Add filesystem API, terminal, game features

For more details on the project architecture and roadmap, see the `planning/` folder.
