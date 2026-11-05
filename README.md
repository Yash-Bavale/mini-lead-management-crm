# Mini Lead Management CRM

A full-stack CRM with a public lead form and a protected admin dashboard.

## Stack
- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Authentication: JWT + bcrypt

## Requirements
Node.js 20+, npm, and a PostgreSQL database (local PostgreSQL or Neon).

## 1. Configure the backend
```bash
cd server
cp .env.example .env
```
Edit `server/.env` and set:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: a long random secret
- `CLIENT_ORIGIN`: frontend URL (local development uses http://localhost:5173)

Install and initialize:
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```
The API runs at `http://localhost:5000`.

Seed admin (development only):
- Email: `admin@example.com`
- Password: `ChangeMe123!`

Change these credentials before deployment. The seed script reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

## 2. Configure the frontend
In a second terminal:
```bash
cd client
cp .env.example .env
npm install
npm run dev
```
Open `http://localhost:5173`.

## 3. Main API routes
Public:
- `POST /api/leads` — create a lead

Admin (requires `Authorization: Bearer <token>`):
- `POST /api/auth/login` — admin login
- `GET /api/auth/me` — current admin
- `GET /api/leads` — list/search/filter leads
- `GET /api/leads/stats` — dashboard counts
- `GET /api/leads/:id` — lead details
- `PATCH /api/leads/:id` — update status and/or internal remarks

See [API.md](./API.md) for request and response examples.

## 4. Database
Prisma schema: `server/prisma/schema.prisma`

Tables:
- `Admin`: admin email and password hash
- `Lead`: customer contact details, selected service, status, internal remarks and timestamps

Apply later schema changes with a new migration:
```bash
cd server
npx prisma migrate dev --name describe_your_change
```

## 5. Production deployment outline
1. Create a PostgreSQL database on Neon and copy its connection string.
2. Deploy `server` to Render. Set `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Set the Render build command to `npm install && npx prisma generate`.
4. Set the Render start command to `npx prisma migrate deploy && npm start`.
5. Seed the first admin once using a secure one-off shell command (`npm run seed`) or a controlled deployment task. Do not leave a default password in production.
6. Deploy `client` to Vercel. Set `VITE_API_URL` to the deployed backend URL, without a trailing slash.
7. Set the backend `CLIENT_ORIGIN` to the deployed frontend URL.
8. Test the public form, login, protected routes, search, filters and status updates on the live URLs.

Never commit `.env` files. Use the included `.env.example` files as templates.

## 6. Testing checklist
- Submit a valid lead and verify it appears in PostgreSQL and the admin list.
- Try blank required fields, malformed email and invalid mobile number.
- Confirm the submit button disables while saving.
- Log out and verify admin API routes return 401.
- Log in and verify the dashboard statistics.
- Search by customer name and mobile.
- Filter by service and each status.
- Open a lead, update its status and add an internal remark.
- Refresh the page and confirm changes persist.

## Project structure
```text
mini-lead-management-crm/
├── client/                 # React application
├── server/                 # Express API
├── API.md
└── README.md
```
