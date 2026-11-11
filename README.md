# School Admission Reservation System

A high-concurrency online school admission and seat reservation system designed for private school admissions. Built with **ASP.NET Core Minimal APIs (.NET 10)**, **Entity Framework Core**, **PostgreSQL 16**, and a **Vite + React (TypeScript)** frontend.

The system solves the critical concurrency challenge of **flash-crowd admission openings**: when thousands of guardians apply for limited seats at the exact same moment, the system **never oversells a seat** and enforces strict first-come-first-served allocation.

---

## Quick Start (Only Docker Required)

You do not need to install .NET, Node.js, or PostgreSQL locally. Docker Compose orchestrates the entire stack (database, migrations, backend API, and frontend).

### 1. Start the Complete Application

Clone this repository and run from the project root:

```bash
docker compose up --build
```

Wait until all services are healthy and running:
- **Frontend SPA**: [http://localhost:3000](http://localhost:3000)
- **Backend REST API**: [http://localhost:8080](http://localhost:8080)
- **PostgreSQL Database**: Port `5434` on host (`5432` internal)

### 2. Stop the Application

```bash
# Stops containers and preserves all database records in the pgdata volume
docker compose down

# To reset and delete all persistent database records:
docker compose down -v
```

---

## Running the Automated Tests

The test suite includes a **50-request concurrent race condition test** executing against real PostgreSQL to mathematically prove that parallel applications never exceed class capacity.

### Run Tests via Docker (Recommended)

```bash
docker compose --profile test run --rm backend-tests
```

### Run Tests Locally (Using .NET SDK)

With PostgreSQL running (on port `5434`), execute:

```bash
dotnet test backend/SchoolAdmission.Tests/SchoolAdmission.Tests.csproj
```

---

## System Configuration Options

All configuration is controlled via environment variables:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `HOLD_DURATION_SECONDS` | `600` (10 mins) | Time window a seat is held before expiring back to the pool. |
| `ConnectionStrings__DefaultConnection` | Pre-configured | PostgreSQL connection string. |
| `RUN_MIGRATIONS` | `true` | Automatically applies pending EF Core migrations on backend startup. |
| `VITE_API_URL` | `http://localhost:8080` | Backend API URL accessed directly by the browser. |

### Testing with a Short Hold Window (e.g. 30 seconds)

```bash
HOLD_DURATION_SECONDS=30 docker compose up --build
```

---

## Architecture & Engineering Design

```
Browser (localhost:3000)
   │
   │ fetch() with X-Student-Id
   ▼
Backend API (localhost:8080)
   ├── Endpoints Layer (ClassEndpoints.cs, HoldEndpoints.cs)
   ├── Service Layer   (SeatService.cs — ALL business rules & row locking)
   └── Data Layer      (AppDbContext.cs — EF Core Npgsql)
           │
           ▼ (SELECT ... FOR UPDATE)
PostgreSQL 16 (Port 5434 / 5432)
```

### Key Engineering Decisions

1. **PostgreSQL Row-Level Locking (`SELECT ... FOR UPDATE`)**:
   - Rather than unreliable in-memory locks (`lock` or `SemaphoreSlim`) that fail across multiple processes, every `Apply`, `Confirm`, and `Cancel` acquires an exclusive row-level lock on the target class row inside a short database transaction.
   - Incoming requests pass through one by one; under PostgreSQL's default `Read Committed` isolation level, subsequent transactions immediately see committed hold counts.
   - This natively enables running multiple backend replicas (`backend` and `backend2`) sharing one database without race conditions.

2. **Zero-Daemon Expiry Calculation**:
   - Holds are not cleaned up by a cron job or background worker.
   - Status is evaluated dynamically at read and count time:
     `effectiveStatus = (status == "HELD" && now >= expiresAt) ? "EXPIRED" : status`.
   - Expired holds immediately return to the available seat pool. If the server crashes or reboots, no state is lost.

3. **17-Digit Student ID Safety**:
   - Student Birth Registration Numbers contain 17 digits, exceeding JavaScript's IEEE 754 safe integer limit ($2^{53} - 1$).
   - Handled strictly as `string` across C#, PostgreSQL, DTOs, and HTTP headers (`X-Student-Id`).

4. **Centralized Error Handling**:
   - Custom `ApiException` handled by ASP.NET Core `IExceptionHandler` (`ApiExceptionHandler`) returning uniform `{ status, message }` JSON.

---

## API Contract (8 Endpoints)

| Method | Endpoint | Required Headers | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/classes` | — | Create an admission class (name & total seats). |
| `GET` | `/classes` | — | List all classes with live seat counts (held, confirmed, available). |
| `GET` | `/classes/{classId}` | — | Get single class details and seat availability. |
| `POST` | `/classes/{classId}/holds` | `X-Student-Id` (17 digits) | Apply for a seat (creates a 10-minute hold). |
| `GET` | `/holds/{holdId}` | — | Get hold details, effective status, and countdown metadata. |
| `POST` | `/holds/{holdId}/confirm` | `X-Student-Id` (17 digits) | Confirm admission (simulated payment; idempotent). |
| `DELETE` | `/holds/{holdId}` | `X-Student-Id` (17 digits) | Cancel hold (releases seat back to available pool; idempotent). |
| `GET` | `/me/holds` | `X-Student-Id` (17 digits) | List all applications belonging to the student. |

---

## Project Structure

```
Admission_Management/
├── docker-compose.yml                      # Full local & test stack orchestration
├── README.md                               # Setup and running guide
├── ASSUMPTIONS.md                          # Explicit assumptions & architectural rationale
├── AI_USAGE.md                             # AI tooling disclosures & bug correction log
│
├── backend/
│   ├── Dockerfile                          # Multi-stage build (build, test, runtime)
│   ├── .dockerignore
│   ├── SchoolAdmission.Api/               # ASP.NET Core Minimal API
│   │   ├── Data/                           # Entities.cs & AppDbContext.cs
│   │   ├── Models/                         # Dtos.cs (API Request/Response contract)
│   │   ├── Services/                       # SeatService.cs (All business rules)
│   │   ├── Endpoints/                      # ClassEndpoints.cs & HoldEndpoints.cs
│   │   ├── Errors/                         # ApiException.cs & ApiExceptionHandler.cs
│   │   ├── Migrations/                     # EF Core migration files
│   │   └── Program.cs                      # Wiring, DI, CORS, Migrations, Exception Handler
│   └── SchoolAdmission.Tests/             # xUnit integration test suite
│       └── SeatTests.cs                    # 50-request concurrency, duplicate & expiry tests
│
└── frontend/                               # Vite + React + TypeScript SPA
    ├── Dockerfile                          # Multi-stage build (Node 22 build → Nginx alpine)
    ├── nginx.conf                          # SPA fallback configuration
    └── src/
        ├── api/                            # client.ts & types.ts
        ├── hooks/                          # useStudentId.ts & useCountdown.ts
        ├── components/                     # StudentIdBar, Navbar, ErrorBanner, ErrorBoundary
        ├── pages/                          # ClassListPage, CreateClassPage, HoldPage, MyApplicationsPage
        ├── App.tsx                         # Router and TanStack Query setup
        └── index.css                       # Responsive pure CSS stylesheet
```
