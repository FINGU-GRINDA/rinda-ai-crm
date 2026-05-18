# Kanban Board & Tabs UI Analysis

## Date: 2026-01-20

---

## 🔴 CRITICAL ISSUES

### 1. **Missing "Lost" Column in Kanban Board**
**Severity:** CRITICAL - Data Loss Risk

**Location:** `KanbanBoard.tsx` lines 25-30

**Problem:**
```typescript
export const KANBAN_COLUMNS: { id: CustomerStatus; title: string; accent: string }[] = [
  { id: 'new', title: '새로운 고객', accent: 'border-l-neutral-400' },
  { id: 'contact', title: '연락 중', accent: 'border-l-blue-600' },
  { id: 'negotiation', title: '제안서 검토 중', accent: 'border-l-blue-600' },
  { id: 'won', title: '계약 완료', accent: 'border-l-emerald-500' },
];
// ❌ Missing 'lost' column!
```

**But the Tab Navigation has a "Lost Deals" tab:**
```typescript
// TabNavigation.tsx lines 41-46
{
  id: 'lost',
  label: 'Lost Deals',
  icon: <IconX className="w-4 h-4" />,
  count: counts.lost
}
```

**Impact:**
- **Users can mark deals as "lost"** (App.tsx line 488)
- **Lost customers exist** (counted in tabs)
- But **there's no kanban column** to display them!
- **Lost customers are invisible** in the kanban view
- Users must switch to "Lost" tab to see them (which shows what?)

**Evidence from App.tsx:**
```typescript
// Line 124 - Lost deals are filtered OUT of kanban
} else if (activeTab === 'lost') {
  baseCustomers = baseCustomers.filter(c => c.status === 'lost');
}

// Line 488 - Users CAN set status to lost
if (newStatus === 'lost') {
  setShowLostDealModal(true);
  return;
}
```

**Result:** Lost deals become **orphaned data** - they exist but can't be dragged/managed in the kanban.

---

### 2. **Missing "Prospect" Column in Kanban Board**
**Severity:** CRITICAL - Inconsistent UX

**Problem:**
The Kanban board has NO column for `status: 'prospect'` even though:
- Prospects exist in the system
- App.tsx filters them out: `c.status !== 'prospect'` (line 120)
- CustomerStatus type includes 'prospect'

**Impact:**
- **Prospects can't be displayed** in the kanban view
- **Inconsistent with tab navigation** which has a Prospects tab
- **Confusing UX** - users see prospect count but no column

---

### 3. **Broken Lost Deals Tab**
**Severity:** CRITICAL - Broken Feature

**Location:** App.tsx lines 124-126 + TabNavigation

**Problem:**
```typescript
} else if (activeTab === 'lost') {
  baseCustomers = baseCustomers.filter(c => c.status === 'lost');
}
```

When user clicks "Lost Deals" tab:
1. ✅ Filters customers to only show lost deals
2. ❌ **But kanban has no 'lost' column!**
3. ❌ **Result: Empty kanban board appears**

**What users see:**
- Click "Lost Deals" tab
- See kanban with 4 columns: New → Contact → Negotiation → Won
- All columns are empty (because lost deals are filtered but have no column)
- **Confusing and looks broken**

**Expected behavior:**
Either:
- Add a "Lost" column to kanban, OR
- Show a different view (table or list) when Lost tab is selected

---

## 🟠 HIGH PRIORITY ISSUES

### 4. **Mobile Kanban Scroll Sync Issue**
**Severity:** HIGH - UX Problem

**Location:** KanbanBoard.tsx lines 240-246

**Problem:**
```typescript
onScroll={(e) => {
  const scrollLeft = e.currentTarget.scrollLeft;
  const columnWidth = window.innerWidth * 0.9 + 16;
  const newIndex = Math.round(scrollLeft / columnWidth);
  if (newIndex !== activeKanbanColumn && newIndex >= 0 && newIndex < KANBAN_COLUMNS.length) {
    setActiveKanbanColumn(newIndex);
  }
}}
```

**Issues:**
- **Hard-coded column width calculation** `window.innerWidth * 0.9 + 16`
- Doesn't account for **padding/margins** properly
- **Rounding errors** can cause misalignment
- **No throttling** - state updates on every scroll event (performance issue)
- If screen rotates, width calculation is stale

**Better approach:**
- Use `IntersectionObserver` API
- Or calculate actual element widths dynamically
- Throttle scroll events

---

### 5. **Accessibility Issues in Kanban**

**Missing ARIA attributes:**

```typescript
// Line 80-92 - Customer card has no ARIA role
<div
  draggable={!isProspect && showDragHandle}
  onClick={() => onSelectCustomer(customer.id)}
  className="..."
>
  // ❌ Missing: role="button" or role="article"
  // ❌ Missing: aria-label with customer name
  // ❌ Missing: tabIndex for keyboard navigation
```

