import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { ThemeSync } from './app/ThemeSync'

export default function App() {
  return (
    <>
      <ThemeSync />
      <RouterProvider router={router} />
    </>
  )
}
