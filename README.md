# Training Management System

A full-stack training management system for managing student applications, courses, batches, attendance, grades, invoices, and reports in one place.

## Overview

This project includes:

- A React + Vite frontend for the user interface
- An Express backend for application logic and REST APIs
- Supabase integration for data storage and auth-related workflows
- Role-based access for staff, students, instructors, and admins

## Features

- Student application tracking
- Course and batch management
- Instructor and asset management
- Attendance tracking
- Grade management
- Invoice and payment visibility
- Notifications and dashboard reporting
- Admin and audit access
- Protected routes based on user roles

## Tech Stack

### Frontend
- React 18
- Vite
- React Router DOM
- Tailwind CSS
- Supabase client
- Axios

### Backend
- Node.js
- Express
- Helmet, CORS, rate limiting
- Supabase client
- Express Validator

## Project Structure

```text
Training-Management-System/
├── backend/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── .gitignore
├── README.md
└── LICENSE
```

## Prerequisites

Before running the project, make sure you have:

- Node.js 18 or later
- npm
- A Supabase project

## Environment Setup

### Backend

Create a `.env` file in `backend/` using the sample file:

```bash
cp backend/.env.example backend/.env
```

Update the values with your Supabase project URL and keys:

```env
PORT=4000
NODE_ENV=production
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=public-anon-key
CORS_ORIGINS=http://localhost:5173
```

### Frontend

Create a `.env` file in `frontend/` using the sample file:

```bash
cp frontend/.env.example frontend/.env
```

Example:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key
VITE_API_URL=http://localhost:4000
```

## Running the App

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start the backend

```bash
cd backend
npm run dev
```

The backend runs on:

```text
http://localhost:4000
```

### 3. Start the frontend

```bash
cd frontend
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

## Main Routes

The app includes routes for:

- `/login` and `/register`
- Dashboard
- Notifications
- Applications
- Students
- Courses
- Instructors
- Assets
- Batches
- Reports
- Invoices
- Attendance
- Grades
- My Profile
- Admin and audit views

## API Health Check

The backend exposes a health endpoint:

```bash
curl http://localhost:4000/health
```

Expected response:

```json
{ "ok": true }
```

## Notes

- The application uses role-based route protection for access control.
- Frontend and backend are separated into distinct folders for cleaner development.
- Supabase configuration is expected for data and auth integrations.

## License

This project is currently unlicensed unless otherwise noted in the repository.

## Contributing

Feel free to fork the repository and submit pull requests for fixes, improvements, or new features.
