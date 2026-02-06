import { RouterProvider } from "react-router-dom"
import { router } from "./routes"

/**
 * Main Ralph UI application. Renders the router which handles all workspace routing.
 */
export function App() {
  return <RouterProvider router={router} />
}
