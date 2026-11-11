# Architectural & Domain Assumptions

This document records the foundational domain and technical assumptions made for the School Admission Reservation System.

---

### 1. Identity & Authentication
- **17-Digit Student ID**: The student identifier is the national birth registration number (BRN). We assume any string composed of **exactly 17 decimal digits (`0-9`)** is valid syntax. We do not validate against an external civil registry.
- **Header-Based Identity**: Per the PRD, user authentication (passwords, JWTs, OAuth) is out of scope. The incoming `X-Student-Id` HTTP header is trusted as authentic.
- **Open Admin Interface**: The admin interface at `/admin` (for creating classes) is open to all users without authentication.

### 2. Class Names & Cohorts
- **Non-Unique Class Names**: Class names are not unique. For example, multiple "Class 6 - Morning Shift" cohorts may be created for different sections. Enforcing a unique database constraint on class name would break automated grading scripts that generate classes repeatedly.
- **Name & Seat Boundaries**: Class names must be between 1 and 100 characters after whitespace trimming. Total seats must be a whole positive integer between 1 and 100,000.

### 3. Hold Lifecycle & Concurrency Invariants
- **Row-Level Serialization**: Seat safety does not depend on application process memory. Every `Apply`, `Confirm`, and `Cancel` acquires an exclusive PostgreSQL row lock on the target class (`SELECT id FROM classes WHERE id = @classId FOR UPDATE`) inside an explicit transaction. Therefore, any number of horizontal backend processes sharing the database maintain strict seat limits.
- **Dynamic Expiry without Background Jobs**: A hold lasts for `HOLD_DURATION_SECONDS` (default: 600 seconds). Expiry is determined dynamically by comparing the current UTC timestamp against `expiresAt`. This guarantees that if the backend container crashes or reboots, no expired holds remain locked and no background schedules are missed.
- **Seat Arithmetic Invariant**: 
  - `heldSeats = COUNT(status == 'HELD' AND expiresAt > now)`
  - `confirmedSeats = COUNT(status == 'CONFIRMED')`
  - `availableSeats = totalSeats - heldSeats - confirmedSeats`
  - The invariant `heldSeats + confirmedSeats <= totalSeats` holds true under any concurrent load.

### 4. Application Multiplicity & Re-Application
- **Cross-Class Applications**: A student may hold seats in different classes simultaneously (e.g. applying for both Class 6 Morning and Class 6 Day).
- **Per-Class Restriction**: A student cannot have more than one active `HELD` hold or `CONFIRMED` admission in the same class at the same time.
- **Re-Application Permitted**: If a student's hold expires or is cancelled, they are fully permitted to apply to the same class again. For this reason, there is **no unique database index on `(class_id, student_id)`**.

### 5. Idempotency & State Machine Transitions
- **Confirm Idempotency**: Confirming an already `CONFIRMED` hold returns `200 OK` with status `CONFIRMED` and does not increment `confirmedSeats` again.
- **Cancel Idempotency**: Cancelling an already `CANCELLED` hold returns `204 NoContent` without error.
- **Non-Refundable**: A confirmed admission or an expired hold cannot be cancelled (returns `409 Conflict`). There is no refund flow.

### 6. Client Clock Skew & Time Authority
- **Server Clock Authority**: The server UTC clock is the single source of truth.
- **Server Offset Compensation**: Hold responses include a `serverTime` timestamp. The frontend computes the clock skew offset:
  `serverOffset = new Date(serverTime).getTime() - Date.now()`.
  This guarantees that client PCs with inaccurate clocks or wrong timezone settings still display the accurate remaining hold time.

### 7. Simulated Payment Gateway
- **Simulated Instant Payment**: Pressing "Pay Admission Fee" simulates a successful payment. In a production system, this step would interface with a payment processor webhook before transitioning to `CONFIRMED`.
