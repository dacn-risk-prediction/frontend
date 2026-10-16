import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Academic Risk Prediction & XAI System</CardTitle>
          <CardDescription>
            Frontend foundation initialized with React, Vite, Tailwind CSS, and shadcn/ui.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Architecture: bulletproof-react feature modules, TanStack Query, and dual-token auth ready.
          </p>
          <Button variant="default">Getting Started</Button>
        </CardContent>
      </Card>
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

