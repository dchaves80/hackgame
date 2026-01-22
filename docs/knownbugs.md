# Known Bugs

## Context Menu - Paste in FileManager Empty Space

**Status:** ✅ Fixed (2026-01-03)
**Priority:** High
**Date Reported:** 2025-10-11

### Description
When right-clicking on empty space in the FileManager window and selecting "Paste", the item gets pasted into the Desktop instead of the FileManager's current directory.

### Expected Behavior
- Right-click on empty space in FileManager
- Select "Paste"
- Item should be pasted into FileManager's `currentPath`

### Actual Behavior
- Right-click on empty space in FileManager
- Select "Paste"
- Item gets pasted into Desktop (`/home/[username]/Desktop`)

### Notes
- Paste works correctly when right-clicking on an existing file/folder in FileManager
- Both Desktop and FileManager use `createPortal` to render context menus to `document.body`
- Both components have `e.stopPropagation()` in their context menu handlers
- Both components conditionally render menu actions based on `contextMenu.item`

### Possible Causes to Investigate
1. Event propagation still reaching Desktop despite `stopPropagation()`
2. Multiple context menus being rendered simultaneously
3. Click handler targeting wrong menu instance
4. Window/Portal z-index layering issue

### Related Files
- `frontend-game/src/pages/Desktop.tsx` - Lines 869-882 (Desktop context menu)
- `frontend-game/src/components/FileManagerContent.tsx` - Lines 179-185 (Empty space handler), 634-647 (Context menu render)
- `frontend-game/src/components/ContextMenu.tsx` - Context menu component