**Drag and drop not keyboard accessible:**
- Kanban is **completely unusable** for keyboard users
- No keyboard shortcuts for moving cards
- No focus management for dragged items

**Tooltips not accessible:**
```typescript
// Lines 15-23
const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => (
  <div className="group relative flex">
    {children}
    <div className="... scale-0 group-hover:scale-100 ...">
      {text}
    </div>
  </div>
);
```

**Issues:**
- **Only shows on hover** (no keyboard support)
- No `role="tooltip"`
- No `aria-describedby` connection
- Screen readers can't access tooltip content

---

### 6. **Tab Navigation Accessibility**

**Location:** TabNavigation.tsx

**Issues:**

```typescript
<button
  onClick={() => onTabChange(tab.id)}
  className="..."
>
  // ❌ Missing: role="tab"
  // ❌ Missing: aria-selected={activeTab === tab.id}
  // ❌ Missing: aria-controls to link to tabpanel
```

**Should be:**
```typescript
<button
  role="tab"
  aria-selected={activeTab === tab.id}
  aria-controls={`${tab.id}-panel`}
  onClick={() => onTabChange(tab.id)}
>
```

**Parent should have:**
```typescript
<div role="tablist" aria-label="Customer categories">
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### 7. **Inconsistent Column Accent Colors**
**Location:** KanbanBoard.tsx lines 25-30

```typescript
{ id: 'new', title: '새로운 고객', accent: 'border-l-neutral-400' },      // Gray
{ id: 'contact', title: '연락 중', accent: 'border-l-blue-600' },          // Blue
{ id: 'negotiation', title: '제안서 검토 중', accent: 'border-l-blue-600' }, // Blue (same as contact)
{ id: 'won', title: '계약 완료', accent: 'border-l-emerald-500' },         // Green
```

**Issues:**
- "Contact" and "Negotiation" have **same color** (blue-600)
- No visual distinction between two blue columns
- No color for "lost" (should be red)
- No color hierarchy/progression

**Better color scheme:**
```typescript
{ id: 'new', title: '새로운 고객', accent: 'border-l-slate-400' },        // Gray
{ id: 'contact', title: '연락 중', accent: 'border-l-blue-500' },         // Light Blue
{ id: 'negotiation', title: '제안서 검토 중', accent: 'border-l-indigo-600' }, // Dark Blue
{ id: 'won', title: '계약 완료', accent: 'border-l-emerald-500' },        // Green
{ id: 'lost', title: 'Lost Deals', accent: 'border-l-red-500' },          // Red
```

---

### 8. **Mobile Kanban Column Width**
**Location:** KanbanBoard.tsx line 255

```typescript
<div
  className="w-[85vw] flex-shrink-0 snap-center ..."
