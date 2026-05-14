# FLEXEE DA Backend

NestJS backend API for FLEXEE DA, a data analytics teaching simulation where the analysis meets the market.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI`, `JWT_SECRET`, and local runtime values.
4. Seed demo data with `npm run seed` when MongoDB is available.
5. Start the API with `npm run start:dev`.

## Useful Scripts

- `npm run start:dev` - start the backend in watch mode.
- `npm run seed` - seed the FLEXEE DA demo data.
- `npm test` - run backend tests.

The API uses the global prefix from `GLOBAL_PREFIX`, which defaults to `api`.
