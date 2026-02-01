import { createContext } from "react"
import type { StoreApi } from "zustand"
import type { BeadsViewStore } from "./types"

/** React context for the beads-view store. */
export const BeadsViewStoreContext = createContext<StoreApi<BeadsViewStore> | null>(null)
