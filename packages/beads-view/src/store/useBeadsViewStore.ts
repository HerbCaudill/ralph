import { useContext } from "react"
import { useStore } from "zustand"
import { BeadsViewStoreContext } from "./BeadsViewStoreContext"
import { beadsViewStore } from "./beadsViewStore"
import type { BeadsViewStore } from "./types"

/** Access the beads-view store with a selector. */
export function useBeadsViewStore<T>(
  /** Selector for derived state. */
  selector: (state: BeadsViewStore) => T,
): T {
  const store = useContext(BeadsViewStoreContext)
  return useStore(store ?? beadsViewStore, selector)
}
