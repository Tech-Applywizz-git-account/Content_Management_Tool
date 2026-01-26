# Workflow Modifications - Video Content

## Changes Implemented

### 1. Workflow Path Update
Modified the standard workflow for Video content projects:
**Old:** `Cine` -> `Editor` -> `Multi-Writer Approval` -> `CMO` -> `CEO` -> `Ops`
**New:** `Cine` -> **`Multi-Writer Approval`** -> **`Editor`** -> (**`Designer`**) -> **`Post Review (CMO)`** -> `Final Review (CEO)` -> `Ops`

### 2. Component Updates
- **CineProjectDetail.tsx**: 
  - Uploading a video now transitions the project to `MULTI_WRITER_APPROVAL` (assigned to Writers) instead of Video Editing.
  - Notifications are sent to Writers.
- **WriterVideoApproval.tsx**:
  - Approving a video now transitions the project to `VIDEO_EDITING` (assigned to Editor).
  - Notifications are sent to Editors.
  - Success message updated.
- **services/supabaseDb.ts**:
  - Updated `getNextStage` mappings to reflect the new path.
  - Updated `workflow.approve` logic for the Multi-Writer stage to properly route to Editor.

### 3. Logic Details
- **Thumbnail Logic**: After Editor uploads:
  - If **Thumbnail Required**: Goes to `THUMBNAIL_DESIGN` (Designer) -> `POST_WRITER_REVIEW` (CMO).
  - If **No Thumbnail**: Goes directly to `POST_WRITER_REVIEW` (CMO).
- **Rework**: Logic remains robust, routing back to the `rework_initiator_stage` if available.

### Verification
- **Cine Upload**: Should appear in Writer's dashboard ("Video Approval").
- **Writer Approval**: Should appear in Editor's dashboard ("Video Editing").
- **Editor Upload**: Should appear in Designer's or CMO's dashboard depending on thumbnail setting.
