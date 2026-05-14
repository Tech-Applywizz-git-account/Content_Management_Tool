/**
 * Google Sheets -> Supabase row-level sync.
 *
 * Required script properties:
 *   SUPABASE_URL              https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY service role key, stored only in Script Properties
 *   DEFAULT_USER_ID           optional public.users id for created_by_user_id
 *
 * Install once from Apps Script:
 *   setupInstallableOnChangeTrigger()
 *
 * Trigger:
 *   Event source: From spreadsheet
 *   Event type: On change
 */

const SCRIPT_VERSION = '2026-05-14-row-sync-v1';
const SYNC_STATE_PREFIX = 'synced_row_fingerprints__';

const SHEET_CONFIGS = {
  'JOB BOARD': {
    brandName: 'APPLYWIZZ JOB BOARD',
    brandType: 'REEL',
    tables: [{
      headerMarkers: ['Name', 'Commercials', 'Type', 'Phone Number', 'Email', 'Insta Link'],
      influencerName: 'Name',
      influencer: {
        budget: 'Commercials',
        campaign_type: 'Type',
        contact_details: 'Phone Number',
        influencer_email: 'Email'
      },
      link: 'Insta Link',
      linkFields: {
        posting_date: '',
        comments: '',
        leads: '',
        resource: '',
        price: ''
      }
    }]
  },
  'Lead Magnets': {
    brandName: 'LEAD MAGNET',
    brandType: 'REEL',
    tables: [{
      headerMarkers: ['Influencer Name', 'Posting Date', 'URL', 'Resource', 'Comments', 'Leads', 'Price'],
      influencerName: 'Influencer Name',
      influencer: {},
      link: 'URL',
      linkFields: {
        posting_date: 'Posting Date',
        resource: 'Resource',
        comments: 'Comments',
        leads: 'Leads',
        price: 'Price'
      }
    }]
  },
  'Career Identifier': {
    brandName: 'CAREER IDENTIFIER',
    brandType: 'REEL',
    tables: [{
      headerMarkers: ['Influencer Name', 'Posting Date', 'URL', 'Comments', 'Leads', 'Price'],
      influencerName: 'Influencer Name',
      influencer: {},
      link: 'URL',
      linkFields: {
        posting_date: 'Posting Date',
        comments: 'Comments',
        leads: 'Leads',
        price: 'Price'
      }
    }]
  },
  'Applywizz': {
    brandName: 'APPLYWIZZ',
    brandType: 'REEL',
    tables: [{
      headerMarkers: ['Influencer Name', 'Posting Date', 'URL', 'Comments', 'Leads', 'Price'],
      influencerName: 'Influencer Name',
      influencer: {},
      link: 'URL',
      linkFields: {
        posting_date: 'Posting Date',
        comments: 'Comments',
        leads: 'Leads',
        price: 'Price'
      }
    }]
  },
  'Applywizz Stories Till Now': {
    brandName: 'APPLYWIZZ STORIES',
    brandType: 'STORY',
    tables: [
      {
        key: 'applywizz_stories_summary',
        headerMarkers: ['Influencer Name', 'Posting Dates', 'Amount', 'Payment Status', 'Payment Through', 'Payment Date'],
        influencerName: 'Influencer Name',
        influencer: {
          budget: 'Amount',
          payment: 'Payment Status',
          platform_type: 'Payment Through',
          payment_date: 'Payment Date'
        }
      },
      {
        key: 'applywizz_stories_links',
        headerMarkers: ['Influencer Name', 'Total Stories Till Date', 'Posting Dates', 'URL', 'Amount', 'Payment Status'],
        influencerName: 'Influencer Name',
        influencer: {
          budget: 'Amount',
          payment: 'Payment Status'
        },
        story: {
          story_date: 'Posting Dates',
          story_link: 'URL'
        }
      }
    ]
  },
  'Manasa Stories': {
    brandName: 'MANASA STORIES',
    brandType: 'STORY',
    tables: [{
      headerMarkers: ['Influencer Name', 'Posting Dates', 'Price', 'Payment Done'],
      influencerName: 'Influencer Name',
      influencer: {
        budget: 'Price',
        payment_date: 'Payment Done'
      }
    }]
  }
};

