import { setProjectAnnotations } from "@storybook/react"
import * as previewAnnotations from "./preview"

/** Apply Storybook decorators and parameters to Vitest browser tests. */
setProjectAnnotations([previewAnnotations])
