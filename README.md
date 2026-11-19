# Blood Donation Management System

A small, runnable DBMS project built with **Node.js, Express and MongoDB**. It demonstrates donor registration, blood inventory, hospital requests and request review. The database design document contains the ER model, logical relations and the highest normal form of each relation.

## Run it locally

You need Node.js 18 or newer and a running MongoDB server. On macOS, you can install MongoDB locally with Homebrew (no Docker required):

```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

MongoDB 7.0 supports macOS 11 or later. MongoDB's official macOS instructions list Homebrew as the installation method and `brew services start mongodb-community@7.0` to run the local server. If Homebrew is not installed, follow [Homebrew's installation guide](https://brew.sh/).

Then, from this project folder, run:

```bash
npm install
cp .env.example .env
npm run seed
npm start
```

Open **http://localhost:3000**. The seed command inserts example records and can be run again without duplicating the sample data. MongoDB runs on `mongodb://127.0.0.1:27017`, in database `blood_donation_management`.

To stop the local MongoDB service, run `brew services stop mongodb-community@7.0`.

### Use Docker instead

If Docker Desktop is installed, the included Compose file can start MongoDB with `docker compose up -d`; stop it with `docker compose down`. The MongoDB data lives in a named Docker volume. To erase that data, use `docker compose down -v`.

### Use MongoDB Atlas instead

Create a database user and allow your IP in the Atlas network settings. Copy `.env.example` to `.env`, then put the Atlas connection string in `MONGODB_URI` and set `DB_NAME=blood_donation_management`. Do not commit `.env` or share its password.

## ER diagram for the report

The report-ready diagram is [`public/er-diagram.png`](public/er-diagram.png), ready to insert into the report. The editable vector version is [`public/er-diagram.svg`](public/er-diagram.svg); open it at full size or click **Download ER diagram** in the app footer.

The relational mapping and BCNF explanations are in [`docs/DATABASE-DESIGN.md`](docs/DATABASE-DESIGN.md).

## Features

- Dashboard counts and stock available by blood bank and blood group.
- Donor registration with duplicate phone/email protection.
- Donation recording that checks the donor's latest eligibility result and updates blood inventory.
- Hospital request submission with pending, approve and reject statuses.
- Aggregations that join related collections with MongoDB `$lookup`.
- Unique indexes and reusable sample records.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Check the MongoDB connection |
| GET | `/api/dashboard` | Dashboard counts and joined inventory |
| GET | `/api/lookups` | Blood groups, banks and hospitals for forms |
| GET / POST | `/api/donors` | List or register donors |
| POST | `/api/donations` | Record an eligible donor's donation and add the units to inventory |
| GET / POST | `/api/requests` | List or submit hospital requests |
| PATCH | `/api/requests/:id/status` | Approve or reject a pending request |

This is an educational prototype. It does not include authentication or production-grade medical-data safeguards; use sample data for classroom demonstrations.
