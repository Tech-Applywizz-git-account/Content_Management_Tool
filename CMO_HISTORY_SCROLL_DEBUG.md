# CMO History Scroll Restoration - Debug & Fix

## 🔍 Current Status

### Files Updated:
1. ✅ `CmoDashboard.tsx` - Has `useScrollRestoration` hook
2. ✅ `CmoProjectDetailPage.tsx` - Has `useScrollRestoration` hook
3. ✅ `handleHistoryDetail` - Uses `navigateWithScroll`
4. ✅ Loading spinner added (no more blank screen)

### How Scroll Restoration Should Work:

**Step-by-Step Flow:**
1. User is on CMO Dashboard History tab (scrolled to 500px)
2. User clicks history item
3. `handleHistoryDetail` calls `navigateWithScroll('/cmo/history_detail/123')`
4. This saves `scrollY: 500` in location state
5. Navigates to history detail page
6. User clicks back
7. `navigate(-1)` returns to CMO Dashboard
8. `useScrollRestoration` hook on CMO Dashboard detects saved scrollY
9. Scrolls to 500px

## 🐛 Potential Issues

### Issue 1: Route Mismatch
The scroll restoration works when navigating between different routes, but the History tab is part of the same route (`/cmo`). When you click back from `/cmo/history_detail/123`, you return to `/cmo`, but the History tab state might not be preserved.

### Issue 2: Tab State Reset
The CMO Dashboard might be resetting to the default tab instead of staying on the History tab.

### Issue 3: Scroll Container
The scroll might be happening in a nested container instead of the window, so `window.scrollY` might not be the right value.

## ✅ Solutions to Try

### Solution 1: Check Active Tab Persistence
Make sure the History tab stays active when returning from detail page.

**Check in `CmoDashboard.tsx`:**
- Does `activeTab` state persist when navigating back?
- Is there URL-based tab state management?

### Solution 2: Verify Scroll Container
Check if the History list scrolls in a nested div or the window.

**If it's a nested div:**
- Need to save and restore scroll position of that specific div
- Modify `useScrollRestoration` to support container refs

### Solution 3: Add Debug Logging
Add console logs to see what's happening:

```tsx
// In CmoDashboard
useEffect(() => {
  console.log('CMO Dashboard mounted, location state:', location.state);
  console.log('Current scrollY:', window.scrollY);
}, [location]);

// In useScrollRestoration hook
useEffect(() => {
  const scrollY = location.state?.scrollY;
  console.log('Restoring scroll to:', scrollY);
  if (scrollY !== undefined) {
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  }
}, [location.state?.scrollY]);
```

## 🔧 Quick Fix to Test

### Test 1: Verify Navigation
Open browser console and check:
1. When clicking history item, does console show scroll position being saved?
2. When clicking back, does console show scroll position being restored?

### Test 2: Check Tab State
When you click back from history detail:
1. Are you still on the History tab?
2. Or does it reset to Pending tab?

### Test 3: Manual Scroll Test
Try this in browser console after navigating back:
```javascript
window.scrollTo({ top: 500, behavior: 'instant' });
```
If this works, the issue is with the hook. If not, the issue is with the scroll container.

## 📋 Next Steps

Based on the test results:

**If tab resets to Pending:**
- Need to preserve tab state in URL or location state

**If scroll container is nested:**
- Need to modify scroll restoration to work with container refs

**If hook not triggering:**
- Need to check if location state is being passed correctly

## 🎯 Expected Behavior

After fix:
1. ✅ Click history item → Saves scroll position
2. ✅ View history detail → Shows loading spinner then content
3. ✅ Click back → Returns to History tab at exact scroll position
4. ✅ No blank screens
5. ✅ Smooth and instant

## 📝 Testing Checklist

- [ ] Scroll down History tab to 500px
- [ ] Click on a history item
- [ ] Verify loading spinner appears (not blank)
- [ ] Verify history detail loads
- [ ] Click back button
- [ ] Verify returns to History tab (not Pending)
- [ ] Verify scroll position is at 500px
- [ ] Test with different scroll positions
- [ ] Test with browser back button
- [ ] Test with UI back button

## 🔍 Debug Commands

Add these temporarily to debug:

**In `CmoDashboard.tsx` (after line 36):**
```tsx
useEffect(() => {
  console.log('🔵 CMO Dashboard - Location state:', location.state);
  console.log('🔵 CMO Dashboard - Current scroll:', window.scrollY);
  console.log('🔵 CMO Dashboard - Active tab:', activeTab);
}, [location, activeTab]);
```

**In `handleHistoryDetail` (line 321):**
```tsx
const handleHistoryDetail = (project: Project, history: any) => {
  console.log('🟢 Navigating to history detail, current scroll:', window.scrollY);
  navigateWithScroll(`/cmo/history_detail/${project.id}`);
};
```

**In `useScrollRestoration` hook:**
```tsx
useEffect(() => {
  const scrollY = location.state?.scrollY;
  console.log('🟡 Scroll restoration - scrollY from state:', scrollY);
  if (scrollY !== undefined) {
    console.log('🟡 Restoring scroll to:', scrollY);
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      console.log('🟡 Scroll restored, current position:', window.scrollY);
    });
  }
}, [location.state?.scrollY]);
```

Run these and check the console to see where the flow breaks.
