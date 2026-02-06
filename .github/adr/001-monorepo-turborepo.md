# ADR-001: Turborepo Monorepo Structure

## Status

Accepted

## Context

The Dubai AI Furnishing Platform requires shared code across consumer web (Next.js), consumer mobile (Expo), admin portal (Next.js), and background workers. We evaluated monorepo tools including Nx, Turborepo, and pnpm workspaces alone.

## Decision

Use **Turborepo 2.8.3** with **pnpm workspaces** for monorepo management, based on the `create-t3-turbo` template.

Key reasons:
- Vercel-backed, pairs naturally with Next.js deployment
- Efficient task caching and parallel execution
- Simpler configuration vs Nx for our team size
- `create-t3-turbo` provides battle-tested starter with tRPC + Prisma patterns
- pnpm strict mode prevents phantom dependencies

## Consequences

### Positive

- Single repository for all platform code with shared TypeScript types
- Efficient CI via Turborepo caching and affected-target detection
- Consistent tooling (ESLint, Prettier, TypeScript) across all packages

### Negative

- Larger repository size over time
- CI complexity for selective builds
- Team members need monorepo familiarity

### Neutral

- Remote caching via Vercel available but optional
