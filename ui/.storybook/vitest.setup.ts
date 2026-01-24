import { setProjectAnnotations } from "@storybook/react"
import * as previewAnnotations from "./preview"

/**
 * Set up Storybook annotations for Vitest browser tests.
 * This ensures decorators, parameters, and other preview config are applied.
 */
setProjectAnnotations([previewAnnotations])
