// Builds a unique ID so movies and TV shows with the same TMDB ID stay separate.
export function key(item) {
  return `${item.type}:${item.id}`;
}

// Makes title names comparable when checking for duplicates.
export function titleKey(item) {
  let title = item.title;
  if (!title) {
    title = "";
  }

  title = title.trim();
  title = title.toLocaleLowerCase();
  title = title.replace(/\s+/g, " ");
  return title;
}

// Builds the CSS class used to color a match category.
export function categoryClass(category) {
  let categoryName = category;
  if (!categoryName) {
    categoryName = "";
  }

  categoryName = categoryName.toLowerCase();
  categoryName = categoryName.replace(/ /g, "-");
  return `category-${categoryName}`;
}

