import ExcelJS from "exceljs";
import { isNonEmptyProductName, isValidUrl } from "@/lib/validation";

export interface ParsedProductRow {
  rowNumber: number;
  productName: string;
  representativeSiteUrl: string;
  myStoreUrl: string;
}

export interface RowError {
  rowNumber: number;
  message: string;
}

export interface ParsedProductExcel {
  rows: ParsedProductRow[];
  rowErrors: RowError[];
  fileError: string | null;
}

type FieldKey = "productName" | "representativeSiteUrl" | "myStoreUrl";

const HEADER_LABELS: Record<FieldKey, string> = {
  productName: "상품명",
  representativeSiteUrl: "대표판매사이트 URL",
  myStoreUrl: "내 판매페이지 URL",
};

const HEADER_ALIASES: Record<string, FieldKey> = {
  "상품명": "productName",
  "대표판매사이트url": "representativeSiteUrl",
  "대표판매사이트": "representativeSiteUrl",
  "내판매페이지url": "myStoreUrl",
  "내판매페이지": "myStoreUrl",
  "내스토어url": "myStoreUrl",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text ?? "").trim();
  }
  if (typeof value === "object" && "hyperlink" in (value as Record<string, unknown>)) {
    const obj = value as { text?: unknown; hyperlink?: unknown };
    return String(obj.text ?? obj.hyperlink ?? "").trim();
  }
  return String(value).trim();
}

export async function parseProductExcel(file: File): Promise<ParsedProductExcel> {
  let workbook: ExcelJS.Workbook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      rows: [],
      rowErrors: [],
      fileError: "엑셀 파일을 읽을 수 없습니다. .xlsx 형식의 파일인지 확인해주세요.",
    };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1) {
    return { rows: [], rowErrors: [], fileError: "엑셀 파일에 내용이 없습니다." };
  }

  const headerRow = sheet.getRow(1);
  const columnByField = new Map<FieldKey, number>();
  headerRow.eachCell((cell, colNumber) => {
    const field = HEADER_ALIASES[normalizeHeader(cell.value)];
    if (field && !columnByField.has(field)) {
      columnByField.set(field, colNumber);
    }
  });

  const missingFields = (Object.keys(HEADER_LABELS) as FieldKey[]).filter(
    (field) => !columnByField.has(field)
  );
  if (missingFields.length > 0) {
    const missingLabels = missingFields.map((field) => HEADER_LABELS[field]).join(", ");
    return {
      rows: [],
      rowErrors: [],
      fileError: `엑셀에서 다음 열 제목을 찾을 수 없습니다: ${missingLabels}. 템플릿을 내려받아 헤더 형식을 맞춰주세요.`,
    };
  }

  const rows: ParsedProductRow[] = [];
  const rowErrors: RowError[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const productName = cellToText(row.getCell(columnByField.get("productName")!).value);
    const representativeSiteUrl = cellToText(
      row.getCell(columnByField.get("representativeSiteUrl")!).value
    );
    const myStoreUrl = cellToText(row.getCell(columnByField.get("myStoreUrl")!).value);

    if (!productName && !representativeSiteUrl && !myStoreUrl) {
      continue;
    }

    if (!isNonEmptyProductName(productName)) {
      rowErrors.push({ rowNumber, message: "상품명이 비어 있습니다." });
      continue;
    }
    if (!isValidUrl(representativeSiteUrl)) {
      rowErrors.push({ rowNumber, message: "대표판매사이트 URL 형식이 올바르지 않습니다." });
      continue;
    }
    if (!isValidUrl(myStoreUrl)) {
      rowErrors.push({ rowNumber, message: "내 판매페이지 URL 형식이 올바르지 않습니다." });
      continue;
    }

    rows.push({ rowNumber, productName, representativeSiteUrl, myStoreUrl });
  }

  return { rows, rowErrors, fileError: null };
}

interface ProductRowLike {
  productName: string;
  representativeSiteUrl: string;
  myStoreUrl: string;
}

async function downloadAsProductWorkbook(rows: ProductRowLike[], filename: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("상품목록");
  sheet.columns = [
    { header: HEADER_LABELS.productName, key: "productName", width: 28 },
    { header: HEADER_LABELS.representativeSiteUrl, key: "representativeSiteUrl", width: 48 },
    { header: HEADER_LABELS.myStoreUrl, key: "myStoreUrl", width: 48 },
  ];
  for (const row of rows) {
    sheet.addRow({
      productName: row.productName,
      representativeSiteUrl: row.representativeSiteUrl,
      myStoreUrl: row.myStoreUrl,
    });
  }
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadProductExcelTemplate(): Promise<void> {
  await downloadAsProductWorkbook(
    [
      {
        productName: "제주 한라봉 5kg",
        representativeSiteUrl: "https://example-wholesale.com/product/hallabong",
        myStoreUrl: "https://my-private-store.example.com/hallabong",
      },
    ],
    "상품목록_템플릿.xlsx"
  );
}

export async function downloadProductRowsAsExcel(rows: ProductRowLike[], filename: string): Promise<void> {
  await downloadAsProductWorkbook(rows, filename);
}