>
```

**Issue:**
- **85vw is too wide** on larger phones (leaves awkward gap)
- **Too narrow** on tablets in portrait mode
- **Fixed width** doesn't adapt to content
- Could show 1.5 columns on tablets but currently forced to 1

**Better approach:**
```typescript
className="w-[90vw] sm:w-[45vw] md:w-80 ..."
// 90vw on mobile, 45vw on small tablets (show 2), fixed on desktop
```

---

### 9. **Empty State Could Be Better**
**Location:** KanbanBoard.tsx lines 269-275 (mobile), 316-322 (desktop)

```typescript
{columnCustomers.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-8 text-center">
    <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center mb-2 opacity-50">
      <IconBuilding className="w-6 h-6 text-slate-400" />
    </div>
    <p className="text-xs text-slate-400">고객이 없습니다</p>
  </div>
```

**Issues:**
- **Not actionable** - doesn't guide user on what to do
- **No CTA** to add customers or move from other columns
- Same empty state for all columns (could be contextual)

**Better approach:**
```typescript
// For "new" column:
<p className="text-xs text-slate-500 mb-2">신규 고객이 없습니다</p>
<button className="text-xs text-blue-600">+ 고객 추가</button>

// For "won" column:
<p className="text-xs text-slate-500">아직 계약 완료된 고객이 없습니다</p>
<p className="text-[10px] text-slate-400 mt-1">고객을 여기로 드래그하세요</p>
```

---

### 10. **Card Height Inconsistency**
**Problem:**

Cards have **variable height** based on content:
- Prospects with source articles: ~220px
- Enriched customers with AI insights: ~180px
- Regular customers: ~140px

**Impact:**
- **Columns look uneven**
- **Hard to scan** visually
- **Drag and drop feels janky** because drop zones shift

**Better approach:**
- Set **min-height** on cards
- Use **line-clamp** consistently for all text content
- Or use **grid layout** with fixed row heights

---

### 11. **Tab Count Update Lag**
**Location:** App.tsx lines 147-152

```typescript
const tabCounts = useMemo(() => ({
  active: customers.filter(c => c.status !== 'lost' && c.status !== 'prospect').length,
  leads: customers.filter(c => c.status === 'new').length,
  prospects: prospects.length,
  lost: customers.filter(c => c.status === 'lost').length
}), [customers, prospects]);
```

**Issue:**
- Counts update **after API response**
- No **optimistic update** when user drags card
- **Delayed visual feedback** - user drags card, count stays same for 1-2 seconds

**Impact:**
- **Feels sluggish**
- **Confusing** - did my action work?

---

## 🟢 LOW PRIORITY ISSUES

### 12. **Prospect Data Type Casting**
**Location:** KanbanBoard.tsx line 77

```typescript
const prospectData = (customer as any).prospectData;
```

**Issues:**
- Using `as any` defeats TypeScript's purpose
- Could break at runtime if structure changes
- Should use proper type guard

**Better:**
```typescript
const prospectData = 'prospectData' in customer ? customer.prospectData : null;
// Or define proper Prospect type that extends Customer
```

---

### 13. **Drag Visual Feedback**
**Location:** KanbanBoard.tsx lines 89-91

```typescript
${draggedCustomerId === customer.id ? 'opacity-50 grayscale scale-95 ring-2 ring-blue-100' : ''}
```

**Minor UX issue:**
- **Grayscale** makes it hard to see what you're dragging
- **scale-95** is subtle (could be more obvious)
- No **ghost/preview** of card at cursor

**Better approach:**
- Keep color, just reduce opacity
- Add cursor: 'grabbing' class
- Consider showing preview at drop location

---

### 14. **Tab Label Inconsistency**
**Location:** TabNavigation.tsx

```typescript
label: '활성 Deal',    // Korean + English
label: '잠재 고객',     // Korean
label: '프로스펙트',    // Korean transliteration of English
label: 'Lost Deals',   // English
```

**Minor issue:**
- **Mixed languages** in tab labels
- "Lost Deals" is only English label
- Inconsistent terminology

**Should be all Korean:**
```typescript
label: '활성 거래',
label: '잠재 고객',
label: '발굴 고객',
label: '종료된 거래',
```

---

### 15. **No Loading State During Drag**
When user drags a card and drops it:

```typescript
const handleDrop = useCallback(async (e: React.DragEvent, targetStatus: CustomerStatus) => {
  e.preventDefault();
  if (!draggedCustomerId) return;

  await onStatusChange(draggedCustomerId, targetStatus);
  setDraggedCustomerId(null);
}, [draggedCustomerId, onStatusChange]);
```

**Issues:**
- No **loading indicator** during API call
- Card stays in original position until API responds
- If API fails, card doesn't return to original column (just disappears)
- No **rollback** on error

---

## 📊 SUMMARY

### Critical Issues That Break Functionality:

| Issue | Impact | Users Affected |
|-------|--------|----------------|
| Missing "lost" column | Lost deals invisible in kanban | All users marking deals as lost |
| Broken "Lost Deals" tab | Shows empty kanban | All users clicking Lost tab |
| Missing "prospect" column | Prospects not shown in kanban | Users with prospects |

### Most Important Fixes:

1. ✅ **Add "lost" column** to kanban board
2. ✅ **Add "prospect" column** OR filter prospects differently
3. ✅ **Fix Lost Deals tab** to show appropriate view
4. ✅ **Add ARIA attributes** for accessibility
5. ✅ **Fix mobile scroll sync** calculation

### Recommended Column Structure:

```typescript
export const KANBAN_COLUMNS = [
  { id: 'prospect', title: '발굴 고객', accent: 'border-l-purple-500' },
  { id: 'new', title: '신규 고객', accent: 'border-l-slate-400' },
  { id: 'contact', title: '연락 중', accent: 'border-l-blue-500' },
  { id: 'negotiation', title: '제안 검토', accent: 'border-l-indigo-600' },
  { id: 'won', title: '계약 완료', accent: 'border-l-emerald-500' },
  { id: 'lost', title: '종료', accent: 'border-l-red-500' },
];
```

OR separate view for lost deals:

```typescript
// When activeTab === 'lost', show table view instead of kanban
{activeTab === 'lost' ? (
  <LostDealsTable customers={filteredCustomers} />
) : (
  <KanbanBoard ... />
)}
```

---

## 🎯 IMMEDIATE ACTION ITEMS

### Week 1:
1. Add missing "lost" and "prospect" columns to kanban
2. Fix broken "Lost Deals" tab behavior
3. Add basic ARIA attributes for accessibility
4. Fix tab label consistency (all Korean)

### Week 2:
5. Improve mobile scroll sync calculation
6. Add loading states during drag operations
7. Better empty states with CTAs
8. Fix column color inconsistency

### Week 3:
9. Implement keyboard navigation for kanban
10. Add accessible tooltips
11. Add optimistic updates for counts
12. Improve drag visual feedback

---

## 🔧 TECHNICAL DEBT

- Type casting with `as any` should be removed
- Drag and drop needs proper error handling
- Mobile column width should be responsive
- Tab navigation needs proper ARIA structure
- No tests for kanban drag/drop logic
