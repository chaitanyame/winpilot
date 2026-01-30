# Technology Stack

**Analysis Date:** 2026-01-29

## Languages

**Primary:**
- TypeScript 5.3.3 - Full-stack TypeScript for type safety across main and renderer processes

**Secondary:**
- JavaScript ES2022 (TypeScript compiled) - Main process and preload scripts

## Runtime

**Environment:**
- Node.js >= 18.0.0 - Electron runtime

**Package Manager:**
- npm 10.x - Package management and dependency resolution
- Lockfile: package-lock.json present

## Frameworks

**Core:**
- Electron 28.1.0 - Desktop application framework
- React 18.2.0 - UI rendering library

**Testing:**
- Not detected - No testing framework configured

**Build/Dev:**
- Vite 5.0.11 - Build tool and dev server
- TypeScript 5.3.3 - Type checker and compiler
- electron-builder 24.9.1 - Electron app packaging
- concurrently 8.2.2 - Concurrent command execution
- wait-on 7.2.0 - Wait for development server availability

## Key Dependencies

**Critical:**
- @github/copilot-sdk 0.1.15 - GitHub Copilot SDK for AI-powered desktop control
- electron-store 8.1.0 - Persistent settings storage (JSON files)

**UI:**
- framer-motion 10.16.16 - Animation library for React components
- lucide-react 0.303.0 - Icon library
- React 18.2.0 - UI rendering (listed separately above)
- React DOM 18.2.0 - React DOM rendering

**State Management:**
- zustand 4.4.7 - State management (used for app state, though no store implementation detected yet)

**Validation:**
- zod 3.22.4 - Schema validation for tool parameters
- zod-to-json-schema 3.25.1 - Convert Zod schemas for Copilot SDK

**Scheduling:**
- node-cron 4.2.1 - Cron-based task scheduling

**CSS:**
- tailwindcss 3.4.1 - Utility-first CSS framework
- postcss 8.4.33 - CSS processing
- autoprefixer 10.4.16 - Vendor prefixing

## Configuration

**Environment:**
- Node environment: Development/production controlled by NODE_ENV variable
- App data path: Configured via APPDATA env var (defaults to platform-specific data directory)
- User home: Resolved from HOME or USERPROFILE env vars

**Build:**
- tsconfig.json - TypeScript compiler configuration
- tsconfig.node.json - TypeScript config for build tools
- vite.config.ts - Vite build configuration
- postcss.config.mjs - PostCSS configuration
- tailwind.config.js - Tailwind CSS configuration
- electron-builder.json - Electron app packaging configuration

**Linting:**
- eslint 8.57.1 - Code linting
- @typescript-eslint/eslint-plugin 6.21.0 - TypeScript ESLint rules
- @typescript-eslint/parser 6.21.0 - TypeScript parser for ESLint
- eslint-plugin-react-hooks 4.6.2 - React hooks linting rules
- eslint-plugin-react-refresh 0.4.26 - React refresh integration

## Platform Requirements

**Development:**
- Node.js 18+ installed
- npm or yarn package manager
- Code editor with TypeScript support

**Production:**
- Platform-specific Electron builds:
  - Windows: .exe installer
  - macOS: .dmg installer
  - Linux: AppImage and/or .deb/.rpm packages

---

*Stack analysis: 2026-01-29*
