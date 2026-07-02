/** IPC channel names shared between the main-process handlers and the preload bridge. */
export const TODAY_GET_SPANS_CHANNEL = 'today:getSpans'
export const TODAY_GET_FOCUS_QUALITY_CHANNEL = 'today:getFocusQuality'
export const TODAY_GET_GOAL_PROGRESS_CHANNEL = 'today:getGoalProgress'

export const TRENDS_GET_CHANNEL = 'trends:get'

export const GOALS_GET_CONFIG_CHANNEL = 'goals:getConfig'
export const GOALS_SET_CONFIG_CHANNEL = 'goals:setConfig'

export const CATEGORIES_LIST_CHANNEL = 'categories:list'
export const CATEGORIES_CREATE_CHANNEL = 'categories:create'
export const CATEGORIES_UPDATE_CHANNEL = 'categories:update'
export const CATEGORIES_DELETE_CHANNEL = 'categories:delete'

export const PROJECTS_LIST_CHANNEL = 'projects:list'
export const PROJECTS_CREATE_CHANNEL = 'projects:create'
export const PROJECTS_UPDATE_CHANNEL = 'projects:update'
export const PROJECTS_DELETE_CHANNEL = 'projects:delete'

export const RULES_LIST_CHANNEL = 'rules:list'
export const RULES_CREATE_CHANNEL = 'rules:create'
export const RULES_DELETE_CHANNEL = 'rules:delete'
export const RULES_REORDER_CHANNEL = 'rules:reorder'

export const OVERRIDES_CREATE_CHANNEL = 'overrides:create'
export const OVERRIDES_DELETE_CHANNEL = 'overrides:delete'

export const MANUAL_ENTRIES_CREATE_CHANNEL = 'manualEntries:create'
export const MANUAL_ENTRIES_DELETE_CHANNEL = 'manualEntries:delete'

export const DISCARDED_SPANS_CREATE_CHANNEL = 'discardedSpans:create'

export const SETTINGS_GET_CHANNEL = 'settings:get'
export const SETTINGS_SET_APP_LEVEL_ONLY_CHANNEL = 'settings:setAppLevelOnly'

export const WORK_MODE_GET_STATE_CHANNEL = 'workMode:getState'
export const WORK_MODE_GET_WORKING_HOURS_CHANNEL = 'workMode:getWorkingHours'
export const WORK_MODE_SET_WORKING_HOURS_CHANNEL = 'workMode:setWorkingHours'
export const WORK_MODE_SET_OVERRIDE_CHANNEL = 'workMode:setOverride'
export const WORK_MODE_CLEAR_OVERRIDE_CHANNEL = 'workMode:clearOverride'

export const PERMISSIONS_GET_STATUS_CHANNEL = 'permissions:getStatus'
export const PERMISSIONS_REQUEST_SCREEN_RECORDING_CHANNEL = 'permissions:requestScreenRecording'
export const PERMISSIONS_OPEN_SCREEN_RECORDING_SETTINGS_CHANNEL = 'permissions:openScreenRecordingSettings'

export const DATA_EXPORT_SPANS_CSV_CHANNEL = 'data:exportSpansCsv'
export const DATA_EXPORT_DAILY_ROLLUPS_CSV_CHANNEL = 'data:exportDailyRollupsCsv'
export const DATA_COPY_DATABASE_CHANNEL = 'data:copyDatabase'
export const DATA_DELETE_ALL_CHANNEL = 'data:deleteAll'
