import { createElement, lazy, Suspense } from 'react'
import type { ReactElement } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { AppLoadingScreen } from './AppLoadingScreen'

const Dashboard = lazy(() => import('./Dashboard'))
const EditorLayout = lazy(() => import('./EditorLayout'))
const AdminEntry = lazy(() => import('./AdminEntry'))

function withSuspense(element: ReactElement) {
  return createElement(
    Suspense,
    { fallback: createElement(AppLoadingScreen) },
    element,
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: withSuspense(createElement(Dashboard)),
  },
  {
    path: '/admin',
    element: withSuspense(createElement(AdminEntry)),
  },
  {
    path: '/editor/:projectId',
    element: withSuspense(createElement(EditorLayout)),
  },
])
