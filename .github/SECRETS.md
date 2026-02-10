# Required GitHub Secrets & Variables

This document lists all secrets and variables required for CI/CD workflows.
**Do NOT store actual values here — only names and descriptions.**

## Secrets

| Name | Purpose | Used in |
|---|---|---|
| `TURBO_TOKEN` | Vercel Remote Cache authentication token | ci.yml, deploy-staging.yml |
| `VERCEL_TOKEN` | Vercel CLI deployment token | ci.yml (preview), deploy-staging.yml |
| `VERCEL_ORG_ID` | Vercel organization identifier | ci.yml (preview), deploy-staging.yml |
| `VERCEL_PROJECT_ID` | Consumer web Vercel project ID | ci.yml (preview), deploy-staging.yml |
| `VERCEL_ADMIN_PROJECT_ID` | Admin app Vercel project ID | deploy-staging.yml |
| `CHROMATIC_PROJECT_TOKEN` | Chromatic visual regression project token | ci.yml (chromatic) |
| `RAILWAY_TOKEN` | Railway CLI deployment token | deploy-staging.yml |
| `RAILWAY_API_SERVICE_ID` | Railway API service identifier | deploy-staging.yml |
| `RAILWAY_WORKER_SERVICE_ID` | Railway worker service identifier | deploy-staging.yml |

## Variables

| Name | Purpose | Used in |
|---|---|---|
| `TURBO_TEAM` | Vercel Remote Cache team slug | ci.yml, deploy-staging.yml |

## Setup Instructions

1. Go to repository **Settings > Secrets and variables > Actions**
2. Add each secret under **Repository secrets**
3. Add each variable under **Repository variables**
4. Vercel tokens: Generate at https://vercel.com/account/tokens
5. Railway tokens: Generate at https://railway.com/account/tokens
6. Chromatic tokens: Available in Chromatic project settings
