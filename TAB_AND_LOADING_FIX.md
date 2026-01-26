# Fixes for Tab State Persistence and Immediate Project Loading

## 1. Tab State Persistence (CMO Overview)

**Issue**: When navigating from "SCRIPT" tab in Overview -> Project -> Back, the tab would reset to "IDEA".
**Fix**: Switched from `useState` to `useSearchParams` (URL Query Params).

**Component**: `CmoOverview.tsx`

**Change**:
```tsx
// Before
const [activeTab, setActiveTab] = useState<'IDEA' | 'SCRIPT'>('IDEA');

// After
const [searchParams, setSearchParams] = useSearchParams();
const activeTab = (searchParams.get('tab') as 'IDEA' | 'SCRIPT') || 'IDEA';
const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });
```

**Result**: Tab state is now preserved in the URL (e.g., `?tab=SCRIPT`). Navigating back restores the correct tab automatically.

## 2. Immediate Project Loading (No Blank Screen)

**Issue**: Opening a project showed a "Loading Project..." spinner or blank screen.
**Fix**: Passed existing project data via Router State (`initialProject`).

**Components Updated**:
- `CmoOverview.tsx`: Updated `navigateWithScroll` calls to include `{ initialProject: project }`.
- `CmoDashboard.tsx`: Updated all `navigateWithScroll` calls (cards, buttons, handlers) to include `{ initialProject: p }`.
- `CmoProjectDetailPage.tsx`: Updated state initialization.

**Change in Detail Page**:
```tsx
// Initialize state from router location state if available
const [project, setProject] = useState<Project | null>(location.state?.initialProject || null);
```

**Result**:
- When clicking a project card, the detail page **renders immediately**.
- No loading spinner is shown (unless direct URL access).
- Fresh data is still fetched in the background to ensure accuracy.

## 🧪 Verification

1. **Tab Test**:
   - Go to CMO Overview.
   - Click "SCRIPT" tab.
   - Click a project.
   - Click Back.
   - **Verify**: You are still on "SCRIPT" tab.

2. **Immediate Open Test**:
   - Go to any list (Overview or Dashboard).
   - Click a project.
   - **Verify**: Detail page opens instantly. No spinner.

These changes apply to all roles accessing project details via these dashboards.
