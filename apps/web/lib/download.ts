/**
 * Save `data` as a JSON file through the browser's download prompt. Nothing leaves the device.
 * `indent` for files a person will read or edit (a mapping); compact for logs and fixtures.
 */
export function downloadJson(filename: string, data: unknown, indent?: number): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, indent)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