function setupInstallableOnChangeTrigger() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'syncNewRowsOnChange')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('syncNewRowsOnChange')
    .forSpreadsheet(ss)
    .onChange()
    .create();

  return {
    ok: true,
    version: SCRIPT_VERSION,
    message: 'Installable On Change trigger created.'
  };
}

function initializeSyncStateToCurrentRows() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sheet => {
    const config = SHEET_CONFIGS[sheet.getName()] || getDynamicSheetConfig_(sheet);
    if (!config) return;
    props.setProperty(stateKey(sheet.getName()), JSON.stringify(collectRowFingerprints_(sheet, config)));
  });
}

function resetSyncState() {
  const props = PropertiesService.getScriptProperties();
  SpreadsheetApp.getActive().getSheets().forEach(sheet => {
    props.deleteProperty(stateKey(sheet.getName()));
  });
}

function syncNewRowsOnChange(e) {
  if (!e) return;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    console.log('Another sync already running. Skipping.');
    return;
  }

  try {
    syncSheetRows_();
  } catch (error) {
    logError_('syncNewRowsOnChange', error, { changeType: e && e.changeType });
    throw error;
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function syncSheetRows_() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActive();
  const allSheets = ss.getSheets();

  allSheets.forEach(sheet => {
    const sheetName = sheet.getName();
    const config = SHEET_CONFIGS[sheetName] || getDynamicSheetConfig_(sheet);
    if (!config) return;

    const key = stateKey(sheetName);
    const synced = readFingerprintSet_(props.getProperty(key));
    const current = processNewRows_(sheet, synced, config);
    props.setProperty(key, JSON.stringify(Array.from(current)));
  });
}

function processNewRows_(sheet, synced, config) {
  const activeConfig = config || SHEET_CONFIGS[sheet.getName()] || getDynamicSheetConfig_(sheet);
  if (!activeConfig) return synced;
  const tableParsers = buildTableParsers_(sheet, activeConfig);
  const current = new Set(synced);
  const lastRow = sheet.getLastRow();

  for (let rowIndex = 1; rowIndex <= lastRow; rowIndex += 1) {
    const parser = tableParsers
      .filter(candidate => rowIndex > candidate.headerRow)
      .sort((a, b) => b.headerRow - a.headerRow)[0];

    if (!parser) continue;

    const rowValues = sheet.getRange(rowIndex, 1, 1, parser.width).getValues()[0];
    if (isBlankRow_(rowValues) || isHeaderRow_(rowValues, parser.table.headerMarkers)) continue;

    const fingerprint = rowFingerprint_(sheet.getName(), parser.table, rowValues, parser.headerMap);
    const alreadyProcessed = current.has(fingerprint);

    try {
      const record = rowToRecord_(rowValues, parser.headerMap);
      syncMappedRecord_(record, config, parser.table, sheet.getName(), rowIndex);
      
      if (!alreadyProcessed) {
        current.add(fingerprint);
      }
    } catch (error) {
      logError_('processRows_', error, { sheet: sheet.getName(), rowIndex: rowIndex });
    }
  }

  return current;
}

function collectRowFingerprints_(sheet, config) {
  const activeConfig = config || SHEET_CONFIGS[sheet.getName()] || getDynamicSheetConfig_(sheet);
  if (!activeConfig) return [];
  const tableParsers = buildTableParsers_(sheet, activeConfig);
  const fingerprints = [];
  const lastRow = sheet.getLastRow();

  for (let rowIndex = 1; rowIndex <= lastRow; rowIndex += 1) {
    const parser = tableParsers
      .filter(candidate => rowIndex > candidate.headerRow)
      .sort((a, b) => b.headerRow - a.headerRow)[0];
    if (!parser) continue;

    const rowValues = sheet.getRange(rowIndex, 1, 1, parser.width).getValues()[0];
    if (isBlankRow_(rowValues) || isHeaderRow_(rowValues, parser.table.headerMarkers)) continue;
    fingerprints.push(rowFingerprint_(sheet.getName(), parser.table, rowValues, parser.headerMap));
  }

  return fingerprints;
}

