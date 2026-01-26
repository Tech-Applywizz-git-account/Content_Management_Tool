# Role-Based Filtering for Scripts View (Cine/Editor/SubEditor/Designer)

## 🎯 Goal
Enable role-based filtering (ALL, WRITER, CMO, CEO, POSTED...) and a dedicated "POSTED" tab within the **SCRIPTS** stats view for all creative roles.

## 🛠️ Changes Implemented

### 1. Unified Filtering Logic
Updated `*MyWork` components for **Cine, Editor, SubEditor, and Designer** to handle the `SCRIPTS` view with advanced filtering:

- **State Added**: `activeRoleFilter` (ALL | POSTED | Role)
- **Logic**:
  - `activeRoleFilter === 'ALL'`: Shows all scripts (existing behavior).
  - `activeRoleFilter === 'POSTED'`: Shows only completed projects with a Live URL (`status === 'DONE' && live_url`).
  - `activeRoleFilter === Role.*`: Shows projects assigned_to_role matching the filter.
  - Special Case: `Role.SUB_EDITOR` filter includes both `SUB_EDITOR` and `EDITOR` roles.

### 2. UI Updates
Added a scrollable tab bar specifically for the **Scripts** view, containing:
- ALL (Default)
- POSTED
- WRITER
- CMO
- CEO
- CINE
- EDITOR
- DESIGNER
- OPS

### 3. Components Updated
- `components/cine/CineMyWork.tsx`
- `components/editor/EditorMyWork.tsx`
- `components/subeditor/SubEditorMyWork.tsx`
- `components/designer/DesignerMyWork.tsx`

## ✅ Benefits
- **Consistent Experience**: Every role sees the same scripts filtering interface.
- **Enhanced Visibility**: Users can now quickly find "POSTED" scripts or filter by who is currently working on them, directly from their dashboard stats card.
- **No Data Loss**: All filters operate on the unified `scriptProjects` list passed from the parent dashboard.

## 🧪 Verification
1. Log in as **Cine** (or Editor/Designer/SubEditor).
2. Click the **SCRIPTS** stats card.
3. Observe the new tab bar above the project grid.
4. Click **POSTED** -> Shows only live projects.
5. Click **WRITER** -> Shows projects with Writer role.
6. Click **ALL** -> Shows everything.
