# DevBoard - Real-time Collaborative Code Editor

A modern collaborative code editor with real-time synchronization, comments, and PostgreSQL persistence.

## Features

- Real-time code collaboration with multiple users
- Live cursor tracking and user presence
- Comment system with line-specific annotations
- PostgreSQL database persistence for code and comments
- Modern dark theme UI
- Room-based collaboration system

## Tech Stack

### Frontend
- Next.js 15 with TypeScript
- Monaco Editor (VS Code editor)
- Socket.IO client
- TailwindCSS styling

### Backend
- Node.js with TypeScript
- Express.js
- Socket.IO
- Prisma ORM
- PostgreSQL

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd DevBoard
```

2. Install dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. Set up environment variables
```bash
# In backend/.env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
```

4. Set up database
```bash
cd backend
npx prisma db push
npx prisma generate
```

5. Start development servers
```bash
# Backend (port 5000)
cd backend
npm run dev

# Frontend (port 3000)
cd frontend
npm run dev
```

6. Open http://localhost:3000 in your browser

## Usage

1. **Create Room**: Click "Create New Room" to generate a unique room ID
2. **Share Room**: Copy the room ID or URL and share with collaborators
3. **Join Room**: Enter room ID and click "Join Room"
4. **Collaborate**: Edit code in real-time, see other users' cursors
5. **Add Comments**: Right-click on a line to add comments

## Database Schema

The application uses PostgreSQL with the following main models:

- **Room**: Stores room ID, code content, and metadata
- **Comment**: Stores line-specific comments with user information
- **User**: Tracks user sessions and socket connections

## API Endpoints

The application uses Socket.IO for real-time communication:

- `join-room`: Join a collaborative room
- `code-change`: Broadcast code changes to all users
- `add-comment`: Add line-specific comments
- `cursor-move`: Share cursor position
- `disconnecting`: Handle user disconnection

## Development

### Project Structure
```
DevBoard/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── socket/          # Socket handlers
│   │   ├── utils/           # Database utilities
│   │   └── server.ts        # Main server
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── room/[roomId]/  # Room page
│   │   │   ├── page.tsx        # Landing page
│   │   │   ├── layout.tsx      # HTML layout
│   │   │   └── globals.css     # Global styles
│   │   └── ...
│   └── package.json
└── README.md
```

### Database Commands
```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# View database
npx prisma studio
```

## Production Deployment

1. Build the frontend
```bash
cd frontend
npm run build
```

2. Set production environment variables
```bash
NODE_ENV=production
DATABASE_URL="postgresql://..."
```

3. Start production server
```bash
cd backend
npm start
```