function buildTableParsers_(sheet, config) {
  const values = sheet.getDataRange().getValues();
  const parsers = [];

  config.tables.forEach(table => {
    values.forEach((row, index) => {
      if (!isHeaderRow_(row, table.headerMarkers)) return;

      const headerMap = {};
      row.forEach((cell, columnIndex) => {
        const header = normalizeHeader_(cell);
        if (header) headerMap[header] = columnIndex;
      });

      parsers.push({
        table: table,
        headerRow: index + 1,
        headerMap: headerMap,
        width: row.length
      });
    });
  });

  return parsers.sort((a, b) => a.headerRow - b.headerRow);
}

function syncMappedRecord_(record, config, table, sheetName, rowIndex) {
  const name = cleanText_(record[table.influencerName]);
  if (!name) return;

  const brandName = normalizeBrandName_(config.brandName || sheetName);
  const influencerFields = mapFields_(record, table.influencer || {});
  influencerFields.influencer_name = name;
  influencerFields.brand_name = brandName;
  influencerFields.brand_type = config.brandType;

  const influencer = upsertInfluencer_(influencerFields);

  if (table.link) {
    const link = cleanText_(record[table.link]);
    const extraLinkFields = table.linkFields ? mapFields_(record, table.linkFields) : {};
    if (link || Object.keys(extraLinkFields).length > 0) {
      upsertInfluencerLink_(influencer.id, link, brandName, extraLinkFields);
    }
  }

  if (table.story) {
    const story = mapFields_(record, table.story);
    if (story.story_link || story.story_date) {
      upsertInfluencerStory_(influencer.id, story);
    }
  }

  logInfo_('row synced', { sheet: sheetName, rowIndex: rowIndex, influencerId: influencer.id, brandName: brandName });
}

function upsertInfluencer_(fields) {
  const existing = supabaseGetOne_(
    'influencers',
    'id',
    [
      ['influencer_name', 'eq', fields.influencer_name],
      ['brand_name', 'eq', fields.brand_name]
    ]
  );

  const payload = removeEmptyFields_(fields);
  payload.updated_at = new Date().toISOString();

  if (existing && existing.id) {
    supabasePatch_('influencers', existing.id, payload);
    return Object.assign({}, existing, payload);
  }

  payload.created_by_user_id = payload.created_by_user_id || getDefaultUserId_();
  const inserted = supabasePost_('influencers', payload);
  return inserted;
}

function upsertInfluencerLink_(influencerId, link, brandName, extraFields) {
  if (!link && (!extraFields || Object.keys(extraFields).length === 0)) {
    return null;
  }

  let filters = [
    ['influencer_id', 'eq', influencerId]
  ];

  if (link) {
    filters.push(['link', 'eq', link]);
  } else {
    if (extraFields.posting_date) {
      filters.push(['posting_date', 'eq', extraFields.posting_date]);
    }
    if (extraFields.resource) {
      filters.push(['resource', 'eq', extraFields.resource]);
    }
  }

  const existing = supabaseGetOne_('influencer_links', 'id', filters);

  const payload = {
    influencer_id: influencerId,
    link: link,
    brand_name: brandName,
    updated_at: new Date().toISOString(),
    created_by_user_id: getDefaultUserId_(),
    ...removeEmptyFields_(extraFields || {})
  };

  if (existing && existing.id) {
    supabasePatch_('influencer_links', existing.id, payload);
    return Object.assign({}, existing, payload);
  }

  return supabasePost_('influencer_links', payload);
}

