# Installation Guide - TypeScript Migration

## ⚠️ IMPORTANT: Do NOT Delete These Files

### ✅ Keep These Files (Essential)
- **`package.json`** - Contains all project dependencies and scripts
- **`package-lock.json`** - Locks exact versions of dependencies for consistency

**Why?** These files are the heart of your Node.js project. Deleting them will break your project!

## 📦 Installation Steps

### Step 1: Install Dependencies
Since we added TypeScript to `package.json`, you need to install it:

```bash
cd client
npm install
```

This will:
- Install TypeScript (newly added to devDependencies)
- Update `package-lock.json` automatically
- Ensure all dependencies are properly installed

### Step 2: Verify TypeScript Installation
Check if TypeScript was installed correctly:

```bash
npx tsc --version
```

You should see something like: `Version 5.7.3`

### Step 3: Run Type Check
Test that TypeScript is working:

```bash
npm run type-check
```

This runs `tsc --noEmit` which checks for type errors without building.

### Step 4: Start Development Server
```bash
npm run dev
```

Your app should start on `http://localhost:5173`

### Step 5: Build for Production
```bash
npm run build
```

This will:
1. Run TypeScript type checking (`tsc`)
2. Build the project with Vite (`vite build`)

## 📝 What Changed in package.json

### Added Scripts
```json
"type-check": "tsc --noEmit"  // Check TypeScript types without building
```

### Updated Scripts
```json
"build": "tsc && vite build"  // Now includes type checking before build
```

### Added Dependencies
```json
"typescript": "^5.7.3"  // TypeScript compiler
```

## 🔄 When to Update package-lock.json

The `package-lock.json` file will be **automatically updated** when you:
- Run `npm install`
- Add new packages with `npm install package-name`
- Remove packages with `npm uninstall package-name`
- Update packages with `npm update`

**Never manually edit `package-lock.json`!**

## 🗑️ Files That Were Deleted (Old JavaScript Files)

These files were safely removed because they were converted to TypeScript:
- ❌ `src/main.jsx` → ✅ `src/main.tsx`
- ❌ `src/App.jsx` → ✅ `src/App.tsx`
- ❌ `vite.config.js` → ✅ `vite.config.ts`

## 🚀 Available Scripts

After installation, you can use:

```bash
npm run dev          # Start development server with hot reload
npm run build        # Type check + build for production
npm run preview      # Preview production build locally
npm run lint         # Run ESLint to check code quality
npm run type-check   # Check TypeScript types only (no build)
```

## ✅ Verification Checklist

- [ ] `package.json` exists and contains TypeScript in devDependencies
- [ ] `package-lock.json` exists (will be updated after npm install)
- [ ] Run `npm install` successfully
- [ ] Run `npm run type-check` without errors
- [ ] Run `npm run dev` and app loads in browser
- [ ] All `.tsx` files are recognized by Vite

## 🆘 Troubleshooting

### Problem: "Cannot find module 'typescript'"
**Solution:** Run `npm install` in the client directory

### Problem: "Cannot find name 'React'"
**Solution:** Already fixed! `@types/react` is in your package.json

### Problem: Type errors in `.tsx` files
**Solution:** Run `npm run type-check` to see all errors, then fix them one by one

### Problem: Vite doesn't recognize `.tsx` files
**Solution:** Make sure `vite.config.ts` exists and `@vitejs/plugin-react` is installed

## 📚 Next Steps

1. Run `npm install` to install TypeScript
2. Convert remaining `.jsx` files to `.tsx` as you work on them
3. Add type definitions for any untyped libraries:
   ```bash
   npm install --save-dev @types/library-name
   ```

## 🎯 Summary

**DO NOT DELETE:**
- ✅ `package.json`
- ✅ `package-lock.json`
- ✅ `node_modules/` (can delete and reinstall, but not necessary)

**ALREADY DELETED (Converted to TypeScript):**
- ❌ Old `.jsx` and `.js` files that were converted to `.tsx` and `.ts`

**NEXT ACTION:**
```bash
npm install
```

That's it! Your project is now ready for TypeScript development. 🎉
