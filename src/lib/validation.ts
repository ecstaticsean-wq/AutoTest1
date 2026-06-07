export function isNonEmptyProductName(name: string): boolean {
  return name.trim().length > 0;
}

export function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validateGenerateInput(body: {
  productName?: unknown;
  representativeSiteUrl?: unknown;
  myStoreUrl?: unknown;
}): string | null {
  if (typeof body.productName !== "string" || !isNonEmptyProductName(body.productName)) {
    return "상품명을 입력해주세요.";
  }
  if (typeof body.representativeSiteUrl !== "string" || !isValidUrl(body.representativeSiteUrl)) {
    return "대표판매사이트 URL이 올바른 형식이 아닙니다.";
  }
  if (typeof body.myStoreUrl !== "string" || !isValidUrl(body.myStoreUrl)) {
    return "내 판매페이지 URL이 올바른 형식이 아닙니다.";
  }
  return null;
}