function upsertInfluencerStory_(influencerId, story) {
  const link = cleanText_(story.story_link);
  const date = toDateString_(story.story_date);
  if (!link && !date) return null;

  // Use both link and date for more robust identification if one is missing
  // Use influencer_id and story_date as the base for all lookups
  const filters = [
    ['influencer_id', 'eq', influencerId],
    ['story_date', 'eq', date]
  ];

  if (link) {
    filters.push(['story_link', 'eq', link]);
  } else if (story.story_caption) {
    filters.push(['story_caption', 'eq', story.story_caption]);
  }

  const existing = supabaseGetOne_('influencer_stories', 'id', filters);

  const payload = {
    influencer_id: influencerId,
    story_date: date,
    story_link: link,
    story_caption: story.story_caption || '',
    updated_at: new Date().toISOString(),
    created_by_user_id: getDefaultUserId_()
  };

  if (existing && existing.id) {
    supabasePatch_('influencer_stories', existing.id, removeEmptyFields_(payload));
    return Object.assign({}, existing, payload);
  }

  return supabasePost_('influencer_stories', payload);
}

function mapFields_(record, mapping) {
  const output = {};
  Object.keys(mapping).forEach(target => {
    const source = mapping[target];
    const value = cleanText_(record[source]);
    if (value !== '') output[target] = target.indexOf('date') >= 0 ? toDateString_(value) : value;
  });
  return output;
}

function rowToRecord_(row, headerMap) {
  const record = {};
  Object.keys(headerMap).forEach(header => {
    record[header] = row[headerMap[header]];
  });
  return record;
}

function isHeaderRow_(row, markers) {
  const normalized = row.map(normalizeHeader_);
  return markers.every(marker => normalized.indexOf(normalizeHeader_(marker)) >= 0);
}

function isBlankRow_(row) {
  return row.every(cell => cleanText_(cell) === '');
}

function normalizeHeader_(value) {
  return cleanText_(value).replace(/\s+/g, ' ').trim();
}

function cleanText_(value) {
  if (value === null || value === undefined) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') return toDateString_(value);
  return String(value).trim();
}

function toDateString_(value) {
  if (!value) return '';
  
  // 1. Handle JS Date objects (standard Sheets behavior)
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  
  const str = String(value).trim();
  if (!str) return '';

  // 2. Handle YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // 3. Handle natural formats like "31 March", "March 31", etc.
  const months = {
    'JAN': '01', 'JANUARY': '01',
    'FEB': '02', 'FEBRUARY': '02',
    'MAR': '03', 'MARCH': '03',
    'APR': '04', 'APRIL': '04',
    'MAY': '05',
    'JUN': '06', 'JUNE': '06',
    'JUL': '07', 'JULY': '07',
    'AUG': '08', 'AUGUST': '08',
    'SEP': '09', 'SEPTEMBER': '09',
    'OCT': '10', 'OCTOBER': '10',
    'NOV': '11', 'NOVEMBER': '11',
    'DEC': '12', 'DECEMBER': '12'
  };

  const parts = str.split(/[\s,]+/);
  if (parts.length >= 2) {
    let day = '';
    let month = '';
    let year = '2026'; // Default as requested

    const p0 = parts[0].toUpperCase();
    const p1 = parts[1].toUpperCase();

    // Check if first part is month (e.g., "March 31") or second part is month (e.g., "31 March")
    if (months[p0]) {
      month = months[p0];
      day = parts[1].replace(/\D/g, '');
    } else if (months[p1]) {
      month = months[p1];
      day = parts[0].replace(/\D/g, '');
    }
    
    // Check if a third part exists that looks like a year
    if (parts.length >= 3 && /^\d{4}$/.test(parts[2])) {
      year = parts[2];
    }

    if (day && month) {
      // Ensure day is 2 digits
      if (day.length === 1) day = '0' + day;
      return year + '-' + month + '-' + day;
    }
  }

  // Final fallback: return original trimmed string
  return str;
}

function removeEmptyFields_(payload) {
  const output = {};
  Object.keys(payload).forEach(key => {
    if (payload[key] !== '' && payload[key] !== null && payload[key] !== undefined) {
      output[key] = payload[key];
    }
  });
  return output;
}

