# ADR-003: Prisma Over Drizzle ORM

## Status

Accepted

## Context

The `create-t3-turbo` template ships with Drizzle ORM. Our architecture requires schema-first database management with robust migration tooling for a multi-tenant SaaS platform with Supabase RLS policies.

## Decision

Replace **Drizzle ORM** with **Prisma 7.2.0+** as the database ORM layer.

Key reasons:
- Schema-first approach (`schema.prisma`) provides single source of truth for database schema
- Prisma 7.x is a pure TypeScript rewrite (no Rust binary), simplifying deployment
- Battle-tested migration system critical for production schema evolution
- Prisma Studio for database inspection during development
- Strong Supabase integration for RLS policy-aware queries
- Better ecosystem support for multi-tenant patterns

## Consequences

### Positive

- Schema-first design prevents schema drift across environments
- Robust migration tooling for production deployments
- Pure TS rewrite eliminates binary compatibility issues
- Excellent TypeScript type generation from schema

### Negative

- Slightly larger bundle than Drizzle
- Schema changes require `prisma generate` step
- Less raw SQL flexibility than Drizzle (mitigated by `$queryRaw`)

### Neutral

- Team familiarity with Prisma is higher than Drizzle
