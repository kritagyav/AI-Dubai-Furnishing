# ADR-004: Supabase Auth Over Better Auth

## Status

Accepted

## Context

The `create-t3-turbo` template ships with Better Auth. Our platform requires multi-tenant authentication with row-level security (RLS) policies for data isolation between consumers, retailers, and administrators.

## Decision

Replace **Better Auth** with **Supabase Auth** as the authentication provider.

Key reasons:
- Consolidates authentication with database RLS policies for multi-tenant data isolation
- Supabase Auth integrates natively with Supabase PostgreSQL and RLS
- Built-in social login providers (Google, Apple) needed for consumer onboarding
- JWT tokens automatically include tenant context for RLS policy enforcement
- Server-side auth helpers for Next.js (`@supabase/auth-helpers-nextjs`)
- Eliminates need for separate auth server infrastructure

## Consequences

### Positive

- Unified auth + database layer reduces architectural complexity
- RLS policies enforce data isolation at database level (defense in depth)
- Built-in email/password, social login, and magic link flows
- No separate auth infrastructure to manage

### Negative

- Vendor lock-in to Supabase for authentication
- Less customizable than self-hosted Better Auth
- Supabase free tier limits may require upgrade for production

### Neutral

- Migration path exists if needed (JWT-based, standard OIDC claims)
