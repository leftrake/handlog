import { RouterProvider } from 'react-router'
import { router } from './app/router'
import { ThemeSync } from './app/ThemeSync'
import { UpdatePrompt } from './app/UpdatePrompt'

export default function App() {
  return (
    <>
      <ThemeSync />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </>
  )
}
