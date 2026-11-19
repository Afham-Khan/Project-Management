# Neon + Prisma 7 Setup (GreatStack Project)

This document records the setup used for the Project Management backend
with **Neon PostgreSQL, Prisma 7.10.1, and the Neon driver adapter**.

## Do I need to repeat this setup?

**No. Your current setup is already working.** You successfully: -
Validated the Prisma schema. - Generated Prisma Client v7.10.1. - Pushed
the schema to Neon. - Opened Prisma Studio and confirmed that your
tables are visible.

You do not need to repeat the installation or database setup for this
existing project. Keep this document for reference if you create a fresh
project or need to reproduce the setup.

------------------------------------------------------------------------

## 1. Create a Neon project and get connection strings

In Neon, get both connection strings:

-   **Pooled connection** for application queries.
-   **Direct / unpooled connection** for Prisma CLI operations.

Add them to the backend `.env` file:

``` env
DATABASE_URL="YOUR_NEON_POOLED_CONNECTION_STRING"
DATABASE_URL_UNPOOLED="YOUR_NEON_DIRECT_CONNECTION_STRING"
```

Use the actual connection strings copied from Neon. Do not commit `.env`
or share its credentials.

## 2. Install dependencies

From the backend/server directory:

``` bash
npm install @prisma/adapter-neon@7 @prisma/client@7 dotenv
npm install prisma@7 --save-dev
```

`dotenv` may already be installed; npm will keep it in the dependency
list.

Keep Prisma packages on major version 7 for this setup. Do not upgrade
to Prisma 8 just because the CLI displays an update notice.

## 3. Configure `package.json`

Ensure the project uses ES modules:

``` json
"type": "module"
```

A suitable scripts section is:

``` json
"scripts": {
  "postinstall": "prisma generate",
  "start": "node server.js",
  "dev": "nodemon server.js"
}
```

If your existing scripts differ, update them deliberately. Generating
Prisma Client on every server start is not necessary; generate it after
installation or whenever the Prisma schema changes.

## 4. Configure `prisma/schema.prisma`

The generator and datasource blocks for this setup:

``` prisma
generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

Keep your application enums and models below these blocks.

For this Prisma 7 setup: - Do not add
`previewFeatures = ["driverAdapters"]`. - Do not put `url` or
`directUrl` in the datasource block. - The CLI connection URL is
configured in `prisma.config.ts`.

## 5. Create `prisma.config.ts`

Create this file in the **server root**, beside `package.json`:

``` ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),
  },
})
```

This tells Prisma CLI to use the direct/unpooled Neon connection for
schema operations.

Do not create this file inside the `config` or `prisma` folder.

## 6. Configure the Prisma Client instance

Keep the existing file: `config/prisma.js`.

Because the generator has a custom output directory, import Prisma
Client from the generated directory:

``` js
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/index.js'
import { PrismaNeon } from '@prisma/adapter-neon'

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({ adapter })

export default prisma
```

This uses the pooled connection for normal application queries.

The `../generated/prisma/index.js` path is correct when
`config/prisma.js` is one directory below the server root and the
generator output is `../generated/prisma` relative to
`prisma/schema.prisma`.

## 7. Validate the schema

Run from the server directory:

``` bash
npx prisma validate
```

Expected result: Prisma loads `prisma.config.ts`, loads
`prisma/schema.prisma`, and reports that the schema is valid.

If it says `Cannot resolve environment variable: DATABASE_URL_UNPOOLED`,
check that: - The variable exists in the server `.env`. - The spelling
matches exactly. - The `.env` file is in the server root.

## 8. Generate Prisma Client

``` bash
npx prisma generate
```

This generates the client into:

``` text
server/
  generated/
    prisma/
```

Run this again whenever you change the Prisma schema.

## 9. Push the schema to Neon

``` bash
npx prisma db push
```

This synchronizes the models in `schema.prisma` with the Neon database
and creates/updates the database tables.

This is the command that syncs the schema; `prisma generate` alone does
not create database tables.

## 10. Verify the tables

``` bash
npx prisma studio
```

Prisma Studio opens a browser interface where you can inspect the
database tables and records.

------------------------------------------------------------------------

## Final project structure

``` text
server/
├── config/
│   └── prisma.js
├── generated/
│   └── prisma/
├── prisma/
│   └── schema.prisma
├── .env
├── prisma.config.ts
├── package.json
└── server.js
```

## Which commands do I run later?

  Situation                              Command
  -------------------------------------- -----------------------
  First setup / after changing schema    `npx prisma validate`
  Generate client after schema changes   `npx prisma generate`
  Sync schema changes to Neon            `npx prisma db push`
  Inspect database tables                `npx prisma studio`

For a normal backend restart, you do **not** need to run `db push` every
time. Start the server using your normal development command:

``` bash
npm run dev
```

## Important security reminder

A real Neon connection string was shared during setup. Rotate the Neon
database password, update both connection strings in `.env`, and ensure
`.env` is listed in `.gitignore`. Never put database credentials in
source code or commit them to Git.

------------------------------------------------------------------------

**Setup status for this project: COMPLETE.** The validation, client
generation, database synchronization, and Prisma Studio checks all
succeeded. The remaining task was to ensure `config/prisma.js` imports
the generated client from `../generated/prisma/index.js`.
