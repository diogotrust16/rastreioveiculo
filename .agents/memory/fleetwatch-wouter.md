---
name: FleetWatch wouter auth routing
description: Auth guard pattern and BASE_URL/base config for wouter in this project
---

**Auth guard:** Put the redirect synchronously in the route component, not in a `useEffect` inside a layout component. `useEffect` fires after render, causing a blank flash before the redirect.

```tsx
function ProtectedRoutes() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppLayout>...</AppLayout>;
}
```

**BASE_URL → wouter base:** When `BASE_PATH` env var is `"/"`, Vite's `import.meta.env.BASE_URL` returns `"/"`. Stripping the trailing slash gives `""` — pass that as wouter's `base` prop. This is correct and works.

**Why:** wouter's `Redirect` rendered synchronously prevents the blank-screen flash. `useEffect` + `setLocation` in a layout that returns `null` causes one render cycle of empty content.
