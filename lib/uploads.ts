import { ApiError } from "@/lib/library";

// This checks signatures and names, not malware or the contents of archives.
export function validateDocument(name: string, bytes: Uint8Array) {
  if (/[\u0000-\u001f\u007f/\\\u202a-\u202e\u2066-\u2069]/u.test(name))
    throw new ApiError("Use um nome de arquivo sem caminhos ou caracteres de controle.");
  const extension = name.split(".").pop()?.toLowerCase() || "";
  const starts = (prefix: number[]) => prefix.every((byte, i) => bytes[i] === byte);
  const zip = starts([0x50, 0x4b, 3, 4]) || starts([0x50, 0x4b, 5, 6]);
  const ole = starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  let valid = true;
  if (["docx", "pptx", "xlsx", "zip"].includes(extension)) valid = zip;
  else if (["doc", "ppt", "xls"].includes(extension)) valid = ole;
  else if (extension === "pdf") valid = starts([37, 80, 68, 70, 45]);
  else if (extension === "png") valid = starts([137, 80, 78, 71, 13, 10, 26, 10]);
  else if (["jpg", "jpeg"].includes(extension)) valid = starts([255, 216, 255]);
  else if (extension === "webp") valid = starts([82, 73, 70, 70]) && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  else if (["txt", "md", "csv"].includes(extension)) {
    // Keep UTF-8, legacy accented text and BOM-marked UTF-16 usable.
    valid = !starts([77, 90]) && !starts([127, 69, 76, 70]) &&
      (!bytes.includes(0) || starts([255, 254]) || starts([254, 255]));
  }
  if (!valid) throw new ApiError("O conteúdo não corresponde ao formato do arquivo. Envie o arquivo original.");
}
