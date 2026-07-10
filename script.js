const header = document.querySelector("[data-menu]");
const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelectorAll(".nav-links a");

if (header && menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("is-open");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      header.classList.remove("is-open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const filterButtons = document.querySelectorAll("[data-filter]");
const articles = document.querySelectorAll("[data-articles] .article-card");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;

    filterButtons.forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    articles.forEach((article) => {
      const shouldShow = filter === "all" || article.dataset.category === filter;
      article.hidden = !shouldShow;
    });
  });
});

const audit = document.querySelector("[data-audit]");

if (audit) {
  const checks = audit.querySelectorAll("[data-check]");
  const score = audit.querySelector("[data-score]");
  const progress = audit.querySelector("[data-progress]");

  const updateScore = () => {
    const completed = Array.from(checks).filter((check) => check.checked).length;
    const percentage = Math.round((completed / checks.length) * 100);

    score.textContent = `${percentage}%`;
    progress.style.width = `${percentage}%`;
  };

  checks.forEach((check) => check.addEventListener("change", updateScore));
  updateScore();
}
