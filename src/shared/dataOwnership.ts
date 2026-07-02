/** Result of a file-save-backed action (CSV export, DB copy) — null `filePath` means the user canceled the dialog. */
export interface FileSaveResult {
  canceled: boolean
  filePath: string | null
}
