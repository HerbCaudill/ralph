import { describe, it, expect } from "vitest"
import { getLanguageFromFilePath } from "./getLanguageFromFilePath"

describe("getLanguageFromFilePath", () => {
  describe("TypeScript and JavaScript", () => {
    it("should detect typescript", () => {
      expect(getLanguageFromFilePath("file.ts")).toBe("typescript")
    })

    it("should detect tsx", () => {
      expect(getLanguageFromFilePath("Component.tsx")).toBe("tsx")
    })

    it("should detect javascript", () => {
      expect(getLanguageFromFilePath("script.js")).toBe("javascript")
    })

    it("should detect jsx", () => {
      expect(getLanguageFromFilePath("Component.jsx")).toBe("jsx")
    })
  })

  describe("markup and styling", () => {
    it("should detect json", () => {
      expect(getLanguageFromFilePath("package.json")).toBe("json")
    })

    it("should detect html", () => {
      expect(getLanguageFromFilePath("index.html")).toBe("html")
    })

    it("should detect css", () => {
      expect(getLanguageFromFilePath("styles.css")).toBe("css")
    })

    it("should detect scss", () => {
      expect(getLanguageFromFilePath("styles.scss")).toBe("css")
    })

    it("should detect less", () => {
      expect(getLanguageFromFilePath("styles.less")).toBe("css")
    })

    it("should detect markdown", () => {
      expect(getLanguageFromFilePath("README.md")).toBe("markdown")
    })
  })

  describe("programming languages", () => {
    it("should detect python", () => {
      expect(getLanguageFromFilePath("script.py")).toBe("python")
    })

    it("should detect rust", () => {
      expect(getLanguageFromFilePath("main.rs")).toBe("rust")
    })

    it("should detect go", () => {
      expect(getLanguageFromFilePath("main.go")).toBe("go")
    })

    it("should detect ruby", () => {
      expect(getLanguageFromFilePath("app.rb")).toBe("ruby")
    })

    it("should detect java", () => {
      expect(getLanguageFromFilePath("Main.java")).toBe("java")
    })

    it("should detect c", () => {
      expect(getLanguageFromFilePath("program.c")).toBe("c")
    })

    it("should detect cpp", () => {
      expect(getLanguageFromFilePath("program.cpp")).toBe("cpp")
    })

    it("should detect c header", () => {
      expect(getLanguageFromFilePath("header.h")).toBe("c")
    })

    it("should detect cpp header", () => {
      expect(getLanguageFromFilePath("header.hpp")).toBe("cpp")
    })
  })

  describe("shell and config", () => {
    it("should detect bash from .sh", () => {
      expect(getLanguageFromFilePath("script.sh")).toBe("bash")
    })

    it("should detect bash from .bash", () => {
      expect(getLanguageFromFilePath("script.bash")).toBe("bash")
    })

    it("should detect bash from .zsh", () => {
      expect(getLanguageFromFilePath("script.zsh")).toBe("bash")
    })

    it("should detect yaml from .yml", () => {
      expect(getLanguageFromFilePath("config.yml")).toBe("yaml")
    })

    it("should detect yaml from .yaml", () => {
      expect(getLanguageFromFilePath("config.yaml")).toBe("yaml")
    })

    it("should detect toml", () => {
      expect(getLanguageFromFilePath("Cargo.toml")).toBe("toml")
    })

    it("should detect xml", () => {
      expect(getLanguageFromFilePath("config.xml")).toBe("xml")
    })
  })

  describe("database and query languages", () => {
    it("should detect sql", () => {
      expect(getLanguageFromFilePath("schema.sql")).toBe("sql")
    })

    it("should detect graphql from .graphql", () => {
      expect(getLanguageFromFilePath("schema.graphql")).toBe("graphql")
    })

    it("should detect graphql from .gql", () => {
      expect(getLanguageFromFilePath("query.gql")).toBe("graphql")
    })
  })

  describe("edge cases", () => {
    it("should handle unknown extension", () => {
      expect(getLanguageFromFilePath("file.xyz")).toBe("text")
    })

    it("should handle file without extension", () => {
      expect(getLanguageFromFilePath("Makefile")).toBe("text")
    })

    it("should handle path with directories", () => {
      expect(getLanguageFromFilePath("/path/to/file.ts")).toBe("typescript")
    })

    it("should handle case insensitivity", () => {
      expect(getLanguageFromFilePath("FILE.TS")).toBe("typescript")
    })

    it("should handle multiple dots in filename", () => {
      expect(getLanguageFromFilePath("file.test.ts")).toBe("typescript")
    })

    it("should handle empty string", () => {
      expect(getLanguageFromFilePath("")).toBe("text")
    })
  })
})
