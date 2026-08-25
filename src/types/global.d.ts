/**
 * Global type declarations
 */

declare global {
  interface Window {
    openBugReportModal?: (
      title: string,
      description: string,
      reportType: "bug" | "content" | "suggestion",
      targetId?: string
    ) => Promise<boolean>
  }
}

export {}
