export const APP_BASE_PATH =
  import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/'
    ? import.meta.env.BASE_URL.replace(/\/+$/, '')
    : ''

export const withAppBasePath = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${APP_BASE_PATH}${normalizedPath}` || '/'
}
