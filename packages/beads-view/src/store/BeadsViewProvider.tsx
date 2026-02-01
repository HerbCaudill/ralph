import { useRef } from "react"
import type { ReactNode } from "react"
import type { StoreApi } from "zustand"
import { createBeadsViewStore } from "./createBeadsViewStore"
import { BeadsViewStoreContext } from "./BeadsViewStoreContext"
import type { BeadsViewStore } from "./types"

/** Provider for the beads-view store. */
export function BeadsViewProvider({ children, initialState, store }: Props) {
  const storeRef = useRef<StoreApi<BeadsViewStore> | null>(null)

  if (!storeRef.current) {
    storeRef.current = store ?? createBeadsViewStore(initialState ?? {})
  }

  return (
    <BeadsViewStoreContext.Provider value={storeRef.current}>
      {children}
    </BeadsViewStoreContext.Provider>
  )
}

type Props = {
  /** Child nodes to render. */
  children: ReactNode
  /** Optional initial state overrides. */
  initialState?: Partial<BeadsViewStore>
  /** Optional store instance to use. */
  store?: StoreApi<BeadsViewStore>
}
