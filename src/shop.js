import "./styles.css";

const categories = [
  "Smartphones",
  "Laptops",
  "Tablets",
  "Earbuds",
  "Smartwatches",
  "Cameras",
  "TVs",
  "Accessories",
];

const productSlots = categories.map((category) => ({
  category,
  title: `${category} slot`,
  price: "Verified price pending",
  verdict: "Verdict pending verified Prasad recommendation.",
  affiliateUrl: "#",
  specs: ["Spec pending", "Spec pending", "Spec pending"],
}));

const categoryRoot = document.querySelector("#shopCategories");
const productRoot = document.querySelector("#shopProducts");

if (categoryRoot) {
  categoryRoot.innerHTML = categories.map((category) => `<button type="button">${category}</button>`).join("");
}

if (productRoot) {
  productRoot.innerHTML = productSlots
    .map(
      (product) => `
        <article class="shop-card">
          <div class="shop-card__image">
            <img src="/assets/prasad-tech-logo.jpeg" alt="" loading="lazy" />
            <span>${product.category}</span>
          </div>
          <div class="shop-card__content">
            <h2>${product.title}</h2>
            <p class="shop-card__price">${product.price}</p>
            <ul>
              ${product.specs.map((spec) => `<li>${spec}</li>`).join("")}
            </ul>
            <p>${product.verdict}</p>
          </div>
          <div class="shop-card__actions">
            <button type="button">Compare</button>
            <a href="${product.affiliateUrl}">Check Price</a>
          </div>
        </article>
      `,
    )
    .join("");
}
