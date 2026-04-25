import axiosInstance from './axiosInstance'
import { UI_ONLY_AUTH } from '../utils/authMode'

export interface DashboardPreferences {
  widgetVisibility: Record<string, boolean>
  widgetOrder: string[]
  layout: {
    columns?: number
    spacing?: number
    cardStyle?: 'default' | 'compact' | 'spacious'
    showGridLines?: boolean
  }
  dateRange: {
    defaultRange?: '7days' | '30days' | '90days' | 'custom'
    customStart?: string
    customEnd?: string
  }
}

const DASHBOARD_PREFERENCES_STORAGE_KEY = 'shipzilla-dashboard-preferences'

const demoDashboardPreferences: DashboardPreferences = {
  widgetVisibility: {
    quickStats: true,
    quickActions: true,
    insights: true,
    actionItems: true,
    recommendations: false,
    performanceMetrics: true,
    ordersTrend: true,
    financialHealth: true,
    recentActivity: true,
    todaysOperations: true,
    orderStatusChart: true,
    courierComparison: true,
    metricsOverview: true,
    courierPerformance: true,
    topDestinations: true,
  },
  widgetOrder: [
    'quickStats',
    'quickActions',
    'insights',
    'actionItems',
    'performanceMetrics',
    'ordersTrend',
    'financialHealth',
    'recentActivity',
    'todaysOperations',
    'orderStatusChart',
    'courierComparison',
    'metricsOverview',
    'courierPerformance',
    'topDestinations',
  ],
  layout: {
    columns: 12,
    spacing: 3,
    cardStyle: 'default',
    showGridLines: false,
  },
  dateRange: {
    defaultRange: '7days',
  },
}

const getPreferencesStorage = () => (typeof window !== 'undefined' ? window.localStorage : null)

export const getDashboardPreferences = async (): Promise<DashboardPreferences> => {
  if (UI_ONLY_AUTH) {
    const raw = getPreferencesStorage()?.getItem(DASHBOARD_PREFERENCES_STORAGE_KEY)
    if (!raw) return demoDashboardPreferences

    try {
      return {
        ...demoDashboardPreferences,
        ...JSON.parse(raw),
      }
    } catch {
      return demoDashboardPreferences
    }
  }

  const { data } = await axiosInstance.get('/dashboard/preferences')
  return data.success ? data.data : ({} as DashboardPreferences)
}

export const saveDashboardPreferences = async (
  preferences: Partial<DashboardPreferences>,
): Promise<DashboardPreferences> => {
  if (UI_ONLY_AUTH) {
    const nextPreferences = {
      ...demoDashboardPreferences,
      ...preferences,
      widgetVisibility: {
        ...demoDashboardPreferences.widgetVisibility,
        ...(preferences.widgetVisibility ?? {}),
      },
      layout: {
        ...demoDashboardPreferences.layout,
        ...(preferences.layout ?? {}),
      },
      dateRange: {
        ...demoDashboardPreferences.dateRange,
        ...(preferences.dateRange ?? {}),
      },
      widgetOrder: preferences.widgetOrder ?? demoDashboardPreferences.widgetOrder,
    }

    getPreferencesStorage()?.setItem(DASHBOARD_PREFERENCES_STORAGE_KEY, JSON.stringify(nextPreferences))
    return nextPreferences
  }

  const { data } = await axiosInstance.post('/dashboard/preferences', preferences)
  return data.success ? data.data : ({} as DashboardPreferences)
}
