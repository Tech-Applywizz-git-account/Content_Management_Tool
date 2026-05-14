/**
 * Deprecated.
 *
 * Google Sheets imports are now handled by scripts/google_sheets_supabase_sync.gs
 * through an installable Spreadsheet "On change" trigger. The old full-sheet
 * importer was removed because sheet URL columns are reel/story URLs and must
 * only be written to influencer_links or influencer_stories.
 */

console.log([
  'This manual importer is deprecated.',
  'Deploy scripts/google_sheets_supabase_sync.gs in Google Apps Script instead.',
  'Run setupInstallableOnChangeTrigger() after setting Script Properties.'
].join('\n'));