function normalizeBrandName_(value) {
  const raw = cleanText_(value).toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, '');

  if (compact.indexOf('STORY') >= 0 || compact.indexOf('STORIES') >= 0) {
    if (compact.indexOf('MANASA') >= 0) return 'MANASA STORIES';
    if (compact.indexOf('APPLYWIZZ') >= 0) return 'APPLYWIZZ STORIES';
    return raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  if (compact.indexOf('JOBBOARD') >= 0) return 'APPLYWIZZ JOB BOARD';
  if (compact.indexOf('LEADMAGNET') >= 0 || compact.indexOf('RTW') >= 0) return 'LEAD MAGNET';
  if (compact.indexOf('CAREERIDENTIFIER') >= 0 || compact === 'CIR') return 'CAREER IDENTIFIER';
  if (compact === 'AW' || compact.indexOf('APPLYWIZZ') >= 0) return 'APPLYWIZZ';
  return raw.replace(/[()_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * AUTO-DETECTION LOGIC
 * If a sheet is not in SHEET_CONFIGS, we try to detect its structure.
 */
function getDynamicSheetConfig_(sheet) {
  const sheetName = sheet.getName();
  const nameUpper = sheetName.toUpperCase();
  
  // 1. Determine Brand Type (Rule: STORY/STORIES keyword)
  const isStory = nameUpper.includes('STORY') || nameUpper.includes('STORIES');
  const brandType = isStory ? 'STORY' : 'REEL';
  
  // 2. Determine Brand Name
  const brandName = normalizeBrandName_(sheetName);

  // 3. Scan for headers to determine mappings
  const lastCol = sheet.getLastColumn();
  const lastRow = sheet.getLastRow();
  if (lastCol === 0 || lastRow === 0) return null;
  
  // Scan first 20 rows for headers
  const values = sheet.getRange(1, 1, Math.min(lastRow, 20), lastCol).getValues();
  
  // Detection Markers from Prompt
  const reelMarkers = ['URL', 'Leads', 'Comments', 'Price'];
  const storyMarkers = ['Posting Dates', 'Payment Status', 'Payment Through'];
  
  let detectedTable = null;

  // Try REEL detection
  for (let i = 0; i < values.length; i++) {
    if (isHeaderRow_(values[i], reelMarkers)) {
      detectedTable = {
        headerMarkers: reelMarkers,
        influencerName: findHeader_(values[i], ['INFLUENCER NAME', 'NAME']) || 'Influencer Name',
        influencer: {},
        link: findHeader_(values[i], ['URL', 'LINK', 'INSTA LINK']),
        linkFields: {
          posting_date: findHeader_(values[i], ['POSTING DATE', 'DATE']),
          comments: findHeader_(values[i], ['COMMENTS', 'REMARKS']),
          leads: findHeader_(values[i], ['LEADS']),
          resource: findHeader_(values[i], ['RESOURCE']),
          price: findHeader_(values[i], ['PRICE', 'BUDGET', 'COST', 'AMOUNT'])
        }
      };
      break;
    }
  }
  
  // Try STORY detection if type is STORY or REEL failed
  if (!detectedTable && isStory) {
    for (let i = 0; i < values.length; i++) {
      if (isHeaderRow_(values[i], storyMarkers)) {
        detectedTable = {
          headerMarkers: storyMarkers,
          influencerName: findHeader_(values[i], ['INFLUENCER NAME', 'NAME']) || 'Influencer Name',
          influencer: {
            payment: findHeader_(values[i], ['PAYMENT STATUS', 'STATUS']),
            platform_type: findHeader_(values[i], ['PAYMENT THROUGH', 'METHOD']),
            payment_date: findHeader_(values[i], ['PAYMENT DATE', 'DONE DATE']),
            budget: findHeader_(values[i], ['PRICE', 'AMOUNT', 'COST'])
          },
          story: {
            story_date: findHeader_(values[i], ['POSTING DATES', 'POSTING DATE']),
            story_link: findHeader_(values[i], ['URL', 'LINK', 'STORY LINK'])
          }
        };
        break;
      }
    }
  }
  
  // DEFAULT BEHAVIOR: If sheet is unknown and not story-related
  if (!detectedTable && brandType === 'REEL') {
     // Check for bare minimum URL to justify sync
     for (let i = 0; i < values.length; i++) {
       const row = values[i];
       const normalized = row.map(normalizeHeader_);
       if (normalized.indexOf('URL') >= 0 || normalized.indexOf('LINK') >= 0) {
         const urlCol = findHeader_(row, ['URL', 'LINK']);
         detectedTable = {
           headerMarkers: [urlCol],
           influencerName: findHeader_(row, ['INFLUENCER NAME', 'NAME']) || 'Name',
           influencer: {},
           link: urlCol,
           linkFields: {
             price: findHeader_(row, ['PRICE', 'BUDGET', 'AMOUNT'])
           }
         };
         break;
       }
     }
  }

  if (!detectedTable) return null;

  return {
    brandName: brandName,
    brandType: brandType,
    tables: [detectedTable]
  };
}

function findHeader_(headerRow, candidates) {
  const normalized = headerRow.map(normalizeHeader_);
  for (let cand of candidates) {
    const idx = normalized.indexOf(normalizeHeader_(cand));
    if (idx >= 0) return headerRow[idx];
  }
  return null;
}

function stateKey(sheetName) {
  return SYNC_STATE_PREFIX + sheetName;
}

function readFingerprintSet_(json) {
  if (!json) return new Set();
  try {
    return new Set(JSON.parse(json));
  } catch (error) {
    return new Set();
  }
}

function rowFingerprint_(sheetName, table, rowValues, headerMap) {
  const record = rowToRecord_(rowValues, headerMap || {});
  const identifier = [
    sheetName,
    cleanText_(record[table.influencerName]),
    cleanText_(record[table.link || 'URL']),
    cleanText_(record['Posting Date']),
    cleanText_(record['Posting Dates'])
  ].join('||');

  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identifier);
  return bytes.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function getDefaultUserId_() {
  return PropertiesService.getScriptProperties().getProperty('DEFAULT_USER_ID') || null;
}

function supabaseConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('SUPABASE_URL');
  const key = props.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Script Properties.');
  }
  return { url: url.replace(/\/$/, ''), key: key };
}

function supabaseGetOne_(table, select, filters) {
  const config = supabaseConfig_();
  const params = ['select=' + encodeURIComponent(select), 'limit=1'];
  filters.forEach(filter => {
    params.push(encodeURIComponent(filter[0]) + '=' + filter[1] + '.' + encodeURIComponent(filter[2]));
  });

  const response = UrlFetchApp.fetch(config.url + '/rest/v1/' + table + '?' + params.join('&'), {
    method: 'get',
    muteHttpExceptions: true,
    headers: supabaseHeaders_(config.key)
  });
  const body = parseResponse_(response, 'GET ' + table);
  return body && body.length ? body[0] : null;
}

function supabasePost_(table, payload) {
  const config = supabaseConfig_();
  const response = UrlFetchApp.fetch(config.url + '/rest/v1/' + table, {
    method: 'post',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
    headers: Object.assign(supabaseHeaders_(config.key), {
      Prefer: 'return=representation'
    })
  });
  const body = parseResponse_(response, 'POST ' + table);
  return body && body[0] ? body[0] : body;
}

function supabasePatch_(table, id, payload) {
  const config = supabaseConfig_();
  const response = UrlFetchApp.fetch(config.url + '/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id), {
    method: 'patch',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
    headers: Object.assign(supabaseHeaders_(config.key), {
      Prefer: 'return=minimal'
    })
  });
  parseResponse_(response, 'PATCH ' + table);
  return true;
}

function supabaseHeaders_(key) {
  return {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json'
  };
}

function parseResponse_(response, label) {
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error(label + ' failed: ' + code + ' ' + text);
  }
  return text ? JSON.parse(text) : null;
}

function logInfo_(message, context) {
  console.log(JSON.stringify({
    level: 'info',
    version: SCRIPT_VERSION,
    message: message,
    context: context || {}
  }));
}

function logError_(where, error, context) {
  console.error(JSON.stringify({
    level: 'error',
    version: SCRIPT_VERSION,
    where: where,
    message: error && error.message ? error.message : String(error),
    stack: error && error.stack ? error.stack : '',
    context: context || {}
  }));
}
