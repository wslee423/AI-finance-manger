import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  initialScope: {
    tags: { app_mode: process.env.APP_MODE ?? 'production' },
  },
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies
      delete event.request.data
      if (event.request.headers) {
        delete event.request.headers['authorization']
        delete event.request.headers['cookie']
      }
    }
    return event
  },
})
