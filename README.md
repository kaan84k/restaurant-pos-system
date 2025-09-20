# Restaurant POS System

This repository contains a Point-of-Sale (POS) system for restaurants, consisting of two main projects:

- **pos-api**: Backend API built with Node.js, TypeScript, and Prisma ORM.
- **pos-register**: Frontend register application built with React, TypeScript, and Vite.

## Getting Started

### Prerequisites
- Node.js (v18 or newer recommended)
- npm or yarn
- (Optional) PostgreSQL or SQLite for database

### Setup

#### 1. Clone the repository
```bash
git clone https://github.com/kaan84k/restaurant-pos-system.git
cd restaurant-pos-system
```

#### 2. Install dependencies
```bash
cd pos-api
npm install
cd ../pos-register
npm install
```

#### 3. Configure environment variables
- Copy `.env.example` to `.env` in both `pos-api` and `pos-register` folders and update values as needed.

#### 4. Database setup (pos-api)
- Update `prisma/schema.prisma` as needed.
- Run migrations:
```bash
npx prisma migrate dev
```

#### 5. Start the backend
```bash
cd pos-api
npm run dev
```

#### 6. Start the frontend
```bash
cd pos-register
npm run dev
```

## Project Structure
- `pos-api/`: Backend API
- `pos-register/`: Frontend register app

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
Specify your license here (e.g., MIT, Apache-2.0).
