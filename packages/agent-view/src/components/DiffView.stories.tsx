import type { Meta, StoryObj } from "@storybook/react-vite"
import { useArgs } from "storybook/preview-api"
import { DiffView } from "./DiffView"

const meta: Meta<typeof DiffView> = {
  title: "Feedback/DiffView",
  component: DiffView,
  args: {
    isExpanded: false,
  },
  decorators: [
    Story => {
      const [args, setArgs] = useArgs()
      return <Story args={{ ...args, onExpand: () => setArgs({ isExpanded: true }) }} />
    },
  ],
}

export default meta
type Story = StoryObj<typeof meta>

export const SimpleChange: Story = {
  args: {
    oldString: `function greet(name) {
  return "Hello, " + name;
}`,
    newString: `function greet(name) {
  return \`Hello, \${name}!\`;
}`,
    language: "typescript",
  },
}

export const AddedLines: Story = {
  args: {
    oldString: `const config = {
  debug: false,
};`,
    newString: `const config = {
  debug: false,
  verbose: true,
  timeout: 5000,
};`,
    language: "typescript",
  },
}

export const RemovedLines: Story = {
  args: {
    oldString: `import React from "react";
import { useState } from "react";
import { useEffect } from "react";

export function App() {
  return <div>Hello</div>;
}`,
    newString: `import React, { useState, useEffect } from "react";

export function App() {
  return <div>Hello</div>;
}`,
    language: "typescript",
  },
}

export const MixedChanges: Story = {
  args: {
    oldString: `export function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`,
    newString: `export function calculateTotal(items: Item[]): number {
  return items.reduce((total, item) => total + item.price, 0);
}`,
    language: "typescript",
  },
}

export const LongDiffTruncated: Story = {
  args: {
    oldString: Array.from({ length: 50 }, (_, i) => `const line${i} = ${i};`).join("\n"),
    newString: Array.from({ length: 50 }, (_, i) => `const line${i} = ${i + 100};`).join("\n"),
    language: "typescript",
    isExpanded: false,
  },
}

export const LongDiffExpanded: Story = {
  args: {
    oldString: Array.from({ length: 50 }, (_, i) => `const line${i} = ${i};`).join("\n"),
    newString: Array.from({ length: 50 }, (_, i) => `const line${i} = ${i + 100};`).join("\n"),
    language: "typescript",
    isExpanded: true,
  },
}

export const JSONDiff: Story = {
  args: {
    oldString: `{
  "name": "my-app",
  "version": "1.0.0"
}`,
    newString: `{
  "name": "my-app",
  "version": "1.1.0",
  "description": "My awesome app"
}`,
    language: "json",
  },
}

export const CSSChanges: Story = {
  args: {
    oldString: `.button {
  background: blue;
  color: white;
}`,
    newString: `.button {
  background: linear-gradient(to right, blue, purple);
  color: white;
  border-radius: 4px;
  padding: 8px 16px;
}`,
    language: "css",
  },
}

export const PlainText: Story = {
  args: {
    oldString: `This is the original text.
It has multiple lines.
Some will change.`,
    newString: `This is the modified text.
It has multiple lines.
Some have changed.
And new lines were added.`,
    language: "text",
  },
}

export const NoChanges: Story = {
  args: {
    oldString: `const x = 1;`,
    newString: `const x = 1;`,
    language: "typescript",
  },
}
