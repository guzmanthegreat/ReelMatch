// Shared title helpers keep identity and category class names consistent.
export const key = (item) => `${item.type}:${item.id}`;

export const titleKey = (item) =>
  (item.title || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");

export function categoryClass(category) {
  // CSS uses lowercase kebab-case names for match category colors.
  return `category-${(category || "").toLowerCase().replaceAll(" ", "-")}`;
}

