# DappDrop Documentation

This folder contains important documentation and action plans for the DappDrop project.

## Contents

### Performance Optimization
- [`optimization-action-plan.md`](./performance-optimization/optimization-action-plan.md) - Comprehensive performance optimization plan identifying bottlenecks and fixes for slow page loads (10-30s → 6.5s)

### Implementation Guides
- [`discord-serverid-implementation.md`](./performance-optimization/discord-serverid-implementation.md) - Walkthrough of adding dedicated `discordServerId` column to database schema

## Quick Reference

### Performance Issues Fixed
- Sequential blockchain calls in loops
- Missing caching layer
- Heavy animations loading synchronously
- Turbopack overhead
- Redundant blockchain queries

### Recent Database Changes
- Added `discordServerId` column to `CampaignTaskMetadata` table
- Migration: `20251222074601_add_discord_server_id_column`

---

Last updated: 2025-12-22
